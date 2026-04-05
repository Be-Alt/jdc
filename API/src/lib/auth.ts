import { neon } from '@neondatabase/serverless';
import { getEnv } from './env.js';

export type AuthenticatedUser = {
  userId: string;
  email: string;
  name: string | null;
};

export type AppRole = 'admin' | 'user' | 'student';

export type ProfileRecord = AuthenticatedUser & {
  role: AppRole;
};

export function parseAuthenticatedUser(body: unknown): AuthenticatedUser {
  const input = (typeof body === 'string' ? JSON.parse(body) : (body ?? {})) as Partial<AuthenticatedUser>;

  return {
    userId: input.userId?.trim() ?? '',
    email: input.email?.trim().toLowerCase() ?? '',
    name: input.name?.trim() || null
  };
}

export async function isAllowedEmailDomain(email: string): Promise<boolean> {
  const sql = neon(getEnv('DATABASE_URL'));
  const domain = email.split('@')[1]?.toLowerCase();

  if (!domain) {
    return false;
  }

  const result = await sql`
    select exists (
      select 1
      from public.allowed_email_domains
      where domain = ${domain}
        and active = true
    ) as allowed
  `;

  const [row] = result as Array<{ allowed: boolean }>;
  return Boolean(row?.allowed);
}

export async function requireAllowedUser(user: AuthenticatedUser): Promise<AuthenticatedUser> {
  if (!user.userId || !user.email) {
    throw new Error('Missing required user payload.');
  }

  const allowed = await isAllowedEmailDomain(user.email);

  if (!allowed) {
    throw new Error(`Email domain not allowed for ${user.email}.`);
  }

  return user;
}

export async function getProfileRecord(user: AuthenticatedUser): Promise<ProfileRecord> {
  const sql = neon(getEnv('DATABASE_URL'));

  const result = await sql`
    select
      user_id,
      email,
      full_name,
      role
    from public.profiles
    where user_id = ${user.userId}
      and email = ${user.email}
    limit 1
  `;

  const [row] = result as Array<{
    user_id: string;
    email: string;
    full_name: string | null;
    role: AppRole;
  }>;

  if (!row) {
    throw new Error('Profile not found. Sync the profile first.');
  }

  return {
    userId: row.user_id,
    email: row.email,
    name: row.full_name,
    role: row.role
  };
}

export async function requireAllowedRole(
  user: AuthenticatedUser,
  allowedRoles: AppRole[]
): Promise<ProfileRecord> {
  const allowedUser = await requireAllowedUser(user);
  const profile = await getProfileRecord(allowedUser);

  if (!allowedRoles.includes(profile.role)) {
    throw new Error(`Role ${profile.role} is not allowed for this endpoint.`);
  }

  return profile;
}

function getHeaderValue(
  headers: Record<string, string | string[] | undefined> | undefined,
  name: string
): string | undefined {
  const value = headers?.[name] ?? headers?.[name.toLowerCase()];

  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export function getBearerToken(headers: Record<string, string | string[] | undefined> | undefined): string {
  const authorization = getHeaderValue(headers, 'authorization');

  if (!authorization?.startsWith('Bearer ')) {
    throw new Error('Missing Bearer token.');
  }

  return authorization.slice('Bearer '.length).trim();
}

export function getCookieHeader(
  headers: Record<string, string | string[] | undefined> | undefined
): string | undefined {
  return getHeaderValue(headers, 'cookie');
}

export async function upsertProfile(user: AuthenticatedUser): Promise<void> {
  const sql = neon(getEnv('DATABASE_URL'));

  await sql`
    insert into public.profiles (user_id, email, full_name)
    values (${user.userId}, ${user.email}, ${user.name})
    on conflict (user_id) do update
    set
      email = excluded.email,
      full_name = excluded.full_name,
      updated_at = now()
  `;
}
