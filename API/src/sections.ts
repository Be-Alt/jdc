import { neon } from '@neondatabase/serverless';
import { withAuthenticatedEndpoint } from './lib/api-guards.js';
import { getEnv } from './lib/env.js';
import { logger } from './lib/logger.js';

type SectionRow = {
  id: string;
  code: string;
  level: number;
  type: string;
  label: string;
};

export default withAuthenticatedEndpoint('GET,OPTIONS', async ({ res, auth }) => {
  try {
    const sql = neon(getEnv('DATABASE_URL'));
    const rows = await sql`
      select
        id,
        code,
        level,
        type,
        label
      from public.sections
      order by level asc, type asc, code asc
    `;

    logger.info('sections.list', {
      userId: auth.userId,
      count: Array.isArray(rows) ? rows.length : 0
    });

    res.status(200).json({
      ok: true,
      data: rows as SectionRow[]
    });
  } catch (error) {
    logger.error('sections.list_failed', error, {
      userId: auth.userId
    });

    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unable to fetch sections.'
    });
  }
}, {
  rateLimit: {
    name: 'sections',
    windowMs: 60_000,
    max: 120,
    key: 'user'
  }
});
