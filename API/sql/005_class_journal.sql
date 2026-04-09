create table if not exists public.class_journal_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  entry_date date not null,
  weekly_schedule_slot_id uuid references public.weekly_schedule_slots(id) on delete set null,
  slot_key text not null,
  title text not null,
  starts_at time not null,
  ends_at time not null,
  section_id uuid references public.sections(id) on delete set null,
  network_id uuid references public.networks(id) on delete set null,
  notes text not null default '',
  teacher_is_absent boolean not null default false,
  teacher_absence_has_cm boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, entry_date, slot_key),
  check (starts_at < ends_at)
);

create table if not exists public.class_journal_entry_skills (
  entry_id uuid not null references public.class_journal_entries(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (entry_id, skill_id)
);

create table if not exists public.class_journal_entry_resources (
  entry_id uuid not null references public.class_journal_entries(id) on delete cascade,
  resource_id uuid not null references public.resources(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (entry_id, resource_id)
);

create table if not exists public.class_journal_entry_students (
  entry_id uuid not null references public.class_journal_entries(id) on delete cascade,
  student_enrollment_id uuid not null references public.student_enrollments(id) on delete cascade,
  attendance_status text not null check (attendance_status in ('present', 'absent', 'late', 'excused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (entry_id, student_enrollment_id)
);

alter table public.class_journal_entries
  add column if not exists teacher_is_absent boolean not null default false;

alter table public.class_journal_entries
  add column if not exists teacher_absence_has_cm boolean not null default false;

create or replace function public.set_class_journal_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists class_journal_entries_set_updated_at on public.class_journal_entries;

create trigger class_journal_entries_set_updated_at
before update on public.class_journal_entries
for each row
execute function public.set_class_journal_updated_at();

create index if not exists idx_class_journal_entries_owner_date
on public.class_journal_entries(owner_id, entry_date);

create index if not exists idx_class_journal_entries_slot
on public.class_journal_entries(weekly_schedule_slot_id);

create index if not exists idx_class_journal_entry_students_enrollment
on public.class_journal_entry_students(student_enrollment_id);
