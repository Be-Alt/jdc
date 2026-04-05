import { neon } from '@neondatabase/serverless';
import { type AppRole } from './auth.js';
import { withRoleProtectedEndpoint } from './api-guards.js';
import { getEnv } from './env.js';

type RoleEndpointConfig = {
  allowedRoles: AppRole[];
  tableName: 'admin_test_data' | 'user_test_data' | 'student_test_data';
};

export function createRoleProtectedHandler(config: RoleEndpointConfig) {
  return withRoleProtectedEndpoint('GET,POST,OPTIONS', config.allowedRoles, async ({ res, auth }) => {
      const sql = neon(getEnv('DATABASE_URL'));

      let rows: unknown;

      switch (config.tableName) {
        case 'admin_test_data':
          rows = await sql`
            select id, title, content, created_at
            from public.admin_test_data
            order by id asc
          `;
          break;
        case 'user_test_data':
          rows = await sql`
            select id, title, content, created_at
            from public.user_test_data
            order by id asc
          `;
          break;
        case 'student_test_data':
          rows = await sql`
            select id, title, content, created_at
            from public.student_test_data
            order by id asc
          `;
          break;
      }

      res.status(200).json({
        ok: true,
        role: auth.role,
        allowedRoles: config.allowedRoles,
        data: rows
      });
    }, {
      rateLimit: {
        name: config.tableName,
        windowMs: 60_000,
        max: 60,
        key: 'user'
      }
    });
}
