import { neon } from '@neondatabase/serverless';
import { type AppRole } from './lib/auth.js';
import { withPermissionEndpoint } from './lib/api-guards.js';
import { getEnv } from './lib/env.js';
import { logger } from './lib/logger.js';

type UserRoleInput = {
  userId?: string;
  role?: AppRole;
};

const roles: AppRole[] = ['super_admin', 'program_admin', 'direction_admin', 'teacher'];

async function listUsers(sql: any, organizationId: string) {
  return sql`
    select user_id, email, full_name, role, created_at::text, updated_at::text
    from public.profiles
    where organization_id = ${organizationId}::uuid
    order by full_name asc nulls last, email asc
  `;
}

export default withPermissionEndpoint('GET,PUT,OPTIONS', 'users.manage', async ({ req, res, auth }) => {
  const sql = neon(getEnv('DATABASE_URL'));
  try {
    if (req.method === 'GET') {
      res.status(200).json({ ok: true, data: await listUsers(sql, auth.organizationId) });
      return;
    }

    const payload = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body ?? {}) as UserRoleInput;
    const userId = payload.userId?.trim();
    const role = payload.role;

    if (!userId || !role || !roles.includes(role)) {
      res.status(400).json({ ok: false, error: 'userId et rôle valide sont obligatoires.' });
      return;
    }

    if (userId === auth.userId && role !== 'super_admin') {
      res.status(400).json({ ok: false, error: 'Tu ne peux pas retirer ton propre rôle super administrateur.' });
      return;
    }

    const rows = await sql`
      update public.profiles
      set role = ${role}, updated_at = now()
      where user_id = ${userId}
        and organization_id = ${auth.organizationId}::uuid
      returning user_id
    `;
    if (rows.length === 0) {
      res.status(404).json({ ok: false, error: 'Utilisateur introuvable.' });
      return;
    }

    await sql`
      update public.organization_members
      set role = ${role === 'teacher' ? 'member' : 'admin'}
      where organization_id = ${auth.organizationId}::uuid
        and user_id = ${userId}::uuid
    `;

    logger.info('users.role_updated', {
      actorUserId: auth.userId,
      targetUserId: userId,
      role
    });
    res.status(200).json({ ok: true, data: await listUsers(sql, auth.organizationId) });
  } catch (error) {
    logger.error('users.failed', error, { userId: auth.userId });
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Impossible de gérer les utilisateurs.'
    });
  }
});
