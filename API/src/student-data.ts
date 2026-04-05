import { createRoleProtectedHandler } from './lib/role-endpoint.js';

export default createRoleProtectedHandler({
  allowedRoles: ['admin', 'student'],
  tableName: 'student_test_data'
});
