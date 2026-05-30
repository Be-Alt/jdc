import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { BehaviorSubject, catchError, combineLatest, map, of, startWith, switchMap } from 'rxjs';
import { Section } from '../../../models/Section';
import { SettingsService } from '../../../services/settings.service';

@Component({
  selector: 'app-settings-sections',
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
          <h3 class="mt-2 text-2xl font-semibold text-slate-950">Sections</h3>
          <p class="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Ajoute les sections disponibles pour les fiches élèves et les programmes.
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

            <form [formGroup]="form" (ngSubmit)="submit()" class="grid gap-4 lg:grid-cols-[0.7fr_0.6fr_0.7fr_1.4fr_auto] lg:items-end">
              <label class="space-y-2">
                <span class="text-sm font-medium text-slate-800">Code</span>
                <input
                  type="text"
                  formControlName="code"
                  class="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 uppercase outline-none transition focus:border-sky-400"
                  placeholder="3TT"
                />
              </label>

              <label class="space-y-2">
                <span class="text-sm font-medium text-slate-800">Niveau</span>
                <input
                  type="number"
                  min="1"
                  formControlName="level"
                  class="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400"
                  placeholder="3"
                />
              </label>

              <label class="space-y-2">
                <span class="text-sm font-medium text-slate-800">Type</span>
                <input
                  type="text"
                  formControlName="type"
                  class="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 uppercase outline-none transition focus:border-sky-400"
                  placeholder="TT, G, TQ, P..."
                />
              </label>

              <label class="space-y-2">
                <span class="text-sm font-medium text-slate-800">Libellé</span>
                <input
                  type="text"
                  formControlName="label"
                  class="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400"
                  placeholder="3e année technique de transition"
                />
              </label>

              <button
                type="submit"
                [disabled]="form.invalid || isSubmitting"
                class="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {{ isSubmitting ? 'Ajout...' : 'Ajouter' }}
              </button>
            </form>

            <div class="mt-6">
              @if (vm.isLoading) {
                <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  @for (item of skeletonItems; track item) {
                    <div class="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                      <div class="h-5 w-16 animate-pulse rounded bg-slate-200"></div>
                      <div class="mt-3 h-4 w-32 animate-pulse rounded bg-slate-100"></div>
                    </div>
                  }
                </div>
              } @else if (vm.sections.length === 0) {
                <div class="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                  Aucune section enregistrée pour le moment.
                </div>
              } @else {
                <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  @for (section of vm.sections; track section.id) {
                    <article class="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                      <div class="flex items-start justify-between gap-3">
                        <div>
                          <p class="text-lg font-semibold text-slate-950">{{ section.code }}</p>
                          <p class="mt-1 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                            {{ section.type }} · {{ section.level }}e
                          </p>
                        </div>
                        <button
                          type="button"
                          (click)="deleteSection(section)"
                          [disabled]="deletingSectionId === section.id"
                          class="rounded-xl border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {{ deletingSectionId === section.id ? '...' : 'Supprimer' }}
                        </button>
                      </div>
                      <p class="mt-3 text-sm leading-6 text-slate-600">{{ section.label }}</p>
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
export class SettingsSectionsComponent {
  private readonly settingsService = inject(SettingsService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly refreshSubject = new BehaviorSubject<void>(undefined);
  private readonly errorMessageSubject = new BehaviorSubject<string>('');

  protected readonly skeletonItems = [1, 2, 3, 4];
  protected isOpen = false;
  protected isSubmitting = false;
  protected deletingSectionId: string | null = null;
  protected successMessage = '';

  protected readonly form = this.formBuilder.group({
    code: ['', Validators.required],
    level: [null as number | null, [Validators.required, Validators.min(1)]],
    type: ['', Validators.required],
    label: ['', Validators.required]
  });

  protected readonly vm$ = combineLatest([
    this.refreshSubject,
    this.errorMessageSubject.asObservable()
  ]).pipe(
    switchMap(([, errorMessage]) =>
      this.settingsService.getSections$().pipe(
        map((sections) => ({
          sections,
          isLoading: false,
          errorMessage
        })),
        startWith({
          sections: [] as Section[],
          isLoading: true,
          errorMessage
        }),
        catchError((error: unknown) =>
          of({
            sections: [] as Section[],
            isLoading: false,
            errorMessage: error instanceof Error ? error.message : 'Impossible de charger les sections.'
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

    this.settingsService.createSection$({
      code: rawValue.code?.trim().toUpperCase() || '',
      level: Number(rawValue.level),
      type: rawValue.type?.trim().toUpperCase() || '',
      label: rawValue.label?.trim() || ''
    }).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.successMessage = 'La section a bien été ajoutée.';
        this.form.reset({
          code: '',
          level: null,
          type: '',
          label: ''
        });
        this.refreshSubject.next();
      },
      error: (error: unknown) => {
        this.isSubmitting = false;
        this.errorMessageSubject.next(
          error instanceof Error ? error.message : 'Impossible d’ajouter la section.'
        );
      }
    });
  }

  protected deleteSection(section: Section): void {
    if (this.deletingSectionId || !confirm(`Supprimer la section "${section.code}" ?`)) {
      return;
    }

    this.deletingSectionId = section.id;
    this.successMessage = '';
    this.errorMessageSubject.next('');

    this.settingsService.deleteSection$(section.id).subscribe({
      next: () => {
        this.deletingSectionId = null;
        this.successMessage = 'La section a bien été supprimée.';
        this.refreshSubject.next();
      },
      error: (error: unknown) => {
        this.deletingSectionId = null;
        this.errorMessageSubject.next(
          error instanceof Error ? error.message : 'Impossible de supprimer la section.'
        );
      }
    });
  }
}
