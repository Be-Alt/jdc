import { neon } from '@neondatabase/serverless';
import { withAuthenticatedEndpoint } from './lib/api-guards.js';
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
async function loadEntriesByDate(sql, ownerId, entryDate) {
    const rows = await sql `
    select
      cje.id::text as id,
      cje.entry_date::text as entry_date,
      cje.weekly_schedule_slot_id::text as weekly_schedule_slot_id,
      cje.slot_key,
      cje.title,
      to_char(cje.starts_at, 'HH24:MI') as starts_at,
      to_char(cje.ends_at, 'HH24:MI') as ends_at,
      cje.section_id::text as section_id,
      cje.network_id::text as network_id,
      cje.notes,
      cje.teacher_is_absent,
      cje.teacher_absence_has_cm,
      cje.status,
      coalesce(skills.selected_skill_ids, '{}'::text[]) as selected_skill_ids,
      coalesce(resources.selected_resource_ids, '{}'::text[]) as selected_resource_ids,
      coalesce(students.student_statuses, '[]'::json) as student_statuses,
      cje.updated_at::text as updated_at
    from public.class_journal_entries cje
    left join lateral (
      select
        array_agg(cjes.skill_id::text order by cjes.skill_id::text) as selected_skill_ids
      from public.class_journal_entry_skills cjes
      where cjes.entry_id = cje.id
    ) skills on true
    left join lateral (
      select
        array_agg(cjer.resource_id::text order by cjer.resource_id::text) as selected_resource_ids
      from public.class_journal_entry_resources cjer
      where cjer.entry_id = cje.id
    ) resources on true
    left join lateral (
      select
        json_agg(
          json_build_object(
            'student_enrollment_id', cjes2.student_enrollment_id::text,
            'attendance_status', cjes2.attendance_status
          )
          order by cjes2.student_enrollment_id::text
        ) as student_statuses
      from public.class_journal_entry_students cjes2
      where cjes2.entry_id = cje.id
    ) students on true
    where cje.owner_id = ${ownerId}::uuid
      and cje.entry_date = ${entryDate}::date
    order by cje.starts_at asc, cje.title asc
  `;
    return rows;
}
async function assertSlotBelongsToOwner(sql, ownerId, weeklyScheduleSlotId) {
    const rows = await sql `
    select wss.id::text as id
    from public.weekly_schedule_slots wss
    join public.weekly_schedule_configs wsc
      on wsc.id = wss.config_id
    where wss.id = ${weeklyScheduleSlotId}::uuid
      and wsc.owner_id = ${ownerId}::uuid
    limit 1
  `;
    return rows.length > 0;
}
export default withAuthenticatedEndpoint('GET,POST,OPTIONS', async ({ req, res, auth }) => {
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
            const entries = await loadEntriesByDate(sql, auth.userId, date);
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
        const sectionId = input.sectionId?.trim() || null;
        const networkId = input.networkId?.trim() || null;
        const notes = input.notes ?? '';
        const teacherIsAbsent = input.teacherIsAbsent === true;
        const teacherAbsenceHasCm = teacherIsAbsent && input.teacherAbsenceHasCm === true;
        const status = input.status === 'done' ? 'done' : 'draft';
        const selectedSkillIds = getStringArray(input.selectedSkillIds);
        const selectedResourceIds = getStringArray(input.selectedResourceIds);
        const studentStatuses = Array.isArray(input.studentStatuses)
            ? input.studentStatuses
                .map((item) => ({
                studentEnrollmentId: item.studentEnrollmentId?.trim() || '',
                attendanceStatus: item.attendanceStatus === 'absent' ||
                    item.attendanceStatus === 'late' ||
                    item.attendanceStatus === 'excused'
                    ? item.attendanceStatus
                    : 'present'
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
        if (weeklyScheduleSlotId && !(await assertSlotBelongsToOwner(sql, auth.userId, weeklyScheduleSlotId))) {
            res.status(404).json({
                ok: false,
                error: 'Weekly schedule slot not found.'
            });
            return;
        }
        const upsertedEntries = await sql `
      insert into public.class_journal_entries (
        owner_id,
        entry_date,
        weekly_schedule_slot_id,
        slot_key,
        title,
        starts_at,
        ends_at,
        section_id,
        network_id,
        notes,
        teacher_is_absent,
        teacher_absence_has_cm,
        status
      )
      values (
        ${auth.userId}::uuid,
        ${date}::date,
        ${weeklyScheduleSlotId}::uuid,
        ${slotKey},
        ${title},
        ${startsAt}::time,
        ${endsAt}::time,
        ${sectionId}::uuid,
        ${networkId}::uuid,
        ${notes},
        ${teacherIsAbsent},
        ${teacherAbsenceHasCm},
        ${status}
      )
      on conflict (owner_id, entry_date, slot_key)
      do update set
        weekly_schedule_slot_id = excluded.weekly_schedule_slot_id,
        title = excluded.title,
        starts_at = excluded.starts_at,
        ends_at = excluded.ends_at,
        section_id = excluded.section_id,
        network_id = excluded.network_id,
        notes = excluded.notes,
        teacher_is_absent = excluded.teacher_is_absent,
        teacher_absence_has_cm = excluded.teacher_absence_has_cm,
        status = excluded.status
      returning id::text as id
    `;
        const [entry] = upsertedEntries;
        await sql `
      delete from public.class_journal_entry_skills
      where entry_id = ${entry.id}::uuid
    `;
        for (const skillId of selectedSkillIds) {
            await sql `
        insert into public.class_journal_entry_skills (entry_id, skill_id)
        select ${entry.id}::uuid, s.id
        from public.skills s
        where s.id = ${skillId}::uuid
        on conflict do nothing
      `;
        }
        await sql `
      delete from public.class_journal_entry_resources
      where entry_id = ${entry.id}::uuid
    `;
        for (const resourceId of selectedResourceIds) {
            await sql `
        insert into public.class_journal_entry_resources (entry_id, resource_id)
        select ${entry.id}::uuid, r.id
        from public.resources r
        where r.id = ${resourceId}::uuid
        on conflict do nothing
      `;
        }
        await sql `
      delete from public.class_journal_entry_students
      where entry_id = ${entry.id}::uuid
    `;
        for (const studentStatus of studentStatuses) {
            await sql `
        insert into public.class_journal_entry_students (
          entry_id,
          student_enrollment_id,
          attendance_status
        )
        select
          ${entry.id}::uuid,
          se.id,
          ${studentStatus.attendanceStatus}
        from public.student_enrollments se
        where se.id = ${studentStatus.studentEnrollmentId}::uuid
          and se.owner_id = ${auth.userId}::uuid
        on conflict (entry_id, student_enrollment_id)
        do update set
          attendance_status = excluded.attendance_status,
          updated_at = now()
      `;
        }
        const entries = await loadEntriesByDate(sql, auth.userId, date);
        const savedEntry = entries.find((item) => item.id === entry.id) ?? null;
        logger.info('class_journal.saved', {
            userId: auth.userId,
            entryId: entry.id,
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
