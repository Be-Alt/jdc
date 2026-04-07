import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { clearApiSession } from '../../helpers/api-session';
import { setAuthError } from '../../helpers/auth-error';
import { waitForAuthenticatedUser } from '../../helpers/auth-session';
import { neonAuthClient } from '../../helpers/neon-auth.client';
import { neonAuthConfig } from '../../helpers/neon-auth.config';
import { syncProfileWithApi } from '../../helpers/profile-sync';

@Component({
  selector: 'app-auth-callback',
  templateUrl: './auth-callback.component.html'
})
export class AuthCallbackComponent {
  private readonly router = inject(Router);

  protected statusMessage = 'Validation de ta session en cours...';
  protected errorMessage = '';

  constructor() {
    void this.completeAuthentication();
  }

  private async completeAuthentication(): Promise<void> {
    try {
      this.statusMessage = 'Validation de la session Google...';
      const { session, user } = await waitForAuthenticatedUser();

      if (!session) {
        this.errorMessage =
          'La session n’a pas encore été créée après le retour OAuth. Recharge la page de callback une fois si besoin, puis vérifie la configuration Neon Auth.';
        this.statusMessage = '';
        return;
      }

      const email = user?.email?.toLowerCase() ?? '';

      if (!this.isAllowedEmail(email)) {
        setAuthError('domain-not-allowed');

        try {
          await clearApiSession();
          await neonAuthClient.signOut();
        } catch {
          // Ignore logout failures here; the login page will attempt a cleanup too.
        }

        const loginUrl = new URL('/', window.location.origin);
        loginUrl.searchParams.set('authError', 'domain-not-allowed');
        window.location.replace(loginUrl.toString());
        return;
      }

      this.statusMessage = 'Vérification du domaine et synchronisation du profil...';
      if (!user?.id || !user.email) {
        this.errorMessage = 'Informations utilisateur incomplètes pour synchroniser le profil.';
        this.statusMessage = '';
        return;
      }

      await this.syncProfile({
        userId: user.id,
        email: user.email,
        name: user.name ?? null
      });

      this.statusMessage = 'Connexion réussie. Redirection en cours...';

      await new Promise((resolve) => window.setTimeout(resolve, 900));
      await this.router.navigateByUrl('/dashboard');
    } catch (error) {
      this.errorMessage =
        error instanceof Error
          ? error.message
          : 'Impossible de récupérer la session après le retour Google.';
      this.statusMessage = '';
    }
  }

  private isAllowedEmail(email: string): boolean {
    const allowedDomains = neonAuthConfig.allowedEmailDomains.map((domain) => domain.toLowerCase());
    const domain = email.split('@')[1];

    if (!domain) {
      return false;
    }

    return allowedDomains.includes(domain);
  }

  private async syncProfile(user: { userId: string; email: string; name: string | null }): Promise<void> {
    await syncProfileWithApi(user);
  }
}
