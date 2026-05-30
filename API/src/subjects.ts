import { neon } from '@neondatabase/serverless';
import { withAuthenticatedEndpoint } from './lib/api-guards.js';
import { getEnv } from './lib/env.js';
import { logger } from './lib/logger.js';

type SubjectRow = {
  id: string;
  name: string;
};

type SubjectInput = {
  subjectId?: string;
  name?: string;
};

export default withAuthenticatedEndpoint('GET,POST,DELETE,OPTIONS', async ({ req, res, auth }) => {
  try {
    const sql = neon(getEnv('DATABASE_URL'));

    if (req.method === 'POST') {
      const payload = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body ?? {}) as SubjectInput;
      const name = payload.name?.trim() || null;

      if (!name) {
        res.status(400).json({
          ok: false,
          error: 'Le nom de la matière est obligatoire.'
        });
        return;
      }

      const insertedRows = await sql`
        insert into public.subjects (
          name
        )
        values (
          ${name}
        )
        returning
          id::text as id,
          name
      `;

      const [subject] = insertedRows as SubjectRow[];

      logger.info('subjects.created', {
        userId: auth.userId,
        subjectId: subject.id
      });

      res.status(201).json({
        ok: true,
        data: subject
      });
      return;
    }

    if (req.method === 'DELETE') {
      const payload = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body ?? {}) as SubjectInput;
      const subjectId = payload.subjectId?.trim() || null;

      if (!subjectId) {
        res.status(400).json({
          ok: false,
          error: 'subjectId est obligatoire pour supprimer une matière.'
        });
        return;
      }

      const usageRows = await sql`
        select
          (
            select count(*)::int
            from public.teachers
            where subject_id = ${subjectId}::uuid
          ) as teacher_count,
          (
            select count(*)::int
            from public.programs
            where subject_id = ${subjectId}::uuid
          ) as program_count
      `;

      const [usage] = usageRows as Array<{
        teacher_count: number;
        program_count: number;
      }>;

      if (usage.teacher_count + usage.program_count > 0) {
        res.status(409).json({
          ok: false,
          error: 'Impossible de supprimer cette matière : elle est liée à des professeurs ou des programmes.',
          data: usage
        });
        return;
      }

      const deletedRows = await sql`
        delete from public.subjects
        where id = ${subjectId}::uuid
        returning id::text as id
      `;

      const [deletedSubject] = deletedRows as Array<{ id: string }>;

      if (!deletedSubject) {
        res.status(404).json({
          ok: false,
          error: 'Matière introuvable.'
        });
        return;
      }

      logger.info('subjects.deleted', {
        userId: auth.userId,
        subjectId: deletedSubject.id
      });

      res.status(200).json({
        ok: true,
        data: {
          subjectId: deletedSubject.id
        }
      });
      return;
    }

    const rows = await sql`
      select
        id::text as id,
        name
      from public.subjects
      order by name asc
    `;

    logger.info('subjects.list', {
      userId: auth.userId,
      count: Array.isArray(rows) ? rows.length : 0
    });

    res.status(200).json({
      ok: true,
      data: rows as SubjectRow[]
    });
  } catch (error) {
    if ((error as { code?: string }).code === '23505') {
      res.status(409).json({
        ok: false,
        error: 'Une matière avec ce nom existe déjà.'
      });
      return;
    }

    logger.error('subjects.request_failed', error, {
      userId: auth.userId
    });

    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Impossible de gérer les matières.'
    });
  }
}, {
  rateLimit: {
    name: 'subjects',
    windowMs: 60_000,
    max: 120,
    key: 'user'
  }
});
