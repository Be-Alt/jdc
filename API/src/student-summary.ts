import { neon } from '@neondatabase/serverless';
import { withPermissionEndpoint } from './lib/api-guards.js';
import { getEnv } from './lib/env.js';
import { logger } from './lib/logger.js';

function getQueryParam(url: string | undefined, name: string): string | undefined {
  return url ? new URL(url, 'http://localhost').searchParams.get(name)?.trim() || undefined : undefined;
}

function isMissingRelationError(error: unknown, relationName: string): boolean {
  const databaseError = error as { code?: string; message?: string };
  return databaseError?.code === '42P01' && databaseError.message?.includes(relationName) === true;
}

async function loadAttendance(sql: any, ownerId: string, enrollmentId: string, useClassSessions: boolean) {
  const rows = useClassSessions
    ? await sql`
        select
          to_char(cs.session_date, 'YYYY-MM') as month,
          count(*)::int as total,
          count(*) filter (where css.status = 'present')::int as attended
        from public.class_session_students css
        join public.class_sessions cs on cs.id = css.session_id
        where css.student_enrollment_id = ${enrollmentId}::uuid
          and cs.owner_id = ${ownerId}::uuid
          and cs.teacher_is_absent = false
        group by to_char(cs.session_date, 'YYYY-MM')
        order by month
      `
    : await sql`
        select
          to_char(cje.entry_date, 'YYYY-MM') as month,
          count(*)::int as total,
          count(*) filter (where css.status = 'present')::int as attended
        from public.class_session_students css
        join public.class_journal_entries cje on cje.id = css.session_id
        where css.student_enrollment_id = ${enrollmentId}::uuid
          and cje.owner_id = ${ownerId}::uuid
          and cje.teacher_is_absent = false
        group by to_char(cje.entry_date, 'YYYY-MM')
        order by month
      `;

  return (rows as Array<{ month: string; total: number; attended: number }>).map((row) => ({
    ...row,
    percentage: row.total > 0 ? Math.round((row.attended / row.total) * 100) : 0
  }));
}

