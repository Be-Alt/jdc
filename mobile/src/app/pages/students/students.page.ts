import { Component, computed, OnInit, signal } from '@angular/core';
import {
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
  IonModal,
  IonNote,
  IonRefresher,
  IonRefresherContent,
  IonSearchbar,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
  IonTitle,
  IonToolbar,
  RefresherCustomEvent,
  SearchbarCustomEvent,
  SegmentCustomEvent
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { closeOutline, refreshOutline } from 'ionicons/icons';
import { StudentListItem, StudentSummary } from '../../models/jdc-mobile.models';
import { JdcApiService } from '../../services/jdc-api.service';

type StudentFilter = 'active' | 'all';

@Component({
  selector: 'app-students',
  standalone: true,
  imports: [
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
    IonModal,
    IonNote,
    IonRefresher,
    IonRefresherContent,
    IonSearchbar,
    IonSegment,
    IonSegmentButton,
    IonSpinner,
    IonTitle,
    IonToolbar
  ],
  templateUrl: './students.page.html'
})
export class StudentsPage implements OnInit {
  readonly loading = signal(true);
  readonly detailLoading = signal(false);
  readonly error = signal('');
  readonly query = signal('');
  readonly filter = signal<StudentFilter>('active');
  readonly students = signal<StudentListItem[]>([]);
  readonly selected = signal<StudentListItem | null>(null);
  readonly summary = signal<StudentSummary | null>(null);

  readonly filteredStudents = computed(() => {
    const query = this.query().trim().toLowerCase();
    const filter = this.filter();

    return this.students().filter((student) => {
      const fullName = `${student.first_name} ${student.last_name}`.toLowerCase();
      const matchesQuery = !query || fullName.includes(query);
      const matchesFilter = filter === 'all' || student.status !== 'inactive';
      return matchesQuery && matchesFilter;
    });
  });

  constructor(private readonly api: JdcApiService) {
    addIcons({ closeOutline, refreshOutline });
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
      this.students.set(await this.api.getStudents());
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Impossible de charger les eleves.');
    } finally {
      this.loading.set(false);
    }
  }

  search(event: SearchbarCustomEvent): void {
    this.query.set(event.detail.value ?? '');
  }

  setFilter(event: SegmentCustomEvent): void {
    this.filter.set((event.detail.value as StudentFilter | undefined) ?? 'active');
  }

  async openStudent(student: StudentListItem): Promise<void> {
    this.selected.set(student);
    this.summary.set(null);
    this.detailLoading.set(true);

    try {
      this.summary.set(await this.api.getStudentSummary(student.enrollment_id));
    } catch {
      this.summary.set(null);
    } finally {
      this.detailLoading.set(false);
    }
  }

  closeStudent(): void {
    this.selected.set(null);
    this.summary.set(null);
  }
}
