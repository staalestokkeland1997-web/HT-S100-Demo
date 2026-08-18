-- Lagring for HT-kiosken (highscores, admininnstillinger, ECDIS-tilstand).
-- Kjor denne een gang i Supabase SQL Editor (eller via supabase db push).
--
-- RLS er PAA uten policies: bare service role-nokkelen (server-side i Vercel)
-- naar tabellene. Ikke lag anon-policies her - da kan hvem som helst lese/
-- skrive highscores og innstillinger via det offentlige REST-endepunktet.

create table if not exists public.htkiosk_kv (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.htkiosk_entries (
  id bigint generated always as identity primary key,
  entry jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.htkiosk_kv enable row level security;
alter table public.htkiosk_entries enable row level security;
