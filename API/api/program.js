import { neon } from '@neondatabase/serverless';
import { withAuthenticatedEndpoint } from './lib/api-guards.js';
import { getEnv } from './lib/env.js';
import { logger } from './lib/logger.js';
import { hasPermission } from './lib/permissions.js';
function getQueryParam(url, name) {
    if (!url) {
        return undefined;
    }
    const query = new URL(url, 'http://localhost').searchParams.get(name)?.trim();
    return query || undefined;
}
function upsertResource(collection, resourceId, resourceDescription) {
    if (!collection.some((resource) => resource.id === resourceId)) {
        collection.push({
            id: resourceId,
            description: resourceDescription
        });
    }
}
function transformProgramRows(rows) {
    const firstRow = rows[0];
    const uaaMap = new Map();
    const subject = firstRow.subject_id && firstRow.subject_name
        ? {
            id: firstRow.subject_id,
            name: firstRow.subject_name
        }
        : null;
    const network = firstRow.network_id && firstRow.network_code && firstRow.network_name
        ? {
            id: firstRow.network_id,
            code: firstRow.network_code,
            name: firstRow.network_name,
            url: firstRow.network_url
        }
        : null;
    for (const row of rows) {
        if (!row.uaa_id || !row.uaa_code || !row.uaa_name) {
            continue;
        }
        let uaa = uaaMap.get(row.uaa_id);
        if (!uaa) {
            uaa = {
                id: row.uaa_id,
                code: row.uaa_code,
                name: row.uaa_name,
                resources: [],
                competences: [],
                strategies: [],
                skillGroups: []
            };
            uaaMap.set(row.uaa_id, uaa);
        }
        if (row.resource_id && row.resource_description) {
            upsertResource(uaa.resources, row.resource_id, row.resource_description);
        }
        if (row.competence_id && row.competence_description) {
            upsertResource(uaa.competences, row.competence_id, row.competence_description);
        }
        if (row.strategy_id && row.strategy_description) {
            upsertResource(uaa.strategies, row.strategy_id, row.strategy_description);
        }
        if (!row.skill_id || !row.skill_description) {
            continue;
        }
        const processTypeName = row.process_type_name ?? 'Autres';
        let group = uaa.skillGroups.find((skillGroup) => skillGroup.processTypeId === row.process_type_id && skillGroup.processTypeName === processTypeName);
        if (!group) {
            group = {
                processTypeId: row.process_type_id,
                processTypeName,
                skills: []
            };
            uaa.skillGroups.push(group);
        }
        let skill = group.skills.find((item) => item.id === row.skill_id);
        if (!skill) {
            skill = {
                id: row.skill_id,
                description: row.skill_description
            };
            group.skills.push(skill);
        }
    }
    return {
        section: firstRow.section_id && firstRow.section_code && firstRow.section_level !== null &&
            firstRow.section_type && firstRow.section_label
            ? {
                id: firstRow.section_id,
                code: firstRow.section_code,
                level: firstRow.section_level,
                type: firstRow.section_type,
                label: firstRow.section_label
            }
            : null,
        program: firstRow.program_id && firstRow.program_hours !== null
            ? {
                id: firstRow.program_id,
                name: firstRow.program_name,
                hours: firstRow.program_hours,
                validFrom: firstRow.program_valid_from,
                validTo: firstRow.program_valid_to,
                subject,
                network,
                ownerId: firstRow.owner_id,
                isShared: firstRow.is_shared,
                canEdit: firstRow.can_edit
            }
            : null,
        uaas: Array.from(uaaMap.values()).map((uaa) => ({
            ...uaa,
            skillGroups: uaa.skillGroups.filter((group) => group.skills.length > 0)
        }))
    };
}
async function cloneUaa(sql, sourceUaaId, targetProgramId) {
    const insertedUaaRows = await sql `
    insert into public.uaa (
      program_id,
      code,
      name
    )
    select
      ${targetProgramId}::uuid,
      code,
      name
    from public.uaa
    where id = ${sourceUaaId}::uuid
    returning id::text as id
  `;
    const [insertedUaa] = insertedUaaRows;
    if (!insertedUaa) {
        throw new Error('UAA source introuvable.');
    }
    await sql `
    insert into public.resources (
      uaa_id,
      description
    )
    select
      ${insertedUaa.id}::uuid,
      description
    from public.resources
    where uaa_id = ${sourceUaaId}::uuid
  `;
    await sql `
    insert into public.uaa_competences (
      uaa_id,
      description
    )
    select
      ${insertedUaa.id}::uuid,
      description
    from public.uaa_competences
    where uaa_id = ${sourceUaaId}::uuid
  `;
    await sql `
    insert into public.uaa_strategies (
      uaa_id,
      description
    )
    select
      ${insertedUaa.id}::uuid,
      description
    from public.uaa_strategies
    where uaa_id = ${sourceUaaId}::uuid
  `;
    await sql `
    insert into public.skills (
      uaa_id,
      process_type_id,
      description
    )
    select
      ${insertedUaa.id}::uuid,
      process_type_id,
      description
    from public.skills
    where uaa_id = ${sourceUaaId}::uuid
  `;
    return insertedUaa.id;
}
async function resolveMutationProgramId(sql, action, payload) {
    if (action === 'update-program' || action === 'create-uaa') {
        return payload.programId?.trim() || null;
    }
    if (action === 'clone-uaas') {
        return payload.targetProgramId?.trim() || null;
    }
    if (action === 'create-resource' || action === 'create-competence' || action === 'create-strategy' || action === 'create-skill') {
        const uaaId = payload.uaaId?.trim();
        if (!uaaId)
            return null;
        const rows = await sql `
      select program_id::text as program_id
      from public.uaa
      where id = ${uaaId}::uuid
      limit 1
    `;
        return rows[0]?.program_id ?? null;
    }
    if (action === 'delete-item' || action === 'update-item') {
        const itemId = payload.itemId?.trim();
        const itemType = payload.itemType?.trim();
        if (!itemId || !itemType)
            return null;
        const rows = itemType === 'resource'
            ? await sql `select u.program_id::text as program_id from public.resources i join public.uaa u on u.id = i.uaa_id where i.id = ${itemId}::uuid limit 1`
            : itemType === 'competence'
                ? await sql `select u.program_id::text as program_id from public.uaa_competences i join public.uaa u on u.id = i.uaa_id where i.id = ${itemId}::uuid limit 1`
                : itemType === 'strategy'
                    ? await sql `select u.program_id::text as program_id from public.uaa_strategies i join public.uaa u on u.id = i.uaa_id where i.id = ${itemId}::uuid limit 1`
                    : itemType === 'skill'
                        ? await sql `select u.program_id::text as program_id from public.skills i join public.uaa u on u.id = i.uaa_id where i.id = ${itemId}::uuid limit 1`
                        : [];
        return rows[0]?.program_id ?? null;
    }
    return null;
}
async function assertProgramEditable(sql, userId, organizationId, role, programId) {
    const rows = await sql `
    select owner_id::text as owner_id, is_shared
    from public.programs
    where id = ${programId}::uuid
      and organization_id = ${organizationId}::uuid
      and (
        is_shared = true
        or owner_id = ${userId}::uuid
      )
    limit 1
  `;
    const program = rows[0];
    if (!program)
        throw new Error('Programme introuvable.');
    const canEdit = role === 'super_admin' ||
        (program.is_shared && role === 'program_admin') ||
        (!program.is_shared && program.owner_id === userId);
    if (!canEdit) {
        throw new Error('Ce programme est accessible en lecture seule.');
    }
}
export default withAuthenticatedEndpoint('GET,POST,OPTIONS', async ({ req, res, auth }) => {
    try {
        const sql = neon(getEnv('DATABASE_URL'));
        if (req.method === 'POST') {
            const payload = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body ?? {});
            const action = payload.action?.trim() || '';
            if (action === 'create-program') {
                const subjectId = payload.subjectId?.trim() || null;
                const sectionId = payload.sectionId?.trim() || null;
                const networkId = payload.networkId?.trim() || null;
                const hours = Number(payload.hours);
                const name = payload.name?.trim() || null;
                const validFrom = payload.validFrom?.trim() || null;
                const validTo = payload.validTo?.trim() || null;
                const isShared = payload.isShared === true;
                if ((isShared && !hasPermission(auth.role, 'programs.manage')) ||
                    (!isShared && !hasPermission(auth.role, 'programs.personal_manage'))) {
                    res.status(403).json({
                        ok: false,
                        error: isShared
                            ? 'Seuls les administrateurs programme peuvent créer un programme partagé.'
                            : 'Tu ne peux pas créer de programme personnel.'
                    });
                    return;
                }
                if (!subjectId || !networkId || !Number.isInteger(hours) || hours < 1 || (isShared && !sectionId)) {
                    res.status(400).json({
                        ok: false,
                        error: isShared && !sectionId
                            ? 'Une année est obligatoire pour créer un programme partagé.'
                            : 'La matière, le réseau et les heures sont obligatoires pour créer un programme.'
                    });
                    return;
                }
                const referenceRows = await sql `
          select
            exists (
              select 1 from public.subjects
              where id = ${subjectId}::uuid
                and organization_id = ${auth.organizationId}::uuid
            ) as subject_exists,
            (
              ${sectionId}::uuid is null
              or exists (
                select 1 from public.sections
                where id = ${sectionId}::uuid
                  and organization_id = ${auth.organizationId}::uuid
              )
            ) as section_exists,
            exists (
              select 1 from public.networks
              where id = ${networkId}::uuid
                and organization_id = ${auth.organizationId}::uuid
            ) as network_exists
        `;
                const [references] = referenceRows;
                if (!references?.subject_exists || !references.section_exists || !references.network_exists) {
                    res.status(400).json({
                        ok: false,
                        error: 'Les références du programme doivent appartenir à ton organisation.'
                    });
                    return;
                }
                const insertedRows = await sql `
          insert into public.programs (
            subject_id,
            section_id,
            network_id,
            hours,
            name,
            valid_from,
            valid_to,
            owner_id,
            organization_id,
            is_shared
          )
          values (
            ${subjectId}::uuid,
            ${sectionId}::uuid,
            ${networkId}::uuid,
            ${hours},
            ${name},
            ${validFrom}::date,
            ${validTo}::date,
            ${auth.userId}::uuid,
            ${auth.organizationId}::uuid,
            ${isShared}
          )
          returning id::text as id
        `;
                const [program] = insertedRows;
                logger.info('program.created', {
                    userId: auth.userId,
                    programId: program.id
                });
                res.status(201).json({
                    ok: true,
                    data: program
                });
                return;
            }
            const mutationProgramId = await resolveMutationProgramId(sql, action, payload);
            if (mutationProgramId) {
                await assertProgramEditable(sql, auth.userId, auth.organizationId, auth.role, mutationProgramId);
            }
            if (action === 'update-program') {
                const programId = payload.programId?.trim() || null;
                const hours = Number(payload.hours);
                const name = payload.name?.trim() || null;
                const requestedShared = payload.isShared;
                if (!programId || !Number.isInteger(hours) || hours < 1) {
                    res.status(400).json({
                        ok: false,
                        error: 'programId et hours sont obligatoires pour modifier un programme.'
                    });
                    return;
                }
                if (requestedShared === true && !hasPermission(auth.role, 'programs.manage')) {
                    res.status(403).json({
                        ok: false,
                        error: 'Seuls les administrateurs programme peuvent partager un programme.'
                    });
                    return;
                }
                if (requestedShared === true) {
                    const sectionRows = await sql `
            select section_id::text as section_id
            from public.programs
            where id = ${programId}::uuid
              and organization_id = ${auth.organizationId}::uuid
            limit 1
          `;
                    const [existingProgram] = sectionRows;
                    if (existingProgram && !existingProgram.section_id) {
                        res.status(400).json({
                            ok: false,
                            error: 'Ajoute une année avant de partager ce programme.'
                        });
                        return;
                    }
                }
                const updatedRows = await sql `
          update public.programs
          set
            name = ${name},
            hours = ${hours},
            owner_id = case
              when ${requestedShared ?? null}::boolean = false then ${auth.userId}::uuid
              else owner_id
            end,
            is_shared = case
              when ${requestedShared ?? null}::boolean is null then is_shared
              else ${requestedShared ?? null}::boolean
            end
          where id = ${programId}::uuid
            and organization_id = ${auth.organizationId}::uuid
            and (
              ${requestedShared ?? null}::boolean is null
              or ${requestedShared ?? null}::boolean = false
              or ${hasPermission(auth.role, 'programs.manage')}
            )
          returning id::text as id
        `;
                const [program] = updatedRows;
                if (!program) {
                    res.status(404).json({
                        ok: false,
                        error: 'Programme introuvable.'
                    });
                    return;
                }
                logger.info('program.updated', {
                    userId: auth.userId,
                    programId: program.id
                });
                res.status(200).json({
                    ok: true,
                    data: program
                });
                return;
            }
            if (action === 'create-uaa') {
                const programId = payload.programId?.trim() || null;
                const code = payload.code?.trim() || null;
                const name = payload.name?.trim() || null;
                if (!programId || !code || !name) {
                    res.status(400).json({
                        ok: false,
                        error: 'programId, code et name sont obligatoires pour créer une UAA.'
                    });
                    return;
                }
                const insertedRows = await sql `
          insert into public.uaa (
            program_id,
            code,
            name
          )
          values (
            ${programId}::uuid,
            ${code},
            ${name}
          )
          returning id::text as id
        `;
                const [uaa] = insertedRows;
                logger.info('program.uaa_created', {
                    userId: auth.userId,
                    programId,
                    uaaId: uaa.id
                });
                res.status(201).json({
                    ok: true,
                    data: uaa
                });
                return;
            }
            if (action === 'create-resource' || action === 'create-competence' || action === 'create-strategy') {
                const uaaId = payload.uaaId?.trim() || null;
                const description = payload.description?.trim() || null;
                if (!uaaId || !description) {
                    res.status(400).json({
                        ok: false,
                        error: 'uaaId et description sont obligatoires.'
                    });
                    return;
                }
                const insertedRows = action === 'create-resource'
                    ? await sql `
                insert into public.resources (uaa_id, description)
                values (${uaaId}::uuid, ${description})
                returning id::text as id
              `
                    : action === 'create-competence'
                        ? await sql `
                  insert into public.uaa_competences (uaa_id, description)
                  values (${uaaId}::uuid, ${description})
                  returning id::text as id
                `
                        : await sql `
                  insert into public.uaa_strategies (uaa_id, description)
                  values (${uaaId}::uuid, ${description})
                  returning id::text as id
                `;
                const [item] = insertedRows;
                logger.info('program.item_created', {
                    userId: auth.userId,
                    action,
                    uaaId,
                    itemId: item.id
                });
                res.status(201).json({
                    ok: true,
                    data: item
                });
                return;
            }
            if (action === 'create-skill') {
                const uaaId = payload.uaaId?.trim() || null;
                const processTypeId = payload.processTypeId?.trim() || null;
                const processTypeName = payload.processTypeName?.trim() || null;
                const description = payload.description?.trim() || null;
                if (!uaaId || !description || (!processTypeId && !processTypeName)) {
                    res.status(400).json({
                        ok: false,
                        error: 'uaaId, description et processus sont obligatoires pour créer une compétence.'
                    });
                    return;
                }
                const resolvedProcessTypeId = processTypeId || (await sql `
          insert into public.process_types (name)
          values (${processTypeName})
          on conflict (name) do update
          set name = excluded.name
          returning id::text as id
        `)[0]?.id;
                const insertedRows = await sql `
          insert into public.skills (
            uaa_id,
            process_type_id,
            description
          )
          values (
            ${uaaId}::uuid,
            ${resolvedProcessTypeId}::uuid,
            ${description}
          )
          returning id::text as id
        `;
                const [skill] = insertedRows;
                logger.info('program.skill_created', {
                    userId: auth.userId,
                    uaaId,
                    skillId: skill.id
                });
                res.status(201).json({
                    ok: true,
                    data: skill
                });
                return;
            }
            if (action === 'delete-item') {
                const itemId = payload.itemId?.trim() || null;
                const itemType = payload.itemType?.trim() || null;
                if (!itemId || !itemType) {
                    res.status(400).json({
                        ok: false,
                        error: 'itemId et itemType sont obligatoires pour supprimer un élément.'
                    });
                    return;
                }
                const deletedRows = itemType === 'resource'
                    ? await sql `
                delete from public.resources
                where id = ${itemId}::uuid
                returning id::text as id
              `
                    : itemType === 'competence'
                        ? await sql `
                  delete from public.uaa_competences
                  where id = ${itemId}::uuid
                  returning id::text as id
                `
                        : itemType === 'strategy'
                            ? await sql `
                    delete from public.uaa_strategies
                    where id = ${itemId}::uuid
                    returning id::text as id
                  `
                            : itemType === 'skill'
                                ? await sql `
                      delete from public.skills
                      where id = ${itemId}::uuid
                      returning id::text as id
                    `
                                : [];
                const [item] = deletedRows;
                if (!item) {
                    res.status(404).json({
                        ok: false,
                        error: 'Élément introuvable.'
                    });
                    return;
                }
                logger.info('program.item_deleted', {
                    userId: auth.userId,
                    itemType,
                    itemId
                });
                res.status(200).json({
                    ok: true,
                    data: item
                });
                return;
            }
            if (action === 'update-item') {
                const itemId = payload.itemId?.trim() || null;
                const itemType = payload.itemType?.trim() || null;
                const description = payload.description?.trim() || null;
                if (!itemId || !itemType || !description) {
                    res.status(400).json({
                        ok: false,
                        error: 'itemId, itemType et description sont obligatoires pour modifier un élément.'
                    });
                    return;
                }
                const updatedRows = itemType === 'resource'
                    ? await sql `
                update public.resources
                set description = ${description}
                where id = ${itemId}::uuid
                returning id::text as id
              `
                    : itemType === 'competence'
                        ? await sql `
                  update public.uaa_competences
                  set description = ${description}
                  where id = ${itemId}::uuid
                  returning id::text as id
                `
                        : itemType === 'strategy'
                            ? await sql `
                    update public.uaa_strategies
                    set description = ${description}
                    where id = ${itemId}::uuid
                    returning id::text as id
                  `
                            : itemType === 'skill'
                                ? await sql `
                      update public.skills
                      set description = ${description}
                      where id = ${itemId}::uuid
                      returning id::text as id
                    `
                                : [];
                const [item] = updatedRows;
                if (!item) {
                    res.status(404).json({
                        ok: false,
                        error: 'Élément introuvable.'
                    });
                    return;
                }
                logger.info('program.item_updated', {
                    userId: auth.userId,
                    itemType,
                    itemId
                });
                res.status(200).json({
                    ok: true,
                    data: item
                });
                return;
            }
            if (action === 'clone-uaas') {
                const targetProgramId = payload.targetProgramId?.trim() || null;
                const uaaIds = Array.isArray(payload.uaaIds)
                    ? Array.from(new Set(payload.uaaIds.map((id) => id.trim()).filter(Boolean)))
                    : [];
                if (!targetProgramId || uaaIds.length === 0) {
                    res.status(400).json({
                        ok: false,
                        error: 'targetProgramId et uaaIds sont obligatoires pour copier des UAA.'
                    });
                    return;
                }
                const clonedUaaIds = [];
                for (const uaaId of uaaIds) {
                    const sourceRows = await sql `
            select 1
            from public.uaa u
            join public.programs p on p.id = u.program_id
            where u.id = ${uaaId}::uuid
              and p.organization_id = ${auth.organizationId}::uuid
              and (
                p.is_shared = true
                or p.owner_id = ${auth.userId}::uuid
              )
            limit 1
          `;
                    if (sourceRows.length === 0) {
                        res.status(403).json({
                            ok: false,
                            error: 'Une UAA source n’est pas accessible.'
                        });
                        return;
                    }
                    clonedUaaIds.push(await cloneUaa(sql, uaaId, targetProgramId));
                }
                logger.info('program.uaas_cloned', {
                    userId: auth.userId,
                    targetProgramId,
                    count: clonedUaaIds.length
                });
                res.status(201).json({
                    ok: true,
                    data: {
                        ids: clonedUaaIds
                    }
                });
                return;
            }
            res.status(400).json({
                ok: false,
                error: 'Action programme inconnue.'
            });
            return;
        }
        const requestUrl = req.url;
        const sectionId = getQueryParam(requestUrl, 'sectionId');
        const networkId = getQueryParam(requestUrl, 'networkId') ?? null;
        const subjectId = getQueryParam(requestUrl, 'subjectId') ?? null;
        const programId = getQueryParam(requestUrl, 'programId') ?? null;
        const withoutProgram = getQueryParam(requestUrl, 'withoutProgram') === 'true';
        if (!sectionId && !programId) {
            res.status(400).json({
                ok: false,
                error: 'Missing sectionId or programId query parameter.'
            });
            return;
        }
        const rows = programId && !sectionId
            ? await sql `
      select
        sec.id as section_id,
        sec.code as section_code,
        sec.level as section_level,
        sec.type as section_type,
        sec.label as section_label,
        p.id as program_id,
        p.name as program_name,
        p.hours as program_hours,
        p.valid_from::text as program_valid_from,
        p.valid_to::text as program_valid_to,
        p.owner_id::text as owner_id,
        p.is_shared,
        (
          p.owner_id = ${auth.userId}::uuid
          or ${auth.role}::text = 'super_admin'
          or (p.is_shared = true and ${auth.role}::text = 'program_admin')
        ) as can_edit,
        u.id as uaa_id,
        u.code as uaa_code,
        u.name as uaa_name,
        sub.id as subject_id,
        sub.name as subject_name,
        net.id as network_id,
        net.code as network_code,
        net.name as network_name,
        net.url as network_url,
        pt.id as process_type_id,
        pt.name as process_type_name,
        s.id as skill_id,
        s.description as skill_description,
        r.id as resource_id,
        r.description as resource_description,
        c.id as competence_id,
        c.description as competence_description,
        st.id as strategy_id,
        st.description as strategy_description
      from public.programs p
      left join public.sections sec on sec.id = p.section_id
      left join public.uaa u on u.program_id = p.id
      left join public.subjects sub on sub.id = p.subject_id
      left join public.networks net on net.id = p.network_id
      left join public.skills s on s.uaa_id = u.id
      left join public.process_types pt on pt.id = s.process_type_id
      left join public.resources r on r.uaa_id = u.id
      left join public.uaa_competences c on c.uaa_id = u.id
      left join public.uaa_strategies st on st.uaa_id = u.id
      where p.id = ${programId}::uuid
        and p.organization_id = ${auth.organizationId}::uuid
        and (
          p.is_shared = true
          or p.owner_id = ${auth.userId}::uuid
        )
      order by u.code, pt.name, s.description, r.description, c.description, st.description
    `
            : await sql `
      select
        sec.id as section_id,
        sec.code as section_code,
        sec.level as section_level,
        sec.type as section_type,
        sec.label as section_label,
        p.id as program_id,
        p.name as program_name,
        p.hours as program_hours,
        p.valid_from::text as program_valid_from,
        p.valid_to::text as program_valid_to,
        p.owner_id::text as owner_id,
        p.is_shared,
        (
          p.owner_id = ${auth.userId}::uuid
          or ${auth.role}::text = 'super_admin'
          or (p.is_shared = true and ${auth.role}::text = 'program_admin')
        ) as can_edit,
        u.id as uaa_id,
        u.code as uaa_code,
        u.name as uaa_name,
        sub.id as subject_id,
        sub.name as subject_name,
        net.id as network_id,
        net.code as network_code,
        net.name as network_name,
        net.url as network_url,
        pt.id as process_type_id,
        pt.name as process_type_name,
        s.id as skill_id,
        s.description as skill_description,
        r.id as resource_id,
        r.description as resource_description,
        c.id as competence_id,
        c.description as competence_description,
        st.id as strategy_id,
        st.description as strategy_description
      from public.sections sec
      left join public.programs p
        on p.section_id = sec.id
       and ${withoutProgram}::boolean = false
       and (${networkId}::uuid is null or p.network_id = ${networkId}::uuid)
       and (${subjectId}::uuid is null or p.subject_id = ${subjectId}::uuid)
       and (${programId}::uuid is null or p.id = ${programId}::uuid)
       and p.organization_id = ${auth.organizationId}::uuid
       and (
         p.is_shared = true
         or p.owner_id = ${auth.userId}::uuid
       )
      left join public.uaa u
        on u.program_id = p.id
      left join public.subjects sub
        on sub.id = p.subject_id
      left join public.networks net
        on net.id = p.network_id
      left join public.skills s
        on s.uaa_id = u.id
      left join public.process_types pt
        on pt.id = s.process_type_id
      left join public.resources r
        on r.uaa_id = u.id
      left join public.uaa_competences c
        on c.uaa_id = u.id
      left join public.uaa_strategies st
        on st.uaa_id = u.id
      where sec.id = ${sectionId}::uuid
        and sec.organization_id = ${auth.organizationId}::uuid
      order by
        sec.level asc,
        sec.type asc,
        sec.code asc,
        p.hours asc nulls last,
        p.name asc nulls last,
        u.code asc nulls last,
        pt.name asc nulls last,
        s.description asc nulls last,
        r.description asc nulls last,
        c.description asc nulls last,
        st.description asc nulls last
    `;
        if (!rows.length) {
            res.status(404).json({
                ok: false,
                error: 'Section introuvable.'
            });
            return;
        }
        const program = transformProgramRows(rows);
        logger.info('program.get_by_section', {
            userId: auth.userId,
            sectionId,
            networkId,
            subjectId,
            programId,
            withoutProgram,
            uaaCount: program.uaas.length
        });
        res.status(200).json({
            ok: true,
            data: program
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (message.includes('lecture seule')) {
            res.status(403).json({ ok: false, error: message });
            return;
        }
        if (message === 'Programme introuvable.') {
            res.status(404).json({ ok: false, error: message });
            return;
        }
        if (error.code === '23505') {
            res.status(409).json({
                ok: false,
                error: 'Un programme existe déjà pour cette matière, cette section, ce réseau et ce volume horaire.'
            });
            return;
        }
        logger.error('program.get_by_section_failed', error, {
            userId: auth.userId
        });
        res.status(500).json({
            ok: false,
            error: error instanceof Error ? error.message : 'Unable to fetch program for the selected section.'
        });
    }
}, {
    rateLimit: {
        name: 'program',
        windowMs: 60_000,
        max: 120,
        key: 'user'
    }
});
