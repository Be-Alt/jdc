create table if not exists public.weekly_schedule_configs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  organization_id uuid references public.organizations(id) on delete set null,
  is_shared_with_org boolean not null default false,
  label text not null,
  valid_from date not null,
  valid_to date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    is_shared_with_org = false
    or organization_id is not null
  )
);

create table if not exists public.weekly_schedule_slots (
  id uuid primary key default gen_random_uuid(),
  config_id uuid not null references public.weekly_schedule_configs(id) on delete cascade,
  day_of_week integer not null check (day_of_week between 1 and 7),
  slot_type text not null check (slot_type in ('course', 'break', 'lunch')),
  label text not null,
  starts_at time not null,
  ends_at time not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  check (starts_at < ends_at)
);

create or replace function public.set_weekly_schedule_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists weekly_schedule_configs_set_updated_at on public.weekly_schedule_configs;

create trigger weekly_schedule_configs_set_updated_at
before update on public.weekly_schedule_configs
for each row
execute function public.set_weekly_schedule_updated_at();

create index if not exists idx_weekly_schedule_configs_owner
on public.weekly_schedule_configs(owner_id);

create index if not exists idx_weekly_schedule_configs_org
on public.weekly_schedule_configs(organization_id);

create index if not exists idx_weekly_schedule_slots_config
on public.weekly_schedule_slots(config_id, day_of_week, position);
