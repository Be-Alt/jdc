import { neonAuthConfig } from './neon-auth.config';

function getApiBaseUrl(): string {
  return neonAuthConfig.apiBaseUrl.trim();
}

export function hasConfiguredApiBaseUrl(): boolean {
  const apiBaseUrl = getApiBaseUrl();
  return Boolean(apiBaseUrl) && !apiBaseUrl.includes('YOUR_VERCEL_API_DOMAIN');
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init?.headers ?? {})
    }
  });
}

export async function clearApiSession(): Promise<void> {
  if (!hasConfiguredApiBaseUrl()) {
    return;
  }

  await apiFetch('/logout', {
    method: 'POST'
  });
}