export default withPermissionEndpoint('GET,OPTIONS', 'students.read', async ({ req, res, auth }) => {
  try {
    const enrollmentId = getQueryParam((req as { url?: string }).url, 'enrollmentId');
    const includeProgram = getQueryParam((req as { url?: string }).url, 'includeProgram') !== 'false';
    if (!enrollmentId) {
      res.status(400).json({ ok: false, error: 'Missing enrollmentId query parameter.' });
      return;
    }

    const sql = neon(getEnv('DATABASE_URL'));
    const enrollmentRows = await sql`
      select se.program_id::text as program_id
      from public.student_enrollments se
      where se.id = ${enrollmentId}::uuid
        and se.owner_id = ${auth.userId}::uuid
      limit 1
    `;
    const enrollment = (enrollmentRows as Array<{ program_id: string | null }>)[0];
    if (!enrollment) {
      res.status(404).json({ ok: false, error: 'Student not found.' });
      return;
    }

    let program = null;
    let workedSkillIds: string[] = [];
    let workedResourceIds: string[] = [];

    if (includeProgram && enrollment.program_id) {
      const programRows = await sql`
        select
          sec.id::text as section_id, sec.code as section_code, sec.level as section_level,
          sec.type as section_type, sec.label as section_label,
          p.id::text as program_id, p.name as program_name, p.hours as program_hours,
          p.valid_from::text as program_valid_from, p.valid_to::text as program_valid_to,
          p.owner_id::text as program_owner_id, p.is_shared as program_is_shared,
          sub.id::text as subject_id, sub.name as subject_name,
          net.id::text as network_id, net.code as network_code, net.name as network_name, net.url as network_url,
          u.id::text as uaa_id, u.code as uaa_code, u.name as uaa_name,
          pt.id::text as process_type_id, pt.name as process_type_name,
          s.id::text as skill_id, s.description as skill_description,
          r.id::text as resource_id, r.description as resource_description,
          c.id::text as competence_id, c.description as competence_description,
          st.id::text as strategy_id, st.description as strategy_description
        from public.programs p
        join public.sections sec on sec.id = p.section_id
        join public.subjects sub on sub.id = p.subject_id
        join public.networks net on net.id = p.network_id
        left join public.uaa u on u.program_id = p.id
        left join public.skills s on s.uaa_id = u.id
        left join public.process_types pt on pt.id = s.process_type_id
        left join public.resources r on r.uaa_id = u.id
        left join public.uaa_competences c on c.uaa_id = u.id
        left join public.uaa_strategies st on st.uaa_id = u.id
        where p.id = ${enrollment.program_id}::uuid
          and (p.is_shared = true or p.owner_id = ${auth.userId}::uuid)
        order by u.code, pt.name, s.description, r.description
      `;

      if (programRows.length > 0) {
        const first = programRows[0] as any;
        const uaaMap = new Map<string, any>();
        for (const row of programRows as any[]) {
          if (!row.uaa_id) continue;
          let uaa = uaaMap.get(row.uaa_id);
          if (!uaa) {
            uaa = { id: row.uaa_id, code: row.uaa_code, name: row.uaa_name, resources: [], competences: [], strategies: [], skillGroups: [] };
            uaaMap.set(row.uaa_id, uaa);
          }
          if (row.resource_id && !uaa.resources.some((item: any) => item.id === row.resource_id)) {
            uaa.resources.push({ id: row.resource_id, description: row.resource_description });
          }
          if (row.competence_id && !uaa.competences.some((item: any) => item.id === row.competence_id)) {
            uaa.competences.push({ id: row.competence_id, description: row.competence_description });
          }
          if (row.strategy_id && !uaa.strategies.some((item: any) => item.id === row.strategy_id)) {
            uaa.strategies.push({ id: row.strategy_id, description: row.strategy_description });
          }
          if (row.skill_id) {
            const groupId = row.process_type_id ?? 'other';
            let group = uaa.skillGroups.find((item: any) => (item.processTypeId ?? 'other') === groupId);
            if (!group) {
              group = { processTypeId: row.process_type_id, processTypeName: row.process_type_name ?? 'Autres', skills: [] };
              uaa.skillGroups.push(group);
            }
            if (!group.skills.some((item: any) => item.id === row.skill_id)) {
              group.skills.push({ id: row.skill_id, description: row.skill_description });
            }
          }
        }
        program = {
          section: {
            id: first.section_id, code: first.section_code, level: first.section_level,
            type: first.section_type, label: first.section_label
          },
          program: {
            id: first.program_id, name: first.program_name, hours: first.program_hours,
            validFrom: first.program_valid_from, validTo: first.program_valid_to,
            subject: { id: first.subject_id, name: first.subject_name },
            network: { id: first.network_id, code: first.network_code, name: first.network_name, url: first.network_url },
            ownerId: first.program_owner_id,
            isShared: first.program_is_shared,
            canEdit:
              first.program_owner_id === auth.userId ||
              auth.role === 'super_admin' ||
              (first.program_is_shared && auth.role === 'program_admin')
          },
          uaas: Array.from(uaaMap.values())
        };
      }

      const workedRows = await sql`
        select
          coalesce(
            array_agg(distinct csss.skill_id::text)
              filter (where csss.skill_id is not null and skill_uaa.program_id = ${enrollment.program_id}::uuid),
            '{}'::text[]
          ) as skill_ids,
          coalesce(
            array_agg(distinct cssr.resource_id::text)
              filter (where cssr.resource_id is not null and resource_uaa.program_id = ${enrollment.program_id}::uuid),
            '{}'::text[]
          ) as resource_ids
        from public.class_session_students css
        left join public.class_session_student_skills csss
          on csss.session_id = css.session_id and csss.student_enrollment_id = css.student_enrollment_id
        left join public.class_session_student_resources cssr
          on cssr.session_id = css.session_id and cssr.student_enrollment_id = css.student_enrollment_id
        left join public.skills selected_skill on selected_skill.id = csss.skill_id
        left join public.uaa skill_uaa on skill_uaa.id = selected_skill.uaa_id
        left join public.resources selected_resource on selected_resource.id = cssr.resource_id
        left join public.uaa resource_uaa on resource_uaa.id = selected_resource.uaa_id
        where css.student_enrollment_id = ${enrollmentId}::uuid
          and (
            css.program_id = ${enrollment.program_id}::uuid
            or skill_uaa.program_id = ${enrollment.program_id}::uuid
            or resource_uaa.program_id = ${enrollment.program_id}::uuid
          )
      `;
      const worked = (workedRows as Array<{ skill_ids: string[]; resource_ids: string[] }>)[0];
      workedSkillIds = worked?.skill_ids ?? [];
      workedResourceIds = worked?.resource_ids ?? [];
    }

    let points;
    try {
      points = await loadAttendance(sql, auth.userId, enrollmentId, true);
    } catch (error) {
      if (!isMissingRelationError(error, 'class_sessions')) throw error;
      points = await loadAttendance(sql, auth.userId, enrollmentId, false);
    }
    const total = points.reduce((sum, point) => sum + point.total, 0);
    const attended = points.reduce((sum, point) => sum + point.attended, 0);

    res.status(200).json({
      ok: true,
      data: {
        program,
        workedSkillIds,
        workedResourceIds,
        attendance: {
          attended,
          total,
          percentage: total > 0 ? Math.round((attended / total) * 100) : 0,
          points
        }
      }
    });
  } catch (error) {
    logger.error('student_summary.failed', error, { userId: auth.userId });
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Impossible de charger la synthèse élève.'
    });
  }
});
