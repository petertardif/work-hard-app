-- Work Hard — the daily quote, with a user-owned library.
--
-- Apply by hand in the Supabase SQL editor, after 0001_init.sql.
--
-- Quotes are owned per user: everyone gets their own copy of the starter set at
-- signup and can then add, edit and delete freely. One tier means every row in
-- Quote management behaves identically, with no read-only exceptions.

-- ---------------------------------------------------------------------------
-- The starter set
-- ---------------------------------------------------------------------------

-- A template, not a live table. It exists so the list is defined once and read
-- by both the signup trigger and the backfill at the bottom. The client never
-- touches it: RLS is on with no policies, which denies everything, while the
-- security-definer trigger can still read it.
create table if not exists public.quote_seeds (
  id       uuid primary key default gen_random_uuid(),
  position int  not null,
  text     text not null,
  author   text
);

alter table public.quote_seeds enable row level security;

insert into public.quote_seeds (position, text, author)
select * from (values
  (1, 'Change is inevitable. The only constant is impermanence.', 'Howard Marks'),
  (2, 'What others think about you is none of your business.', 'Venus Williams'),
  (3, 'The brave do not live forever, but the cautious do not live at all', 'Sir Richard Branson'),
  (4, '…almost everyone expects the future to be a slightly modified version of the present, it is almost always, very different.', 'Ray Dalio'),
  (5, 'even if you feel terrible for a while that’s not how you’re going to feel the whole time. Things change if you just keep moving.', 'Gary Vaynerchuk'),
  (6, 'Clutch is about the last minute. Relentless is about every minute.', 'Tim Grover'),
  (7, 'Imposter syndrome says ‘I don’t know what I’m doing. It’s only a matter of time before everyone finds out.’ Growth mindset says ‘I don’t know what I’m doing yet. It’s only a matter of time before I figure it out.’', 'Adam Grant'),
  (8, 'Life cannot be merely about solving problems. It also has to be about pursuing great dreams. That’s what can get us up in the morning.', 'Elon Musk'),
  (9, 'Don’t ever pre-judge who can, and cannot make an impact in your life. Even the most unlikely of people can turn out to be instrumental in your journey. Maybe the villain in your story it’s just the antihero in disguise...', 'Cameron Hanes'),
  (10, 'Only take the advice from people who have what I want.', 'Austin Belcak'),
  (11, 'The most effective way to change your habits it’s not focus on what you want to achieve but who you wish to become. Your identity Emerges out of your actions. Every action is a vote for the type of person you wish to become.', 'James Clear'),
  (12, 'As long as you are alive you will live to accomplish your own goals and dreams or you will be used as a resource to help somebody else accomplish their goals and dreams.', 'Grant Cardone'),
  (13, 'Success is the result of relentless proper actions persisted over time.', 'Andy Frisella'),
  (14, 'Success is a state. It is a constant or state in which you have complete control over. You either create success or you don’t it’s not for whiners it’s not for crybabies it is not for victims', 'Andy Frisella'),
  (15, 'Learn. Grow. And come get your spot.', null),
  (16, '‘What would you have accomplished free?’ said Edmond. ‘Possibly nothing at all... Pressure is required, you know, to ignite powder...’', 'Alexandre Dumas'),
  (17, 'Work is endless. Exercise is endless. Parenting is endless. Same with marriage, writing, investing, creating, and more. You get to choose the parts of your life, but many of the important things in life cannot be ‘finished.’', 'James Clear'),
  (18, 'Do not approach an endless game with a finite mindset. The objective is not to be done, but to settle into a daily lifestyle you can sustain and that allows you to make daily progress on the areas that matter.', 'James Clear'),
  (19, 'Embrace the fact that life is continual and look for ways to enjoy the daily practice.', 'James Clear')
) as seed(position, text, author)
-- Idempotent: re-running the migration will not duplicate the template.
where not exists (select 1 from public.quote_seeds);

-- ---------------------------------------------------------------------------
-- The user's library
-- ---------------------------------------------------------------------------

create table if not exists public.quotes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  text       text not null check (length(trim(text)) between 1 and 300),
  -- Nullable: proverbs and anything unsourced get no attribution row.
  author     text check (author is null or length(trim(author)) <= 120),
  created_at timestamptz not null default now()
);

create index if not exists quotes_user_idx on public.quotes (user_id, created_at desc);

alter table public.quotes enable row level security;

drop policy if exists quotes_own on public.quotes;
create policy quotes_own on public.quotes
  for all using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- The per-user switch
-- ---------------------------------------------------------------------------

-- `profiles_own` in 0001 is `for all`, so it already covers this column.
alter table public.profiles
  add column if not exists show_daily_quote boolean not null default true;

-- ---------------------------------------------------------------------------
-- Give every account a library
-- ---------------------------------------------------------------------------

-- Extends 0001's trigger: a new account now gets a profile *and* its own copy
-- of the starter quotes.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;

  insert into public.quotes (user_id, text, author)
  select new.id, s.text, s.author
  from public.quote_seeds s
  order by s.position;

  return new;
end;
$$;

-- The trigger only fires for new signups, so accounts that already exist would
-- otherwise end up with an empty library.
insert into public.quotes (user_id, text, author)
select u.id, s.text, s.author
from auth.users u
cross join public.quote_seeds s
where not exists (
  select 1 from public.quotes q where q.user_id = u.id
)
order by u.id, s.position;
