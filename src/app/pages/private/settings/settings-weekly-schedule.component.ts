import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { BehaviorSubject, catchError, combineLatest, map, of, startWith, tap } from 'rxjs';
import { StudentOption } from '../../../models/StudentOption';
import { WeeklyScheduleConfig } from '../../../models/WeeklySchedule';
import { SettingsService } from '../../../services/settings.service';

type SettingsViewModel = {
  isLoading: boolean;
  errorMessage: string;
  hasSchedule: boolean;
  studentOptions: StudentOption[];
};

type Weekday = {
  value: number;
  label: string;
};

@Component({
  selector: 'app-settings-weekly-schedule',
  imports: [AsyncPipe, ReactiveFormsModule],
  template: `
    <section class="mt-5 overflow-hidden rounded-[1.8rem] border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        (click)="toggleWeeklySchedule()"
        class="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition hover:bg-slate-50"
      >
        <div>
          <p class="text-sm font-medium tracking-[0.2em] text-sky-700 uppercase">Bloc paramètre</p>
          <h3 class="mt-2 text-2xl font-semibold text-slate-950">Agenda hebdomadaire</h3>
          <p class="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Ouvre cette section pour configurer les jours, les créneaux et les élèves liés.
          </p>
        </div>

        <span class="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-lg text-slate-700">
          {{ isWeeklyScheduleOpen ? '−' : '+' }}
        </span>
      </button>

      @if (isWeeklyScheduleOpen) {
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
                <div class="h-6 w-48 animate-pulse rounded bg-slate-200"></div>
                <div class="mt-4 h-10 w-80 animate-pulse rounded bg-slate-100"></div>
                <div class="mt-6 h-64 animate-pulse rounded-3xl bg-white"></div>
              </div>
            } @else {
              <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-6">
                <div class="grid gap-4 xl:grid-cols-3">
                  <label class="space-y-2">
                    <span class="text-sm font-medium text-slate-800">Nom de la configuration</span>
                    <input
                      type="text"
                      formControlName="label"
                      class="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400"
                    />
                  </label>

                  <label class="space-y-2">
                    <span class="text-sm font-medium text-slate-800">Valable à partir du</span>
                    <input
                      type="date"
                      formControlName="validFrom"
                      class="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400"
                    />
                  </label>

                  <label class="space-y-2">
                    <span class="text-sm font-medium text-slate-800">Valable jusqu’au</span>
                    <input
                      type="date"
                      formControlName="validTo"
                      class="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400"
                    />
                  </label>
                </div>

                <section class="grid gap-4">
                  <div class="rounded-[1.6rem] border border-slate-200 bg-white p-4 shadow-sm xl:hidden">
                    <div class="flex items-center justify-between gap-3">
                      <button
                        type="button"
                        (click)="goToPreviousMobileDay()"
                        class="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-300 bg-white text-lg text-slate-700 transition hover:bg-slate-50"
                        aria-label="Jour précédent"
                      >
                        ←
                      </button>

                      <div class="text-center">
                        <p class="text-xs font-medium tracking-[0.2em] text-slate-500 uppercase">Jour affiché</p>
                        <p class="mt-1 text-lg font-semibold text-slate-950">{{ getWeekdayLabel(selectedMobileDay) }}</p>
                      </div>

                      <button
                        type="button"
                        (click)="goToNextMobileDay()"
                        class="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-300 bg-white text-lg text-slate-700 transition hover:bg-slate-50"
                        aria-label="Jour suivant"
                      >
                        →
                      </button>
                    </div>

                    <div class="mt-4 grid grid-cols-5 gap-2">
                      @for (day of weekdays; track day.value) {
                        <button
                          type="button"
                          (click)="selectMobileDay(day.value)"
                          class="rounded-2xl px-2 py-2 text-center text-xs font-medium transition"
                          [class.bg-slate-950]="selectedMobileDay === day.value"
                          [class.text-white]="selectedMobileDay === day.value"
                          [class.bg-slate-100]="selectedMobileDay !== day.value"
                          [class.text-slate-700]="selectedMobileDay !== day.value"
                        >
                          {{ day.label.slice(0, 3) }}
                        </button>
                      }
                    </div>
                  </div>

                  @for (day of weekdays; track day.value) {
                    <article
                      class="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm xl:block"
                      [class.hidden]="selectedMobileDay !== day.value"
                    >
                      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p class="text-lg font-semibold text-slate-950">{{ day.label }}</p>
                          <p class="mt-1 text-sm text-slate-600">Ajoute des cours, des récréations et la pause de midi.</p>
                        </div>

                        <div class="flex flex-wrap gap-2">
                          <button
                            type="button"
                            (click)="addSlot(day.value, 'course')"
                            class="rounded-2xl bg-slate-950 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                          >
                            Ajouter un cours
                          </button>
                          <button
                            type="button"
                            (click)="addSlot(day.value, 'break')"
                            class="rounded-2xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-50"
                          >
                            Récréation
                          </button>
                          <button
                            type="button"
                            (click)="addSlot(day.value, 'lunch')"
                            class="rounded-2xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-50"
                          >
                            Midi
                          </button>
                        </div>
                      </div>

                      <div class="mt-5 space-y-3">
                        @if (getDaySlots(day.value).length === 0) {
                          <div class="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                            Aucun créneau défini pour cette journée.
                          </div>
                        }

                        @for (slot of getDaySlots(day.value); track trackSlot(slot, $index)) {
                          <div class="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4" [formGroup]="slot">
                            <div class="grid gap-3 xl:grid-cols-[140px_1fr_150px_150px_auto]">
                              <label class="space-y-2">
                                <span class="text-xs font-medium tracking-[0.18em] text-slate-500 uppercase">Type</span>
                                <select
                                  formControlName="slotType"
                                  class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-sky-400"
                                >
                                  <option value="course">Cours</option>
                                  <option value="break">Récréation</option>
                                  <option value="lunch">Midi</option>
                                </select>
                              </label>

                              <label class="space-y-2">
                                <span class="text-xs font-medium tracking-[0.18em] text-slate-500 uppercase">Libellé</span>
                                <input
                                  type="text"
                                  formControlName="label"
                                  class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-sky-400"
                                  placeholder="Cours de math, Récréation, Temps de midi..."
                                />
                              </label>

                              <label class="space-y-2">
                                <span class="text-xs font-medium tracking-[0.18em] text-slate-500 uppercase">De</span>
                                <input
                                  type="time"
                                  formControlName="startsAt"
                                  class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-sky-400"
                                />
                              </label>

                              <label class="space-y-2">
                                <span class="text-xs font-medium tracking-[0.18em] text-slate-500 uppercase">À</span>
                                <input
                                  type="time"
                                  formControlName="endsAt"
                                  class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-sky-400"
                                />
                              </label>

                              <div class="flex items-end">
                                <button
                                  type="button"
                                  (click)="removeSlot(slot)"
                                  class="w-full rounded-xl border border-rose-200 px-3 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50"
                                >
                                  Supprimer
                                </button>
                              </div>
                            </div>

                            @if (slot.get('slotType')?.value === 'course') {
                              <div class="rounded-2xl border border-slate-200 bg-white p-4">
                                <div class="flex items-center justify-between gap-3">
                                  <div>
                                    <p class="text-sm font-medium text-slate-800">Élèves liés au cours</p>
                                    <p class="mt-1 text-sm text-slate-500">
                                      Sélectionne un ou plusieurs élèves pour ce créneau.
                                    </p>
                                  </div>
                                  <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                                    {{ getSelectedStudentIds(slot).length }}
                                  </span>
                                </div>

                                <div class="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                                  @for (student of vm.studentOptions; track student.enrollment_id) {
                                    <label class="flex items-start gap-3 rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-700 transition hover:bg-slate-50">
                                      <input
                                        type="checkbox"
                                        class="mt-1 h-4 w-4"
                                        [checked]="isStudentSelected(slot, student.enrollment_id)"
                                        (change)="toggleStudentOnSlot(slot, student.enrollment_id, $any($event.target).checked)"
                                      />
                                      <span>
                                        <span class="block font-medium text-slate-900">
                                          {{ student.first_name }} {{ student.last_name }}
                                        </span>
                                        <span class="mt-1 block text-xs text-slate-500">
                                          {{ student.section_code || student.section_label || student.school_year_label }}
                                        </span>
                                      </span>
                                    </label>
                                  }
                                </div>
                              </div>
                            }
                          </div>
                        }
                      </div>
                    </article>
                  }
                </section>

                <div class="rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4">
                  <div class="flex flex-wrap items-center justify-between gap-3">
                    <p class="text-sm text-slate-600">
                      Enregistre les changements de ton agenda hebdomadaire une fois la configuration terminée.
                    </p>

                    <button
                      type="submit"
                      [disabled]="form.invalid || isSubmitting || slotsArray.length === 0"
                      class="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {{ isSubmitting ? 'Enregistrement...' : 'Enregistrer l’agenda' }}
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
export class SettingsWeeklyScheduleComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly settingsService = inject(SettingsService);

  protected readonly weekdays: Weekday[] = [
    { value: 1, label: 'Lundi' },
    { value: 2, label: 'Mardi' },
    { value: 3, label: 'Mercredi' },
    { value: 4, label: 'Jeudi' },
    { value: 5, label: 'Vendredi' }
  ];

  protected selectedMobileDay = this.getDefaultMobileDay();
  protected isWeeklyScheduleOpen = false;
  protected isSubmitting = false;
  protected successMessage = '';
  private readonly errorMessageSubject = new BehaviorSubject<string>('');

  protected readonly form = this.formBuilder.group({
    configId: [''],
    label: ['Agenda hebdomadaire', Validators.required],
    validFrom: ['', Validators.required],
    validTo: [''],
    slots: this.formBuilder.array([])
  });

  protected readonly vm$ = combineLatest([
    this.settingsService.getWeeklySchedule$().pipe(
      tap((schedule) => this.patchSchedule(schedule)),
      startWith(undefined),
      catchError((error: unknown) => {
        this.errorMessageSubject.next(
          error instanceof Error ? error.message : 'Impossible de charger l’agenda.'
        );
        return of(null);
      })
    ),
    this.settingsService.getStudentOptions$().pipe(
      startWith([] as StudentOption[]),
      catchError((error: unknown) => {
        this.errorMessageSubject.next(
          error instanceof Error ? error.message : 'Impossible de charger les élèves.'
        );
        return of([] as StudentOption[]);
      })
    ),
    this.errorMessageSubject.asObservable()
  ]).pipe(
    map(([schedule, studentOptions, errorMessage]) => ({
      isLoading: schedule === undefined,
      errorMessage,
      hasSchedule: Boolean(schedule),
      studentOptions
    }) satisfies SettingsViewModel)
  );

  protected get slotsArray(): FormArray {
    return this.form.get('slots') as FormArray;
  }

  protected getDaySlots(dayOfWeek: number): FormGroup[] {
    return this.slotsArray.controls.filter(
      (control) => Number(control.get('dayOfWeek')?.value) === dayOfWeek
    ) as FormGroup[];
  }

  protected addSlot(dayOfWeek: number, slotType: 'course' | 'break' | 'lunch'): void {
    const daySlotsCount = this.getDaySlots(dayOfWeek).length;
    const defaults = this.getSlotDefaults(slotType, daySlotsCount);

    this.slotsArray.push(
      this.formBuilder.group({
        dayOfWeek: [dayOfWeek, Validators.required],
        slotType: [slotType, Validators.required],
        label: [defaults.label, Validators.required],
        startsAt: [defaults.startsAt, Validators.required],
        endsAt: [defaults.endsAt, Validators.required],
        position: [this.slotsArray.length],
        studentEnrollmentIds: [[] as string[]]
      })
    );
  }

  protected removeSlot(slotControl: FormGroup): void {
    const index = this.slotsArray.controls.indexOf(slotControl);

    if (index >= 0) {
      this.slotsArray.removeAt(index);
      this.reindexSlots();
    }
  }

  protected trackSlot(slotControl: FormGroup, index: number): string {
    return `${slotControl.get('dayOfWeek')?.value}-${slotControl.get('position')?.value}-${index}`;
  }

  protected getSelectedStudentIds(slot: FormGroup): string[] {
    const value = slot.get('studentEnrollmentIds')?.value;
    return Array.isArray(value) ? value : [];
  }

  protected isStudentSelected(slot: FormGroup, enrollmentId: string): boolean {
    return this.getSelectedStudentIds(slot).includes(enrollmentId);
  }

  protected toggleStudentOnSlot(slot: FormGroup, enrollmentId: string, checked: boolean): void {
    const currentIds = this.getSelectedStudentIds(slot);
    const nextIds = checked
      ? Array.from(new Set([...currentIds, enrollmentId]))
      : currentIds.filter((id) => id !== enrollmentId);

    slot.get('studentEnrollmentIds')?.setValue(nextIds);
  }

  protected selectMobileDay(dayOfWeek: number): void {
    this.selectedMobileDay = dayOfWeek;
  }

  protected goToPreviousMobileDay(): void {
    const currentIndex = this.weekdays.findIndex((day) => day.value === this.selectedMobileDay);
    const previousIndex = currentIndex <= 0 ? this.weekdays.length - 1 : currentIndex - 1;
    this.selectedMobileDay = this.weekdays[previousIndex].value;
  }

  protected goToNextMobileDay(): void {
    const currentIndex = this.weekdays.findIndex((day) => day.value === this.selectedMobileDay);
    const nextIndex = currentIndex >= this.weekdays.length - 1 ? 0 : currentIndex + 1;
    this.selectedMobileDay = this.weekdays[nextIndex].value;
  }

  protected getWeekdayLabel(dayOfWeek: number): string {
    return this.weekdays.find((day) => day.value === dayOfWeek)?.label ?? 'Jour';
  }

  protected toggleWeeklySchedule(): void {
    this.isWeeklyScheduleOpen = !this.isWeeklyScheduleOpen;
  }

  protected submit(): void {
    if (this.form.invalid || this.isSubmitting || this.slotsArray.length === 0) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    this.successMessage = '';
    this.errorMessageSubject.next('');

    const rawValue = this.form.getRawValue();

    this.settingsService.saveWeeklySchedule$({
      configId: rawValue.configId || undefined,
      label: rawValue.label || 'Agenda hebdomadaire',
      validFrom: rawValue.validFrom || '',
      validTo: rawValue.validTo || null,
      slots: this.slotsArray.controls.map((control, index) => ({
        dayOfWeek: Number(control.get('dayOfWeek')?.value),
        slotType: control.get('slotType')?.value as 'course' | 'break' | 'lunch',
        label: String(control.get('label')?.value ?? ''),
        startsAt: String(control.get('startsAt')?.value ?? ''),
        endsAt: String(control.get('endsAt')?.value ?? ''),
        position: index,
        studentEnrollmentIds: this.getSelectedStudentIds(control as FormGroup)
      }))
    }).subscribe({
      next: (schedule) => {
        this.isSubmitting = false;
        this.successMessage = 'L’agenda hebdomadaire a bien été enregistré.';
        this.patchSchedule(schedule);
      },
      error: (error: unknown) => {
        this.isSubmitting = false;
        this.errorMessageSubject.next(
          error instanceof Error ? error.message : 'Impossible d’enregistrer l’agenda.'
        );
      }
    });
  }

  private patchSchedule(schedule: WeeklyScheduleConfig | null | undefined): void {
    if (schedule === undefined) {
      return;
    }

    this.slotsArray.clear();

    if (!schedule) {
      this.form.patchValue({
        configId: '',
        label: 'Agenda hebdomadaire',
        validFrom: this.getDefaultValidFrom(),
        validTo: ''
      });
      return;
    }

    this.form.patchValue({
      configId: schedule.id,
      label: schedule.label,
      validFrom: schedule.valid_from,
      validTo: schedule.valid_to ?? ''
    });

    for (const slot of schedule.slots) {
      this.slotsArray.push(
        this.formBuilder.group({
          dayOfWeek: [slot.day_of_week, Validators.required],
          slotType: [slot.slot_type, Validators.required],
          label: [slot.label, Validators.required],
          startsAt: [slot.starts_at, Validators.required],
          endsAt: [slot.ends_at, Validators.required],
          position: [slot.position],
          studentEnrollmentIds: [slot.student_enrollment_ids ?? []]
        })
      );
    }
  }

  private getDefaultValidFrom(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private getDefaultMobileDay(): number {
    const weekday = new Date().getDay();

    if (weekday >= 1 && weekday <= 5) {
      return weekday;
    }

    return 1;
  }

  private getSlotDefaults(slotType: 'course' | 'break' | 'lunch', index: number) {
    if (slotType === 'break') {
      return {
        label: 'Récréation',
        startsAt: '10:15',
        endsAt: '10:30'
      };
    }

    if (slotType === 'lunch') {
      return {
        label: 'Temps de midi',
        startsAt: '12:00',
        endsAt: '13:00'
      };
    }

    const startHour = 8 + index;
    const endHour = startHour + 1;

    return {
      label: `Cours ${index + 1}`,
      startsAt: `${String(startHour).padStart(2, '0')}:00`,
      endsAt: `${String(endHour).padStart(2, '0')}:00`
    };
  }

  private reindexSlots(): void {
    this.slotsArray.controls.forEach((control, index) => {
      control.get('position')?.setValue(index);
    });
  }
}
