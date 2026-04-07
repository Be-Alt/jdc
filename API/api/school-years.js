import { neon } from '@neondatabase/serverless';
import { withAuthenticatedEndpoint } from './lib/api-guards.js';
import { getEnv } from './lib/env.js';
import { logger } from './lib/logger.js';
export default withAuthenticatedEndpoint('GET,OPTIONS', async ({ res, auth }) => {
    try {
        const sql = neon(getEnv('DATABASE_URL'));
        const rows = await sql `
      select
        sy.id,
        sy.label,
        sy.start_date::text as start_date,
        sy.end_date::text as end_date,
        count(se.id)::int as student_count
      from public.school_years sy
      inner join public.student_enrollments se
        on se.school_year_id = sy.id
      where se.owner_id = ${auth.userId}::uuid
      group by sy.id, sy.label, sy.start_date, sy.end_date
      order by
        sy.start_date desc nulls last,
        sy.label desc
    `;
        logger.info('school_years.list', {
            userId: auth.userId,
            count: Array.isArray(rows) ? rows.length : 0
        });
        res.status(200).json({
            ok: true,
            data: rows
        });
    }
    catch (error) {
        logger.error('school_years.list_failed', error, {
            userId: auth.userId
        });
        res.status(500).json({
            ok: false,
            error: error instanceof Error ? error.message : 'Unable to fetch school years.'
        });
    }
}, {
    rateLimit: {
        name: 'school-years',
        windowMs: 60_000,
        max: 120,
        key: 'user'
    }
});
