import { neon } from '@neondatabase/serverless';
import { getEnv } from './env.js';
export function normalizeAppRole(value) {
    if (value === 'super_admin' || value === 'program_admin' || value === 'direction_admin' || value === 'teacher') {
        return value;
    }
    return value === 'admin' ? 'super_admin' : 'teacher';
}
export function parseAuthenticatedUser(body) {
    const input = (typeof body === 'string' ? JSON.parse(body) : (body ?? {}));
    return {
        userId: input.userId?.trim() ?? '',
        email: input.email?.trim().toLowerCase() ?? '',
        name: input.name?.trim() || null
    };
}
export async function isAllowedEmailDomain(email) {
    const sql = neon(getEnv('DATABASE_URL'));
    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain) {
        return false;
    }
    const result = await sql `
    select exists (
      select 1
      from public.allowed_email_domains
      where domain = ${domain}
        and active = true
    ) as allowed
  `;
    const [row] = result;
    return Boolean(row?.allowed);
}
export async function requireAllowedUser(user) {
    if (!user.userId || !user.email) {
        throw new Error('Missing required user payload.');
    }
    const allowed = await isAllowedEmailDomain(user.email);
    if (!allowed) {
        throw new Error(`Email domain not allowed for ${user.email}.`);
    }
    return user;
}
export async function getProfileRecord(user) {
    const sql = neon(getEnv('DATABASE_URL'));
    const result = await sql `
    select
      user_id,
      email,
      full_name,
      role,
      organization_id::text as organization_id
    from public.profiles
    where user_id = ${user.userId}
      and email = ${user.email}
      and exists (
        select 1
        from public.organization_members om
        where om.organization_id = profiles.organization_id
          and om.user_id = ${user.userId}::uuid
      )
    limit 1
  `;
    const [row] = result;
    if (!row?.organization_id) {
        throw new Error('Profile not found. Sync the profile first.');
    }
    return {
        userId: row.user_id,
        email: row.email,
        name: row.full_name,
        role: normalizeAppRole(row.role),
        organizationId: row.organization_id
    };
}
export async function requireAllowedRole(user, allowedRoles) {
    const allowedUser = await requireAllowedUser(user);
    const profile = await getProfileRecord(allowedUser);
    if (!allowedRoles.includes(profile.role)) {
        throw new Error(`Role ${profile.role} is not allowed for this endpoint.`);
    }
    return profile;
}
function getHeaderValue(headers, name) {
    const value = headers?.[name] ?? headers?.[name.toLowerCase()];
    if (Array.isArray(value)) {
        return value[0];
    }
    return value;
}
export function getBearerToken(headers) {
    const authorization = getHeaderValue(headers, 'authorization');
    if (!authorization?.startsWith('Bearer ')) {
        throw new Error('Missing Bearer token.');
    }
    return authorization.slice('Bearer '.length).trim();
}
export function getCookieHeader(headers) {
    return getHeaderValue(headers, 'cookie');
}
export async function upsertProfile(user) {
    const sql = neon(getEnv('DATABASE_URL'));
    const domain = user.email.split('@')[1]?.toLowerCase();
    if (!domain) {
        throw new Error('Email domain is missing.');
    }
    const rows = await sql `
    insert into public.profiles (user_id, email, full_name, organization_id)
    select
      ${user.userId},
      ${user.email},
      ${user.name},
      coalesce(
        (
          select p.organization_id
          from public.profiles p
          where p.user_id = ${user.userId}
        ),
        (
          select om.organization_id
          from public.organization_members om
          where ${user.userId} ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
            and om.user_id = ${user.userId}::uuid
          order by om.created_at
          limit 1
        ),
        (
          select aed.organization_id
          from public.allowed_email_domains aed
          where lower(aed.domain) = ${domain}
            and aed.active = true
            and aed.organization_id is not null
          limit 1
        )
      )
    on conflict (user_id) do update
    set
      email = excluded.email,
      full_name = excluded.full_name,
      updated_at = now()
    returning user_id
  `;
    if (rows.length === 0) {
        throw new Error('No organization is configured for this user.');
    }
    await sql `
    insert into public.organization_members (organization_id, user_id, role)
    select
      organization_id,
      user_id::uuid,
      case when role in ('super_admin', 'program_admin', 'direction_admin') then 'admin' else 'member' end
    from public.profiles
    where user_id = ${user.userId}
    on conflict (organization_id, user_id) do update
    set role = excluded.role
  `;
}
