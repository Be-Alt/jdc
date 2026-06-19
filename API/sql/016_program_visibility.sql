alter table public.programs
add column if not exists owner_id uuid;

alter table public.programs
add column if not exists is_shared boolean not null default false;

update public.programs
set is_shared = true
where owner_id is null;

alter table public.programs
drop constraint if exists programs_subject_id_section_id_network_id_hours_key;

create unique index if not exists uq_shared_program_definition
on public.programs(subject_id, section_id, network_id, hours)
where is_shared = true;

drop index if exists public.uq_personal_program_definition;

create unique index uq_personal_program_definition
on public.programs(
  owner_id,
  subject_id,
  coalesce(section_id, '00000000-0000-0000-0000-000000000000'::uuid),
  network_id,
  hours
)
where is_shared = false;

alter table public.programs
drop constraint if exists programs_personal_owner_check;

alter table public.programs
add constraint programs_personal_owner_check
check (
  (is_shared = true and section_id is not null)
  or (is_shared = false and owner_id is not null)
);

create index if not exists idx_programs_visibility
on public.programs(is_shared, owner_id);
