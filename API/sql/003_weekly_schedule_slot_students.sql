create table if not exists public.weekly_schedule_slot_students (
  slot_id uuid not null references public.weekly_schedule_slots(id) on delete cascade,
  student_enrollment_id uuid not null references public.student_enrollments(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (slot_id, student_enrollment_id)
);

create index if not exists idx_weekly_schedule_slot_students_slot
on public.weekly_schedule_slot_students(slot_id);

create index if not exists idx_weekly_schedule_slot_students_student
on public.weekly_schedule_slot_students(student_enrollment_id);
