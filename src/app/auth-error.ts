const AUTH_ERROR_KEY = 'auth_error';

export function setAuthError(error: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.setItem(AUTH_ERROR_KEY, error);
}

export function getAuthError(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.sessionStorage.getItem(AUTH_ERROR_KEY);
}

export function clearAuthError(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.removeItem(AUTH_ERROR_KEY);
}
