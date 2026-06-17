import { Component, signal } from '@angular/core';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonSpinner,
  IonTitle,
  IonToolbar
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { logoGoogle, shieldCheckmarkOutline } from 'ionicons/icons';
import { environment } from '../../../environments/environment';
import { MobileAuthService } from '../../services/mobile-auth.service';

@Component({
  selector: 'app-login',
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
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonSpinner,
    IonTitle,
    IonToolbar
  ],
  templateUrl: './login.page.html'
})
export class LoginPage {
  readonly loading = signal(false);
  readonly error = signal('');
  readonly domains = environment.allowedEmailDomains.join(', ');

  constructor(private readonly auth: MobileAuthService) {
    addIcons({ logoGoogle, shieldCheckmarkOutline });
  }

  async signIn(): Promise<void> {
    this.loading.set(true);
    this.error.set('');

    try {
      await this.auth.signInWithGoogle();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'La connexion Google a echoue.');
      this.loading.set(false);
    }
  }
}
