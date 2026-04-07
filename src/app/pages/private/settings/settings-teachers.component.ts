import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { BehaviorSubject, catchError, combineLatest, map, of, startWith, switchMap } from 'rxjs';
import { School } from '../../../models/School';
import { Teacher } from '../../../models/Teacher';
import { SettingsService } from '../../../services/settings.service';

@Component({
  selector: 'app-settings-teachers',
  imports: [AsyncPipe, ReactiveFormsModule],
  template: `
    <section class="mt-5 overflow-hidden rounded-[1.8rem] border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        (click)="toggleOpen()"
        class="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition hover:bg-slate-50"
      >
        <div>
          <p class="text-sm font-medium tracking-[0.2em] text-sky-700 uppercase">Bloc paramètre</p>
          <h3 class="mt-2 text-2xl font-semibold text-slate-950">Professeurs des écoles d’origine</h3>
          <p class="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Ajoute et modifie les professeurs liés à une école d’origine pour garder un référentiel clair.
          </p>
        </div>

        <span class="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-lg text-slate-700">
          {{ isOpen ? '−' : '+' }}
        </span>
      </button>

      @if (isOpen) {
        <div class="border-t border-slate-200 px-6 py-6">
          @if (vm$ | async; as vm) {
            @if (vm.errorMessage) {
              <div class="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {{ vm.errorMessage }}
              </div>
            }

            @if (successMessage) {
              <div class="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {{ successMessage }}
              </div>
            }

            <form [formGroup]="form" (ngSubmit)="submit()" class="grid gap-4 xl:grid-cols-2">
              @if (editingTeacherId) {
                <div class="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800 xl:col-span-2">
                  Modification en cours : <span class="font-semibold">{{ editingTeacherName }}</span>
                </div>
              }

              <label class="space-y-2">
                <span class="text-sm font-medium text-slate-800">Prénom</span>
                <input
                  type="text"
                  formControlName="firstName"
                  class="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400"
                />
              </label>

              <label class="space-y-2">
                <span class="text-sm font-medium text-slate-800">Nom</span>
                <input
                  type="text"
                  formControlName="lastName"
                  class="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400"
                />
              </label>

              <label class="space-y-2">
                <span class="text-sm font-medium text-slate-800">École liée</span>
                <select
                  formControlName="schoolId"
                  class="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400"
                >
                  <option value="">Aucune école</option>
                  @for (school of vm.schools; track school.id) {
                    <option [value]="school.id">{{ school.name }}{{ school.city ? ' · ' + school.city : '' }}</option>
                  }
                </select>
              </label>

              <label class="space-y-2">
                <span class="text-sm font-medium text-slate-800">Matière</span>
                <input
                  type="text"
                  formControlName="subject"
                  class="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400"
                />
              </label>

              <label class="space-y-2">
                <span class="text-sm font-medium text-slate-800">Email</span>
                <input
                  type="email"
                  formControlName="email"
                  class="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400"
                />
              </label>

              <label class="space-y-2">
                <span class="text-sm font-medium text-slate-800">Téléphone</span>
                <input
                  type="text"
                  formControlName="phone"
                  class="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400"
                />
              </label>

              <div class="flex items-end xl:col-span-2">
                <div class="flex w-full flex-col gap-3 sm:flex-row">
                  <button
                    type="submit"
                    [disabled]="form.invalid || isSubmitting"
                    class="w-full rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                  >
                    {{
                      isSubmitting
                        ? (editingTeacherId ? 'Mise à jour...' : 'Ajout...')
                        : (editingTeacherId ? 'Enregistrer les modifications' : 'Ajouter')
                    }}
                  </button>

                  @if (editingTeacherId) {
                    <button
                      type="button"
                      (click)="resetForm()"
                      class="w-full rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 sm:w-auto"
                    >
                      Annuler
                    </button>
                  }
                </div>
              </div>
            </form>

            <div class="mt-6">
              @if (vm.isLoading) {
                <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  @for (item of skeletonItems; track item) {
                    <div class="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                      <div class="h-5 w-28 animate-pulse rounded bg-slate-200"></div>
                      <div class="mt-3 h-4 w-20 animate-pulse rounded bg-slate-100"></div>
                    </div>
                  }
                </div>
              } @else if (vm.teachers.length === 0) {
                <div class="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                  Aucun professeur enregistré pour le moment.
                </div>
              } @else {
                <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  @for (teacher of vm.teachers; track teacher.id) {
                    <article class="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                      <div class="flex items-start justify-between gap-3">
                        <div>
                          <h4 class="text-base font-semibold text-slate-950">
                            {{ teacher.first_name || '' }} {{ teacher.last_name || '' }}
                          </h4>
                          <p class="mt-1 text-sm text-slate-600">{{ teacher.subject || 'Matière non renseignée' }}</p>
                        </div>

                        <div class="flex items-center gap-2">
                          <button
                            type="button"
                            (click)="editTeacher(teacher)"
                            class="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                          >
                            Modifier
                          </button>
                          <button
                            type="button"
                            (click)="deleteTeacher(teacher)"
                            [disabled]="deletingTeacherId === teacher.id"
                            class="rounded-xl border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {{ deletingTeacherId === teacher.id ? '...' : 'Supprimer' }}
                          </button>
                        </div>
                      </div>

                      <div class="mt-3 space-y-2 text-sm text-slate-600">
                        <p>{{ teacher.school_name || 'Aucune école liée' }}</p>
                        <p>{{ teacher.email || 'Email non renseigné' }}</p>
                        <p>{{ teacher.phone || 'Téléphone non renseigné' }}</p>
                      </div>
                    </article>
                  }
                </div>
              }
            </div>
          }
        </div>
      }
    </section>
  `
})
export class SettingsTeachersComponent {
  private readonly settingsService = inject(SettingsService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly refreshSubject = new BehaviorSubject<void>(undefined);
  private readonly errorMessageSubject = new BehaviorSubject<string>('');

  protected readonly skeletonItems = [1, 2, 3];
  protected isOpen = false;
  protected isSubmitting = false;
  protected deletingTeacherId: string | null = null;
  protected successMessage = '';
  protected editingTeacherId: string | null = null;
  protected editingTeacherName = '';

  protected readonly form = this.formBuilder.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    schoolId: [''],
    subject: [''],
    email: [''],
    phone: ['']
  });

  protected readonly vm$ = combineLatest([
    this.refreshSubject,
    this.errorMessageSubject.asObservable()
  ]).pipe(
    switchMap(([, errorMessage]) =>
      combineLatest([
        this.settingsService.getTeachers$(),
        this.settingsService.getSchools$()
      ]).pipe(
        map(([teachers, schools]) => ({
          teachers,
          schools,
          isLoading: false,
          errorMessage
        })),
        startWith({
          teachers: [] as Teacher[],
          schools: [] as School[],
          isLoading: true,
          errorMessage
        }),
        catchError((error: unknown) =>
          of({
            teachers: [] as Teacher[],
            schools: [] as School[],
            isLoading: false,
            errorMessage: error instanceof Error ? error.message : 'Impossible de charger les professeurs.'
          })
        )
      )
    )
  );

  protected toggleOpen(): void {
    this.isOpen = !this.isOpen;
  }

  protected submit(): void {
    if (this.form.invalid || this.isSubmitting) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    this.successMessage = '';
    this.errorMessageSubject.next('');

    const rawValue = this.form.getRawValue();

    const request$ = this.editingTeacherId
      ? this.settingsService.updateTeacher$({
          teacherId: this.editingTeacherId,
          firstName: rawValue.firstName?.trim() || '',
          lastName: rawValue.lastName?.trim() || '',
          schoolId: rawValue.schoolId || null,
          subject: rawValue.subject?.trim() || null,
          email: rawValue.email?.trim() || null,
          phone: rawValue.phone?.trim() || null
        })
      : this.settingsService.createTeacher$({
          firstName: rawValue.firstName?.trim() || '',
          lastName: rawValue.lastName?.trim() || '',
          schoolId: rawValue.schoolId || null,
          subject: rawValue.subject?.trim() || null,
          email: rawValue.email?.trim() || null,
          phone: rawValue.phone?.trim() || null
        });

    request$.subscribe({
      next: () => {
        this.isSubmitting = false;
        this.successMessage = this.editingTeacherId
          ? 'Le professeur a bien été mis à jour.'
          : 'Le professeur a bien été ajouté.';
        this.resetForm();
        this.refreshSubject.next();
      },
      error: (error: unknown) => {
        this.isSubmitting = false;
        this.errorMessageSubject.next(
          error instanceof Error ? error.message : 'Impossible d’enregistrer le professeur.'
        );
      }
    });
  }

  protected editTeacher(teacher: Teacher): void {
    this.editingTeacherId = teacher.id;
    this.editingTeacherName = `${teacher.first_name || ''} ${teacher.last_name || ''}`.trim();
    this.successMessage = '';
    this.errorMessageSubject.next('');

    this.form.patchValue({
      firstName: teacher.first_name || '',
      lastName: teacher.last_name || '',
      schoolId: teacher.school_id || '',
      subject: teacher.subject || '',
      email: teacher.email || '',
      phone: teacher.phone || ''
    });
  }

  protected deleteTeacher(teacher: Teacher): void {
    if (this.deletingTeacherId || !confirm(`Supprimer le professeur "${teacher.first_name || ''} ${teacher.last_name || ''}" ?`)) {
      return;
    }

    this.deletingTeacherId = teacher.id;
    this.successMessage = '';
    this.errorMessageSubject.next('');

    this.settingsService.deleteTeacher$(teacher.id).subscribe({
      next: () => {
        this.deletingTeacherId = null;
        this.successMessage = 'Le professeur a bien été supprimé.';

        if (this.editingTeacherId === teacher.id) {
          this.resetForm();
        }

        this.refreshSubject.next();
      },
      error: (error: unknown) => {
        this.deletingTeacherId = null;
        this.errorMessageSubject.next(
          error instanceof Error ? error.message : 'Impossible de supprimer le professeur.'
        );
      }
    });
  }

  protected resetForm(): void {
    this.editingTeacherId = null;
    this.editingTeacherName = '';
    this.form.reset({
      firstName: '',
      lastName: '',
      schoolId: '',
      subject: '',
      email: '',
      phone: ''
    });
  }
}
