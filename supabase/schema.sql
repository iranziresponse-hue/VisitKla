-- VisitKla MVP schema — Zone 1 only (Makerere, Wandegeya, Mulago, Town)
-- Run this once in the Supabase SQL editor, then run seed.sql.

create extension if not exists pgcrypto;

create table if not exists routes (
  id text primary key,
  start_name text not null,
  end_name text not null,
  steps_json jsonb not null,
  boda_price_min int not null,
  boda_price_max int not null,
  panya_tip text
);

create table if not exists landmarks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  alias text[] default '{}',
  lat double precision not null,
  lng double precision not null,
  photo_url text,
  type text
);

create index if not exists landmarks_name_idx on landmarks (name);
create index if not exists routes_start_end_idx on routes (start_name, end_name);

-- Free-tier Supabase projects have RLS-friendly defaults; the app only ever
-- reads these two tables anonymously, so allow public read access.
alter table routes enable row level security;
alter table landmarks enable row level security;

drop policy if exists "Public read access" on routes;
create policy "Public read access" on routes for select using (true);

drop policy if exists "Public read access" on landmarks;
create policy "Public read access" on landmarks for select using (true);
