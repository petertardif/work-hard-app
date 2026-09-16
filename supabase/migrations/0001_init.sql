-- Work Hard — initial schema.
--
-- Apply by hand in the Supabase SQL editor (same workflow as One Stop on Neon).
--
-- Design notes:
--   * `runs` holds a SNAPSHOT of its list's name and tasks. Editing a list
--     later must never rewrite the history of a run that used it.
--   * `completions` is keyed on (run_id, on_date, task_id) so an offline write
--     replayed twice is a harmless upsert. No dedup logic anywhere.
--   * Progress is stored as calendar dates. The day number is always derived.

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  timezone    text not null default 'America/Detroit',
  day_ends_at time not null default '00:00',
  glyph       text not null default 'ant' check (glyph in ('ant','pickaxe','sledge','square')),
  reminder_at time,                    -- null = reminders off
  created_at  timestamptz not null default now()
);

-- Every new auth user gets a profile row automatically.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- lists + tasks
-- ---------------------------------------------------------------------------

create table if not exists public.lists (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  name        text not null check (length(trim(name)) between 1 and 80),
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists lists_user_idx on public.lists (user_id, archived_at);

create table if not exists public.list_tasks (
  id       uuid primary key default gen_random_uuid(),
  list_id  uuid not null references public.lists on delete cascade,
  position int  not null check (position >= 0),
  name     text not null check (length(trim(name)) between 1 and 120)
);

create index if not exists list_tasks_list_idx on public.list_tasks (list_id, position);

-- Cap of 25 tasks per list, enforced server-side as well as in the client.
create or replace function public.enforce_task_cap()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (select count(*) from public.list_tasks where list_id = new.list_id) > 25 then
    raise exception 'A list may hold at most 25 tasks';
  end if;
  return null;
end;
$$;

drop trigger if exists list_tasks_cap on public.list_tasks;
create constraint trigger list_tasks_cap
  after insert on public.list_tasks
  deferrable initially deferred
  for each row execute function public.enforce_task_cap();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists lists_touch on public.lists;
create trigger lists_touch
  before update on public.lists
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- runs + completions
-- ---------------------------------------------------------------------------

create table if not exists public.runs (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users on delete cascade,
  list_id        uuid not null references public.lists on delete cascade,
  list_name      text not null,                      -- snapshot
  tasks          jsonb not null,                     -- snapshot [{id,name,position}]
  duration_days  int  not null check (duration_days between 1 and 365),
  timezone       text not null,
  day_ends_at    time not null default '00:00',
  start_date     date not null,
  status         text not null default 'active'
                 check (status in ('active','failed','completed')),
  ended_on       date,
  failure_reason text,
  created_at     timestamptz not null default now(),
  constraint runs_tasks_non_empty check (jsonb_array_length(tasks) > 0)
);

create index if not exists runs_user_idx on public.runs (user_id, status);
create index if not exists runs_list_idx on public.runs (list_id);

-- At most one active run per user. This is the "only one list can be active"
-- rule from the design, enforced where it cannot be raced.
create unique index if not exists runs_one_active
  on public.runs (user_id) where status = 'active';

create table if not exists public.completions (
  run_id       uuid not null references public.runs on delete cascade,
  on_date      date not null,
  task_id      uuid not null,
  completed_at timestamptz not null default now(),
  primary key (run_id, on_date, task_id)
);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles    enable row level security;
alter table public.lists       enable row level security;
alter table public.list_tasks  enable row level security;
alter table public.runs        enable row level security;
alter table public.completions enable row level security;

create policy profiles_own on public.profiles
  for all using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy lists_own on public.lists
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy list_tasks_own on public.list_tasks
  for all
  using (exists (
    select 1 from public.lists l
    where l.id = list_tasks.list_id and l.user_id = (select auth.uid())))
  with check (exists (
    select 1 from public.lists l
    where l.id = list_tasks.list_id and l.user_id = (select auth.uid())));

create policy runs_own on public.runs
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy completions_own on public.completions
  for all
  using (exists (
    select 1 from public.runs r
    where r.id = completions.run_id and r.user_id = (select auth.uid())))
  with check (exists (
    select 1 from public.runs r
    where r.id = completions.run_id and r.user_id = (select auth.uid())));

-- ---------------------------------------------------------------------------
-- Server time + adjudication
-- ---------------------------------------------------------------------------

-- The client uses this to detect a tampered device clock: it compares the
-- value against its own Date.now() and keeps the offset.
create or replace function public.server_now()
returns timestamptz
language sql
stable
as $$ select now(); $$;

-- Mirrors `adjudicate()` in src/lib/run-logic.ts. This is the authority; the
-- TypeScript copy only renders an optimistic result while offline.
--
-- Walks every fully-elapsed day of each active run. The first day missing a
-- task kills the run, dated to THAT day — which is what makes "skip Tuesday,
-- open the app on Friday" report a Tuesday failure.
create or replace function public.adjudicate_runs()
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  r           record;
  today       date;
  final_day   date;
  scan_until  date;
  d           date;
  task_count  int;
  done_count  int;
  failed_on   date;
begin
  for r in
    select * from public.runs
    where user_id = (select auth.uid()) and status = 'active'
  loop
    -- The run's own logical "today", in its captured timezone, shifted back by
    -- its rollover time so a 3am day-end puts 1am on the previous day.
    today     := ((now() at time zone r.timezone) - r.day_ends_at::interval)::date;
    final_day := r.start_date + (r.duration_days - 1);

    -- A clock rolled back before the start date leaves the run untouched
    -- rather than failing it spuriously.
    if today < r.start_date then
      continue;
    end if;

    -- Only days that have fully ended can fail a run; today is still in play.
    scan_until := least(today - 1, final_day);
    task_count := jsonb_array_length(r.tasks);
    failed_on  := null;

    d := r.start_date;
    while d <= scan_until loop
      select count(*) into done_count
      from public.completions c
      where c.run_id = r.id
        and c.on_date = d
        and c.task_id in (
          select (t ->> 'id')::uuid from jsonb_array_elements(r.tasks) t
        );

      if done_count < task_count then
        failed_on := d;
        exit;
      end if;

      d := d + 1;
    end loop;

    if failed_on is not null then
      update public.runs
        set status         = 'failed',
            ended_on       = failed_on,
            failure_reason = 'Day ' || (failed_on - r.start_date + 1)
                             || ' ended with tasks unchecked.'
        where id = r.id;
      continue;
    end if;

    -- Survived every elapsed day. Did it survive the whole run?
    if today > final_day then
      update public.runs set status = 'completed', ended_on = final_day where id = r.id;
    elsif today = final_day then
      select count(*) into done_count
      from public.completions c
      where c.run_id = r.id
        and c.on_date = today
        and c.task_id in (
          select (t ->> 'id')::uuid from jsonb_array_elements(r.tasks) t
        );

      if done_count >= task_count then
        update public.runs set status = 'completed', ended_on = final_day where id = r.id;
      end if;
    end if;
  end loop;
end;
$$;
