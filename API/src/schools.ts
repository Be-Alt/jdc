import { neon } from '@neondatabase/serverless';
import { withAuthenticatedEndpoint } from './lib/api-guards.js';
import { getEnv } from './lib/env.js';
import { logger } from './lib/logger.js';

type SchoolRow = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  country: string;
  website: string | null;
};

type SchoolInput = {
  schoolId?: string;
  name?: string;
  address?: string | null;
  city?: string | null;
  postalCode?: string | null;
  country?: string | null;
  website?: string | null;
};

export default withAuthenticatedEndpoint('GET,POST,PUT,DELETE,OPTIONS', async ({ req, res, auth }) => {
  try {
    const sql = neon(getEnv('DATABASE_URL'));

    if (req.method === 'POST') {
      const payload = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body ?? {}) as SchoolInput;
      const name = payload.name?.trim();
      const address = payload.address?.trim() || null;
      const city = payload.city?.trim() || null;
      const postalCode = payload.postalCode?.trim() || null;
      const country = payload.country?.trim() || 'Belgique';
      const website = payload.website?.trim() || null;

      if (!name) {
        res.status(400).json({
          ok: false,
          error: 'Le nom de l’école est obligatoire.'
        });
        return;
      }

      const insertedRows = await sql`
        insert into public.schools (
          name,
          address,
          city,
          postal_code,
          country,
          website,
          owner_id
        )
        values (
          ${name},
          ${address},
          ${city},
          ${postalCode},
          ${country},
          ${website},
          ${auth.userId}::uuid
        )
        returning
          id::text as id,
          name,
          address,
          city,
          postal_code,
          country,
          website
      `;

      const [school] = insertedRows as SchoolRow[];

      logger.info('schools.created', {
        userId: auth.userId,
        schoolId: school.id
      });

      res.status(201).json({
        ok: true,
        data: school
      });
      return;
    }

    if (req.method === 'PUT') {
      const payload = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body ?? {}) as SchoolInput;
      const schoolId = payload.schoolId?.trim() || null;
      const name = payload.name?.trim();
      const address = payload.address?.trim() || null;
      const city = payload.city?.trim() || null;
      const postalCode = payload.postalCode?.trim() || null;
      const country = payload.country?.trim() || 'Belgique';
      const website = payload.website?.trim() || null;

      if (!schoolId || !name) {
        res.status(400).json({
          ok: false,
          error: 'schoolId et name sont obligatoires pour modifier une école.'
        });
        return;
      }

      const updatedRows = await sql`
        update public.schools
        set
          name = ${name},
          address = ${address},
          city = ${city},
          postal_code = ${postalCode},
          country = ${country},
          website = ${website}
        where id = ${schoolId}::uuid
          and owner_id = ${auth.userId}::uuid
        returning
          id::text as id,
          name,
          address,
          city,
          postal_code,
          country,
          website
      `;

      const [school] = updatedRows as SchoolRow[];

      if (!school) {
        res.status(404).json({
          ok: false,
          error: 'École introuvable.'
        });
        return;
      }

      logger.info('schools.updated', {
        userId: auth.userId,
        schoolId: school.id
      });

      res.status(200).json({
        ok: true,
        data: school
      });
      return;
    }

    if (req.method === 'DELETE') {
      const payload = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body ?? {}) as SchoolInput;
      const schoolId = payload.schoolId?.trim() || null;

      if (!schoolId) {
        res.status(400).json({
          ok: false,
          error: 'schoolId est obligatoire pour supprimer une école.'
        });
        return;
      }

      await sql`
        update public.student_school_history
        set school_id = null
        where school_id = ${schoolId}::uuid
      `;

      const deletedRows = await sql`
        delete from public.schools
        where id = ${schoolId}::uuid
          and owner_id = ${auth.userId}::uuid
        returning id::text as id
      `;

      const [deletedSchool] = deletedRows as Array<{ id: string }>;

      if (!deletedSchool) {
        res.status(404).json({
          ok: false,
          error: 'École introuvable.'
        });
        return;
      }

      logger.info('schools.deleted', {
        userId: auth.userId,
        schoolId: deletedSchool.id
      });

      res.status(200).json({
        ok: true,
        data: {
          schoolId: deletedSchool.id
        }
      });
      return;
    }

    const rows = await sql`
      select
        id::text as id,
        name,
        address,
        city,
        postal_code,
        country,
        website
      from public.schools
      where owner_id = ${auth.userId}::uuid
      order by name asc
    `;

    logger.info('schools.list', {
      userId: auth.userId,
      count: Array.isArray(rows) ? rows.length : 0
    });

    res.status(200).json({
      ok: true,
      data: rows as SchoolRow[]
    });
  } catch (error) {
    logger.error('schools.list_failed', error, {
      userId: auth.userId
    });

    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unable to fetch schools.'
    });
  }
}, {
  rateLimit: {
    name: 'schools',
    windowMs: 60_000,
    max: 120,
    key: 'user'
  }
});
