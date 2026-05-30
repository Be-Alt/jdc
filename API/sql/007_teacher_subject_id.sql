alter table public.teachers
add column if not exists subject_id uuid references public.subjects(id) on delete set null;

insert into public.subjects (name)
select distinct trim(subject)
from public.teachers
where subject is not null
  and trim(subject) <> ''
on conflict (name) do nothing;

update public.teachers teacher
set subject_id = subject.id
from public.subjects subject
where teacher.subject_id is null
  and teacher.subject is not null
  and lower(trim(teacher.subject)) = lower(subject.name);
