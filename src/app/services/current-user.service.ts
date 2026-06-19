import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { apiFetch } from '../helpers/api-session';
import { AppPermission, AppRole, CurrentAppUser } from '../models/Auth';

@Injectable({ providedIn: 'root' })
export class CurrentUserService {
  private readonly userSubject = new BehaviorSubject<CurrentAppUser | null>(null);
  readonly user$ = this.userSubject.asObservable();

  get user(): CurrentAppUser | null {
    return this.userSubject.value;
  }

  async load(): Promise<CurrentAppUser> {
    const response = await apiFetch('/me', { method: 'GET' });
    const payload = await response.json() as {
      user?: CurrentAppUser;
      error?: string;
    };
    if (!response.ok || !payload.user) {
      throw new Error(payload.error || 'Impossible de lire les permissions utilisateur.');
    }
    this.userSubject.next(payload.user);
    return payload.user;
  }

  has(permission: AppPermission): boolean {
    return this.user?.permissions.includes(permission) === true;
  }

  hasRole(role: AppRole): boolean {
    return this.user?.role === role;
  }
}
