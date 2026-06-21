import { type AppRole } from './auth.js';

export type AppPermission =
  | 'users.manage'
  | 'programs.read'
  | 'programs.manage'
  | 'programs.personal_manage'
  | 'directory.read'
  | 'directory.manage'
  | 'students.read'
  | 'students.manage'
  | 'schedules.manage'
  | 'teaching.manage';

const teacherPermissions: AppPermission[] = [
  'programs.read',
  'programs.personal_manage',
  'directory.read',
  'students.read',
  'students.manage',
  'schedules.manage',
  'teaching.manage'
];

const rolePermissions: Record<AppRole, AppPermission[]> = {
  super_admin: [
    ...teacherPermissions,
    'users.manage',
    'programs.manage',
    'directory.manage',
  ],
  program_admin: [
    ...teacherPermissions,
    'programs.manage'
  ],
  direction_admin: [
    'programs.read',
    'directory.read',
    'directory.manage',
    'students.read',
    'students.manage',
    'schedules.manage'
  ],
  teacher: teacherPermissions
};

export function hasPermission(role: AppRole, permission: AppPermission): boolean {
  return rolePermissions[role].includes(permission);
}

export function getPermissions(role: AppRole): AppPermission[] {
  return [...rolePermissions[role]];
}
