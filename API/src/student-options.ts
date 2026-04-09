import { neon } from '@neondatabase/serverless';
import { withAuthenticatedEndpoint } from './lib/api-guards.js';
import { getEnv } from './lib/env.js';
import { logger } from './lib/logger.js';

type StudentOptionRow = {
  enrollment_id: string;
  person_id: string;
  first_name: string;
  last_name: string;
  school_year_label: string;
  section_id: string | null;
  section_level: number | null;
  section_code: string | null;
  section_label: string | null;
};

export default withAuthenticatedEndpoint('GET,OPTIONS', async ({ res, auth }) => {
  try {
    const sql = neon(getEnv('DATABASE_URL'));

    const rows = await sql`
      select
        se.id::text as enrollment_id,
        p.id::text as person_id,
        p.first_name,
        p.last_name,
        sy.label as school_year_label,
        sec.id::text as section_id,
        sec.level as section_level,
        sec.code as section_code,
        sec.label as section_label
      from public.student_enrollments se
      inner join public.persons p
        on p.id = se.person_id
      inner join public.school_years sy
        on sy.id = se.school_year_id
      left join public.sections sec
        on sec.id = se.section_id
      where se.owner_id = ${auth.userId}::uuid
      order by p.last_name asc, p.first_name asc
    `;

    logger.info('student_options.list', {
      userId: auth.userId,
      count: Array.isArray(rows) ? rows.length : 0
    });

    res.status(200).json({
      ok: true,
      data: rows as StudentOptionRow[]
    });
  } catch (error) {
    logger.error('student_options.list_failed', error, {
      userId: auth.userId
    });

    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unable to fetch student options.'
    });
  }
}, {
  rateLimit: {
    name: 'student-options',
    windowMs: 60_000,
    max: 120,
    key: 'user'
  }
});
