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
        const subjectId = getQueryParam(requestUrl, 'subjectId') ?? null;
        const excludeProgramId = getQueryParam(requestUrl, 'excludeProgramId') ?? null;
        const sql = neon(getEnv('DATABASE_URL'));
        const rows = await sql `
      select
        p.id::text as id,
        p.name,
        p.hours,
        sub.id::text as subject_id,
        sub.name as subject_name,
        sec.id::text as section_id,
        sec.code as section_code,
        sec.label as section_label,
        net.id::text as network_id,
        net.code as network_code,
        net.name as network_name,
        count(u.id)::int as uaa_count
      from public.programs p
      inner join public.subjects sub
        on sub.id = p.subject_id
      inner join public.sections sec
        on sec.id = p.section_id
      inner join public.networks net
        on net.id = p.network_id
      left join public.uaa u
        on u.program_id = p.id
      where (${subjectId}::uuid is null or p.subject_id = ${subjectId}::uuid)
        and (${excludeProgramId}::uuid is null or p.id <> ${excludeProgramId}::uuid)
      group by
        p.id,
        p.name,
        p.hours,
        sub.id,
        sub.name,
        sec.id,
        sec.code,
        sec.label,
        net.id,
        net.code,
        net.name
      order by
        sub.name asc,
        sec.level asc,
        sec.code asc,
        net.code asc,
        p.hours asc
    `;
        logger.info('program_catalog.list', {
            userId: auth.userId,
            subjectId,
            excludeProgramId,
            count: Array.isArray(rows) ? rows.length : 0
        });
        res.status(200).json({
            ok: true,
            data: rows
        });
    }
    catch (error) {
        logger.error('program_catalog.list_failed', error, {
            userId: auth.userId
        });
        res.status(500).json({
            ok: false,
            error: error instanceof Error ? error.message : 'Impossible de lister les programmes.'
        });
    }
}, {
    rateLimit: {
        name: 'program-catalog',
        windowMs: 60_000,
        max: 120,
        key: 'user'
    }
});
