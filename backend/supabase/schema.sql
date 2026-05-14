create extension if not exists pgcrypto;

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  password_hash text not null default '',
  auth_provider text not null default 'email',
  provider_id text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists app_users_provider_idx
  on public.app_users (auth_provider, provider_id);

create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  preview text not null default 'Chat',
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chats_user_updated_idx
  on public.chats (user_id, updated_at desc);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_app_users_updated_at on public.app_users;
create trigger set_app_users_updated_at
before update on public.app_users
for each row execute function public.set_updated_at();

drop trigger if exists set_chats_updated_at on public.chats;
create trigger set_chats_updated_at
before update on public.chats
for each row execute function public.set_updated_at();

alter table public.app_users enable row level security;
alter table public.chats enable row level security;

drop policy if exists "service role full access app_users" on public.app_users;
create policy "service role full access app_users"
on public.app_users
for all
to service_role
using (true)
with check (true);

drop policy if exists "service role full access chats" on public.chats;
create policy "service role full access chats"
on public.chats
for all
to service_role
using (true)
with check (true);
