import { neon } from '@neondatabase/serverless';
import { withMethodPermissions } from './lib/api-guards.js';
import { getEnv } from './lib/env.js';
import { logger } from './lib/logger.js';

type SectionRow = {
  id: string;
  code: string;
  level: number;
  type: string;
  label: string;
};

type SectionInput = {
  sectionId?: string;
  code?: string;
  level?: number | string | null;
  type?: string;
  label?: string;
};

function getQueryParam(url: string | undefined, name: string): string | undefined {
  if (!url) {
    return undefined;
  }

  const query = new URL(url, 'http://localhost').searchParams.get(name)?.trim();
  return query || undefined;
}

export default withMethodPermissions('GET,POST,DELETE,OPTIONS', {
  GET: 'programs.read',
  POST: 'programs.manage',
  DELETE: 'programs.manage'
}, async ({ req, res, auth }) => {
  try {
    const sql = neon(getEnv('DATABASE_URL'));

    if (req.method === 'POST') {
      const payload = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body ?? {}) as SectionInput;
      const code = payload.code?.trim().toUpperCase();
      const level = Number(payload.level);
      const type = payload.type?.trim().toUpperCase();
      const label = payload.label?.trim();

      if (!code || !Number.isInteger(level) || level < 1 || !type || !label) {
        res.status(400).json({
          ok: false,
          error: 'Le code, le niveau, le type et le libellé sont obligatoires.'
        });
        return;
      }

      const insertedRows = await sql`
        insert into public.sections (
          code,
          level,
          type,
          label,
          organization_id
        )
        values (
          ${code},
          ${level},
          ${type},
          ${label},
          ${auth.organizationId}::uuid
        )
        returning
          id::text as id,
          code,
          level,
          type,
          label
      `;

      const [section] = insertedRows as SectionRow[];

      logger.info('sections.created', {
        userId: auth.userId,
        sectionId: section.id
      });

      res.status(201).json({
        ok: true,
        data: section
      });
      return;
    }

    if (req.method === 'DELETE') {
      const payload = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body ?? {}) as SectionInput;
      const sectionId = payload.sectionId?.trim() || null;

      if (!sectionId) {
        res.status(400).json({
          ok: false,
          error: 'sectionId est obligatoire pour supprimer une section.'
        });
        return;
      }

      const usageRows = await sql`
        select
          (
            select count(*)::int
            from public.student_enrollments
            where section_id = ${sectionId}::uuid
              and organization_id = ${auth.organizationId}::uuid
          ) as student_count,
          (
            select count(*)::int
            from public.programs
            where section_id = ${sectionId}::uuid
              and organization_id = ${auth.organizationId}::uuid
          ) as program_count,
          (
            select count(*)::int
            from public.class_session_students
            where section_id = ${sectionId}::uuid
              and exists (
                select 1
                from public.student_enrollments se
                where se.id = class_session_students.student_enrollment_id
                  and se.organization_id = ${auth.organizationId}::uuid
              )
          ) as journal_count
      `;

      const [usage] = usageRows as Array<{
        student_count: number;
        program_count: number;
        journal_count: number;
      }>;

      const totalUsage = usage.student_count + usage.program_count + usage.journal_count;

      if (totalUsage > 0) {
        res.status(409).json({
          ok: false,
          error:
            'Impossible de supprimer cette section : elle est encore liée à des élèves, des programmes ou des entrées du journal.',
          data: usage
        });
        return;
      }

      const deletedRows = await sql`
        delete from public.sections
        where id = ${sectionId}::uuid
          and organization_id = ${auth.organizationId}::uuid
        returning id::text as id
      `;

      const [deletedSection] = deletedRows as Array<{ id: string }>;

      if (!deletedSection) {
        res.status(404).json({
          ok: false,
          error: 'Section introuvable.'
        });
        return;
      }

      logger.info('sections.deleted', {
        userId: auth.userId,
        sectionId: deletedSection.id
      });

      res.status(200).json({
        ok: true,
        data: {
          sectionId: deletedSection.id
        }
      });
      return;
    }

    const requestUrl = (req as { url?: string }).url;
    const subjectId = getQueryParam(requestUrl, 'subjectId');
    const rows = subjectId
      ? await sql`
          select distinct
            sec.id::text as id,
            sec.code,
            sec.level,
            sec.type,
            sec.label
          from public.sections sec
          inner join public.programs p
            on p.section_id = sec.id
          where p.subject_id = ${subjectId}::uuid
            and p.organization_id = ${auth.organizationId}::uuid
            and sec.organization_id = ${auth.organizationId}::uuid
          order by sec.level asc, sec.type asc, sec.code asc
        `
      : await sql`
          select
            id::text as id,
            code,
            level,
            type,
            label
          from public.sections
          where organization_id = ${auth.organizationId}::uuid
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
    if ((error as { code?: string }).code === '23505') {
      res.status(409).json({
        ok: false,
        error: 'Une section avec ce code existe déjà.'
      });
      return;
    }

    logger.error('sections.request_failed', error, {
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
