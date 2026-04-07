import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { BehaviorSubject, catchError, combineLatest, map, of, startWith, switchMap } from 'rxjs';
import { School } from '../../../models/School';
import { SettingsService } from '../../../services/settings.service';

@Component({
  selector: 'app-settings-schools',
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
          <h3 class="mt-2 text-2xl font-semibold text-slate-950">Écoles d’origine</h3>
          <p class="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Ajoute ici les écoles d’origine que tu pourras ensuite associer à tes élèves.
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
              @if (editingSchoolId) {
                <div class="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800 xl:col-span-2">
                  Modification en cours : <span class="font-semibold">{{ editingSchoolName }}</span>
                </div>
              }

              <label class="space-y-2">
                <span class="text-sm font-medium text-slate-800">Nom de l’école</span>
                <input
                  type="text"
                  formControlName="name"
                  class="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400"
                  placeholder="Athénée, collège, institut..."
                />
              </label>

              <label class="space-y-2">
                <span class="text-sm font-medium text-slate-800">Adresse</span>
                <input
                  type="text"
                  formControlName="address"
                  class="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400"
                  placeholder="Rue, numéro..."
                />
              </label>

              <label class="space-y-2">
                <span class="text-sm font-medium text-slate-800">Ville</span>
                <input
                  type="text"
                  formControlName="city"
                  class="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400"
                  placeholder="Bruxelles, Liège..."
                />
              </label>

              <label class="space-y-2">
                <span class="text-sm font-medium text-slate-800">Code postal</span>
                <input
                  type="text"
                  formControlName="postalCode"
                  class="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400"
                  placeholder="1000"
                />
              </label>

              <label class="space-y-2">
                <span class="text-sm font-medium text-slate-800">Pays</span>
                <input
                  type="text"
                  formControlName="country"
                  class="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400"
                  placeholder="Belgique"
                />
              </label>

              <label class="space-y-2 xl:col-span-2">
                <span class="text-sm font-medium text-slate-800">Site web</span>
                <input
                  type="text"
                  formControlName="website"
                  class="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400"
                  placeholder="https://..."
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
                        ? (editingSchoolId ? 'Mise à jour...' : 'Ajout...')
                        : (editingSchoolId ? 'Enregistrer les modifications' : 'Ajouter')
                    }}
                  </button>

                  @if (editingSchoolId) {
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
              } @else if (vm.schools.length === 0) {
                <div class="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                  Aucune école d’origine enregistrée pour le moment.
                </div>
              } @else {
                <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  @for (school of vm.schools; track school.id) {
                    <article class="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                      <div class="flex items-start justify-between gap-3">
                        <h4 class="text-base font-semibold text-slate-950">{{ school.name }}</h4>
                        <div class="flex items-center gap-2">
                          <button
                            type="button"
                            (click)="editSchool(school)"
                            class="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                          >
                            Modifier
                          </button>
                          <button
                            type="button"
                            (click)="deleteSchool(school)"
                            [disabled]="deletingSchoolId === school.id"
                            class="rounded-xl border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {{ deletingSchoolId === school.id ? '...' : 'Supprimer' }}
                          </button>
                        </div>
                      </div>
                      <div class="mt-3 space-y-2 text-sm text-slate-600">
                        <p>{{ school.address || 'Adresse non renseignée' }}</p>
                        <p>
                          {{ school.postal_code || 'Code postal —' }}
                          @if (school.city) {
                            <span> · {{ school.city }}</span>
                          }
                        </p>
                        <p>{{ school.country }}</p>
                        @if (school.website) {
                          <a
                            [href]="school.website"
                            target="_blank"
                            rel="noreferrer noopener"
                            class="block break-all text-sky-700 underline-offset-4 transition hover:text-sky-800 hover:underline"
                          >
                            {{ school.website }}
                          </a>
                        } @else {
                          <p class="break-all">Site web non renseigné</p>
                        }
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
export class SettingsSchoolsComponent {
  private readonly settingsService = inject(SettingsService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly refreshSubject = new BehaviorSubject<void>(undefined);
  private readonly errorMessageSubject = new BehaviorSubject<string>('');

  protected readonly skeletonItems = [1, 2, 3];
  protected isOpen = false;
  protected isSubmitting = false;
  protected deletingSchoolId: string | null = null;
  protected successMessage = '';
  protected editingSchoolId: string | null = null;
  protected editingSchoolName = '';

  protected readonly form = this.formBuilder.group({
    name: ['', Validators.required],
    address: [''],
    city: [''],
    postalCode: [''],
    country: ['Belgique'],
    website: ['']
  });

  protected readonly vm$ = combineLatest([
    this.refreshSubject,
    this.errorMessageSubject.asObservable()
  ]).pipe(
    switchMap(([, errorMessage]) =>
      this.settingsService.getSchools$().pipe(
        map((schools) => ({
          schools,
          isLoading: false,
          errorMessage
        })),
        startWith({
          schools: [],
          isLoading: true,
          errorMessage
        }),
        catchError((error: unknown) =>
          of({
            schools: [],
            isLoading: false,
            errorMessage: error instanceof Error ? error.message : 'Impossible de charger les écoles.'
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

    const request$ = this.editingSchoolId
      ? this.settingsService.updateSchool$({
          schoolId: this.editingSchoolId,
          name: rawValue.name?.trim() || '',
          address: rawValue.address?.trim() || null,
          city: rawValue.city?.trim() || null,
          postalCode: rawValue.postalCode?.trim() || null,
          country: rawValue.country?.trim() || 'Belgique',
          website: rawValue.website?.trim() || null
        })
      : this.settingsService.createSchool$({
          name: rawValue.name?.trim() || '',
          address: rawValue.address?.trim() || null,
          city: rawValue.city?.trim() || null,
          postalCode: rawValue.postalCode?.trim() || null,
          country: rawValue.country?.trim() || 'Belgique',
          website: rawValue.website?.trim() || null
        });

    request$.subscribe({
      next: () => {
        this.isSubmitting = false;
        this.successMessage = this.editingSchoolId
          ? 'L’école d’origine a bien été mise à jour.'
          : 'L’école d’origine a bien été ajoutée.';
        this.resetForm();
        this.refreshSubject.next();
      },
      error: (error: unknown) => {
        this.isSubmitting = false;
        this.errorMessageSubject.next(
          error instanceof Error ? error.message : 'Impossible d’enregistrer l’école.'
        );
      }
    });
  }

  protected editSchool(school: School): void {
    this.editingSchoolId = school.id;
    this.editingSchoolName = school.name;
    this.successMessage = '';
    this.errorMessageSubject.next('');

    this.form.patchValue({
      name: school.name,
      address: school.address || '',
      city: school.city || '',
      postalCode: school.postal_code || '',
      country: school.country || 'Belgique',
      website: school.website || ''
    });
  }

  protected resetForm(): void {
    this.editingSchoolId = null;
    this.editingSchoolName = '';
    this.form.reset({
      name: '',
      address: '',
      city: '',
      postalCode: '',
      country: 'Belgique',
      website: ''
    });
  }

  protected deleteSchool(school: School): void {
    if (this.deletingSchoolId || !confirm(`Supprimer l’école "${school.name}" ?`)) {
      return;
    }

    this.deletingSchoolId = school.id;
    this.successMessage = '';
    this.errorMessageSubject.next('');

    this.settingsService.deleteSchool$(school.id).subscribe({
      next: () => {
        this.deletingSchoolId = null;
        this.successMessage = 'L’école d’origine a bien été supprimée.';

        if (this.editingSchoolId === school.id) {
          this.resetForm();
        }

        this.refreshSubject.next();
      },
      error: (error: unknown) => {
        this.deletingSchoolId = null;
        this.errorMessageSubject.next(
          error instanceof Error ? error.message : 'Impossible de supprimer l’école.'
        );
      }
    });
  }
}
