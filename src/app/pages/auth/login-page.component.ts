import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { clearApiSession } from '../../helpers/api-session';
import { clearAuthError, getAuthError } from '../../helpers/auth-error';
import { getActiveSession } from '../../helpers/auth-session';
import { neonAuthClient } from '../../helpers/neon-auth.client';
import { neonAuthConfig } from '../../helpers/neon-auth.config';

@Component({
  selector: 'app-login-page',
  templateUrl: './login-page.component.html'
})
export class LoginPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly appName = neonAuthConfig.appName;
  protected readonly callbackUrl = neonAuthConfig.callbackUrl;
  protected readonly supportEmail = neonAuthConfig.supportEmail;
  protected readonly neonAuthUrl = neonAuthConfig.neonAuthUrl;
  protected readonly allowedDomainsLabel = neonAuthConfig.allowedEmailDomains.join(', ');
  protected errorMessage = '';
  protected isLoading = false;
  private hasBlockingAuthError = false;

  constructor() {
    this.route.queryParamMap.subscribe((params) => {
      const authError = params.get('authError') ?? getAuthError();

      if (authError === 'domain-not-allowed') {
        this.hasBlockingAuthError = true;
        this.errorMessage =
          'Ce compte Google n’est pas autorisé. Utilise une adresse appartenant à un domaine autorisé.';
        void this.cleanupUnauthorizedSession();
        clearAuthError();
      } else {
        this.hasBlockingAuthError = false;
      }
    });

    void this.redirectIfAlreadyAuthenticated();
  }

  protected async signInWithGoogle(): Promise<void> {
    this.errorMessage = '';
    this.isLoading = true;

    try {
      try {
        await clearApiSession();
      } catch {
        // Ignore stale backend-session cleanup issues before starting a fresh login.
      }

      await neonAuthClient.signIn.social({
        provider: 'google',
        callbackURL: this.getCallbackUrl()
      });
    } catch (error) {
      this.isLoading = false;
      this.errorMessage =
        error instanceof Error
          ? error.message
          : 'La redirection Google a échoué. Vérifie la configuration Neon Auth et Google OAuth.';
    }
  }

  private getCallbackUrl(): string {
    if (typeof window === 'undefined') {
      return neonAuthConfig.callbackUrl;
    }

    const configuredUrl = neonAuthConfig.callbackUrl.trim();

    if (!configuredUrl) {
      return `${window.location.origin}/auth/callback`;
    }

    if (configuredUrl.startsWith('http://') || configuredUrl.startsWith('https://')) {
      return configuredUrl;
    }

    return new URL(configuredUrl, window.location.origin).toString();
  }

  private async redirectIfAlreadyAuthenticated(): Promise<void> {
    try {
      if (this.hasBlockingAuthError) {
        return;
      }

      const session = await getActiveSession();

      if (session) {
        await this.router.navigateByUrl('/dashboard');
      }
    } catch {
      // No-op: the page can still display the login button.
    }
  }

  private async cleanupUnauthorizedSession(): Promise<void> {
    try {
      await clearApiSession();
      await neonAuthClient.signOut();
    } catch {
      // Ignore cleanup failures; user feedback is already shown.
    }
  }
}
