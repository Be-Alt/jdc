import { neon } from '@neondatabase/serverless';
import { withAuthenticatedEndpoint } from './lib/api-guards.js';
import { getEnv } from './lib/env.js';
import { logger } from './lib/logger.js';
async function loadSchedule(sql, ownerId) {
    const configs = await sql `
    select
      id::text as id,
      label,
      valid_from::text as valid_from,
      valid_to::text as valid_to,
      organization_id::text as organization_id,
      is_shared_with_org
    from public.weekly_schedule_configs
    where owner_id = ${ownerId}::uuid
    order by valid_from desc, created_at desc
    limit 1
  `;
    const [config] = configs;
    if (!config) {
        return null;
    }
    const slots = await sql `
    select
      id::text as id,
      day_of_week,
      slot_type,
      label,
      to_char(starts_at, 'HH24:MI') as starts_at,
      to_char(ends_at, 'HH24:MI') as ends_at,
      position,
      coalesce(
        array_agg(wsss.student_enrollment_id::text order by wsss.student_enrollment_id)
          filter (where wsss.student_enrollment_id is not null),
        '{}'::text[]
      ) as student_enrollment_ids
    from public.weekly_schedule_slots
    left join public.weekly_schedule_slot_students wsss
      on wsss.slot_id = public.weekly_schedule_slots.id
    where config_id = ${config.id}::uuid
    group by id, day_of_week, slot_type, label, starts_at, ends_at, position
    order by day_of_week asc, position asc, starts_at asc
  `;
    return {
        ...config,
        slots: slots
    };
}
export default withAuthenticatedEndpoint('GET,POST,OPTIONS', async ({ req, res, auth }) => {
    const sql = neon(getEnv('DATABASE_URL'));
    try {
        if (req.method === 'GET') {
            const schedule = await loadSchedule(sql, auth.userId);
            res.status(200).json({
                ok: true,
                data: schedule
            });
            return;
        }
        const input = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body ?? {});
        const label = input.label?.trim();
        const validFrom = input.validFrom?.trim();
        const validTo = input.validTo?.trim() || null;
        const slots = Array.isArray(input.slots) ? input.slots : [];
        const configId = input.configId?.trim() || null;
        if (!label || !validFrom) {
            res.status(400).json({
                ok: false,
                error: 'Missing required weekly schedule fields.'
            });
            return;
        }
        if (slots.length === 0) {
            res.status(400).json({
                ok: false,
                error: 'At least one schedule slot is required.'
            });
            return;
        }
        const normalizedSlots = slots.map((slot, index) => ({
            dayOfWeek: Number(slot.dayOfWeek),
            slotType: slot.slotType,
            label: slot.label?.trim() || '',
            startsAt: slot.startsAt?.trim() || '',
            endsAt: slot.endsAt?.trim() || '',
            position: slot.position ?? index,
            studentEnrollmentIds: Array.isArray(slot.studentEnrollmentIds)
                ? slot.studentEnrollmentIds
                    .map((studentEnrollmentId) => studentEnrollmentId?.trim())
                    .filter((studentEnrollmentId) => Boolean(studentEnrollmentId))
                : []
        }));
        for (const slot of normalizedSlots) {
            if (!Number.isInteger(slot.dayOfWeek) ||
                slot.dayOfWeek < 1 ||
                slot.dayOfWeek > 7 ||
                !slot.slotType ||
                !slot.label ||
                !slot.startsAt ||
                !slot.endsAt) {
                res.status(400).json({
                    ok: false,
                    error: 'Invalid weekly schedule slot payload.'
                });
                return;
            }
            if (slot.slotType !== 'course' && slot.studentEnrollmentIds.length > 0) {
                res.status(400).json({
                    ok: false,
                    error: 'Only course slots can be linked to students.'
                });
                return;
            }
        }
        const organizationId = null;
        let savedConfigId = configId;
        if (savedConfigId) {
            const updatedRows = await sql `
        update public.weekly_schedule_configs
        set
          label = ${label},
          valid_from = ${validFrom}::date,
          valid_to = ${validTo}::date,
          is_shared_with_org = false,
          organization_id = ${organizationId}::uuid
        where id = ${savedConfigId}::uuid
          and owner_id = ${auth.userId}::uuid
        returning id::text as id
      `;
            const [updatedConfig] = updatedRows;
            if (!updatedConfig) {
                res.status(404).json({
                    ok: false,
                    error: 'Weekly schedule config not found.'
                });
                return;
            }
        }
        else {
            const createdRows = await sql `
        insert into public.weekly_schedule_configs (
          owner_id,
          organization_id,
          is_shared_with_org,
          label,
          valid_from,
          valid_to
        )
        values (
          ${auth.userId}::uuid,
          ${organizationId}::uuid,
          false,
          ${label},
          ${validFrom}::date,
          ${validTo}::date
        )
        returning id::text as id
      `;
            const [createdConfig] = createdRows;
            savedConfigId = createdConfig.id;
        }
        await sql `
      delete from public.weekly_schedule_slot_students
      where slot_id in (
        select id
        from public.weekly_schedule_slots
        where config_id = ${savedConfigId}::uuid
      )
    `;
        await sql `
      delete from public.weekly_schedule_slots
      where config_id = ${savedConfigId}::uuid
    `;
        for (const slot of normalizedSlots) {
            const insertedSlots = await sql `
        insert into public.weekly_schedule_slots (
          config_id,
          day_of_week,
          slot_type,
          label,
          starts_at,
          ends_at,
          position
        )
        values (
          ${savedConfigId}::uuid,
          ${slot.dayOfWeek},
          ${slot.slotType},
          ${slot.label},
          ${slot.startsAt}::time,
          ${slot.endsAt}::time,
          ${slot.position}
        )
        returning id::text as id
      `;
            const [insertedSlot] = insertedSlots;
            if (slot.slotType === 'course') {
                for (const studentEnrollmentId of slot.studentEnrollmentIds) {
                    await sql `
            insert into public.weekly_schedule_slot_students (
              slot_id,
              student_enrollment_id
            )
            select
              ${insertedSlot.id}::uuid,
              se.id
            from public.student_enrollments se
            where se.id = ${studentEnrollmentId}::uuid
              and se.owner_id = ${auth.userId}::uuid
          `;
                }
            }
        }
        const schedule = await loadSchedule(sql, auth.userId);
        logger.info('weekly_schedule.saved', {
            userId: auth.userId,
            configId: savedConfigId,
            slots: normalizedSlots.length
        });
        res.status(200).json({
            ok: true,
            data: schedule
        });
    }
    catch (error) {
        logger.error('weekly_schedule.failed', error, {
            userId: auth.userId
        });
        res.status(500).json({
            ok: false,
            error: error instanceof Error ? error.message : 'Unable to manage weekly schedule.'
        });
    }
}, {
    rateLimit: {
        name: 'weekly-schedule',
        windowMs: 60_000,
        max: 120,
        key: 'user'
    }
});
