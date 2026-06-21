alter table public.allowed_email_domains
add column if not exists organization_id uuid references public.organizations(id) on delete restrict;

do $$
declare
  domain_row record;
  created_organization_id uuid;
begin
  for domain_row in
    select domain
    from public.allowed_email_domains
    where organization_id is null
  loop
    insert into public.organizations (name)
    values (domain_row.domain)
    returning id into created_organization_id;

    update public.allowed_email_domains
    set organization_id = created_organization_id
    where domain = domain_row.domain;
  end loop;
end;
$$;

alter table public.allowed_email_domains
alter column organization_id set not null;

alter table public.profiles
add column if not exists organization_id uuid references public.organizations(id) on delete restrict;

update public.profiles p
set organization_id = om.organization_id
from public.organization_members om
where p.organization_id is null
  and p.user_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and om.user_id = p.user_id::uuid;

update public.profiles p
set organization_id = aed.organization_id
from public.allowed_email_domains aed
where p.organization_id is null
  and lower(split_part(p.email, '@', 2)) = lower(aed.domain);

do $$
begin
  if exists (select 1 from public.profiles where organization_id is null) then
    raise exception 'Impossible de rattacher tous les profils a une organisation.';
  end if;
end;
$$;

alter table public.profiles
alter column organization_id set not null;

insert into public.organization_members (organization_id, user_id, role)
select
  p.organization_id,
  p.user_id::uuid,
  case when p.role in ('super_admin', 'program_admin', 'direction_admin') then 'admin' else 'member' end
from public.profiles p
where p.user_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
on conflict (organization_id, user_id) do update
set role = excluded.role;

alter table public.programs
add column if not exists organization_id uuid references public.organizations(id) on delete restrict;

alter table public.sections
add column if not exists organization_id uuid references public.organizations(id) on delete restrict;

alter table public.subjects
add column if not exists organization_id uuid references public.organizations(id) on delete restrict;

alter table public.networks
add column if not exists organization_id uuid references public.organizations(id) on delete restrict;

alter table public.class_journal_entries
add column if not exists organization_id uuid references public.organizations(id) on delete restrict;

do $$
begin
  if to_regclass('public.class_sessions') is not null then
    alter table public.class_sessions
    add column if not exists organization_id uuid references public.organizations(id) on delete restrict;
  end if;
end;
$$;

alter table public.student_competency_assessments
add column if not exists organization_id uuid references public.organizations(id) on delete restrict;

alter table public.student_teacher_communications
add column if not exists organization_id uuid references public.organizations(id) on delete restrict;

alter table public.student_teacher_communication_reminders
add column if not exists organization_id uuid references public.organizations(id) on delete restrict;

alter table public.school_holidays
add column if not exists organization_id uuid references public.organizations(id) on delete restrict;

alter table public.admin_test_data
add column if not exists organization_id uuid references public.organizations(id) on delete restrict;

alter table public.user_test_data
add column if not exists organization_id uuid references public.organizations(id) on delete restrict;

alter table public.student_test_data
add column if not exists organization_id uuid references public.organizations(id) on delete restrict;

update public.schools data
set organization_id = p.organization_id
from public.profiles p
where data.owner_id::text = p.user_id;

update public.teachers data
set organization_id = p.organization_id
from public.profiles p
where data.owner_id::text = p.user_id;

update public.student_enrollments data
set organization_id = p.organization_id
from public.profiles p
where data.owner_id::text = p.user_id;

update public.weekly_schedule_configs data
set organization_id = p.organization_id
from public.profiles p
where data.owner_id::text = p.user_id;

update public.programs data
set organization_id = p.organization_id
from public.profiles p
where data.owner_id::text = p.user_id;

update public.programs
set organization_id = (
  coalesce(
    (
      select organization_id
      from public.profiles
      order by
        case role
          when 'super_admin' then 1
          when 'program_admin' then 2
          else 3
        end,
        created_at
      limit 1
    ),
    (
      select organization_id
      from public.allowed_email_domains
      order by domain
      limit 1
    )
  )
)
where organization_id is null;

do $$
begin
  if exists (
    select subject_id
    from public.programs
    where subject_id is not null
    group by subject_id
    having count(distinct organization_id) > 1
  ) or exists (
    select section_id
    from public.programs
    where section_id is not null
    group by section_id
    having count(distinct organization_id) > 1
  ) or exists (
    select network_id
    from public.programs
    where network_id is not null
    group by network_id
    having count(distinct organization_id) > 1
  ) then
    raise exception 'Un referentiel programme est utilise par plusieurs organisations. Separation manuelle requise.';
  end if;
