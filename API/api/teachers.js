import { neon } from '@neondatabase/serverless';
import { withMethodPermissions } from './lib/api-guards.js';
import { getEnv } from './lib/env.js';
import { logger } from './lib/logger.js';
async function listTeachers(sql, organizationId) {
    const rows = await sql `
    select
      t.id::text as id,
      t.school_id::text as school_id,
      s.name as school_name,
      t.subject_id::text as subject_id,
      t.first_name,
      t.last_name,
      t.email,
      t.phone,
      coalesce(sub.name, t.subject) as subject
    from public.teachers t
    left join public.schools s
      on s.id = t.school_id
     and s.organization_id = ${organizationId}::uuid
    left join public.subjects sub
      on sub.id = t.subject_id
     and sub.organization_id = ${organizationId}::uuid
    where t.organization_id = ${organizationId}::uuid
    order by t.last_name asc nulls last, t.first_name asc nulls last
  `;
    return rows;
}
export default withMethodPermissions('GET,POST,PUT,DELETE,OPTIONS', {
    GET: 'directory.read', POST: 'directory.manage', PUT: 'directory.manage', DELETE: 'directory.manage'
}, async ({ req, res, auth }) => {
    const sql = neon(getEnv('DATABASE_URL'));
    try {
        if (req.method === 'GET') {
            const teachers = await listTeachers(sql, auth.organizationId);
            res.status(200).json({
                ok: true,
                data: teachers
            });
            return;
        }
        const payload = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body ?? {});
        const teacherId = payload.teacherId?.trim() || null;
        const schoolId = payload.schoolId?.trim() || null;
        const firstName = payload.firstName?.trim() || null;
        const lastName = payload.lastName?.trim() || null;
        const email = payload.email?.trim() || null;
        const phone = payload.phone?.trim() || null;
        const subjectId = payload.subjectId?.trim() || null;
        const legacySubject = payload.subject?.trim() || null;
        if (schoolId) {
            const schools = await sql `
        select id
        from public.schools
        where id = ${schoolId}::uuid
          and organization_id = ${auth.organizationId}::uuid
        limit 1
      `;
            if (schools.length === 0) {
                res.status(400).json({
                    ok: false,
                    error: 'L’école sélectionnée n’appartient pas à ton organisation.'
                });
                return;
            }
        }
        if (subjectId) {
            const subjects = await sql `
        select id
        from public.subjects
        where id = ${subjectId}::uuid
          and organization_id = ${auth.organizationId}::uuid
        limit 1
      `;
            if (subjects.length === 0) {
                res.status(400).json({
                    ok: false,
                    error: 'La matière sélectionnée n’appartient pas à ton organisation.'
                });
                return;
            }
        }
        if (req.method === 'POST') {
            if (!firstName || !lastName) {
                res.status(400).json({
                    ok: false,
                    error: 'Le prénom et le nom du professeur sont obligatoires.'
                });
                return;
            }
            const insertedRows = await sql `
        insert into public.teachers (
          school_id,
          first_name,
          last_name,
          email,
          phone,
          subject_id,
          subject,
          owner_id,
          organization_id,
          is_shared_with_org
        )
        values (
          ${schoolId}::uuid,
          ${firstName},
          ${lastName},
          ${email},
          ${phone},
          ${subjectId}::uuid,
          ${legacySubject},
          ${auth.userId}::uuid,
          ${auth.organizationId}::uuid,
          true
        )
        returning id::text as id
      `;
            const [created] = insertedRows;
            const teachers = await listTeachers(sql, auth.organizationId);
            const teacher = teachers.find((item) => item.id === created.id) ?? null;
            logger.info('teachers.created', {
                userId: auth.userId,
                teacherId: created.id
            });
            res.status(201).json({
                ok: true,
                data: teacher
            });
            return;
        }
        if (req.method === 'PUT') {
            if (!teacherId || !firstName || !lastName) {
                res.status(400).json({
                    ok: false,
                    error: 'teacherId, prénom et nom sont obligatoires.'
                });
                return;
            }
            const updatedRows = await sql `
        update public.teachers
        set
          school_id = ${schoolId}::uuid,
          first_name = ${firstName},
          last_name = ${lastName},
          email = ${email},
          phone = ${phone},
          subject_id = ${subjectId}::uuid,
          subject = ${legacySubject}
        where id = ${teacherId}::uuid
          and organization_id = ${auth.organizationId}::uuid
        returning id::text as id
      `;
            const [updated] = updatedRows;
            if (!updated) {
                res.status(404).json({
                    ok: false,
                    error: 'Professeur introuvable.'
                });
                return;
            }
            const teachers = await listTeachers(sql, auth.organizationId);
            const teacher = teachers.find((item) => item.id === updated.id) ?? null;
            logger.info('teachers.updated', {
                userId: auth.userId,
                teacherId
            });
            res.status(200).json({
                ok: true,
                data: teacher
            });
            return;
        }
        if (req.method === 'DELETE') {
            if (!teacherId) {
                res.status(400).json({
                    ok: false,
                    error: 'teacherId est obligatoire.'
                });
                return;
            }
            const deletedRows = await sql `
        delete from public.teachers
        where id = ${teacherId}::uuid
          and organization_id = ${auth.organizationId}::uuid
        returning id::text as id
      `;
            const [deleted] = deletedRows;
            if (!deleted) {
                res.status(404).json({
                    ok: false,
                    error: 'Professeur introuvable.'
                });
                return;
            }
            logger.info('teachers.deleted', {
                userId: auth.userId,
                teacherId
            });
            res.status(200).json({
                ok: true,
                data: {
                    teacherId: deleted.id
                }
            });
        }
    }
    catch (error) {
        logger.error('teachers.failed', error, {
            userId: auth.userId
        });
        res.status(500).json({
            ok: false,
            error: error instanceof Error ? error.message : 'Impossible de gérer les professeurs.'
        });
    }
}, {
    rateLimit: {
        name: 'teachers',
        windowMs: 60_000,
        max: 120,
        key: 'user'
    }
});
