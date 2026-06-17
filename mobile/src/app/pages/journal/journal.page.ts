import { Component, computed, OnInit, signal } from '@angular/core';
import {
  IonAccordion,
  IonAccordionGroup,
  IonBadge,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCheckbox,
  IonContent,
  IonDatetime,
  IonDatetimeButton,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonNote,
  IonRange,
  IonRefresher,
  IonRefresherContent,
  IonSpinner,
  IonTitle,
  IonToolbar,
  RefresherCustomEvent
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { refreshOutline } from 'ionicons/icons';
import { ClassJournalEntry } from '../../models/jdc-mobile.models';
import { JdcApiService } from '../../services/jdc-api.service';

@Component({
  selector: 'app-journal',
  standalone: true,
  imports: [
    IonAccordion,
    IonAccordionGroup,
    IonBadge,
    IonButton,
    IonButtons,
    IonCard,
    IonCardContent,
    IonCheckbox,
    IonContent,
    IonDatetime,
    IonDatetimeButton,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonModal,
    IonNote,
    IonRange,
    IonRefresher,
    IonRefresherContent,
    IonSpinner,
    IonTitle,
    IonToolbar
  ],
  templateUrl: './journal.page.html'
})
export class JournalPage implements OnInit {
  readonly loading = signal(true);
  readonly error = signal('');
  readonly date = signal(new Date().toISOString().slice(0, 10));
  readonly entries = signal<ClassJournalEntry[]>([]);
  readonly studentCount = computed(() =>
    this.entries().reduce((total, entry) => total + (entry.students?.length ?? 0), 0)
  );

  constructor(private readonly api: JdcApiService) {
    addIcons({ refreshOutline });
  }

  ngOnInit(): void {
    void this.load();
  }

  async refresh(event: RefresherCustomEvent): Promise<void> {
    await this.load();
    event.target.complete();
  }

  async changeDate(value: string | string[] | null | undefined): Promise<void> {
    const nextDate = Array.isArray(value) ? value[0] : value;
    if (!nextDate) {
      return;
    }
    this.date.set(nextDate.slice(0, 10));
    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');

    try {
      this.entries.set(await this.api.getJournalEntries(this.date()));
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Impossible de charger le journal.');
    } finally {
      this.loading.set(false);
    }
  }
}
