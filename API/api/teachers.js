import { neon } from '@neondatabase/serverless';
import { withAuthenticatedEndpoint } from './lib/api-guards.js';
import { getEnv } from './lib/env.js';
import { logger } from './lib/logger.js';
async function listTeachers(sql, userId) {
    const rows = await sql `
    select
      t.id::text as id,
      t.school_id::text as school_id,
      s.name as school_name,
      t.first_name,
      t.last_name,
      t.email,
      t.phone,
      t.subject
    from public.teachers t
    left join public.schools s
      on s.id = t.school_id
    where t.owner_id = ${userId}::uuid
    order by t.last_name asc nulls last, t.first_name asc nulls last
  `;
    return rows;
}
export default withAuthenticatedEndpoint('GET,POST,PUT,DELETE,OPTIONS', async ({ req, res, auth }) => {
    const sql = neon(getEnv('DATABASE_URL'));
    try {
        if (req.method === 'GET') {
            const teachers = await listTeachers(sql, auth.userId);
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
        const subject = payload.subject?.trim() || null;
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
          ${subject},
          ${auth.userId}::uuid,
          null,
          false
        )
        returning id::text as id
      `;
            const [created] = insertedRows;
            const teachers = await listTeachers(sql, auth.userId);
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
          subject = ${subject}
        where id = ${teacherId}::uuid
          and owner_id = ${auth.userId}::uuid
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
            const teachers = await listTeachers(sql, auth.userId);
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
          and owner_id = ${auth.userId}::uuid
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
