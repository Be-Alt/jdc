export type AppRole = 'super_admin' | 'program_admin' | 'direction_admin' | 'teacher';

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

export type CurrentAppUser = {
  userId: string;
  email: string;
  name: string | null;
  role: AppRole;
  organizationId: string;
  permissions: AppPermission[];
};