end;
$$;

update public.subjects data
set organization_id = usage.organization_id
from (
  select subject_id, min(organization_id::text)::uuid as organization_id
  from public.programs
  where subject_id is not null
    and organization_id is not null
  group by subject_id
) usage
where data.id = usage.subject_id;

update public.sections data
set organization_id = usage.organization_id
from (
  select section_id, min(organization_id::text)::uuid as organization_id
  from public.programs
  where section_id is not null
    and organization_id is not null
  group by section_id
) usage
where data.id = usage.section_id;

update public.networks data
set organization_id = usage.organization_id
from (
  select network_id, min(organization_id::text)::uuid as organization_id
  from public.programs
  where network_id is not null
    and organization_id is not null
  group by network_id
) usage
where data.id = usage.network_id;

update public.subjects data
set organization_id = usage.organization_id
from (
  select subject_id, min(organization_id::text)::uuid as organization_id
  from public.teachers
  where subject_id is not null
    and organization_id is not null
  group by subject_id
) usage
where data.id = usage.subject_id
  and data.organization_id is null;

update public.sections data
set organization_id = usage.organization_id
from (
  select section_id, min(organization_id::text)::uuid as organization_id
  from public.student_enrollments
  where section_id is not null
    and organization_id is not null
  group by section_id
) usage
where data.id = usage.section_id
  and data.organization_id is null;

update public.subjects
set organization_id = (
  select organization_id
  from public.allowed_email_domains
  order by domain
  limit 1
)
where organization_id is null;

update public.sections
set organization_id = (
  select organization_id
  from public.allowed_email_domains
  order by domain
  limit 1
)
where organization_id is null;

update public.networks
set organization_id = (
  select organization_id
  from public.allowed_email_domains
  order by domain
  limit 1
)
where organization_id is null;

do $$
begin
  if exists (
    select 1
    from public.programs p
    join public.subjects s on s.id = p.subject_id
    where s.organization_id <> p.organization_id
  ) or exists (
    select 1
    from public.programs p
    join public.sections s on s.id = p.section_id
    where s.organization_id <> p.organization_id
  ) or exists (
    select 1
    from public.programs p
    join public.networks n on n.id = p.network_id
    where n.organization_id <> p.organization_id
  ) or exists (
    select 1
    from public.teachers t
    join public.subjects s on s.id = t.subject_id
    where s.organization_id <> t.organization_id
  ) or exists (
    select 1
    from public.teachers t
    join public.schools s on s.id = t.school_id
    where s.organization_id <> t.organization_id
  ) or exists (
    select 1
    from public.student_enrollments se
    join public.sections s on s.id = se.section_id
    where s.organization_id <> se.organization_id
  ) or exists (
    select 1
    from public.student_school_history ssh
    join public.student_enrollments se on se.id = ssh.student_enrollment_id
    join public.schools s on s.id = ssh.school_id
    where s.organization_id <> se.organization_id
  ) or exists (
    select 1
    from public.student_teachers st
    join public.student_enrollments se on se.id = st.student_enrollment_id
    join public.teachers t on t.id = st.teacher_id
    where t.organization_id <> se.organization_id
  ) then
    raise exception 'Des relations existantes traversent plusieurs organisations. Separation manuelle requise.';
  end if;
end;
$$;

update public.class_journal_entries data
set organization_id = p.organization_id
from public.profiles p
where data.owner_id::text = p.user_id;

do $$
begin
  if to_regclass('public.class_sessions') is not null then
    update public.class_sessions data
    set organization_id = p.organization_id
    from public.profiles p
    where data.owner_id::text = p.user_id;

    if exists (select 1 from public.class_sessions where organization_id is null) then
      raise exception 'Certaines sessions de classe ne peuvent pas etre rattachees a une organisation.';
    end if;

    alter table public.class_sessions
    alter column organization_id set not null;

    create index if not exists idx_class_sessions_organization_date
    on public.class_sessions(organization_id, session_date);
  end if;
end;
$$;

update public.student_competency_assessments data
set organization_id = p.organization_id
from public.profiles p
where data.owner_id::text = p.user_id;

