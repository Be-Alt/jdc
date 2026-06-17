import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonBadge,
  IonButton,
  IonButtons,
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
  IonRefresher,
  IonRefresherContent,
  IonSpinner,
  IonTitle,
  IonToolbar,
  RefresherCustomEvent
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { arrowForwardOutline, refreshOutline } from 'ionicons/icons';
import { ClassJournalEntry, CurrentUser, StudentListItem } from '../../models/jdc-mobile.models';
import { JdcApiService } from '../../services/jdc-api.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    RouterLink,
    IonBadge,
    IonButton,
    IonButtons,
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
    IonRefresher,
    IonRefresherContent,
    IonSpinner,
    IonTitle,
    IonToolbar
  ],
  templateUrl: './home.page.html'
})
export class HomePage implements OnInit {
  readonly loading = signal(true);
  readonly error = signal('');
  readonly user = signal<CurrentUser | null>(null);
  readonly students = signal<StudentListItem[]>([]);
  readonly entries = signal<ClassJournalEntry[]>([]);
  readonly today = new Date().toISOString().slice(0, 10);

  constructor(private readonly api: JdcApiService) {
    addIcons({ arrowForwardOutline, refreshOutline });
  }

  ngOnInit(): void {
    void this.load();
  }

  async refresh(event: RefresherCustomEvent): Promise<void> {
    await this.load();
    event.target.complete();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');

    try {
      const [user, students, entries] = await Promise.all([
        this.api.getCurrentUser(),
        this.api.getStudents(),
        this.api.getJournalEntries(this.today)
      ]);
      this.user.set(user);
      this.students.set(students);
      this.entries.set(entries);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Chargement impossible.');
    } finally {
      this.loading.set(false);
    }
  }
}
