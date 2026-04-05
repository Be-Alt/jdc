create table if not exists public.allowed_email_domains (
  domain text primary key,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.allowed_email_domains is
  'Liste blanche des domaines email autorises pour l application.';

create table if not exists public.profiles (
  user_id text primary key,
  email text not null unique,
  full_name text,
  role text not null default 'user' check (role in ('admin', 'user', 'student')),
  auth_provider text not null default 'google',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Profils applicatifs relies aux utilisateurs Neon Auth via neon_auth."user".id.';

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

insert into public.allowed_email_domains (domain)
values ('lmottet.be')
on conflict (domain) do nothing;

create table if not exists public.admin_test_data (
  id bigserial primary key,
  title text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.user_test_data (
  id bigserial primary key,
  title text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.student_test_data (
  id bigserial primary key,
  title text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.rate_limit_counters (
  scope text not null,
  key_value text not null,
  bucket_start timestamptz not null,
  hit_count integer not null default 1,
  updated_at timestamptz not null default now(),
  primary key (scope, key_value, bucket_start)
);

comment on table public.rate_limit_counters is
  'Compteurs de rate limiting partages entre les instances serverless.';

insert into public.admin_test_data (title, content)
values ('Admin secret', 'Donnees de test reservees aux administrateurs.')
on conflict do nothing;

insert into public.user_test_data (title, content)
values ('User area', 'Donnees de test accessibles aux utilisateurs standards.')
on conflict do nothing;

insert into public.student_test_data (title, content)
values ('Student content', 'Donnees de test accessibles aux etudiants.')
on conflict do nothing;
