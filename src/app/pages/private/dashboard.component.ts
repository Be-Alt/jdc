import { DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  apiFetch,
  clearApiSession,
  hasConfiguredApiBaseUrl
} from '../../helpers/api-session';
import { waitForAuthenticatedUser } from '../../helpers/auth-session';
import { neonAuthClient } from '../../helpers/neon-auth.client';
import { syncProfileWithApi } from '../../helpers/profile-sync';
import { CommunicationReminder } from '../../models/StudentCommunication';
import { StudentCommunicationsService } from '../../services/student-communications.service';

@Component({
  selector: 'app-dashboard',
  imports: [RouterOutlet, RouterLink, DatePipe],
  templateUrl: './dashboard.component.html'
})
export class DashboardComponent {
  private readonly router = inject(Router);
  private readonly communicationsService = inject(StudentCommunicationsService);

  protected isLoading = true;
  protected isSigningOut = false;
  protected errorMessage = '';
  protected syncMessage = '';
  protected userName = '';
  protected userEmail = '';
  protected currentUserId = '';
  protected currentUserRole = 'unknown';
  protected endpointError = '';
  protected dueReminders: CommunicationReminder[] = [];
  protected showNotifications = false;
  protected get isOverviewPage(): boolean {
    const url = this.router.url.split('?')[0].split('#')[0];
    return url === '/dashboard' || url === '/dashboard/overview';
  }

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

  protected async completeReminder(reminder: CommunicationReminder): Promise<void> {
    try {
      await firstValueFrom(this.communicationsService.updateReminder$(reminder.id, 'complete-reminder'));
      await this.loadDueReminders();
    } catch (error) {
      this.endpointError = error instanceof Error ? error.message : 'Impossible de terminer le rappel.';
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
        await this.loadDueReminders();
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

  private async loadDueReminders(): Promise<void> {
    try {
      this.dueReminders = await firstValueFrom(this.communicationsService.getDueReminders$());
    } catch {
      this.dueReminders = [];
    }
  }
}
