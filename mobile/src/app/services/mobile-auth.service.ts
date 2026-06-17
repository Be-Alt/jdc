import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { createAuthClient } from '@neondatabase/neon-js/auth';
import { environment } from '../../environments/environment';
import { JdcApiService } from './jdc-api.service';

type ActiveSession = {
  token?: string;
};

type ActiveUser = {
  id?: string | null;
  email?: string | null;
  name?: string | null;
};

@Injectable({
  providedIn: 'root'
})
export class MobileAuthService {
  private readonly api = inject(JdcApiService);
  private readonly router = inject(Router);
  private readonly authClient = createAuthClient(environment.neonAuthUrl);

  async signInWithGoogle(): Promise<void> {
    await this.api.logout().catch(() => undefined);

    await this.authClient.signIn.social({
      provider: 'google',
      callbackURL: this.getCallbackUrl()
    });
  }

  async completeCallback(): Promise<void> {
    const { session, user } = await this.waitForAuthenticatedUser();

    if (!session || !user?.id || !user.email) {
      throw new Error('La session Google n’est pas encore disponible.');
    }

    if (!this.isAllowedEmail(user.email)) {
      await this.signOut();
      throw new Error('Ce compte Google n’est pas autorise pour JDC.');
    }

    await this.api.syncProfile({
      userId: user.id,
      email: user.email,
      name: user.name ?? null
    });
  }

  async hasSession(): Promise<boolean> {
    const [apiUser, neonSession] = await Promise.all([
      this.api.getCurrentUser(),
      this.getActiveSession().catch(() => null)
    ]);

    return Boolean(apiUser || neonSession);
  }

  async signOut(): Promise<void> {
    await Promise.allSettled([this.api.logout(), this.authClient.signOut()]);
    await this.router.navigateByUrl('/login', { replaceUrl: true });
  }

  private getCallbackUrl(): string {
    if (typeof window === 'undefined') {
      return environment.callbackPath;
    }

    return new URL(environment.callbackPath, window.location.origin).toString();
  }

  private isAllowedEmail(email: string): boolean {
    const domain = email.toLowerCase().split('@')[1];
    return Boolean(domain && environment.allowedEmailDomains.includes(domain));
  }

  private async getActiveSession(): Promise<ActiveSession | null> {
    const response = (await this.authClient.getSession()) as {
      data?: {
        session?: ActiveSession;
      } | null;
    };

    return response?.data?.session ?? null;
  }

  private async getActiveUser(): Promise<ActiveUser | null> {
    const response = (await this.authClient.getSession()) as {
      data?: {
        user?: ActiveUser | null;
      } | null;
    };

    return response?.data?.user ?? null;
  }

  private async waitForAuthenticatedUser(): Promise<{
    session: ActiveSession | null;
    user: ActiveUser | null;
  }> {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const [session, user] = await Promise.all([this.getActiveSession(), this.getActiveUser()]);

      if (session && user?.id && user.email) {
        return { session, user };
      }

      await new Promise((resolve) => window.setTimeout(resolve, 400));
    }

    return { session: null, user: null };
  }
}
