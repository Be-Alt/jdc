import { DatePipe, NgClass } from '@angular/common';
import { Component, Input, OnChanges, SimpleChanges, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  CommunicationDirection,
  CommunicationReminder,
  StudentCommunication,
  StudentCommunicationData
} from '../../../models/StudentCommunication';
import { Teacher } from '../../../models/Teacher';
import { StudentCommunicationsService } from '../../../services/student-communications.service';

@Component({
  selector: 'app-student-communications',
  imports: [FormsModule, DatePipe, NgClass],
  template: `
    <article class="rounded-[1.8rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p class="text-sm font-medium tracking-[0.2em] text-slate-500 uppercase">Communications</p>
          <h3 class="mt-2 text-2xl font-semibold text-slate-950">Courriels, réponses et rappels</h3>
          <p class="mt-2 text-sm text-slate-600">
            Colle ici le contenu envoyé ou reçu. Sans date indiquée, la date du jour est utilisée.
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          @if (isOpen) {
            <button
              type="button"
              (click)="reload()"
              class="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Actualiser
            </button>
          }
          <button
            type="button"
            (click)="toggleOpen()"
            class="rounded-xl bg-sky-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-800"
          >
            {{ isOpen ? 'Fermer la conversation' : 'Ouvrir la conversation' }}
          </button>
        </div>
      </div>

      @if (isOpen) {
        @if (errorMessage) {
          <div class="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {{ errorMessage }}
          </div>
        }

        <div class="mt-6 grid gap-5 xl:grid-cols-2">
        <form (ngSubmit)="addInteraction()" class="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <h4 class="font-semibold text-slate-900">Ajouter une interaction</h4>
          <div class="mt-4 grid gap-4 sm:grid-cols-2">
            <label>
              <span class="text-sm font-medium text-slate-700">Type</span>
              <select [(ngModel)]="interactionDirection" name="direction" class="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm">
                <option value="outgoing">Courriel envoyé</option>
                <option value="incoming">Réponse reçue</option>
                <option value="note">Note d’interaction</option>
              </select>
            </label>
            <label>
              <span class="text-sm font-medium text-slate-700">Professeur</span>
              <select [(ngModel)]="interactionTeacherId" name="interactionTeacher" (ngModelChange)="selectInteractionTeacher()" class="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm">
                <option value="">Sélectionner un professeur</option>
                @for (teacher of teachers; track teacher.id) {
                  <option [value]="teacher.id">{{ teacherName(teacher) }}</option>
                }
              </select>
            </label>
            <label>
              <span class="text-sm font-medium text-slate-700">Date</span>
              <input type="date" [(ngModel)]="interactionDate" name="interactionDate" class="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
            </label>
            <label>
              <span class="text-sm font-medium text-slate-700">Objet</span>
              <input [(ngModel)]="interactionSubject" name="subject" class="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
            </label>
          </div>
          <label class="mt-4 block">
            <span class="text-sm font-medium text-slate-700">Contenu du courriel ou de la réponse</span>
            <textarea
              [(ngModel)]="interactionContent"
              name="content"
              rows="7"
              required
              placeholder="Copier-coller le contenu ici..."
              class="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            ></textarea>
          </label>
          <div class="mt-4 flex flex-wrap gap-3">
            <button type="submit" [disabled]="isSaving || !interactionTeacherId || !interactionContent.trim()" class="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">
              Enregistrer l’interaction
            </button>
            @if (interactionContactEmail) {
              <button
                type="button"
                (click)="openMailClient()"
                class="rounded-xl bg-sky-700 px-4 py-2.5 text-sm font-medium text-white"
              >
                Préparer le courriel
              </button>
            }
          </div>
        </form>

        <form (ngSubmit)="addReminder()" class="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h4 class="font-semibold text-slate-900">Programmer un rappel</h4>
          <div class="mt-4 grid gap-4 sm:grid-cols-2">
            <label>
              <span class="text-sm font-medium text-slate-700">Professeur</span>
              <select [(ngModel)]="reminderTeacherId" name="reminderTeacher" class="mt-2 w-full rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-sm">
                <option value="">Sélectionner un professeur</option>
                @for (teacher of teachers; track teacher.id) {
                  <option [value]="teacher.id">{{ teacherName(teacher) }}</option>
                }
              </select>
            </label>
            <label>
              <span class="text-sm font-medium text-slate-700">Date du rappel</span>
              <input type="date" [(ngModel)]="reminderDate" name="reminderDate" class="mt-2 w-full rounded-xl border border-amber-200 px-3 py-2.5 text-sm" />
            </label>
          </div>
          <label class="mt-4 block">
            <span class="text-sm font-medium text-slate-700">Objet du rappel</span>
            <input [(ngModel)]="reminderTitle" name="reminderTitle" required placeholder="Relancer le professeur..." class="mt-2 w-full rounded-xl border border-amber-200 px-3 py-2.5 text-sm" />
          </label>
          <label class="mt-4 block">
            <span class="text-sm font-medium text-slate-700">Notes</span>
            <textarea [(ngModel)]="reminderNotes" name="reminderNotes" rows="5" class="mt-2 w-full rounded-xl border border-amber-200 px-3 py-2.5 text-sm"></textarea>
          </label>
          <button type="submit" [disabled]="isSaving || !reminderTeacherId || !reminderTitle.trim()" class="mt-4 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">
            Ajouter le rappel
          </button>
        </form>
        </div>

        <div class="mt-6 grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <section>
          <h4 class="font-semibold text-slate-900">Rappels</h4>
          <div class="mt-3 space-y-3">
            @for (reminder of data.reminders; track reminder.id) {
              <div
                class="rounded-2xl border p-4"
                [ngClass]="reminder.completed_at ? 'border-slate-200 bg-slate-50 opacity-70' : isReminderDue(reminder) ? 'border-rose-200 bg-rose-50' : 'border-amber-200 bg-amber-50'"
              >
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <p class="font-medium text-slate-900">{{ reminder.title }}</p>
                    <p class="mt-1 text-xs text-slate-600">
                      {{ reminder.due_date | date: 'dd/MM/yyyy' }}
                      @if (reminder.teacher_name) { · {{ reminder.teacher_name }} }
                    </p>
                  </div>
                  @if (!reminder.completed_at && isReminderDue(reminder)) {
                    <span class="rounded-full bg-rose-600 px-2.5 py-1 text-[11px] font-semibold text-white">À traiter</span>
                  }
                </div>
                @if (reminder.notes) {
                  <p class="mt-3 whitespace-pre-wrap text-sm text-slate-700">{{ reminder.notes }}</p>
                }
                <div class="mt-3 flex gap-2">
                  <button type="button" (click)="toggleReminder(reminder)" class="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
                    {{ reminder.completed_at ? 'Réouvrir' : 'Terminé' }}
                  </button>
                  <button type="button" (click)="deleteReminder(reminder)" class="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-rose-700 ring-1 ring-rose-200">
                    Supprimer
                  </button>
                </div>
              </div>
            } @empty {
              <p class="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">Aucun rappel.</p>
            }
          </div>
        </section>

        <section>
          <div class="flex flex-wrap items-center justify-between gap-3">
            <h4 class="font-semibold text-slate-900">Historique des interactions</h4>
            @if (data.interactions.length > 0) {
              <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                {{ interactionIndex + 1 }} / {{ data.interactions.length }}
              </span>
            }
          </div>
          <div class="mt-3">
            @if (currentInteraction(); as interaction) {
              <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <span class="rounded-full px-3 py-1 text-xs font-semibold" [ngClass]="directionClasses(interaction.direction)">
                    {{ directionLabel(interaction.direction) }}
                  </span>
                  <span class="text-xs text-slate-500">{{ interaction.occurred_on | date: 'dd/MM/yyyy' }}</span>
                </div>
                <p class="mt-3 font-medium text-slate-900">{{ interaction.subject || 'Sans objet' }}</p>
                <p class="mt-1 text-xs text-slate-500">
                  {{ interaction.teacher_name || interaction.contact_name || interaction.contact_email || 'Contact non précisé' }}
                </p>
                <p class="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{{ interaction.content }}</p>
              </div>

              <div class="mt-4 flex items-center justify-between gap-3">
                <button
                  type="button"
                  (click)="showNewerInteraction()"
                  [disabled]="interactionIndex === 0"
                  class="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  ← Plus récent
                </button>
                <button
                  type="button"
                  (click)="showOlderInteraction()"
                  [disabled]="interactionIndex >= data.interactions.length - 1"
                  class="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Plus ancien →
                </button>
              </div>
            } @else {
              <p class="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">Aucune interaction enregistrée.</p>
            }
          </div>
        </section>
        </div>
      }
    </article>
  `
})
export class StudentCommunicationsComponent implements OnChanges {
  @Input({ required: true }) enrollmentId = '';
  @Input() teachers: Teacher[] = [];

