import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { apiFetch } from '../../helpers/api-session';
import { School } from '../../models/School';
import { Subject } from '../../models/Subject';
import { Teacher } from '../../models/Teacher';
import { SettingsService } from '../../services/settings.service';

type CurrentUser = {
  userId: string;
  email: string;
  name: string | null;
  role: string;
};

@Component({
  selector: 'app-teacher-profile',
  imports: [ReactiveFormsModule],
  template: `
    <section class="space-y-6">
      <div class="rounded-[1.8rem] border border-slate-200 bg-white p-6 shadow-sm">
        <p class="text-sm font-medium tracking-[0.2em] text-sky-700 uppercase">Profil professeur</p>
        <h2 class="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Ma fiche enseignante</h2>
        <p class="mt-3 max-w-3xl text-base leading-7 text-slate-600">
          Cette fiche utilise ton adresse de connexion pour retrouver ou créer ton profil professeur.
        </p>
      </div>

      @if (errorMessage) {
        <div class="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {{ errorMessage }}
        </div>
      }

      @if (successMessage) {
        <div class="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {{ successMessage }}
        </div>
      }

      @if (isLoading) {
        <div class="rounded-[1.8rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div class="h-5 w-40 animate-pulse rounded bg-slate-200"></div>
          <div class="mt-5 grid gap-4 md:grid-cols-2">
            <div class="h-12 animate-pulse rounded-2xl bg-slate-100"></div>
            <div class="h-12 animate-pulse rounded-2xl bg-slate-100"></div>
            <div class="h-12 animate-pulse rounded-2xl bg-slate-100"></div>
            <div class="h-12 animate-pulse rounded-2xl bg-slate-100"></div>
          </div>
        </div>
      } @else {
        <div class="grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
          <aside class="rounded-[1.8rem] border border-slate-200 bg-slate-950 p-6 text-white shadow-sm">
            <p class="text-sm font-medium tracking-[0.2em] text-cyan-200 uppercase">Compte connecté</p>
            <div class="mt-5 flex items-center gap-4">
              <div class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-lg font-semibold">
                {{ userInitial }}
              </div>
              <div class="min-w-0">
                <p class="truncate text-lg font-semibold">{{ currentUser?.name || 'Compte professeur' }}</p>
                <p class="mt-1 truncate text-sm text-slate-300">{{ currentUser?.email }}</p>
              </div>
            </div>

            <div class="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-slate-200">
              @if (teacherId) {
                Une fiche professeur existe pour cette adresse email.
              } @else {
                Aucune fiche professeur n’est encore liée à cette adresse email.
              }
            </div>
          </aside>

          <form
            [formGroup]="form"
            (ngSubmit)="submit()"
            class="rounded-[1.8rem] border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p class="text-sm font-medium tracking-[0.2em] text-sky-700 uppercase">
                  {{ teacherId ? 'Modifier' : 'Créer' }}
                </p>
                <h3 class="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                  Informations professeur
                </h3>
              </div>

              <span class="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">
                {{ teacherId ? 'Fiche liée' : 'Nouvelle fiche' }}
              </span>
            </div>

            <div class="mt-6 grid gap-4 md:grid-cols-2">
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
                <span class="text-sm font-medium text-slate-800">Email</span>
                <input
                  type="email"
                  formControlName="email"
                  class="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none"
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

              <label class="space-y-2">
                <span class="text-sm font-medium text-slate-800">École liée</span>
                <select
                  formControlName="schoolId"
                  class="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400"
                >
                  <option value="">Aucune école</option>
                  @for (school of schools; track school.id) {
                    <option [value]="school.id">{{ school.name }}{{ school.city ? ' · ' + school.city : '' }}</option>
                  }
                </select>
              </label>

              <label class="space-y-2">
                <span class="text-sm font-medium text-slate-800">Matière enseignée</span>
                <select
                  formControlName="subjectId"
                  class="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400"
                >
                  <option value="">Aucune matière</option>
                  @for (subject of subjects; track subject.id) {
                    <option [value]="subject.id">{{ subject.name }}</option>
                  }
                </select>
              </label>
            </div>

            <div class="mt-6 flex justify-end">
              <button
                type="submit"
                [disabled]="form.invalid || isSubmitting"
                class="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {{ isSubmitting ? 'Enregistrement...' : (teacherId ? 'Mettre à jour' : 'Créer ma fiche') }}
              </button>
            </div>
          </form>
        </div>
      }
    </section>
  `
})
export class TeacherProfileComponent {
  private readonly settingsService = inject(SettingsService);
  private readonly formBuilder = inject(FormBuilder);

