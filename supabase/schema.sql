create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.users (
  id text primary key,
  name text not null,
  public_slug text unique,
  created_at timestamptz not null default now()
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  elevenlabs_conversation_id text unique,
  user_id text not null references public.users(id) on delete cascade,
  mode text not null check (mode in ('learning', 'socialization')),
  visitor_id text,
  transcript jsonb not null default '[]'::jsonb,
  raw_payload jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  category text not null,
  title text not null,
  content text not null,
  source_conversation_id uuid references public.conversations(id) on delete set null,
  confidence numeric(4, 3) not null default 0.5,
  visibility text not null default 'private' check (visibility in ('private', 'public', 'restricted')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.memory_profiles (
  user_id text primary key references public.users(id) on delete cascade,
  public_context text not null default '',
  private_context text not null default '',
  values_summary text not null default '',
  career_summary text not null default '',
  project_summary text not null default '',
  management_philosophy text not null default '',
  personal_story_summary text not null default '',
  updated_at timestamptz not null default now()
);

create index if not exists conversations_user_id_created_at_idx
on public.conversations (user_id, created_at desc);

create index if not exists conversations_elevenlabs_conversation_id_idx
on public.conversations (elevenlabs_conversation_id);

create index if not exists memories_user_id_status_visibility_idx
on public.memories (user_id, status, visibility);

create index if not exists memories_source_conversation_id_idx
on public.memories (source_conversation_id);

drop trigger if exists memories_set_updated_at on public.memories;
create trigger memories_set_updated_at
before update on public.memories
for each row
execute function public.set_updated_at();

drop trigger if exists memory_profiles_set_updated_at on public.memory_profiles;
create trigger memory_profiles_set_updated_at
before update on public.memory_profiles
for each row
execute function public.set_updated_at();

alter table public.users enable row level security;
alter table public.conversations enable row level security;
alter table public.memories enable row level security;
alter table public.memory_profiles enable row level security;

insert into public.users (id, name, public_slug)
values ('martin', 'Martin', 'martin')
on conflict (id) do nothing;

insert into public.memory_profiles (user_id)
values ('martin')
on conflict (user_id) do nothing;
