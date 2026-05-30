import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { BehaviorSubject, catchError, combineLatest, map, of, startWith, switchMap } from 'rxjs';
import { Subject } from '../../../models/Subject';
import { SettingsService } from '../../../services/settings.service';

@Component({
  selector: 'app-settings-subjects',
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
          <h3 class="mt-2 text-2xl font-semibold text-slate-950">Matières</h3>
          <p class="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Ajoute les matières qui pourront être associées aux professeurs et aux programmes.
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

            <form [formGroup]="form" (ngSubmit)="submit()" class="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
              <label class="space-y-2">
                <span class="text-sm font-medium text-slate-800">Nom de la matière</span>
                <input
                  type="text"
                  formControlName="name"
                  class="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400"
                  placeholder="Mathématiques"
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
                      <div class="h-5 w-32 animate-pulse rounded bg-slate-200"></div>
                    </div>
                  }
                </div>
              } @else if (vm.subjects.length === 0) {
                <div class="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                  Aucune matière enregistrée pour le moment.
                </div>
              } @else {
                <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  @for (subject of vm.subjects; track subject.id) {
                    <article class="flex items-center justify-between gap-3 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                      <p class="text-sm font-semibold text-slate-950">{{ subject.name }}</p>
                      <button
                        type="button"
                        (click)="deleteSubject(subject)"
                        [disabled]="deletingSubjectId === subject.id"
                        class="rounded-xl border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {{ deletingSubjectId === subject.id ? '...' : 'Supprimer' }}
                      </button>
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
export class SettingsSubjectsComponent {
  private readonly settingsService = inject(SettingsService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly refreshSubject = new BehaviorSubject<void>(undefined);
  private readonly errorMessageSubject = new BehaviorSubject<string>('');

  protected readonly skeletonItems = [1, 2, 3, 4];
  protected isOpen = false;
  protected isSubmitting = false;
  protected deletingSubjectId: string | null = null;
  protected successMessage = '';

  protected readonly form = this.formBuilder.group({
    name: ['', Validators.required]
  });

  protected readonly vm$ = combineLatest([
    this.refreshSubject,
    this.errorMessageSubject.asObservable()
  ]).pipe(
    switchMap(([, errorMessage]) =>
      this.settingsService.getSubjects$().pipe(
        map((subjects) => ({
          subjects,
          isLoading: false,
          errorMessage
        })),
        startWith({
          subjects: [] as Subject[],
          isLoading: true,
          errorMessage
        }),
        catchError((error: unknown) =>
          of({
            subjects: [] as Subject[],
            isLoading: false,
            errorMessage: error instanceof Error ? error.message : 'Impossible de charger les matières.'
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

    this.settingsService.createSubject$({
      name: this.form.controls.name.value?.trim() || ''
    }).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.successMessage = 'La matière a bien été ajoutée.';
        this.form.reset({ name: '' });
        this.refreshSubject.next();
      },
      error: (error: unknown) => {
        this.isSubmitting = false;
        this.errorMessageSubject.next(
          error instanceof Error ? error.message : 'Impossible d’ajouter la matière.'
        );
      }
    });
  }

  protected deleteSubject(subject: Subject): void {
    if (this.deletingSubjectId || !confirm(`Supprimer la matière "${subject.name}" ?`)) {
      return;
    }

    this.deletingSubjectId = subject.id;
    this.successMessage = '';
    this.errorMessageSubject.next('');

    this.settingsService.deleteSubject$(subject.id).subscribe({
      next: () => {
        this.deletingSubjectId = null;
        this.successMessage = 'La matière a bien été supprimée.';
        this.refreshSubject.next();
      },
      error: (error: unknown) => {
        this.deletingSubjectId = null;
        this.errorMessageSubject.next(
          error instanceof Error ? error.message : 'Impossible de supprimer la matière.'
        );
      }
    });
  }
}
