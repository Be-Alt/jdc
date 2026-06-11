alter table public.student_enrollments
add column if not exists program_id uuid references public.programs(id) on delete set null;

create index if not exists idx_student_enrollments_program
on public.student_enrollments(program_id);