  protected currentUser: CurrentUser | null = null;
  protected schools: School[] = [];
  protected subjects: Subject[] = [];
  protected teacherId: string | null = null;
  protected isLoading = true;
  protected isSubmitting = false;
  protected errorMessage = '';
  protected successMessage = '';

  protected readonly form = this.formBuilder.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    email: [{ value: '', disabled: true }],
    phone: [''],
    schoolId: [''],
    subjectId: ['']
  });

  protected get userInitial(): string {
    const source = this.currentUser?.name || this.currentUser?.email || 'P';
    return source.trim().charAt(0).toUpperCase() || 'P';
  }

  constructor() {
    void this.loadProfile();
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.isSubmitting || !this.currentUser) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';
    this.successMessage = '';

    const rawValue = this.form.getRawValue();
    const payload = {
      firstName: rawValue.firstName?.trim() || '',
      lastName: rawValue.lastName?.trim() || '',
      email: this.currentUser.email,
      phone: rawValue.phone?.trim() || null,
      schoolId: rawValue.schoolId || null,
      subjectId: rawValue.subjectId || null
    };

    try {
      const teacher = this.teacherId
        ? await firstValueFrom(
            this.settingsService.updateTeacher$({
              teacherId: this.teacherId,
              ...payload
            })
          )
        : await firstValueFrom(this.settingsService.createTeacher$(payload));

      this.teacherId = teacher.id;
      this.successMessage = 'Ton profil professeur a bien été enregistré.';
    } catch (error) {
      this.errorMessage =
        error instanceof Error ? error.message : 'Impossible d’enregistrer le profil professeur.';
    } finally {
      this.isSubmitting = false;
    }
  }

  private async loadProfile(): Promise<void> {
    try {
      const [currentUser, teachers, schools, subjects] = await Promise.all([
        this.loadCurrentUser(),
        firstValueFrom(this.settingsService.getTeachers$()),
        firstValueFrom(this.settingsService.getSchools$()),
        firstValueFrom(this.settingsService.getSubjects$())
      ]);

      this.currentUser = currentUser;
      this.schools = schools;
      this.subjects = subjects;

      const teacher = teachers.find(
        (item) => item.email?.trim().toLowerCase() === currentUser.email.trim().toLowerCase()
      );

      this.teacherId = teacher?.id ?? null;
      this.form.patchValue({
        firstName: teacher?.first_name || this.getFirstName(currentUser.name),
        lastName: teacher?.last_name || this.getLastName(currentUser.name),
        email: currentUser.email,
        phone: teacher?.phone || '',
        schoolId: teacher?.school_id || '',
        subjectId: teacher?.subject_id || ''
      });
    } catch (error) {
      this.errorMessage =
        error instanceof Error ? error.message : 'Impossible de charger le profil professeur.';
    } finally {
      this.isLoading = false;
    }
  }

  private async loadCurrentUser(): Promise<CurrentUser> {
    const response = await apiFetch('/me', { method: 'GET' });
    const payload = (await response.json().catch(() => null)) as
      | { user?: CurrentUser; error?: string }
      | null;

    if (!response.ok || !payload?.user) {
      throw new Error(payload?.error || 'Impossible de charger le compte connecté.');
    }

    return payload.user;
  }

  private getFirstName(name: string | null): string {
    return name?.trim().split(/\s+/)[0] ?? '';
  }

  private getLastName(name: string | null): string {
    const parts = name?.trim().split(/\s+/).filter(Boolean) ?? [];
    return parts.slice(1).join(' ');
  }
}
