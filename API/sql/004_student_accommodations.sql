create table if not exists public.student_accommodations (
  student_id uuid not null references public.persons(id) on delete cascade,
  accommodation_id int not null references public.accommodations(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (student_id, accommodation_id)
);

create index if not exists idx_student_accommodations_student
on public.student_accommodations(student_id);

create index if not exists idx_student_accommodations_accommodation
on public.student_accommodations(accommodation_id);
