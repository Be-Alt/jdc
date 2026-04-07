import { neon } from '@neondatabase/serverless';
import { withAuthenticatedEndpoint } from './lib/api-guards.js';
import { getEnv } from './lib/env.js';
import { logger } from './lib/logger.js';
function getQueryParam(url, name) {
    if (!url) {
        return undefined;
    }
    const query = new URL(url, 'http://localhost').searchParams.get(name)?.trim();
    return query || undefined;
}
export default withAuthenticatedEndpoint('GET,OPTIONS', async ({ req, res, auth }) => {
    try {
        const enrollmentId = getQueryParam(req.url, 'enrollmentId');
        if (!enrollmentId) {
            res.status(400).json({
                ok: false,
                error: 'Missing enrollmentId query parameter.'
            });
            return;
        }
        const sql = neon(getEnv('DATABASE_URL'));
        const result = await sql `
      select
        se.id as enrollment_id,
        p.id as person_id,
        sy.id as school_year_id,
        sy.label as school_year_label,
        se.organization_id::text as organization_id,
        se.is_shared_with_org,
        sec.id as section_id,
        sec.code as section_code,
        sec.level as section_level,
        sec.type as section_type,
        sec.label as section_label,
        se.status,
        p.first_name,
        p.last_name,
        p.birth_date::text as birth_date,
        sch.id as school_id,
        sch.name as school_name,
        coalesce(
          array_agg(distinct t.id::text) filter (where t.id is not null),
          '{}'::text[]
        ) as teacher_ids,
        coalesce(
          array_agg(distinct concat_ws(' ', t.first_name, t.last_name)) filter (where t.id is not null),
          '{}'::text[]
        ) as teacher_names,
        coalesce(
          array_agg(distinct sd.dys_id) filter (where sd.dys_id is not null),
          '{}'::int[]
        ) as dys_ids,
        coalesce(
          array_agg(distinct dt.nom) filter (where dt.nom is not null),
          '{}'::text[]
        ) as dys_names,
        coalesce(
          array_agg(distinct sa.accommodation_id) filter (where sa.accommodation_id is not null),
          '{}'::int[]
        ) as accommodation_ids,
        coalesce(
          array_agg(distinct acc.amenagement) filter (where acc.amenagement is not null),
          '{}'::text[]
        ) as accommodation_names
      from public.student_enrollments se
      inner join public.persons p
        on p.id = se.person_id
      inner join public.school_years sy
        on sy.id = se.school_year_id
      left join public.sections sec
        on sec.id = se.section_id
      left join public.student_school_history ssh
        on ssh.student_enrollment_id = se.id
       and ssh.end_date is null
      left join public.schools sch
        on sch.id = ssh.school_id
      left join public.student_teachers st
        on st.student_enrollment_id = se.id
      left join public.teachers t
        on t.id = st.teacher_id
      left join public.student_dys sd
        on sd.student_id = p.id
      left join public.dys_types dt
        on dt.id = sd.dys_id
      left join public.student_accommodations sa
        on sa.student_id = p.id
      left join public.accommodations acc
        on acc.id = sa.accommodation_id
      where se.owner_id = ${auth.userId}::uuid
        and se.id = ${enrollmentId}::uuid
      group by
        se.id,
        p.id,
        sy.id,
        sy.label,
        se.organization_id,
        se.is_shared_with_org,
        sec.id,
        sec.code,
        sec.level,
        sec.type,
        sec.label,
        se.status,
        p.first_name,
        p.last_name,
        p.birth_date,
        sch.id,
        sch.name
      limit 1
    `;
        const [student] = result;
        if (!student) {
            res.status(404).json({
                ok: false,
                error: 'Student not found.'
            });
            return;
        }
        logger.info('student.detail', {
            userId: auth.userId,
            enrollmentId
        });
        res.status(200).json({
            ok: true,
            data: student
        });
    }
    catch (error) {
        logger.error('student.detail_failed', error, {
            userId: auth.userId
        });
        res.status(500).json({
            ok: false,
            error: error instanceof Error ? error.message : 'Unable to fetch student details.'
        });
    }
}, {
    rateLimit: {
        name: 'student',
        windowMs: 60_000,
        max: 120,
        key: 'user'
    }
});
