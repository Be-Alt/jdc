import { neon } from '@neondatabase/serverless';
import { withPermissionEndpoint } from './lib/api-guards.js';
import { getEnv } from './lib/env.js';
import { logger } from './lib/logger.js';
function getQueryParam(url, name) {
    if (!url) {
        return undefined;
    }
    return new URL(url, 'http://localhost').searchParams.get(name)?.trim() || undefined;
}
function getStringArray(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    return value
        .map((item) => item?.trim())
        .filter((item) => Boolean(item))
        .filter((item, index, collection) => collection.indexOf(item) === index);
}
function getIndicatorValue(value) {
    if (value === null || value === undefined) {
        return null;
    }
    const numberValue = Number(value);
    return Number.isInteger(numberValue) && numberValue >= 0 && numberValue <= 5
        ? numberValue
        : null;
}
function isMissingRelationError(error, relationName) {
    if (!error || typeof error !== 'object') {
        return false;
    }
    const databaseError = error;
    return databaseError.code === '42P01' && databaseError.message?.includes(relationName) === true;
}
async function loadEntriesByDateFromClassSessions(sql, ownerId, organizationId, entryDate) {
    const rows = await sql `
    select
      cs.id::text as id,
      cs.session_date::text as session_date,
      cs.weekly_schedule_slot_id::text as weekly_schedule_slot_id,
      cs.slot_key,
      cs.title,
      to_char(cs.starts_at, 'HH24:MI') as starts_at,
      to_char(cs.ends_at, 'HH24:MI') as ends_at,
      cs.teacher_is_absent,
      cs.teacher_absence_has_cm,
      coalesce(students.students, '[]'::json) as students,
      cs.updated_at::text as updated_at
    from public.class_sessions cs
    left join lateral (
      select
        json_agg(
          json_build_object(
            'student_enrollment_id', css.student_enrollment_id::text,
            'section_id', css.section_id::text,
            'network_id', css.network_id::text,
            'program_id', css.program_id::text,
            'attendance_status', css.status,
            'comment', coalesce(css.comment, ''),
            'fatigue_level', css.fatigue_level,
            'concentration_level', css.concentration_level,
            'motivation_level', css.motivation_level,
            'emotional_wellbeing_level', css.emotional_wellbeing_level,
            'selected_skill_ids', coalesce(skills.selected_skill_ids, '{}'::text[]),
            'selected_resource_ids', coalesce(resources.selected_resource_ids, '{}'::text[]),
            'selected_observation_ids', coalesce(observations.selected_observation_ids, '{}'::text[])
          )
          order by css.student_enrollment_id::text
        ) as students
      from public.class_session_students css
      left join lateral (
        select
          array_agg(csss.skill_id::text order by csss.skill_id::text) as selected_skill_ids
        from public.class_session_student_skills csss
        where csss.session_id = css.session_id
          and csss.student_enrollment_id = css.student_enrollment_id
      ) skills on true
      left join lateral (
        select
          array_agg(cssr.resource_id::text order by cssr.resource_id::text) as selected_resource_ids
        from public.class_session_student_resources cssr
        where cssr.session_id = css.session_id
          and cssr.student_enrollment_id = css.student_enrollment_id
      ) resources on true
      left join lateral (
        select
          array_agg(csso.observation_item_id order by csso.observation_item_id) as selected_observation_ids
        from public.class_session_student_observations csso
        where csso.session_id = css.session_id
          and csso.student_enrollment_id = css.student_enrollment_id
      ) observations on true
      where css.session_id = cs.id
    ) students on true
    where cs.owner_id = ${ownerId}::uuid
      and cs.organization_id = ${organizationId}::uuid
      and cs.session_date = ${entryDate}::date
    order by cs.starts_at asc, cs.title asc
  `;
    return rows;
}
async function loadEntriesByDateFromLegacyEntries(sql, ownerId, organizationId, entryDate) {
    const rows = await sql `
    select
      cje.id::text as id,
      cje.entry_date::text as session_date,
      cje.weekly_schedule_slot_id::text as weekly_schedule_slot_id,
      cje.slot_key,
      cje.title,
      to_char(cje.starts_at, 'HH24:MI') as starts_at,
      to_char(cje.ends_at, 'HH24:MI') as ends_at,
      cje.teacher_is_absent,
      cje.teacher_absence_has_cm,
      coalesce(students.students, '[]'::json) as students,
      cje.updated_at::text as updated_at
    from public.class_journal_entries cje
    left join lateral (
      select
        json_agg(
          json_build_object(
            'student_enrollment_id', css.student_enrollment_id::text,
            'section_id', css.section_id::text,
            'network_id', css.network_id::text,
            'program_id', css.program_id::text,
            'attendance_status', css.status,
            'comment', coalesce(css.comment, ''),
            'fatigue_level', css.fatigue_level,
            'concentration_level', css.concentration_level,
            'motivation_level', css.motivation_level,
            'emotional_wellbeing_level', css.emotional_wellbeing_level,
            'selected_skill_ids', coalesce(skills.selected_skill_ids, '{}'::text[]),
            'selected_resource_ids', coalesce(resources.selected_resource_ids, '{}'::text[]),
            'selected_observation_ids', coalesce(observations.selected_observation_ids, '{}'::text[])
          )
          order by css.student_enrollment_id::text
        ) as students
      from public.class_session_students css
      left join lateral (
        select
          array_agg(csss.skill_id::text order by csss.skill_id::text) as selected_skill_ids
        from public.class_session_student_skills csss
        where csss.session_id = css.session_id
          and csss.student_enrollment_id = css.student_enrollment_id
      ) skills on true
      left join lateral (
        select
          array_agg(cssr.resource_id::text order by cssr.resource_id::text) as selected_resource_ids
        from public.class_session_student_resources cssr
        where cssr.session_id = css.session_id
          and cssr.student_enrollment_id = css.student_enrollment_id
      ) resources on true
      left join lateral (
        select
          array_agg(csso.observation_item_id order by csso.observation_item_id) as selected_observation_ids
        from public.class_session_student_observations csso
        where csso.session_id = css.session_id
          and csso.student_enrollment_id = css.student_enrollment_id
      ) observations on true
      where css.session_id = cje.id
    ) students on true
    where cje.owner_id = ${ownerId}::uuid
      and cje.organization_id = ${organizationId}::uuid
      and cje.entry_date = ${entryDate}::date
    order by cje.starts_at asc, cje.title asc
  `;
    return rows;
}
async function loadEntriesByDate(sql, ownerId, organizationId, entryDate) {
    try {
        return await loadEntriesByDateFromClassSessions(sql, ownerId, organizationId, entryDate);
    }
    catch (error) {
        if (!isMissingRelationError(error, 'class_sessions')) {
            throw error;
        }
        return loadEntriesByDateFromLegacyEntries(sql, ownerId, organizationId, entryDate);
    }
}
async function assertSlotBelongsToOwner(sql, ownerId, organizationId, weeklyScheduleSlotId) {
    const rows = await sql `
    select wss.id::text as id
    from public.weekly_schedule_slots wss
    join public.weekly_schedule_configs wsc
      on wsc.id = wss.config_id
    where wss.id = ${weeklyScheduleSlotId}::uuid
      and wsc.owner_id = ${ownerId}::uuid
      and wsc.organization_id = ${organizationId}::uuid
    limit 1
  `;
    return rows.length > 0;
}
async function upsertSessionIntoClassSessions(sql, input) {
    const upsertedSessions = await sql `
    insert into public.class_sessions (
      owner_id,
      organization_id,
      session_date,
      weekly_schedule_slot_id,
      slot_key,
      title,
      starts_at,
      ends_at,
      teacher_is_absent,
      teacher_absence_has_cm
    )
    values (
      ${input.ownerId}::uuid,
      ${input.organizationId}::uuid,
      ${input.date}::date,
      ${input.weeklyScheduleSlotId}::uuid,
      ${input.slotKey},
      ${input.title},
      ${input.startsAt}::time,
      ${input.endsAt}::time,
      ${input.teacherIsAbsent},
      ${input.teacherAbsenceHasCm}
    )
    on conflict (owner_id, session_date, slot_key)
    do update set
      weekly_schedule_slot_id = excluded.weekly_schedule_slot_id,
      organization_id = excluded.organization_id,
      title = excluded.title,
      starts_at = excluded.starts_at,
      ends_at = excluded.ends_at,
      teacher_is_absent = excluded.teacher_is_absent,
      teacher_absence_has_cm = excluded.teacher_absence_has_cm
    returning id::text as id
  `;
    return upsertedSessions[0]?.id ?? '';
}
async function upsertSessionIntoLegacyEntries(sql, input) {
    const upsertedEntries = await sql `
    insert into public.class_journal_entries (
      owner_id,
      organization_id,
      entry_date,
      weekly_schedule_slot_id,
      slot_key,
      title,
      starts_at,
      ends_at,
      teacher_is_absent,
      teacher_absence_has_cm
    )
    values (
      ${input.ownerId}::uuid,
      ${input.organizationId}::uuid,
      ${input.date}::date,
      ${input.weeklyScheduleSlotId}::uuid,
      ${input.slotKey},
      ${input.title},
      ${input.startsAt}::time,
      ${input.endsAt}::time,
      ${input.teacherIsAbsent},
      ${input.teacherAbsenceHasCm}
    )
    on conflict (owner_id, entry_date, slot_key)
    do update set
      weekly_schedule_slot_id = excluded.weekly_schedule_slot_id,
      organization_id = excluded.organization_id,
      title = excluded.title,
      starts_at = excluded.starts_at,
      ends_at = excluded.ends_at,
      teacher_is_absent = excluded.teacher_is_absent,
      teacher_absence_has_cm = excluded.teacher_absence_has_cm
    returning id::text as id
  `;
    return upsertedEntries[0]?.id ?? '';
}
async function upsertSession(sql, input) {
    try {
        return await upsertSessionIntoClassSessions(sql, input);
    }
    catch (error) {
        if (!isMissingRelationError(error, 'class_sessions')) {
            throw error;
        }
        return upsertSessionIntoLegacyEntries(sql, input);
    }
}
export default withPermissionEndpoint('GET,POST,OPTIONS', 'teaching.manage', async ({ req, res, auth }) => {
    const sql = neon(getEnv('DATABASE_URL'));
    try {
        if (req.method === 'GET') {
            const date = getQueryParam(req.url, 'date');
            if (!date) {
                res.status(400).json({
                    ok: false,
                    error: 'Missing date query parameter.'
                });
                return;
            }
            const entries = await loadEntriesByDate(sql, auth.userId, auth.organizationId, date);
            res.status(200).json({
                ok: true,
                data: entries
            });
            return;
        }
        const input = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body ?? {});
        const date = input.date?.trim();
        const slotKey = input.slotKey?.trim();
        const title = input.title?.trim();
        const startsAt = input.startsAt?.trim();
        const endsAt = input.endsAt?.trim();
        const weeklyScheduleSlotId = input.weeklyScheduleSlotId?.trim() || null;
        const teacherIsAbsent = input.teacherIsAbsent === true;
        const teacherAbsenceHasCm = teacherIsAbsent && input.teacherAbsenceHasCm === true;
        const studentEntries = Array.isArray(input.studentEntries)
            ? input.studentEntries
                .map((item) => ({
                studentEnrollmentId: item.studentEnrollmentId?.trim() || '',
                sectionId: item.sectionId?.trim() || null,
                networkId: item.networkId?.trim() || null,
                programId: item.programId?.trim() || null,
                attendanceStatus: item.attendanceStatus === 'absent' ||
                    item.attendanceStatus === 'late' ||
                    item.attendanceStatus === 'excused'
                    ? item.attendanceStatus
                    : 'present',
                comment: item.comment?.trim() || '',
                selectedSkillIds: getStringArray(item.selectedSkillIds),
                selectedResourceIds: getStringArray(item.selectedResourceIds),
                selectedObservationIds: getStringArray(item.selectedObservationIds),
                fatigueLevel: getIndicatorValue(item.fatigueLevel),
                concentrationLevel: getIndicatorValue(item.concentrationLevel),
                motivationLevel: getIndicatorValue(item.motivationLevel),
                emotionalWellbeingLevel: getIndicatorValue(item.emotionalWellbeingLevel)
            }))
                .filter((item) => Boolean(item.studentEnrollmentId))
            : [];
        if (!date || !slotKey || !title || !startsAt || !endsAt) {
            res.status(400).json({
                ok: false,
                error: 'Missing required class journal fields.'
            });
            return;
        }
        if (weeklyScheduleSlotId &&
            !(await assertSlotBelongsToOwner(sql, auth.userId, auth.organizationId, weeklyScheduleSlotId))) {
            res.status(404).json({
                ok: false,
                error: 'Weekly schedule slot not found.'
            });
            return;
        }
        const sessionId = await upsertSession(sql, {
            ownerId: auth.userId,
            organizationId: auth.organizationId,
            date,
            weeklyScheduleSlotId,
            slotKey,
            title,
            startsAt,
            endsAt,
            teacherIsAbsent,
            teacherAbsenceHasCm
        });
        if (!sessionId) {
            throw new Error('Unable to create the class journal session.');
        }
        await sql `
      delete from public.class_session_students
      where session_id = ${sessionId}::uuid
    `;
        for (const studentEntry of studentEntries) {
            const insertedStudents = await sql `
        insert into public.class_session_students (
          session_id,
          student_enrollment_id,
          section_id,
          network_id,
          program_id,
          status,
          comment,
          fatigue_level,
          concentration_level,
          motivation_level,
          emotional_wellbeing_level
        )
        select
          ${sessionId}::uuid,
          se.id,
          ${studentEntry.sectionId}::uuid,
          ${studentEntry.networkId}::uuid,
          ${studentEntry.programId}::uuid,
          ${studentEntry.attendanceStatus},
          ${studentEntry.comment},
          ${studentEntry.fatigueLevel},
          ${studentEntry.concentrationLevel},
          ${studentEntry.motivationLevel},
          ${studentEntry.emotionalWellbeingLevel}
        from public.student_enrollments se
        where se.id = ${studentEntry.studentEnrollmentId}::uuid
          and se.organization_id = ${auth.organizationId}::uuid
          and (
            ${studentEntry.sectionId}::uuid is null
            or exists (
              select 1
              from public.sections sec
              where sec.id = ${studentEntry.sectionId}::uuid
                and sec.organization_id = ${auth.organizationId}::uuid
            )
          )
          and (
            ${studentEntry.networkId}::uuid is null
            or exists (
              select 1
              from public.networks net
              where net.id = ${studentEntry.networkId}::uuid
                and net.organization_id = ${auth.organizationId}::uuid
            )
          )
          and (
            ${studentEntry.programId}::uuid is null
            or exists (
              select 1
              from public.programs prog
              where prog.id = ${studentEntry.programId}::uuid
                and prog.organization_id = ${auth.organizationId}::uuid
            )
          )
        returning student_enrollment_id::text as student_enrollment_id
      `;
            if (!insertedStudents.length) {
                continue;
            }
            for (const skillId of studentEntry.selectedSkillIds) {
                await sql `
          insert into public.class_session_student_skills (session_id, student_enrollment_id, skill_id)
          select ${sessionId}::uuid, ${studentEntry.studentEnrollmentId}::uuid, s.id
          from public.skills s
          join public.uaa u on u.id = s.uaa_id
          join public.programs p on p.id = u.program_id
          where s.id = ${skillId}::uuid
            and p.organization_id = ${auth.organizationId}::uuid
          on conflict do nothing
        `;
            }
            for (const resourceId of studentEntry.selectedResourceIds) {
                await sql `
          insert into public.class_session_student_resources (session_id, student_enrollment_id, resource_id)
          select ${sessionId}::uuid, ${studentEntry.studentEnrollmentId}::uuid, r.id
          from public.resources r
          join public.uaa u on u.id = r.uaa_id
          join public.programs p on p.id = u.program_id
          where r.id = ${resourceId}::uuid
            and p.organization_id = ${auth.organizationId}::uuid
          on conflict do nothing
        `;
            }
            for (const observationId of studentEntry.selectedObservationIds) {
                await sql `
          insert into public.class_session_student_observations (
            session_id,
            student_enrollment_id,
            observation_item_id
          )
          select
            ${sessionId}::uuid,
            ${studentEntry.studentEnrollmentId}::uuid,
            oi.id
          from public.observation_items oi
          where oi.id = ${observationId}
          on conflict do nothing
        `;
            }
        }
        const entries = await loadEntriesByDate(sql, auth.userId, auth.organizationId, date);
        const savedEntry = entries.find((item) => item.id === sessionId) ?? null;
        logger.info('class_journal.saved', {
            userId: auth.userId,
            sessionId,
            date,
            slotKey
        });
        res.status(200).json({
            ok: true,
            data: savedEntry
        });
    }
    catch (error) {
        logger.error('class_journal.failed', error, {
            userId: auth.userId
        });
        res.status(500).json({
            ok: false,
            error: error instanceof Error ? error.message : 'Unable to manage class journal.'
        });
    }
}, {
    rateLimit: {
        name: 'class-journal',
        windowMs: 60_000,
        max: 180,
        key: 'user'
    }
});
