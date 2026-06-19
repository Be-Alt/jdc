import { createRoleProtectedHandler } from './lib/role-endpoint.js';

export default createRoleProtectedHandler({
  allowedRoles: ['super_admin', 'program_admin', 'direction_admin', 'teacher'],
  tableName: 'user_test_data'
});
