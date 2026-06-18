alter table public.weekly_schedule_slots
add column if not exists subject_id uuid references public.subjects(id) on delete set null;

create index if not exists idx_weekly_schedule_slots_subject
on public.weekly_schedule_slots(subject_id);
