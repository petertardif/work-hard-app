-- Work Hard — in-app account deletion.
--
-- Apply by hand in the Supabase SQL editor, after 0002.
--
-- Required by App Store Review Guideline 5.1.1(v): "If your app supports
-- account creation, you must also offer account deletion within the app."
-- Pointing users at a support email is the pattern Apple rejects.
--
-- No new cascade rules are needed. `profiles`, `lists`, `runs` and `quotes` all
-- already declare `on delete cascade` against auth.users, and `list_tasks` and
-- `completions` cascade through their parents, so removing the auth row removes
-- everything the account ever wrote.

create or replace function public.delete_my_account()
returns void
language plpgsql
-- security definer is what allows reaching into the auth schema; the guard
-- below is what stops it ever touching anyone else's row.
security definer
set search_path = public
as $$
declare
  caller uuid := (select auth.uid());
begin
  if caller is null then
    raise exception 'Not signed in';
  end if;

  delete from auth.users where id = caller;
end;
$$;

-- Callable only by a signed-in user, never anonymously.
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
