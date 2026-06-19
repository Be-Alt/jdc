import { createRoleProtectedHandler } from './lib/role-endpoint.js';
export default createRoleProtectedHandler({
    allowedRoles: ['super_admin', 'direction_admin', 'teacher'],
    tableName: 'student_test_data'
});
