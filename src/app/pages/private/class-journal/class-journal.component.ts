import { AsyncPipe, DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { firstValueFrom, forkJoin, map, shareReplay, startWith, switchMap } from 'rxjs';
import { ProgramNetwork, ProgramSkill, ProgramUaa, SectionProgram } from '../../../models/Program';
import { StudentOption } from '../../../models/StudentOption';
import { WeeklyScheduleConfig, WeeklyScheduleSlot } from '../../../models/WeeklySchedule';
import { ClassJournalService } from '../../../services/class-journal.service';
import { SettingsService } from '../../../services/settings.service';

type ClassJournalViewModel = {
  schedule: WeeklyScheduleConfig | null;
  students: StudentOption[];
  isLoading: boolean;
};

type SlotProgramState = {
  isLoading: boolean;
  errorMessage: string;
  networks: ProgramNetwork[];
  program: SectionProgram | null;
};

@Component({
  selector: 'app-class-journal',
  imports: [AsyncPipe, DatePipe],
  template: `
    <section class="space-y-6">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p class="text-sm font-medium tracking-[0.2em] text-sky-700 uppercase">Journal de classe</p>
          <h2 class="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Agenda de l’enseignant</h2>
          <p class="mt-3 max-w-3xl text-base leading-7 text-slate-600">
            Prépare chaque séance depuis ton horaire : élèves attendus, processus, ressources et notes libres.
          </p>
        </div>

        <button
          type="button"
          (click)="goToToday()"
          class="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Aujourd’hui
        </button>
      </div>

      <section class="rounded-[1.8rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p class="text-sm font-semibold text-slate-900">{{ selectedDate | date: 'EEEE d MMMM y' }}</p>
            <p class="mt-1 text-sm text-slate-500">{{ viewModeLabel }}</p>
          </div>

          <div class="flex flex-wrap gap-2">
            <button type="button" (click)="setViewMode('day')" class="rounded-2xl border px-4 py-2 text-sm font-medium" [class.bg-slate-950]="viewMode === 'day'" [class.text-white]="viewMode === 'day'">Jour</button>
            <button type="button" (click)="setViewMode('week')" class="rounded-2xl border px-4 py-2 text-sm font-medium" [class.bg-slate-950]="viewMode === 'week'" [class.text-white]="viewMode === 'week'">Semaine</button>
            <button type="button" (click)="setViewMode('month')" class="rounded-2xl border px-4 py-2 text-sm font-medium" [class.bg-slate-950]="viewMode === 'month'" [class.text-white]="viewMode === 'month'">Mois</button>
          </div>
        </div>

        <div class="mt-5 flex items-center justify-between gap-3">
          <button type="button" (click)="goToPreviousPeriod()" class="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700">←</button>
          <p class="text-center text-sm font-medium text-slate-700">{{ periodTitle }}</p>
          <button type="button" (click)="goToNextPeriod()" class="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700">→</button>
        </div>

        @if (viewMode === 'week') {
          <div class="mt-5 grid grid-cols-7 gap-2">
            @for (date of weekDates; track toIsoDate(date)) {
              <button type="button" (click)="selectDate(date)" class="rounded-2xl border px-2 py-3 text-center text-xs font-medium" [class.bg-sky-50]="isSameDay(date, selectedDate)" [class.border-sky-300]="isSameDay(date, selectedDate)">
                <span class="block">{{ date | date: 'EEE' }}</span>
                <span class="mt-1 block text-base font-semibold">{{ date | date: 'd' }}</span>
              </button>
            }
          </div>
        }

        @if (viewMode === 'month') {
          <div class="mt-5 grid grid-cols-7 gap-2">
            @for (date of monthDates; track toIsoDate(date)) {
              <button type="button" (click)="selectDate(date)" class="min-h-12 rounded-2xl border px-2 py-2 text-sm font-semibold" [class.opacity-40]="date.getMonth() !== selectedDate.getMonth()" [class.bg-sky-50]="isSameDay(date, selectedDate)" [class.border-sky-300]="isSameDay(date, selectedDate)">
                {{ date | date: 'd' }}
              </button>
            }
          </div>
        }
      </section>

      @if (vm$ | async; as vm) {
        @if (vm.isLoading) {
          <div class="rounded-[1.8rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div class="h-6 w-52 animate-pulse rounded bg-slate-200"></div>
            <div class="mt-5 h-52 animate-pulse rounded-[1.8rem] bg-slate-50"></div>
          </div>
        } @else if (!vm.schedule) {
          <div class="rounded-[1.8rem] border border-dashed border-slate-300 bg-slate-50 p-6 text-sm leading-6 text-slate-600">
            Aucun agenda hebdomadaire n’est configuré. Crée-le dans Paramètres pour alimenter le journal.
          </div>
        } @else {
          <section class="space-y-4">
            @if (getSlotsForSelectedDate(vm.schedule).length === 0) {
              <div class="rounded-[1.8rem] border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
                Aucun créneau prévu pour cette date.
              </div>
            }

            @for (slot of getSlotsForSelectedDate(vm.schedule); track getSlotKey(slot)) {
              <article class="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm">
                <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p class="text-sm font-medium tracking-[0.18em] text-sky-700 uppercase">{{ slot.starts_at }} → {{ slot.ends_at }}</p>
                    <h3 class="mt-2 text-2xl font-semibold text-slate-950">{{ slot.label }}</h3>
                    <p class="mt-2 text-sm text-slate-500">{{ getSlotTypeLabel(slot) }}</p>
                  </div>
                </div>

                <div class="mt-5 flex flex-wrap gap-2">
                  @for (student of getStudentsForSlot(slot, vm.students); track student.enrollment_id) {
                    <button type="button" (click)="selectSectionForSlot(slot, student)" class="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700">
                      {{ student.first_name }} {{ student.last_name }}
                      @if (student.section_code) {
                        <span> · {{ student.section_code }}</span>
                      }
                    </button>
                  }
                </div>

                @if (slot.slot_type === 'course') {
                  <div class="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
                    <section class="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                      <div class="space-y-4">
                        <label class="block space-y-2">
                          <span class="text-sm font-semibold text-slate-900">Section travaillée</span>
                          <select
                            [value]="journalService.getDraft(getSlotKey(slot)).sectionId"
                            (change)="selectSectionIdForSlot(slot, $any($event.target).value)"
                            class="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
                          >
                            <option value="">Sélectionner une section</option>
                            @for (section of getSlotSections(slot, vm.students); track section.id) {
                              <option [value]="section.id">{{ section.code }} · {{ section.label }}</option>
                            }
                          </select>
                        </label>

                        @if (getSlotProgramState(slot); as state) {
                          @if (state.isLoading) {
                            <p class="text-sm text-slate-500">Chargement du programme...</p>
                          } @else if (state.errorMessage) {
                            <p class="text-sm text-rose-700">{{ state.errorMessage }}</p>
                          } @else if (state.program) {
                            <div class="space-y-4">
                              @for (uaa of state.program.uaas; track uaa.id) {
                                <details class="rounded-2xl border border-slate-200 bg-white p-4">
                                  <summary class="cursor-pointer text-sm font-semibold text-slate-950">{{ uaa.code }} · {{ uaa.name }}</summary>

                                  <div class="mt-4 grid gap-4 lg:grid-cols-2">
                                    <section>
                                      <p class="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">Processus</p>
                                      <div class="mt-3 space-y-3">
                                        @for (skill of flattenUaaSkills(uaa); track skill.id) {
                                          <label class="flex gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-800">
                                            <input type="checkbox" class="mt-1" [checked]="isSkillSelected(slot, skill.id)" (change)="toggleSkill(slot, skill.id)" />
                                            <span>{{ skill.description }}</span>
                                          </label>
                                        }
                                      </div>
                                    </section>

                                    <section>
                                      <p class="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">Ressources</p>
                                      <div class="mt-3 space-y-3">
                                        @for (resource of uaa.resources; track resource.id) {
                                          <label class="flex gap-3 rounded-2xl bg-sky-50 px-4 py-3 text-sm leading-6 text-slate-800">
                                            <input type="checkbox" class="mt-1" [checked]="isResourceSelected(slot, resource.id)" (change)="toggleResource(slot, resource.id)" />
                                            <span>{{ resource.description }}</span>
                                          </label>
                                        }
                                      </div>
                                    </section>
                                  </div>
                                </details>
                              }
                            </div>
                          }
                        }
                      </div>
                    </section>

                    <aside class="rounded-[1.5rem] border border-amber-100 bg-amber-50 p-4">
                      <label class="block space-y-2">
                        <span class="text-sm font-semibold text-slate-900">Notes libres</span>
                        <textarea
                          [value]="journalService.getDraft(getSlotKey(slot)).notes"
                          (input)="updateNotes(slot, $any($event.target).value)"
                          rows="10"
                          class="w-full resize-y rounded-2xl border border-amber-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none"
                          placeholder="Objectif, déroulé, devoir, observation, adaptation..."
                        ></textarea>
                      </label>
                    </aside>
                  </div>
                }
              </article>
            }
          </section>
        }
      }
    </section>
  `
})
export class ClassJournalComponent {
  protected readonly settingsService = inject(SettingsService);
  protected readonly journalService = inject(ClassJournalService);

  protected selectedDate = new Date();
  protected viewMode: 'day' | 'week' | 'month' = 'day';
  protected slotProgramStates: Record<string, SlotProgramState> = {};

  protected readonly vm$ = forkJoin({
    schedule: this.settingsService.getWeeklySchedule$(),
    students: this.settingsService.getStudentOptions$()
  }).pipe(
    map(({ schedule, students }): ClassJournalViewModel => ({
      schedule,
      students,
      isLoading: false
    })),
    startWith({
      schedule: null,
      students: [],
      isLoading: true
    }),
    shareReplay(1)
  );

  protected get viewModeLabel(): string {
    switch (this.viewMode) {
      case 'week':
        return 'Vue semaine';
      case 'month':
        return 'Vue mois';
      default:
        return 'Vue jour';
    }
  }

  protected get periodTitle(): string {
    return this.viewMode === 'month'
      ? this.formatMonthTitle(this.selectedDate)
      : `Semaine du ${this.toDisplayDate(this.weekDates[0])}`;
  }

  protected get weekDates(): Date[] {
    const monday = this.getWeekStart(this.selectedDate);
    return Array.from({ length: 7 }, (_, index) => this.addDays(monday, index));
  }

  protected get monthDates(): Date[] {
    const firstOfMonth = new Date(this.selectedDate.getFullYear(), this.selectedDate.getMonth(), 1);
    const calendarStart = this.getWeekStart(firstOfMonth);
    return Array.from({ length: 42 }, (_, index) => this.addDays(calendarStart, index));
  }

  protected setViewMode(viewMode: 'day' | 'week' | 'month'): void {
    this.viewMode = viewMode;
  }

  protected goToToday(): void {
    this.selectDate(new Date());
    this.viewMode = 'day';
  }

  protected goToPreviousPeriod(): void {
    if (this.viewMode === 'month') {
      this.selectDate(new Date(this.selectedDate.getFullYear(), this.selectedDate.getMonth() - 1, 1));
      return;
    }

    this.selectDate(this.addDays(this.selectedDate, this.viewMode === 'week' ? -7 : -1));
  }

  protected goToNextPeriod(): void {
    if (this.viewMode === 'month') {
      this.selectDate(new Date(this.selectedDate.getFullYear(), this.selectedDate.getMonth() + 1, 1));
      return;
    }

    this.selectDate(this.addDays(this.selectedDate, this.viewMode === 'week' ? 7 : 1));
  }

  protected selectDate(date: Date): void {
    this.selectedDate = new Date(date);
  }

  protected getSlotsForSelectedDate(schedule: WeeklyScheduleConfig): WeeklyScheduleSlot[] {
    const dayOfWeek = this.getScheduleDayOfWeek(this.selectedDate);
    return schedule.slots
      .filter((slot) => slot.day_of_week === dayOfWeek)
      .sort((left, right) => left.starts_at.localeCompare(right.starts_at));
  }

  protected getStudentsForSlot(slot: WeeklyScheduleSlot, students: StudentOption[]): StudentOption[] {
    return slot.student_enrollment_ids
      .map((studentId) => students.find((student) => student.enrollment_id === studentId))
      .filter((student): student is StudentOption => Boolean(student));
  }

  protected getSlotSections(slot: WeeklyScheduleSlot, students: StudentOption[]): Array<{ id: string; code: string; label: string }> {
    const sections = this.getStudentsForSlot(slot, students)
      .filter((student) => student.section_id && student.section_code && student.section_label)
      .map((student) => ({
        id: student.section_id as string,
        code: student.section_code as string,
        label: student.section_label as string
      }));

    return sections.filter((section, index, collection) => collection.findIndex((item) => item.id === section.id) === index);
  }

  protected selectSectionForSlot(slot: WeeklyScheduleSlot, student: StudentOption): void {
    if (student.section_id) {
      void this.selectSectionIdForSlot(slot, student.section_id);
    }
  }

  protected async selectSectionIdForSlot(slot: WeeklyScheduleSlot, sectionId: string): Promise<void> {
    const slotKey = this.getSlotKey(slot);
    this.journalService.updateDraft(slotKey, { sectionId, networkId: '' });

    if (!sectionId) {
      return;
    }

    this.slotProgramStates[slotKey] = {
      isLoading: true,
      errorMessage: '',
      networks: [],
      program: null
    };

    try {
      const networks = await firstValueFrom(this.settingsService.getProgramNetworksBySectionId$(sectionId));
      const network = networks[0];

      if (!network) {
        this.slotProgramStates[slotKey] = {
          isLoading: false,
          errorMessage: 'Aucun réseau/programme disponible pour cette section.',
          networks,
          program: null
        };
        return;
      }

      this.journalService.updateDraft(slotKey, { networkId: network.id });
      const program = await firstValueFrom(this.settingsService.getProgramBySectionId$(sectionId, network.id));
      this.slotProgramStates[slotKey] = {
        isLoading: false,
        errorMessage: '',
        networks,
        program
      };
    } catch (error) {
      this.slotProgramStates[slotKey] = {
        isLoading: false,
        errorMessage: error instanceof Error ? error.message : 'Impossible de charger le programme.',
        networks: [],
        program: null
      };
    }
  }

  protected getSlotProgramState(slot: WeeklyScheduleSlot): SlotProgramState | null {
    return this.slotProgramStates[this.getSlotKey(slot)] ?? null;
  }

  protected updateNotes(slot: WeeklyScheduleSlot, notes: string): void {
    this.journalService.updateDraft(this.getSlotKey(slot), { notes });
  }

  protected toggleSkill(slot: WeeklyScheduleSlot, skillId: string): void {
    this.journalService.toggleSkill(this.getSlotKey(slot), skillId);
  }

  protected toggleResource(slot: WeeklyScheduleSlot, resourceId: string): void {
    this.journalService.toggleResource(this.getSlotKey(slot), resourceId);
  }

  protected isSkillSelected(slot: WeeklyScheduleSlot, skillId: string): boolean {
    return this.journalService.getDraft(this.getSlotKey(slot)).selectedSkillIds.includes(skillId);
  }

  protected isResourceSelected(slot: WeeklyScheduleSlot, resourceId: string): boolean {
    return this.journalService.getDraft(this.getSlotKey(slot)).selectedResourceIds.includes(resourceId);
  }

  protected flattenUaaSkills(uaa: ProgramUaa): ProgramSkill[] {
    return uaa.skillGroups.flatMap((group) => group.skills);
  }

  protected getSlotKey(slot: WeeklyScheduleSlot): string {
    return `${this.toIsoDate(this.selectedDate)}-${slot.id ?? slot.position}-${slot.starts_at}`;
  }

  protected getSlotTypeLabel(slot: WeeklyScheduleSlot): string {
    switch (slot.slot_type) {
      case 'break':
        return 'Récréation';
      case 'lunch':
        return 'Temps de midi';
      default:
        return 'Cours';
    }
  }

  protected isSameDay(left: Date, right: Date): boolean {
    return this.toIsoDate(left) === this.toIsoDate(right);
  }

  protected toIsoDate(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private getScheduleDayOfWeek(date: Date): number {
    const day = date.getDay();
    return day === 0 ? 7 : day;
  }

  private getWeekStart(date: Date): Date {
    return this.addDays(date, 1 - this.getScheduleDayOfWeek(date));
  }

  private addDays(date: Date, amount: number): Date {
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + amount);
    return nextDate;
  }

  private toDisplayDate(date: Date): string {
    return new Intl.DateTimeFormat('fr-BE', { day: '2-digit', month: '2-digit' }).format(date);
  }

  private formatMonthTitle(date: Date): string {
    return new Intl.DateTimeFormat('fr-BE', { month: 'long', year: 'numeric' }).format(date);
  }
}
