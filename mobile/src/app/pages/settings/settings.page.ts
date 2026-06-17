import { Component, OnInit, inject, signal } from '@angular/core';
import {
  IonAccordion,
  IonAccordionGroup,
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonSpinner,
  IonTextarea,
  IonTitle,
  IonToast,
  IonToolbar
} from '@ionic/angular/standalone';
import { environment } from '../../../environments/environment';
import { ObservationCategory } from '../../models/jdc-mobile.models';
import { JdcApiService } from '../../services/jdc-api.service';
import { MobileAuthService } from '../../services/mobile-auth.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    IonAccordion,
    IonAccordionGroup,
    IonButton,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardSubtitle,
    IonCardTitle,
    IonContent,
    IonHeader,
    IonInput,
    IonItem,
    IonLabel,
    IonList,
    IonSpinner,
    IonTextarea,
    IonTitle,
    IonToast,
    IonToolbar
  ],
  templateUrl: './settings.page.html'
})
export class SettingsPage implements OnInit {
  private readonly api = inject(JdcApiService);
  private readonly auth = inject(MobileAuthService);

  readonly loading = signal(false);
  readonly toastMessage = signal('');
  readonly apiBaseUrl = signal(this.api.apiBaseUrl());
  readonly observations = signal<ObservationCategory[]>([]);
  readonly webAppUrl = environment.webAppUrl;

  ngOnInit(): void {
    void this.loadCatalog();
  }

  updateApiBaseUrl(value: string | number | null | undefined): void {
    this.apiBaseUrl.set(String(value ?? ''));
  }

  saveApiBaseUrl(): void {
    this.api.updateApiBaseUrl(this.apiBaseUrl());
    this.toastMessage.set('Adresse API mise a jour pour cette session.');
  }

  async loadCatalog(): Promise<void> {
    this.loading.set(true);

    try {
      this.observations.set(await this.api.getObservationCatalog());
    } catch {
      this.observations.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  async signOut(): Promise<void> {
    await this.auth.signOut();
  }
}
