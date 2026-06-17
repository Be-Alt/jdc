import { Component, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonSpinner,
  IonTitle,
  IonToolbar
} from '@ionic/angular/standalone';
import { MobileAuthService } from '../../services/mobile-auth.service';

@Component({
  selector: 'app-auth-callback',
  standalone: true,
  imports: [
    IonButton,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardSubtitle,
    IonCardTitle,
    IonContent,
    IonHeader,
    IonSpinner,
    IonTitle,
    IonToolbar
  ],
  templateUrl: './auth-callback.page.html'
})
export class AuthCallbackPage implements OnInit {
  readonly status = signal('Validation de la session Google...');
  readonly error = signal('');

  constructor(
    private readonly auth: MobileAuthService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    void this.complete();
  }

  async complete(): Promise<void> {
    this.status.set('Validation de la session Google...');
    this.error.set('');

    try {
      await this.auth.completeCallback();
      this.status.set('Connexion reussie.');
      await this.router.navigateByUrl('/home', { replaceUrl: true });
    } catch (error) {
      this.status.set('');
      this.error.set(error instanceof Error ? error.message : 'Impossible de terminer la connexion.');
    }
  }

  goToLogin(): void {
    void this.router.navigateByUrl('/login', { replaceUrl: true });
  }
}
