begin;

create table if not exists public.tournament (
  id integer primary key check (id = 1),
  state jsonb not null check (jsonb_typeof(state) = 'object'),
  revision integer not null default 0 check (revision >= 0)
);

create schema if not exists tournament_private;
revoke all on schema tournament_private from public, anon, authenticated;

-- The singleton row restricts editing to one Supabase Auth account.
create table if not exists tournament_private.admin (
  singleton boolean primary key default true check (singleton),
  user_id uuid not null references auth.users(id) on delete cascade
);
alter table tournament_private.admin enable row level security;
revoke all on tournament_private.admin from public, anon, authenticated;

create or replace function public.is_tournament_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from tournament_private.admin where user_id = (select auth.uid())
  );
$$;
revoke all on function public.is_tournament_admin() from public, anon, authenticated;
grant execute on function public.is_tournament_admin() to authenticated;

insert into public.tournament (id, state)
values (1, '{
  "players": [],
  "matches": {},
  "cups": ["Mushroom Cup", "Flower Cup", "Star Cup", "Special Cup", "Shell Cup", "Banana Cup", "Leaf Cup", "Lightning Cup"],
  "picked": []
}')
on conflict (id) do nothing;

alter table public.tournament enable row level security;
revoke all on public.tournament from public, anon, authenticated;
grant select on public.tournament to anon, authenticated;
grant update (state, revision) on public.tournament to authenticated;

drop policy if exists "Tournament is public" on public.tournament;
create policy "Tournament is public"
on public.tournament for select to anon, authenticated
using (true);

drop policy if exists "Designated admin can score" on public.tournament;
create policy "Designated admin can score"
on public.tournament for update to authenticated
using ((select public.is_tournament_admin()))
with check ((select public.is_tournament_admin()));

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tournament'
  ) then
    alter publication supabase_realtime add table public.tournament;
  end if;
end;
$$;

commit;

-- Run this separately once you have created your user in Authentication > Users.
-- insert into tournament_private.admin (user_id)
-- values ('YOUR-AUTH-USER-UUID')
-- on conflict (singleton) do update set user_id = excluded.user_id;
