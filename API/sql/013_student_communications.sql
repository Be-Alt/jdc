do $$
begin
  if to_regclass('public.student_communications') is not null
     and to_regclass('public.student_teacher_communications') is null then
    alter table public.student_communications rename to student_teacher_communications;
  end if;
end $$;

create table if not exists public.student_teacher_communications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  student_enrollment_id uuid not null references public.student_enrollments(id) on delete cascade,
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  direction text not null check (direction in ('outgoing', 'incoming', 'note')),
  contact_name text,
  contact_email text,
  subject text,
  content text not null,
  occurred_on date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

delete from public.student_teacher_communications
where teacher_id is null;

alter table public.student_teacher_communications
alter column teacher_id set not null;

alter table public.student_teacher_communications
drop constraint if exists student_communications_teacher_id_fkey;

alter table public.student_teacher_communications
drop constraint if exists student_teacher_communications_teacher_id_fkey;

alter table public.student_teacher_communications
add constraint student_teacher_communications_teacher_id_fkey
foreign key (teacher_id) references public.teachers(id) on delete cascade;

create index if not exists idx_student_teacher_communications_student
on public.student_teacher_communications(owner_id, student_enrollment_id, occurred_on desc);

do $$
begin
  if to_regclass('public.student_communication_reminders') is not null
     and to_regclass('public.student_teacher_communication_reminders') is null then
    alter table public.student_communication_reminders rename to student_teacher_communication_reminders;
  end if;
end $$;

create table if not exists public.student_teacher_communication_reminders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  student_enrollment_id uuid not null references public.student_enrollments(id) on delete cascade,
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  title text not null,
  notes text,
  due_date date not null,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

delete from public.student_teacher_communication_reminders
where teacher_id is null;

alter table public.student_teacher_communication_reminders
alter column teacher_id set not null;

alter table public.student_teacher_communication_reminders
drop constraint if exists student_communication_reminders_teacher_id_fkey;

alter table public.student_teacher_communication_reminders
drop constraint if exists student_teacher_communication_reminders_teacher_id_fkey;

alter table public.student_teacher_communication_reminders
add constraint student_teacher_communication_reminders_teacher_id_fkey
foreign key (teacher_id) references public.teachers(id) on delete cascade;

create index if not exists idx_student_teacher_communication_reminders_due
on public.student_teacher_communication_reminders(owner_id, completed_at, due_date);
