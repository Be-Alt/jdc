create table if not exists public.school_holidays (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  title text not null,
  starts_on date not null,
  ends_on date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_on <= ends_on)
);

create or replace function public.set_school_holidays_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists school_holidays_set_updated_at on public.school_holidays;

create trigger school_holidays_set_updated_at
before update on public.school_holidays
for each row
execute function public.set_school_holidays_updated_at();

create index if not exists idx_school_holidays_owner_dates
on public.school_holidays(owner_id, starts_on, ends_on);
