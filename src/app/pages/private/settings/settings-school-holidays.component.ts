import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { BehaviorSubject, catchError, map, of, startWith, tap } from 'rxjs';
import { SchoolHoliday } from '../../../models/SchoolHoliday';
import { SettingsService } from '../../../services/settings.service';

type HolidaysViewModel = {
  isLoading: boolean;
  holidays: SchoolHoliday[];
  errorMessage: string;
};

@Component({
  selector: 'app-settings-school-holidays',
  imports: [AsyncPipe, ReactiveFormsModule],
  template: `
    <section class="mt-5 overflow-hidden rounded-[1.8rem] border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        (click)="isOpen = !isOpen"
        class="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition hover:bg-slate-50"
      >
        <div>
          <p class="text-sm font-medium tracking-[0.2em] text-sky-700 uppercase">Bloc paramètre</p>
          <h3 class="mt-2 text-2xl font-semibold text-slate-950">Congés scolaires</h3>
          <p class="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Indique ici les périodes de congé pour faire remonter automatiquement les jours sans cours dans le journal.
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

            @if (vm.isLoading) {
              <div class="rounded-[1.8rem] border border-slate-200 bg-slate-50 p-6">
                <div class="h-6 w-52 animate-pulse rounded bg-slate-200"></div>
                <div class="mt-4 h-32 animate-pulse rounded-3xl bg-white"></div>
              </div>
            } @else {
              <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4">
                <div class="flex justify-end">
                  <button
                    type="button"
                    (click)="addHoliday()"
                    class="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Ajouter un congé
                  </button>
                </div>

                <div class="space-y-4">
                  @if (holidaysArray.length === 0) {
                    <div class="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                      Aucun congé encodé pour l’instant.
                    </div>
                  }

                  @for (holiday of holidaysArray.controls; track $index) {
                    <div [formGroup]="asHolidayGroup(holiday)" class="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 xl:grid-cols-[1fr_180px_180px_auto]">
                      <label class="space-y-2">
                        <span class="text-xs font-medium tracking-[0.18em] text-slate-500 uppercase">Nom</span>
                        <input
                          type="text"
                          formControlName="title"
                          class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-sky-400"
                          placeholder="Congé de Pâques, Toussaint..."
                        />
                      </label>

                      <label class="space-y-2">
                        <span class="text-xs font-medium tracking-[0.18em] text-slate-500 uppercase">Du</span>
                        <input
                          type="date"
                          formControlName="startsOn"
                          class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-sky-400"
                        />
                      </label>

                      <label class="space-y-2">
                        <span class="text-xs font-medium tracking-[0.18em] text-slate-500 uppercase">Au</span>
                        <input
                          type="date"
                          formControlName="endsOn"
                          class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-sky-400"
                        />
                      </label>

                      <div class="flex items-end">
                        <button
                          type="button"
                          (click)="removeHoliday($index)"
                          class="w-full rounded-xl border border-rose-200 px-3 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50"
                        >
                          Supprimer
                        </button>
                      </div>
                    </div>
                  }
                </div>

                <div class="rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4">
                  <div class="flex flex-wrap items-center justify-between gap-3">
                    <p class="text-sm text-slate-600">
                      Ces périodes seront affichées automatiquement dans le journal de classe à la date correspondante.
                    </p>

                    <button
                      type="submit"
                      [disabled]="form.invalid || isSubmitting"
                      class="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {{ isSubmitting ? 'Enregistrement...' : 'Enregistrer les congés' }}
                    </button>
                  </div>
                </div>
              </form>
            }
          }
        </div>
      }
    </section>
  `
})
export class SettingsSchoolHolidaysComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly settingsService = inject(SettingsService);
  private readonly errorMessageSubject = new BehaviorSubject<string>('');

  protected isOpen = false;
  protected isSubmitting = false;
  protected successMessage = '';

  protected readonly form = this.formBuilder.group({
    holidays: this.formBuilder.array([])
  });

  protected readonly vm$ = this.settingsService.getSchoolHolidays$().pipe(
    tap((holidays) => this.populateForm(holidays)),
    map(
      (holidays): HolidaysViewModel => ({
        isLoading: false,
        holidays,
        errorMessage: this.errorMessageSubject.value
      })
    ),
    catchError((error) =>
      of({
        isLoading: false,
        holidays: [],
        errorMessage: error instanceof Error ? error.message : 'Impossible de charger les congés.'
      } satisfies HolidaysViewModel)
    ),
    startWith({
      isLoading: true,
      holidays: [],
      errorMessage: ''
    } satisfies HolidaysViewModel)
  );

  protected get holidaysArray(): FormArray {
    return this.form.get('holidays') as FormArray;
  }

  protected asHolidayGroup(control: unknown): ReturnType<typeof this.createHolidayGroup> {
    return control as ReturnType<typeof this.createHolidayGroup>;
  }

  protected addHoliday(): void {
    this.holidaysArray.push(this.createHolidayGroup());
    this.successMessage = '';
  }

  protected removeHoliday(index: number): void {
    this.holidaysArray.removeAt(index);
    this.successMessage = '';
  }

  protected submit(): void {
    if (this.form.invalid || this.isSubmitting) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    this.successMessage = '';
    this.errorMessageSubject.next('');

    const holidays = this.holidaysArray.controls.map((control) => ({
      title: `${control.get('title')?.value ?? ''}`.trim(),
      startsOn: `${control.get('startsOn')?.value ?? ''}`.trim(),
      endsOn: `${control.get('endsOn')?.value ?? ''}`.trim()
    }));

    this.settingsService.saveSchoolHolidays$(holidays).subscribe({
      next: (savedHolidays) => {
        this.populateForm(savedHolidays);
        this.successMessage = 'Les congés ont été enregistrés.';
        this.isSubmitting = false;
      },
      error: (error: unknown) => {
        this.errorMessageSubject.next(
          error instanceof Error ? error.message : 'Impossible d’enregistrer les congés.'
        );
        this.isSubmitting = false;
      }
    });
  }

  private populateForm(holidays: SchoolHoliday[]): void {
    this.holidaysArray.clear();

    for (const holiday of holidays) {
      this.holidaysArray.push(
        this.createHolidayGroup({
          title: holiday.title,
          startsOn: holiday.starts_on,
          endsOn: holiday.ends_on
        })
      );
    }
  }

  private createHolidayGroup(holiday?: { title?: string; startsOn?: string; endsOn?: string }) {
    return this.formBuilder.group({
      title: [holiday?.title ?? '', [Validators.required]],
      startsOn: [holiday?.startsOn ?? '', [Validators.required]],
      endsOn: [holiday?.endsOn ?? '', [Validators.required]]
    });
  }
}
