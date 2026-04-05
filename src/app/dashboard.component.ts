import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { apiFetch, clearApiSession, hasConfiguredApiBaseUrl } from './api-session';
import { neonAuthClient } from './neon-auth.client';
import { waitForAuthenticatedUser } from './auth-session';
import { syncProfileWithApi } from './profile-sync';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html'
})
export class DashboardComponent {
  private readonly router = inject(Router);

  protected isLoading = true;
  protected isSigningOut = false;
  protected errorMessage = '';
  protected syncMessage = '';
  protected userName = '';
  protected userEmail = '';
  protected currentUserId = '';
  protected currentUserRole = 'unknown';
  protected endpointResult = '';
  protected endpointError = '';

  constructor() {
    void this.loadUser();
  }

  protected async testEndpoint(endpoint: 'admin-data' | 'user-data' | 'student-data'): Promise<void> {
    this.endpointResult = '';
    this.endpointError = '';

    if (!this.currentUserId || !this.userEmail) {
      this.endpointError = 'Utilisateur non charge.';
      return;
    }

    try {
      const response = await apiFetch(`/${endpoint}`, {
        method: 'POST'
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || 'Endpoint call failed.');
      }

      this.currentUserRole = payload.role ?? this.currentUserRole;
      this.endpointResult = JSON.stringify(payload, null, 2);
    } catch (error) {
      this.endpointError = error instanceof Error ? error.message : 'Endpoint call failed.';
    }
  }

  protected async signOut(): Promise<void> {
    this.errorMessage = '';
    this.isSigningOut = true;

    try {
      try {
        await clearApiSession();
      } catch {
        // Best effort: we still want to close the Neon session even if API cleanup fails.
      }

      await neonAuthClient.signOut();
      await this.router.navigateByUrl('/');
    } catch (error) {
      this.isSigningOut = false;
      this.errorMessage =
        error instanceof Error ? error.message : 'La déconnexion a échoué.';
    }
  }

  private async loadUser(): Promise<void> {
    try {
      const { user } = await waitForAuthenticatedUser({
        attempts: 6,
        delayMs: 300
      });

      this.currentUserId = user?.id || '';
      this.userName = user?.name || 'Compte Google connecté';
      this.userEmail = user?.email || 'Adresse email indisponible';

      if (user?.id && user.email) {
        this.syncMessage = 'Synchronisation du profil avec l’API...';

        await syncProfileWithApi({
          userId: user.id,
          email: user.email,
          name: user.name ?? null
        });

        this.syncMessage = 'Profil synchronisé avec succès.';
        await this.loadBackendSession();
      }
    } catch (error) {
      this.errorMessage =
        error instanceof Error ? error.message : 'Impossible de charger la session utilisateur.';
      this.syncMessage = '';
    } finally {
      this.isLoading = false;
    }
  }

  private async loadBackendSession(): Promise<void> {
    if (!hasConfiguredApiBaseUrl()) {
      return;
    }

    try {
      const response = await apiFetch('/me', {
        method: 'GET'
      });

      const payload = (await response.json().catch(() => null)) as
        | { user?: { role?: string } }
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(payload && 'error' in payload ? payload.error || 'Session API invalide.' : 'Session API invalide.');
      }

      const role = payload && 'user' in payload ? payload.user?.role : undefined;
      this.currentUserRole = role || this.currentUserRole;
    } catch (error) {
      this.endpointError = error instanceof Error ? error.message : 'Impossible de lire la session API.';
    }
  }
}
