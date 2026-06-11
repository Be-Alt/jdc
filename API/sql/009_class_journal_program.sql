alter table public.class_session_students
add column if not exists program_id uuid references public.programs(id) on delete set null;

create index if not exists idx_class_session_students_program
on public.class_session_students(program_id);