  private readonly service = inject(StudentCommunicationsService);
  protected data: StudentCommunicationData = { interactions: [], reminders: [] };
  protected isOpen = false;
  protected errorMessage = '';
  protected isSaving = false;
  private isLoading = false;
  private loadedEnrollmentId = '';
  protected interactionDirection: CommunicationDirection = 'outgoing';
  protected interactionTeacherId = '';
  protected interactionContactName = '';
  protected interactionContactEmail = '';
  protected interactionSubject = '';
  protected interactionContent = '';
  protected interactionDate = '';
  protected reminderTeacherId = '';
  protected reminderTitle = '';
  protected reminderNotes = '';
  protected reminderDate = '';
  protected interactionIndex = 0;

  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes['enrollmentId'] &&
      this.enrollmentId &&
      this.enrollmentId !== this.loadedEnrollmentId
    ) {
      this.data = { interactions: [], reminders: [] };
      this.loadedEnrollmentId = '';
      this.isOpen = false;
    }
  }

  protected async toggleOpen(): Promise<void> {
    this.isOpen = !this.isOpen;
    if (this.isOpen && this.enrollmentId !== this.loadedEnrollmentId) {
      await this.reload();
    }
  }

  protected async reload(): Promise<void> {
    if (!this.enrollmentId || this.isLoading) return;

    this.isLoading = true;
    try {
      this.data = await firstValueFrom(this.service.getStudentData$(this.enrollmentId));
      this.interactionIndex = 0;
      this.loadedEnrollmentId = this.enrollmentId;
      this.errorMessage = '';
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Impossible de charger les communications.';
    } finally {
      this.isLoading = false;
    }
  }

  protected teacherName(teacher: Teacher): string {
    return `${teacher.first_name ?? ''} ${teacher.last_name ?? ''}`.trim() || teacher.email || 'Professeur';
  }

  protected selectInteractionTeacher(): void {
    const teacher = this.teachers.find((item) => item.id === this.interactionTeacherId);
    if (!teacher) return;
    this.interactionContactName = this.teacherName(teacher);
    this.interactionContactEmail = teacher.email ?? '';
  }

  protected openMailClient(): void {
    const email = this.interactionContactEmail.trim();
    if (!email) return;
    const params = new URLSearchParams();
    if (this.interactionSubject) params.set('subject', this.interactionSubject);
    if (this.interactionContent) params.set('body', this.interactionContent);
    const query = params.toString();
    window.location.href = `mailto:${email}${query ? `?${query}` : ''}`;
  }

  protected async addInteraction(): Promise<void> {
    this.isSaving = true;
    try {
      this.data = await firstValueFrom(this.service.createInteraction$({
        enrollmentId: this.enrollmentId,
        teacherId: this.interactionTeacherId || null,
        direction: this.interactionDirection,
        contactName: this.interactionContactName || null,
        contactEmail: this.interactionContactEmail || null,
        subject: this.interactionSubject || null,
        content: this.interactionContent,
        occurredOn: this.interactionDate || null
      }));
      this.interactionIndex = 0;
      this.interactionSubject = '';
      this.interactionContent = '';
      this.interactionDate = '';
      this.errorMessage = '';
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Impossible d’enregistrer l’interaction.';
    } finally {
      this.isSaving = false;
    }
  }

  protected async addReminder(): Promise<void> {
    this.isSaving = true;
    try {
      this.data = await firstValueFrom(this.service.createReminder$({
        enrollmentId: this.enrollmentId,
        teacherId: this.reminderTeacherId || null,
        title: this.reminderTitle,
        notes: this.reminderNotes || null,
        dueDate: this.reminderDate || null
      }));
      this.reminderTitle = '';
      this.reminderNotes = '';
      this.reminderDate = '';
      this.errorMessage = '';
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Impossible d’ajouter le rappel.';
    } finally {
      this.isSaving = false;
    }
  }

  protected async toggleReminder(reminder: CommunicationReminder): Promise<void> {
    await firstValueFrom(this.service.updateReminder$(reminder.id, 'complete-reminder'));
    await this.reload();
  }

  protected async deleteReminder(reminder: CommunicationReminder): Promise<void> {
    await firstValueFrom(this.service.updateReminder$(reminder.id, 'delete-reminder'));
    await this.reload();
  }

  protected isReminderDue(reminder: CommunicationReminder): boolean {
    return !reminder.completed_at && reminder.due_date <= this.todayIso();
  }

  protected directionLabel(direction: CommunicationDirection): string {
    return direction === 'outgoing' ? 'Courriel envoyé' : direction === 'incoming' ? 'Réponse reçue' : 'Note';
  }

  protected directionClasses(direction: CommunicationDirection): string {
    return direction === 'outgoing'
      ? 'bg-sky-100 text-sky-800'
      : direction === 'incoming'
        ? 'bg-emerald-100 text-emerald-800'
        : 'bg-slate-100 text-slate-700';
  }

  protected currentInteraction(): StudentCommunication | null {
    return this.data.interactions[this.interactionIndex] ?? null;
  }

  protected showNewerInteraction(): void {
    this.interactionIndex = Math.max(0, this.interactionIndex - 1);
  }

  protected showOlderInteraction(): void {
    this.interactionIndex = Math.min(
      this.data.interactions.length - 1,
      this.interactionIndex + 1
    );
  }

  private todayIso(): string {
    const date = new Date();
    const offset = date.getTimezoneOffset();
    return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
  }
}
