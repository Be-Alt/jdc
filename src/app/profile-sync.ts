import { apiFetch, hasConfiguredApiBaseUrl } from './api-session';

export type ProfilePayload = {
  userId: string;
  email: string;
  name: string | null;
};

export async function syncProfileWithApi(user: ProfilePayload): Promise<void> {
  if (!hasConfiguredApiBaseUrl()) {
    return;
  }

  const response = await apiFetch('/profile', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(user)
  });

  const payload = (await response.json().catch(() => null)) as
    | { error?: string; allowed?: boolean }
    | null;

  if (!response.ok) {
    throw new Error(payload?.error || 'La synchronisation du profil avec l’API a échoué.');
  }
}
