import { neon } from '@neondatabase/serverless';
import { withAuthenticatedEndpoint } from './lib/api-guards.js';
import { getEnv } from './lib/env.js';
import { logger } from './lib/logger.js';

type NetworkRow = {
  id: string;
  code: string;
  name: string;
  url: string | null;
};

type NetworkInput = {
  networkId?: string;
  code?: string;
  name?: string;
  url?: string | null;
};

export default withAuthenticatedEndpoint('GET,POST,PUT,DELETE,OPTIONS', async ({ req, res, auth }) => {
  try {
    const sql = neon(getEnv('DATABASE_URL'));

    if (req.method === 'POST') {
      const payload = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body ?? {}) as NetworkInput;
      const code = payload.code?.trim().toUpperCase();
      const name = payload.name?.trim();
      const url = payload.url?.trim() || null;

      if (!code || !name) {
        res.status(400).json({
          ok: false,
          error: 'Le code et le nom du réseau sont obligatoires.'
        });
        return;
      }

      const insertedRows = await sql`
        insert into public.networks (
          code,
          name,
          url
        )
        values (
          ${code},
          ${name},
          ${url}
        )
        returning
          id::text as id,
          code,
          name,
          url
      `;

      const [network] = insertedRows as NetworkRow[];

      logger.info('networks.created', {
        userId: auth.userId,
        networkId: network.id
      });

      res.status(201).json({
        ok: true,
        data: network
      });
      return;
    }

    if (req.method === 'PUT') {
      const payload = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body ?? {}) as NetworkInput;
      const networkId = payload.networkId?.trim() || null;
      const code = payload.code?.trim().toUpperCase();
      const name = payload.name?.trim();
      const url = payload.url?.trim() || null;

      if (!networkId || !code || !name) {
        res.status(400).json({
          ok: false,
          error: 'networkId, code et name sont obligatoires pour modifier un réseau.'
        });
        return;
      }

      const updatedRows = await sql`
        update public.networks
        set
          code = ${code},
          name = ${name},
          url = ${url}
        where id = ${networkId}::uuid
        returning
          id::text as id,
          code,
          name,
          url
      `;

      const [network] = updatedRows as NetworkRow[];

      if (!network) {
        res.status(404).json({
          ok: false,
          error: 'Réseau introuvable.'
        });
        return;
      }

      logger.info('networks.updated', {
        userId: auth.userId,
        networkId: network.id
      });

      res.status(200).json({
        ok: true,
        data: network
      });
      return;
    }

    if (req.method === 'DELETE') {
      const payload = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body ?? {}) as NetworkInput;
      const networkId = payload.networkId?.trim() || null;

      if (!networkId) {
        res.status(400).json({
          ok: false,
          error: 'networkId est obligatoire pour supprimer un réseau.'
        });
        return;
      }

      const usageRows = await sql`
        select
          (
            select count(*)::int
            from public.programs
            where network_id = ${networkId}::uuid
          ) as program_count,
          (
            select count(*)::int
            from public.class_session_students
            where network_id = ${networkId}::uuid
          ) as journal_count
      `;

      const [usage] = usageRows as Array<{
        program_count: number;
        journal_count: number;
      }>;

      if (usage.program_count + usage.journal_count > 0) {
        res.status(409).json({
          ok: false,
          error: 'Impossible de supprimer ce réseau : il est encore lié à des programmes ou des entrées du journal.',
          data: usage
        });
        return;
      }

      const deletedRows = await sql`
        delete from public.networks
        where id = ${networkId}::uuid
        returning id::text as id
      `;

      const [deletedNetwork] = deletedRows as Array<{ id: string }>;

      if (!deletedNetwork) {
        res.status(404).json({
          ok: false,
          error: 'Réseau introuvable.'
        });
        return;
      }

      logger.info('networks.deleted', {
        userId: auth.userId,
        networkId: deletedNetwork.id
      });

      res.status(200).json({
        ok: true,
        data: {
          networkId: deletedNetwork.id
        }
      });
      return;
    }

    const rows = await sql`
      select
        id::text as id,
        code,
        name,
        url
      from public.networks
      order by code asc, name asc
    `;

    logger.info('networks.list', {
      userId: auth.userId,
      count: Array.isArray(rows) ? rows.length : 0
    });

    res.status(200).json({
      ok: true,
      data: rows as NetworkRow[]
    });
  } catch (error) {
    if ((error as { code?: string }).code === '23505') {
      res.status(409).json({
        ok: false,
        error: 'Un réseau avec ce code existe déjà.'
      });
      return;
    }

    logger.error('networks.request_failed', error, {
      userId: auth.userId
    });

    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unable to process networks request.'
    });
  }
}, {
  rateLimit: {
    name: 'networks',
    windowMs: 60_000,
    max: 120,
    key: 'user'
  }
});
