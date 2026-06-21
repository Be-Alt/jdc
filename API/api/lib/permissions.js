const teacherPermissions = [
    'programs.read',
    'programs.personal_manage',
    'directory.read',
    'students.read',
    'students.manage',
    'schedules.manage',
    'teaching.manage'
];
const rolePermissions = {
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
export function hasPermission(role, permission) {
    return rolePermissions[role].includes(permission);
}
export function getPermissions(role) {
    return [...rolePermissions[role]];
}
