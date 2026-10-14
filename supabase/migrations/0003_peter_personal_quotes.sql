-- Work Hard — personal quotes for one account.
--
-- Apply by hand in the Supabase SQL editor, AFTER 0002 (it inserts into the
-- table 0002 creates).
--
-- These four carry strong language, so they are kept out of the seed every new
-- account receives — that seed drives the App Store age rating, and shipping
-- them by default would push it to 17+. They belong to one library instead.
--
-- Anyone else can of course add whatever they like through Quote management;
-- their own library is their own business.

insert into public.quotes (user_id, text, author)
select u.id, q.text, q.author
from auth.users u
cross join (values
  ('…every day is an opportunity. You worked to get here. Now don’t stop until you’re insanely fucking proud of yourself.', 'Gary Vaynerchuk'),
  ('Know what you do and do it. Leon Spinks, when asked what he does for a living: ‘I knock motherfuckers out.’', 'Tim Grover'),
  ('Nothing happens to you it happens because of you and don’t be a little bitch.', 'Andy Frisella'),
  ('When you don’t give a fuck about what other people think, you become fundamentally unbeatable.', 'Gary Vaynerchuk')
) as q(text, author)
where u.email = 'peter.tardif@gmail.com'
  -- Idempotent, and a no-op on every other account.
  and not exists (
    select 1 from public.quotes existing
    where existing.user_id = u.id and existing.text = q.text
  );
