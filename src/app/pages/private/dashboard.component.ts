import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import {
  apiFetch,
  clearApiSession,
  hasConfiguredApiBaseUrl
} from '../../helpers/api-session';
import { waitForAuthenticatedUser } from '../../helpers/auth-session';
import { neonAuthClient } from '../../helpers/neon-auth.client';
import { neonAuthConfig } from '../../helpers/neon-auth.config';
import { syncProfileWithApi } from '../../helpers/profile-sync';

@Component({
  selector: 'app-dashboard',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './dashboard.component.html'
})
export class DashboardComponent {
  private readonly router = inject(Router);

  protected readonly allowedDomainsLabel = neonAuthConfig.allowedEmailDomains.join(', ');
  protected readonly navItems = [
    { label: 'Vue d’ensemble', path: '/dashboard/overview', badge: '01', exact: true },
    { label: 'Élèves', path: '/dashboard/students', badge: '02', exact: false },
    { label: 'Présences', path: '/dashboard/attendance', badge: '03', exact: false },
    { label: 'Suivis', path: '/dashboard/follow-up', badge: '04', exact: false },
    { label: 'Paramètres', path: '/dashboard/settings', badge: '05', exact: false }
  ];
  protected isLoading = true;
  protected isSigningOut = false;
  protected errorMessage = '';
  protected syncMessage = '';
  protected userName = '';
  protected userEmail = '';
  protected currentUserId = '';
  protected currentUserRole = 'unknown';
  protected endpointError = '';
  protected isMobileNavOpen = false;

  constructor() {
    void this.loadUser();
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

  protected toggleMobileNav(): void {
    this.isMobileNavOpen = !this.isMobileNavOpen;
  }

  protected closeMobileNav(): void {
    this.isMobileNavOpen = false;
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
