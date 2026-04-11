import { neon } from '@neondatabase/serverless';
import { withAuthenticatedEndpoint } from './lib/api-guards.js';
import { getEnv } from './lib/env.js';
import { logger } from './lib/logger.js';

type SchoolHolidayInput = {
  id?: string;
  title?: string;
  startsOn?: string;
  endsOn?: string;
};

type SchoolHolidaysPayload = {
  holidays?: SchoolHolidayInput[];
};

type SchoolHolidayRow = {
  id: string;
  title: string;
  starts_on: string;
  ends_on: string;
};

async function loadHolidays(sql: any, ownerId: string): Promise<SchoolHolidayRow[]> {
  const rows = await sql`
    select
      id::text as id,
      title,
      starts_on::text as starts_on,
      ends_on::text as ends_on
    from public.school_holidays
    where owner_id = ${ownerId}::uuid
    order by starts_on asc, ends_on asc, title asc
  `;

  return rows as SchoolHolidayRow[];
}

export default withAuthenticatedEndpoint('GET,POST,OPTIONS', async ({ req, res, auth }) => {
  const sql = neon(getEnv('DATABASE_URL'));

  try {
    if (req.method === 'GET') {
      const holidays = await loadHolidays(sql, auth.userId);

      res.status(200).json({
        ok: true,
        data: holidays
      });
      return;
    }

    const input = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body ?? {}) as SchoolHolidaysPayload;
    const holidays = Array.isArray(input.holidays) ? input.holidays : [];

    const normalized = holidays
      .map((holiday) => ({
        title: holiday.title?.trim() || '',
        startsOn: holiday.startsOn?.trim() || '',
        endsOn: holiday.endsOn?.trim() || ''
      }))
      .filter((holiday) => holiday.title || holiday.startsOn || holiday.endsOn);

    for (const holiday of normalized) {
      if (!holiday.title || !holiday.startsOn || !holiday.endsOn) {
        res.status(400).json({
          ok: false,
          error: 'Chaque congé doit contenir un nom, une date de début et une date de fin.'
        });
        return;
      }
    }

    await sql`
      delete from public.school_holidays
      where owner_id = ${auth.userId}::uuid
    `;

    for (const holiday of normalized) {
      await sql`
        insert into public.school_holidays (
          owner_id,
          title,
          starts_on,
          ends_on
        )
        values (
          ${auth.userId}::uuid,
          ${holiday.title},
          ${holiday.startsOn}::date,
          ${holiday.endsOn}::date
        )
      `;
    }

    const savedHolidays = await loadHolidays(sql, auth.userId);

    logger.info('school_holidays.saved', {
      userId: auth.userId,
      count: savedHolidays.length
    });

    res.status(200).json({
      ok: true,
      data: savedHolidays
    });
  } catch (error) {
    logger.error('school_holidays.failed', error, {
      userId: auth.userId
    });

    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unable to manage school holidays.'
    });
  }
}, {
  rateLimit: {
    name: 'school-holidays',
    windowMs: 60_000,
    max: 120,
    key: 'user'
  }
});
