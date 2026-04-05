import { createRoleProtectedHandler } from './lib/role-endpoint.js';
export default createRoleProtectedHandler({
    allowedRoles: ['admin', 'user'],
    tableName: 'user_test_data'
});
