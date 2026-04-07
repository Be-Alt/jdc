import { neon } from '@neondatabase/serverless';
import { withAuthenticatedEndpoint } from './lib/api-guards.js';
import { getEnv } from './lib/env.js';
import { logger } from './lib/logger.js';
async function loadDysTypes(sql) {
    const dysTypes = await sql `
    select
      id,
      code,
      nom,
      description
    from public.dys_types
    order by id asc
  `;
    const accommodations = await sql `
    select
      id,
      dys_id,
      amenagement
    from public.accommodations
    order by dys_id asc, id asc
  `;
    const accommodationMap = new Map();
    for (const row of accommodations) {
        const bucket = accommodationMap.get(row.dys_id) ?? [];
        bucket.push({
            id: row.id,
            amenagement: row.amenagement
        });
        accommodationMap.set(row.dys_id, bucket);
    }
    return dysTypes.map((dysType) => ({
        ...dysType,
        accommodations: accommodationMap.get(dysType.id) ?? []
    }));
}
export default withAuthenticatedEndpoint('GET,PUT,OPTIONS', async ({ req, res, auth }) => {
    const sql = neon(getEnv('DATABASE_URL'));
    try {
        if (req.method === 'GET') {
            const dysTypes = await loadDysTypes(sql);
            logger.info('dys.list', {
                userId: auth.userId,
                count: dysTypes.length
            });
            res.status(200).json({
                ok: true,
                data: dysTypes
            });
            return;
        }
        const payload = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body ?? {});
        const id = Number(payload.id);
        const code = payload.code?.trim();
        const nom = payload.nom?.trim();
        const description = payload.description?.trim() || null;
        const accommodations = Array.isArray(payload.accommodations)
            ? payload.accommodations
                .map((item) => item?.trim())
                .filter((item) => Boolean(item))
            : [];
        if (!Number.isInteger(id) || !code || !nom) {
            res.status(400).json({
                ok: false,
                error: 'Les champs id, code et nom sont obligatoires.'
            });
            return;
        }
        const updatedDysRows = await sql `
      update public.dys_types
      set
        code = ${code},
        nom = ${nom},
        description = ${description}
      where id = ${id}
      returning id
    `;
        if (updatedDysRows.length === 0) {
            res.status(404).json({
                ok: false,
                error: 'Type DYS introuvable.'
            });
            return;
        }
        await sql `
      delete from public.accommodations
      where dys_id = ${id}
    `;
        for (const amenagement of accommodations) {
            await sql `
        insert into public.accommodations (
          dys_id,
          amenagement
        )
        values (
          ${id},
          ${amenagement}
        )
      `;
        }
        const dysTypes = await loadDysTypes(sql);
        const updatedDys = dysTypes.find((item) => item.id === id) ?? null;
        logger.info('dys.updated', {
            userId: auth.userId,
            dysId: id,
            accommodations: accommodations.length
        });
        res.status(200).json({
            ok: true,
            data: updatedDys
        });
    }
    catch (error) {
        logger.error('dys.failed', error, {
            userId: auth.userId
        });
        res.status(500).json({
            ok: false,
            error: error instanceof Error ? error.message : 'Impossible de gérer les DYS.'
        });
    }
}, {
    rateLimit: {
        name: 'dys',
        windowMs: 60_000,
        max: 120,
        key: 'user'
    }
});
