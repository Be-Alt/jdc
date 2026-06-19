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

const rolePermissions: Record<AppRole, AppPermission[]> = {
  super_admin: [
    'users.manage',
    'programs.read',
    'programs.manage',
    'programs.personal_manage',
    'directory.read',
    'directory.manage',
    'students.read',
    'students.manage',
    'schedules.manage',
    'teaching.manage'
  ],
  program_admin: ['programs.read', 'programs.manage', 'programs.personal_manage'],
  direction_admin: [
    'programs.read',
    'directory.read',
    'directory.manage',
    'students.read',
    'students.manage',
    'schedules.manage'
  ],
  teacher: [
    'programs.read',
    'programs.personal_manage',
    'directory.read',
    'students.read',
    'students.manage',
    'schedules.manage',
    'teaching.manage'
  ]
};

export function hasPermission(role: AppRole, permission: AppPermission): boolean {
  return rolePermissions[role].includes(permission);
}

export function getPermissions(role: AppRole): AppPermission[] {
  return [...rolePermissions[role]];
}
