create table if not exists public.student_competency_assessments (
  owner_id uuid not null,
  student_enrollment_id uuid not null references public.student_enrollments(id) on delete cascade,
  program_id uuid not null references public.programs(id) on delete cascade,
  item_type text not null check (item_type in ('skill', 'competence', 'resource')),
  item_id uuid not null,
  status text not null check (status in ('not_acquired', 'in_progress', 'acquired', 'viewed', 'not_viewed')),
  updated_at timestamptz not null default now(),
  primary key (owner_id, student_enrollment_id, program_id, item_type, item_id)
);

create index if not exists idx_student_competency_assessments_student
on public.student_competency_assessments(owner_id, student_enrollment_id, program_id);

alter table public.student_competency_assessments
drop constraint if exists student_competency_assessments_item_type_check;

alter table public.student_competency_assessments
add constraint student_competency_assessments_item_type_check
check (item_type in ('skill', 'competence', 'resource'));

alter table public.student_competency_assessments
drop constraint if exists student_competency_assessments_status_check;

alter table public.student_competency_assessments
add constraint student_competency_assessments_status_check
check (status in ('not_acquired', 'in_progress', 'acquired', 'viewed', 'not_viewed'));
