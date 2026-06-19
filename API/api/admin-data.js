import { createRoleProtectedHandler } from './lib/role-endpoint.js';
export default createRoleProtectedHandler({
    allowedRoles: ['super_admin'],
    tableName: 'admin_test_data'
});
