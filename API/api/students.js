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
        const requestUrl = req.url;
        const schoolYearId = getQueryParam(requestUrl, 'schoolYearId');
        const schoolYearLabel = getQueryParam(requestUrl, 'schoolYearLabel');
        if (!schoolYearId && !schoolYearLabel) {
            res.status(400).json({
                ok: false,
                error: 'Missing schoolYearId or schoolYearLabel query parameter.'
            });
            return;
        }
        const sql = neon(getEnv('DATABASE_URL'));
        const rows = await sql `
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
        sch.name as school_name
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
      where se.owner_id = ${auth.userId}::uuid
        and (
          (${schoolYearId}::uuid is not null and se.school_year_id = ${schoolYearId}::uuid)
          or (${schoolYearLabel}::text is not null and sy.label = ${schoolYearLabel}::text)
        )
      order by p.last_name asc, p.first_name asc
    `;
        logger.info('students.list_by_year', {
            userId: auth.userId,
            schoolYearId,
            schoolYearLabel,
            count: Array.isArray(rows) ? rows.length : 0
        });
        res.status(200).json({
            ok: true,
            data: rows
        });
    }
    catch (error) {
        logger.error('students.list_by_year_failed', error, {
            userId: auth.userId
        });
        res.status(500).json({
            ok: false,
            error: error instanceof Error ? error.message : 'Unable to fetch students for the selected year.'
        });
    }
}, {
    rateLimit: {
        name: 'students',
        windowMs: 60_000,
        max: 120,
        key: 'user'
    }
});
