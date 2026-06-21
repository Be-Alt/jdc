import { neon } from '@neondatabase/serverless';
import { withPermissionEndpoint } from './lib/api-guards.js';
import { getEnv } from './lib/env.js';
import { logger } from './lib/logger.js';

type CommunicationInput = {
  action?: 'create-interaction' | 'create-reminder' | 'complete-reminder' | 'delete-reminder';
  enrollmentId?: string;
  teacherId?: string | null;
  direction?: 'outgoing' | 'incoming' | 'note';
  contactName?: string | null;
  contactEmail?: string | null;
  subject?: string | null;
  content?: string | null;
  occurredOn?: string | null;
  title?: string | null;
  notes?: string | null;
  dueDate?: string | null;
  reminderId?: string;
};

function getQueryParam(url: string | undefined, name: string): string | undefined {
  return url ? new URL(url, 'http://localhost').searchParams.get(name)?.trim() || undefined : undefined;
}

async function assertEnrollmentAccess(sql: any, organizationId: string, enrollmentId: string): Promise<void> {
  const rows = await sql`
    select 1
    from public.student_enrollments
    where id = ${enrollmentId}::uuid
      and organization_id = ${organizationId}::uuid
    limit 1
  `;
  if (rows.length === 0) throw new Error('Élève introuvable.');
}

async function resolveTeacherId(
  sql: any,
  organizationId: string,
  enrollmentId: string,
  teacherId: string | null | undefined
): Promise<string> {
  const normalizedTeacherId = teacherId?.trim() || null;
  if (!normalizedTeacherId) throw new Error('Le professeur de l’école d’origine est obligatoire.');

  const rows = await sql`
    select t.id::text as id
    from public.teachers t
    join public.student_teachers st
      on st.teacher_id = t.id
     and st.student_enrollment_id = ${enrollmentId}::uuid
    join public.student_school_history ssh
      on ssh.student_enrollment_id = st.student_enrollment_id
     and ssh.end_date is null
     and ssh.school_id = t.school_id
    where t.id = ${normalizedTeacherId}::uuid
      and t.organization_id = ${organizationId}::uuid
    limit 1
  `;
  const teacher = (rows as Array<{ id: string }>)[0];
  if (!teacher) throw new Error('Ce professeur n’est pas lié à l’élève dans son école d’origine.');
  return teacher.id;
}

async function listStudentData(sql: any, ownerId: string, organizationId: string, enrollmentId: string) {
  await assertEnrollmentAccess(sql, organizationId, enrollmentId);
  const interactions = await sql`
    select
      sc.id::text as id,
      sc.student_enrollment_id::text as student_enrollment_id,
      sc.teacher_id::text as teacher_id,
      sc.direction,
      sc.contact_name,
      sc.contact_email,
      sc.subject,
      sc.content,
      sc.occurred_on::text as occurred_on,
      sc.created_at::text as created_at,
      concat_ws(' ', t.first_name, t.last_name) as teacher_name
    from public.student_teacher_communications sc
    left join public.teachers t on t.id = sc.teacher_id
    where sc.owner_id = ${ownerId}::uuid
      and sc.organization_id = ${organizationId}::uuid
      and sc.student_enrollment_id = ${enrollmentId}::uuid
    order by sc.occurred_on desc, sc.created_at desc
  `;
  const reminders = await sql`
    select
      r.id::text as id,
      r.student_enrollment_id::text as student_enrollment_id,
      r.teacher_id::text as teacher_id,
      r.title,
      r.notes,
      r.due_date::text as due_date,
      r.completed_at::text as completed_at,
      r.created_at::text as created_at,
      concat_ws(' ', t.first_name, t.last_name) as teacher_name
    from public.student_teacher_communication_reminders r
    left join public.teachers t on t.id = r.teacher_id
    where r.owner_id = ${ownerId}::uuid
      and r.organization_id = ${organizationId}::uuid
      and r.student_enrollment_id = ${enrollmentId}::uuid
    order by (r.completed_at is not null), r.due_date asc, r.created_at desc
  `;
  return { interactions, reminders };
}

