import { neon } from '@neondatabase/serverless';
import { withRoleProtectedEndpoint } from './api-guards.js';
import { getEnv } from './env.js';
export function createRoleProtectedHandler(config) {
    return withRoleProtectedEndpoint('GET,POST,OPTIONS', config.allowedRoles, async ({ res, auth }) => {
        const sql = neon(getEnv('DATABASE_URL'));
        let rows;
        switch (config.tableName) {
            case 'admin_test_data':
                rows = await sql `
            select id, title, content, created_at
            from public.admin_test_data
            order by id asc
          `;
                break;
            case 'user_test_data':
                rows = await sql `
            select id, title, content, created_at
            from public.user_test_data
            order by id asc
          `;
                break;
            case 'student_test_data':
                rows = await sql `
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
