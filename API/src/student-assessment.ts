import { neon } from '@neondatabase/serverless';
import { withPermissionEndpoint } from './lib/api-guards.js';
import { getEnv } from './lib/env.js';
import { logger } from './lib/logger.js';

type AssessmentStatus = 'not_acquired' | 'in_progress' | 'acquired' | 'viewed' | 'not_viewed';
type AssessmentItemType = 'skill' | 'competence' | 'resource';

type AssessmentInput = {
  enrollmentId?: string;
  programId?: string;
  assessments?: Array<{
    itemType?: AssessmentItemType;
    itemId?: string;
    status?: AssessmentStatus;
  }>;
};

function getQueryParam(url: string | undefined, name: string): string | undefined {
  return url ? new URL(url, 'http://localhost').searchParams.get(name)?.trim() || undefined : undefined;
}

async function enrollmentBelongsToOrganization(
  sql: any,
  organizationId: string,
  enrollmentId: string,
  programId: string
): Promise<boolean> {
  const rows = await sql`
    select 1
    from public.student_enrollments
    where id = ${enrollmentId}::uuid
      and organization_id = ${organizationId}::uuid
      and program_id = ${programId}::uuid
    limit 1
  `;
  return rows.length > 0;
}

export default withPermissionEndpoint('GET,PUT,OPTIONS', 'teaching.manage', async ({ req, res, auth }) => {
  try {
    const sql = neon(getEnv('DATABASE_URL'));

    if (req.method === 'GET') {
      const enrollmentId = getQueryParam((req as { url?: string }).url, 'enrollmentId');
      const programId = getQueryParam((req as { url?: string }).url, 'programId');

      if (!enrollmentId || !programId) {
        res.status(400).json({ ok: false, error: 'enrollmentId et programId sont obligatoires.' });
        return;
      }

      if (!(await enrollmentBelongsToOrganization(sql, auth.organizationId, enrollmentId, programId))) {
        res.status(404).json({ ok: false, error: 'Élève ou programme introuvable.' });
        return;
      }

      const rows = await sql`
        select item_type, item_id::text as item_id, status, updated_at::text as updated_at
        from public.student_competency_assessments
        where owner_id = ${auth.userId}::uuid
          and organization_id = ${auth.organizationId}::uuid
          and student_enrollment_id = ${enrollmentId}::uuid
          and program_id = ${programId}::uuid
        order by item_type, item_id
      `;

      res.status(200).json({ ok: true, data: rows });
      return;
    }

    const payload = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body ?? {}) as AssessmentInput;
    const enrollmentId = payload.enrollmentId?.trim();
    const programId = payload.programId?.trim();
    const assessments = payload.assessments ?? [];

    if (!enrollmentId || !programId) {
      res.status(400).json({ ok: false, error: 'enrollmentId et programId sont obligatoires.' });
      return;
    }

    if (!(await enrollmentBelongsToOrganization(sql, auth.organizationId, enrollmentId, programId))) {
      res.status(404).json({ ok: false, error: 'Élève ou programme introuvable.' });
      return;
    }

    const validItems = assessments.filter(
      (item): item is { itemType: AssessmentItemType; itemId: string; status: AssessmentStatus } =>
        (item.itemType === 'skill' || item.itemType === 'competence' || item.itemType === 'resource') &&
        typeof item.itemId === 'string' &&
        ['not_acquired', 'in_progress', 'acquired', 'viewed', 'not_viewed'].includes(item.status ?? '')
    );

    await sql`
      delete from public.student_competency_assessments
      where owner_id = ${auth.userId}::uuid
        and organization_id = ${auth.organizationId}::uuid
        and student_enrollment_id = ${enrollmentId}::uuid
        and program_id = ${programId}::uuid
    `;

    for (const item of validItems) {
      await sql`
        insert into public.student_competency_assessments (
          owner_id,
          organization_id,
          student_enrollment_id,
          program_id,
          item_type,
          item_id,
          status
        )
        values (
          ${auth.userId}::uuid,
          ${auth.organizationId}::uuid,
          ${enrollmentId}::uuid,
          ${programId}::uuid,
          ${item.itemType},
          ${item.itemId}::uuid,
          ${item.status}
        )
      `;
    }

    logger.info('student_assessment.saved', {
      userId: auth.userId,
      enrollmentId,
      programId,
      assessmentCount: validItems.length
    });
    res.status(200).json({ ok: true, data: { count: validItems.length } });
  } catch (error) {
    logger.error('student_assessment.failed', error, { userId: auth.userId });
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Impossible de gérer le bilan.'
    });
  }
});