update public.student_teacher_communications data
set organization_id = p.organization_id
from public.profiles p
where data.owner_id::text = p.user_id;

update public.student_teacher_communication_reminders data
set organization_id = p.organization_id
from public.profiles p
where data.owner_id::text = p.user_id;

update public.school_holidays data
set organization_id = p.organization_id
from public.profiles p
where data.owner_id::text = p.user_id;

update public.admin_test_data
set organization_id = (
  select organization_id
  from public.allowed_email_domains
  order by domain
  limit 1
)
where organization_id is null;

update public.user_test_data
set organization_id = (
  select organization_id
  from public.allowed_email_domains
  order by domain
  limit 1
)
where organization_id is null;

update public.student_test_data
set organization_id = (
  select organization_id
  from public.allowed_email_domains
  order by domain
  limit 1
)
where organization_id is null;

do $$
begin
  if exists (
    select 1
    from public.schools
    where organization_id is null
  ) or exists (
    select 1
    from public.teachers
    where organization_id is null
  ) or exists (
    select 1
    from public.student_enrollments
    where organization_id is null
  ) or exists (
    select 1
    from public.weekly_schedule_configs
    where organization_id is null
  ) or exists (
    select 1
    from public.programs
    where organization_id is null
  ) or exists (
    select 1
    from public.class_journal_entries
    where organization_id is null
  ) or exists (
    select 1
    from public.student_competency_assessments
    where organization_id is null
  ) or exists (
    select 1
    from public.student_teacher_communications
    where organization_id is null
  ) or exists (
    select 1
    from public.student_teacher_communication_reminders
    where organization_id is null
  ) or exists (
    select 1
    from public.school_holidays
    where organization_id is null
  ) then
    raise exception 'Certaines donnees metier ne peuvent pas etre rattachees a une organisation.';
  end if;
end;
$$;

alter table public.schools alter column organization_id set not null;
alter table public.teachers alter column organization_id set not null;
alter table public.student_enrollments alter column organization_id set not null;
alter table public.weekly_schedule_configs alter column organization_id set not null;
alter table public.programs alter column organization_id set not null;
alter table public.sections alter column organization_id set not null;
alter table public.subjects alter column organization_id set not null;
alter table public.networks alter column organization_id set not null;
alter table public.class_journal_entries alter column organization_id set not null;
alter table public.student_competency_assessments alter column organization_id set not null;
alter table public.student_teacher_communications alter column organization_id set not null;
alter table public.student_teacher_communication_reminders alter column organization_id set not null;
alter table public.school_holidays alter column organization_id set not null;
alter table public.admin_test_data alter column organization_id set not null;
alter table public.user_test_data alter column organization_id set not null;
alter table public.student_test_data alter column organization_id set not null;

create index if not exists idx_profiles_organization
on public.profiles(organization_id);

alter table public.schools
drop constraint if exists schools_name_city_key;

alter table public.sections
drop constraint if exists sections_code_key;

alter table public.subjects
drop constraint if exists subjects_name_key;

alter table public.networks
drop constraint if exists networks_code_key;

create unique index if not exists uq_schools_organization_name_city
on public.schools(
  organization_id,
  lower(name),
  coalesce(lower(city), '')
);

create unique index if not exists uq_sections_organization_code
on public.sections(organization_id, upper(code));

create unique index if not exists uq_subjects_organization_name
on public.subjects(organization_id, lower(name));

create unique index if not exists uq_networks_organization_code
on public.networks(organization_id, upper(code));

drop index if exists public.uq_shared_program_definition;

create unique index uq_shared_program_definition
on public.programs(organization_id, subject_id, section_id, network_id, hours)
where is_shared = true;

create index if not exists idx_programs_organization_visibility
on public.programs(organization_id, is_shared, owner_id);

create index if not exists idx_class_journal_entries_organization_date
on public.class_journal_entries(organization_id, entry_date);

create index if not exists idx_student_assessments_organization
on public.student_competency_assessments(organization_id, student_enrollment_id);

create index if not exists idx_student_communications_organization
on public.student_teacher_communications(organization_id, student_enrollment_id);

create index if not exists idx_student_reminders_organization
on public.student_teacher_communication_reminders(organization_id, completed_at, due_date);

create index if not exists idx_school_holidays_organization
on public.school_holidays(organization_id, starts_on, ends_on);