export default withPermissionEndpoint('GET,POST,OPTIONS', 'teaching.manage', async ({ req, res, auth }) => {
  const sql = neon(getEnv('DATABASE_URL'));
  try {
    if (req.method === 'GET') {
      const enrollmentId = getQueryParam((req as { url?: string }).url, 'enrollmentId');
      const dueOnly = getQueryParam((req as { url?: string }).url, 'due') === 'true';

      if (dueOnly) {
        const reminders = await sql`
          select
            r.id::text as id,
            r.student_enrollment_id::text as student_enrollment_id,
            r.teacher_id::text as teacher_id,
            r.title,
            r.notes,
            r.due_date::text as due_date,
            r.completed_at::text as completed_at,
            r.created_at::text as created_at,
            concat_ws(' ', p.first_name, p.last_name) as student_name,
            concat_ws(' ', t.first_name, t.last_name) as teacher_name
          from public.student_teacher_communication_reminders r
          join public.student_enrollments se on se.id = r.student_enrollment_id
          join public.persons p on p.id = se.person_id
          left join public.teachers t on t.id = r.teacher_id
          where r.owner_id = ${auth.userId}::uuid
            and r.organization_id = ${auth.organizationId}::uuid
            and r.completed_at is null
            and r.due_date <= current_date
          order by r.due_date asc, r.created_at asc
        `;
        res.status(200).json({ ok: true, data: reminders });
        return;
      }

      if (!enrollmentId) {
        res.status(400).json({ ok: false, error: 'enrollmentId est obligatoire.' });
        return;
      }
      res.status(200).json({
        ok: true,
        data: await listStudentData(sql, auth.userId, auth.organizationId, enrollmentId)
      });
      return;
    }

    const payload = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body ?? {}) as CommunicationInput;
    const action = payload.action;

    if (action === 'create-interaction') {
      const enrollmentId = payload.enrollmentId?.trim();
      const content = payload.content?.trim();
      if (!enrollmentId || !content || !['outgoing', 'incoming', 'note'].includes(payload.direction ?? '')) {
        res.status(400).json({ ok: false, error: 'Élève, type et contenu sont obligatoires.' });
        return;
      }
      await assertEnrollmentAccess(sql, auth.organizationId, enrollmentId);
      const teacherId = await resolveTeacherId(sql, auth.organizationId, enrollmentId, payload.teacherId);
      await sql`
        insert into public.student_teacher_communications (
          owner_id, organization_id, student_enrollment_id, teacher_id, direction, contact_name,
          contact_email, subject, content, occurred_on
        ) values (
          ${auth.userId}::uuid, ${auth.organizationId}::uuid, ${enrollmentId}::uuid, ${teacherId}::uuid,
          ${payload.direction}, ${payload.contactName?.trim() || null},
          ${payload.contactEmail?.trim() || null}, ${payload.subject?.trim() || null},
          ${content}, coalesce(${payload.occurredOn?.trim() || null}::date, current_date)
        )
      `;
      res.status(201).json({
        ok: true,
        data: await listStudentData(sql, auth.userId, auth.organizationId, enrollmentId)
      });
      return;
    }

    if (action === 'create-reminder') {
      const enrollmentId = payload.enrollmentId?.trim();
      const title = payload.title?.trim();
      if (!enrollmentId || !title) {
        res.status(400).json({ ok: false, error: 'Élève et titre du rappel sont obligatoires.' });
        return;
      }
      await assertEnrollmentAccess(sql, auth.organizationId, enrollmentId);
      const teacherId = await resolveTeacherId(sql, auth.organizationId, enrollmentId, payload.teacherId);
      await sql`
        insert into public.student_teacher_communication_reminders (
          owner_id, organization_id, student_enrollment_id, teacher_id, title, notes, due_date
        ) values (
          ${auth.userId}::uuid, ${auth.organizationId}::uuid, ${enrollmentId}::uuid, ${teacherId}::uuid,
          ${title}, ${payload.notes?.trim() || null},
          coalesce(${payload.dueDate?.trim() || null}::date, current_date)
        )
      `;
      res.status(201).json({
        ok: true,
        data: await listStudentData(sql, auth.userId, auth.organizationId, enrollmentId)
      });
      return;
    }

    if (action === 'complete-reminder' || action === 'delete-reminder') {
      const reminderId = payload.reminderId?.trim();
      if (!reminderId) {
        res.status(400).json({ ok: false, error: 'reminderId est obligatoire.' });
        return;
      }
      if (action === 'complete-reminder') {
        await sql`
          update public.student_teacher_communication_reminders
          set completed_at = case when completed_at is null then now() else null end
          where id = ${reminderId}::uuid
            and owner_id = ${auth.userId}::uuid
            and organization_id = ${auth.organizationId}::uuid
        `;
      } else {
        await sql`
          delete from public.student_teacher_communication_reminders
          where id = ${reminderId}::uuid
            and owner_id = ${auth.userId}::uuid
            and organization_id = ${auth.organizationId}::uuid
        `;
      }
      res.status(200).json({ ok: true, data: { reminderId } });
      return;
    }

    res.status(400).json({ ok: false, error: 'Action inconnue.' });
  } catch (error) {
    logger.error('student_communications.failed', error, { userId: auth.userId });
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Impossible de gérer les communications.'
    });
  }
});
