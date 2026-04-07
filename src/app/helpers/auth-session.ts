import { neonAuthClient } from './neon-auth.client';

export type ActiveSession = {
  token?: string;
};

export type ActiveUser = {
  id?: string | null;
  email?: string | null;
  name?: string | null;
};

export async function getActiveSession() {
  const response = (await neonAuthClient.getSession()) as {
    data?: {
      session?: ActiveSession;
      user?: {
        id?: string | null;
        email?: string | null;
        name?: string | null;
      } | null;
    } | null;
  };

  return response?.data?.session ?? null;
}

export async function getActiveUser() {
  const response = (await neonAuthClient.getSession()) as {
    data?: {
      session?: ActiveSession;
      user?: {
        id?: string | null;
        email?: string | null;
        name?: string | null;
      } | null;
    } | null;
  };

  return response?.data?.user ?? null;
}

export async function waitForAuthenticatedUser(options?: {
  attempts?: number;
  delayMs?: number;
}) {
  const attempts = options?.attempts ?? 8;
  const delayMs = options?.delayMs ?? 400;

  for (let index = 0; index < attempts; index += 1) {
    const [session, user] = await Promise.all([getActiveSession(), getActiveUser()]);

    if (session && user?.id && user.email) {
      return { session, user };
    }

    if (index < attempts - 1) {
      await new Promise((resolve) => window.setTimeout(resolve, delayMs));
    }
  }

  return { session: null, user: null };
}
