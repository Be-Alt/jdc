alter table public.profiles
drop constraint if exists profiles_role_check;

update public.profiles
set role = case
  when role = 'admin' then 'super_admin'
  else 'teacher'
end
where role not in ('super_admin', 'program_admin', 'direction_admin', 'teacher');

alter table public.profiles
alter column role set default 'teacher';

alter table public.profiles
add constraint profiles_role_check
check (role in ('super_admin', 'program_admin', 'direction_admin', 'teacher'));

create index if not exists idx_profiles_role
on public.profiles(role);
