import { neon } from '@neondatabase/serverless';
import { withAuthenticatedEndpoint } from './lib/api-guards.js';
import { getEnv } from './lib/env.js';
import { logger } from './lib/logger.js';
export default withAuthenticatedEndpoint('POST,OPTIONS', async ({ req, res, auth }) => {
    try {
        const payload = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body ?? {});
        const enrollmentId = payload.enrollmentId?.trim() || null;
        const firstName = payload.firstName?.trim();
        const lastName = payload.lastName?.trim();
        const birthDate = payload.birthDate?.trim() || null;
        const schoolYearId = payload.schoolYearId?.trim();
        const sectionId = payload.sectionId?.trim() || null;
        const schoolId = payload.schoolId?.trim() || null;
        const status = payload.status?.trim() || 'active';
        const teacherIds = schoolId && Array.isArray(payload.teacherIds)
            ? Array.from(new Set(payload.teacherIds
                .map((value) => (typeof value === 'string' ? value.trim() : ''))
                .filter(Boolean)))
            : [];
        const accommodationIds = Array.isArray(payload.accommodationIds)
            ? Array.from(new Set(payload.accommodationIds
                .map((value) => Number(value))
                .filter((value) => Number.isInteger(value))))
            : [];
        const dysIds = Array.isArray(payload.dysIds)
            ? payload.dysIds
                .map((value) => Number(value))
                .filter((value) => Number.isInteger(value))
            : [];
        if (!firstName || !lastName || !schoolYearId) {
            res.status(400).json({
                ok: false,
                error: 'Missing required student fields.'
            });
            return;
        }
        const sql = neon(getEnv('DATABASE_URL'));
        if (enrollmentId) {
            const existingRows = await sql `
        select
          se.id as enrollment_id,
          se.person_id::text as person_id,
          se.organization_id::text as organization_id,
          se.is_shared_with_org
        from public.student_enrollments se
        where se.id = ${enrollmentId}::uuid
          and se.owner_id = ${auth.userId}::uuid
        limit 1
      `;
            const [existingStudent] = existingRows;
            if (!existingStudent) {
                res.status(404).json({
                    ok: false,
                    error: 'Student not found.'
                });
                return;
            }
            await sql `
        update public.persons
        set
          first_name = ${firstName},
          last_name = ${lastName},
          birth_date = ${birthDate}::date
        where id = ${existingStudent.person_id}::uuid
          and owner_id = ${auth.userId}::uuid
      `;
            await sql `
        update public.student_enrollments
        set
          school_year_id = ${schoolYearId}::uuid,
          section_id = ${sectionId}::uuid,
          status = ${status}
        where id = ${enrollmentId}::uuid
          and owner_id = ${auth.userId}::uuid
      `;
            const activeSchoolRows = await sql `
        select id
        from public.student_school_history
        where student_enrollment_id = ${enrollmentId}::uuid
          and end_date is null
        limit 1
      `;
            const [activeSchoolRow] = activeSchoolRows;
            if (schoolId) {
                if (activeSchoolRow) {
                    await sql `
            update public.student_school_history
            set school_id = ${schoolId}::uuid
            where id = ${activeSchoolRow.id}::uuid
          `;
                }
                else {
                    await sql `
            insert into public.student_school_history (
              student_enrollment_id,
              school_id,
              start_date
            )
            values (
              ${enrollmentId}::uuid,
              ${schoolId}::uuid,
              current_date
            )
          `;
                }
            }
            else if (activeSchoolRow) {
                await sql `
          update public.student_school_history
          set end_date = current_date
          where id = ${activeSchoolRow.id}::uuid
        `;
            }
            await sql `
        delete from public.student_teachers
        where student_enrollment_id = ${enrollmentId}::uuid
      `;
            if (teacherIds.length > 0) {
                const validTeacherRows = await sql `
          select id::text as id
          from public.teachers
          where owner_id = ${auth.userId}::uuid
            and school_id = ${schoolId}::uuid
            and id = any(${teacherIds}::uuid[])
        `;
                for (const teacher of validTeacherRows) {
                    await sql `
            insert into public.student_teachers (
              student_enrollment_id,
              teacher_id
            )
            values (
              ${enrollmentId}::uuid,
              ${teacher.id}::uuid
            )
          `;
                }
            }
            await sql `
        delete from public.student_accommodations
        where student_id = ${existingStudent.person_id}::uuid
      `;
            if (accommodationIds.length > 0 && dysIds.length > 0) {
                const validAccommodationRows = await sql `
          select a.id
          from public.accommodations a
          where a.dys_id = any(${dysIds}::int[])
            and a.id = any(${accommodationIds}::int[])
        `;
                for (const accommodation of validAccommodationRows) {
                    await sql `
            insert into public.student_accommodations (
              student_id,
              accommodation_id
            )
            values (
              ${existingStudent.person_id}::uuid,
              ${accommodation.id}
            )
          `;
                }
            }
            await sql `
        delete from public.student_dys
        where student_id = ${existingStudent.person_id}::uuid
      `;
            for (const dysId of dysIds) {
                await sql `
          insert into public.student_dys (
            student_id,
            dys_id
          )
          values (
            ${existingStudent.person_id}::uuid,
            ${dysId}
          )
        `;
            }
            logger.info('student.updated', {
                userId: auth.userId,
                enrollmentId
            });
            res.status(200).json({
                ok: true,
                data: {
                    enrollmentId
                }
            });
            return;
        }
        const personRows = await sql `
      insert into public.persons (
        first_name,
        last_name,
        birth_date,
        owner_id
      )
      values (
        ${firstName},
        ${lastName},
        ${birthDate}::date,
        ${auth.userId}::uuid
      )
      returning id::text as id
    `;
        const [person] = personRows;
        const enrollmentRows = await sql `
      insert into public.student_enrollments (
        person_id,
        school_year_id,
        section_id,
        status,
        owner_id,
        organization_id,
        is_shared_with_org
      )
      values (
        ${person.id}::uuid,
        ${schoolYearId}::uuid,
        ${sectionId}::uuid,
        ${status},
        ${auth.userId}::uuid,
        null,
        false
      )
      returning id::text as id
    `;
        const [enrollment] = enrollmentRows;
        if (teacherIds.length > 0) {
            const validTeacherRows = await sql `
        select id::text as id
        from public.teachers
        where owner_id = ${auth.userId}::uuid
          and school_id = ${schoolId}::uuid
          and id = any(${teacherIds}::uuid[])
      `;
            for (const teacher of validTeacherRows) {
                await sql `
          insert into public.student_teachers (
            student_enrollment_id,
            teacher_id
          )
          values (
            ${enrollment.id}::uuid,
            ${teacher.id}::uuid
          )
        `;
            }
        }
        if (accommodationIds.length > 0 && dysIds.length > 0) {
            const validAccommodationRows = await sql `
        select a.id
        from public.accommodations a
        where a.dys_id = any(${dysIds}::int[])
          and a.id = any(${accommodationIds}::int[])
      `;
            for (const accommodation of validAccommodationRows) {
                await sql `
          insert into public.student_accommodations (
            student_id,
            accommodation_id
          )
          values (
            ${person.id}::uuid,
            ${accommodation.id}
          )
        `;
            }
        }
        for (const dysId of dysIds) {
            await sql `
        insert into public.student_dys (
          student_id,
          dys_id
        )
        values (
          ${person.id}::uuid,
          ${dysId}
        )
      `;
        }
        if (schoolId) {
            await sql `
        insert into public.student_school_history (
          student_enrollment_id,
          school_id,
          start_date
        )
        values (
          ${enrollment.id}::uuid,
          ${schoolId}::uuid,
          current_date
        )
      `;
        }
        logger.info('student.created', {
            userId: auth.userId,
            enrollmentId: enrollment.id
        });
        res.status(201).json({
            ok: true,
            data: {
                enrollmentId: enrollment.id
            }
        });
    }
    catch (error) {
        logger.error('student.upsert_failed', error, {
            userId: auth.userId
        });
        res.status(500).json({
            ok: false,
            error: error instanceof Error ? error.message : 'Unable to save student.'
        });
    }
}, {
    rateLimit: {
        name: 'student-upsert',
        windowMs: 60_000,
        max: 60,
        key: 'user'
    }
});
