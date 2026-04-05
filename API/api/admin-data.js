import { createRoleProtectedHandler } from './lib/role-endpoint.js';
export default createRoleProtectedHandler({
    allowedRoles: ['admin'],
    tableName: 'admin_test_data'
});
