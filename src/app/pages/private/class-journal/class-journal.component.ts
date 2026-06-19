import { AsyncPipe, DatePipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { filter, firstValueFrom, forkJoin, map, shareReplay, startWith } from 'rxjs';
import { ClassJournalEntry, StudentIndicatorKey } from '../../../models/ClassJournal';
import { ObservationCategory, ObservationTone } from '../../../models/Observation';
import {
  ProgramCatalogItem,
  ProgramNetwork,
  ProgramResource,
  ProgramSkill,
  ProgramUaa,
  SectionProgram
} from '../../../models/Program';
import { SchoolHoliday } from '../../../models/SchoolHoliday';
import { StudentOption } from '../../../models/StudentOption';
import { WeeklyScheduleConfig, WeeklyScheduleSlot } from '../../../models/WeeklySchedule';
import { ClassJournalService } from '../../../services/class-journal.service';
import { SettingsService } from '../../../services/settings.service';

type ClassJournalViewModel = {
  schedule: WeeklyScheduleConfig | null;
  holidays: SchoolHoliday[];
  students: StudentOption[];
  programs: ProgramCatalogItem[];
  observationCategories: ObservationCategory[];
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
            Pour chaque plage du jour, gère les statuts des élèves, les compétences travaillées, les ressources et les commentaires.
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
            @if (getHolidayForSelectedDate(vm.holidays); as holiday) {
              <div class="rounded-[1.8rem] border border-amber-200 bg-amber-50 p-6 shadow-sm">
                <p class="text-sm font-medium tracking-[0.18em] text-amber-700 uppercase">Jour sans cours</p>
                <h3 class="mt-2 text-2xl font-semibold text-slate-950">{{ holiday.title }}</h3>
                <p class="mt-2 text-sm leading-6 text-slate-700">
                  Cette date est couverte par une période de congé du {{ holiday.starts_on | date: 'd MMMM y' }}
                  au {{ holiday.ends_on | date: 'd MMMM y' }}.
                </p>
              </div>
            } @else if (getSlotsForSelectedDate(vm.schedule).length === 0) {
              <div class="rounded-[1.8rem] border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
                Aucun créneau prévu pour cette date.
              </div>
            }

            @for (slot of getSlotsForSelectedDate(vm.schedule); track getSlotKey(slot)) {
              @if (!getHolidayForSelectedDate(vm.holidays)) {
              <article
                class="rounded-[1.8rem] border p-5 shadow-sm"
                [class.border-slate-200]="!isTeacherAbsentSummary(slot)"
                [class.bg-white]="!isTeacherAbsentSummary(slot)"
                [class.border-slate-300]="isTeacherAbsentSummary(slot)"
                [class.bg-slate-100]="isTeacherAbsentSummary(slot)"
              >
                <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p class="text-sm font-medium tracking-[0.18em] text-sky-700 uppercase">{{ slot.starts_at }} → {{ slot.ends_at }}</p>
                    <h3 class="mt-2 text-2xl font-semibold text-slate-950">{{ slot.label }}</h3>
                    <p class="mt-2 text-sm text-slate-500">{{ getSlotTypeLabel(slot) }}</p>
                  </div>

                  @if (isTeacherAbsentSummary(slot)) {
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-white">Prof absent</span>
                      <span class="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                        {{ getTeacherAbsenceLabel(slot) }}
                      </span>
                    </div>
                  }
                </div>

                @if (slot.slot_type === 'course') {
                  <div class="mt-6 grid gap-5">
                    <section class="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                      <div class="space-y-4">
                        <div class="rounded-2xl border border-slate-200 bg-white p-4">
                          <div class="flex items-center justify-between gap-3">
                            <div>
                              <p class="text-sm font-semibold text-slate-900">Absence enseignant</p>
                              <p class="mt-1 text-xs text-slate-500">
                                @if (!isSlotEditable(slot) && hasSavedSlotContent(slot)) {
                                  Vue simple active. Utilise le bouton ci-dessous pour repasser en édition.
                                } @else {
                                  Indique si le professeur est absent pour ce créneau.
                                }
                              </p>
                            </div>

                            @if (isSlotEditable(slot)) {
                              <label class="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                                <input
                                type="checkbox"
                                [checked]="journalService.getDraft(getSlotKey(slot)).teacherIsAbsent"
                                (change)="setTeacherAbsent(slot, $any($event.target).checked)"
                              />
                              <span>Absent</span>
                            </label>
                            } @else {
                              <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                                {{ journalService.getDraft(getSlotKey(slot)).teacherIsAbsent ? getTeacherAbsenceLabel(slot) : 'Présence' }}
                              </span>
                            }
                          </div>

                          @if (journalService.getDraft(getSlotKey(slot)).teacherIsAbsent && isSlotEditable(slot)) {
                            <label class="mt-4 inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                              <input
                                type="checkbox"
                                [checked]="journalService.getDraft(getSlotKey(slot)).teacherAbsenceHasCm"
                                (change)="setTeacherAbsenceHasCm(slot, $any($event.target).checked)"
                              />
                              <span>CM / certificat fourni</span>
                            </label>
                          }
                        </div>

                        <div class="rounded-2xl border border-slate-200 bg-white p-4">
                          <p class="text-sm font-semibold text-slate-900">Élèves de la plage</p>
                          <p class="mt-1 text-xs text-slate-500">Statut, programme travaillé et éléments vus sont gérés élève par élève.</p>

                          <div class="mt-4 space-y-4">
                            @for (student of getStudentsForSlot(slot, vm.students); track student.enrollment_id) {
                              <article
                                class="rounded-2xl border p-4"
                                [class.border-rose-200]="getStudentAttendanceStatus(slot, student.enrollment_id) === 'absent'"
                                [class.bg-rose-50]="getStudentAttendanceStatus(slot, student.enrollment_id) === 'absent'"
                                [class.border-slate-200]="getStudentAttendanceStatus(slot, student.enrollment_id) !== 'absent'"
                                [class.bg-slate-50]="getStudentAttendanceStatus(slot, student.enrollment_id) !== 'absent'"
                              >
                                <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                  <div>
                                    <p class="text-sm font-semibold text-slate-900">{{ student.first_name }} {{ student.last_name }}</p>
                                    @if (student.section_code) {
                                      <p class="text-xs text-slate-500">Section actuelle : {{ student.section_code }}</p>
                                    }
                                  </div>

                                  @if (isStudentLocked(slot, student.enrollment_id)) {
                                    <span class="inline-flex w-fit rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                                      Enregistré
                                    </span>
                                  } @else {
                                    <select
                                      [value]="getStudentAttendanceStatus(slot, student.enrollment_id)"
                                      (change)="setStudentAttendanceStatus(slot, student.enrollment_id, $any($event.target).value)"
                                      class="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 outline-none lg:w-52"
                                    >
                                      <option value="present">Présent</option>
                                      <option value="absent">Absent</option>
                                      <option value="late">En retard</option>
                                      <option value="excused">Excusé</option>
                                    </select>
                                  }
                                </div>

                                @if (isStudentLocked(slot, student.enrollment_id)) {
                                  @if (getSavedStudentEntry(slot, student.enrollment_id); as savedStudent) {
                                    <div class="mt-4 space-y-3">
                                      <p class="text-sm text-slate-700">
                                        <span class="font-semibold text-slate-900">Statut :</span>
                                        {{ getAttendanceLabel(savedStudent.attendance_status) }}
                                      </p>

                                      @if (getStudentProgramState(slot, student.enrollment_id)?.program?.program?.subject?.name; as subjectName) {
                                        <p class="text-sm text-sky-800">
                                          <span class="font-semibold text-slate-900">Matière vue :</span>
                                          {{ subjectName }}
                                        </p>
                                      }

                                      @if (savedStudent.selected_skill_ids.length > 0) {
                                        <div>
                                          <p class="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">Programme travaillé</p>
                                          <div class="mt-2 space-y-3">
                                            @for (uaaGroup of getSavedUaaSummaries(slot, student.enrollment_id); track uaaGroup.uaa.id) {
                                              <section class="rounded-2xl bg-white px-4 py-3">
                                                <p class="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">{{ uaaGroup.uaa.code }}</p>
                                                <p class="mt-1 text-sm font-semibold text-slate-900">{{ uaaGroup.uaa.name }}</p>

                                                @if (uaaGroup.skills.length > 0) {
                                                  <div class="mt-3">
                                                    <p class="text-xs font-semibold text-slate-600">Compétences</p>
                                                    <ul class="mt-2 space-y-2">
                                                      @for (skillDescription of uaaGroup.skills; track skillDescription) {
                                                        <li class="text-sm text-slate-800">{{ skillDescription }}</li>
                                                      }
                                                    </ul>
                                                  </div>
                                                }

                                                @if (uaaGroup.resources.length > 0) {
                                                  <div class="mt-3">
                                                    <p class="text-xs font-semibold text-slate-600">Ressources</p>
                                                    <ul class="mt-2 space-y-2">
                                                      @for (resourceDescription of uaaGroup.resources; track resourceDescription) {
                                                        <li class="text-sm text-slate-800">{{ resourceDescription }}</li>
                                                      }
                                                    </ul>
                                                  </div>
                                                }
                                              </section>
                                            }
                                          </div>
                                        </div>
                                      }

                                      @if (savedStudent.comment) {
                                        <div>
                                          <p class="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">Commentaire</p>
                                          <p class="mt-2 rounded-2xl bg-white px-4 py-3 text-sm leading-6 text-slate-800">{{ savedStudent.comment }}</p>
                                        </div>
                                      }

                                      @if (savedStudent.selected_observation_ids.length > 0) {
                                        <div>
                                          <p class="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">
                                            Observations
                                          </p>
                                          <div class="mt-2 flex flex-wrap gap-2">
                                            @for (
                                              observationLabel of getSavedObservationLabels(
                                                savedStudent.selected_observation_ids,
                                                vm.observationCategories
                                              );
                                              track observationLabel
                                            ) {
                                              <span class="rounded-full bg-violet-100 px-3 py-1.5 text-xs font-medium text-violet-800">
                                                {{ observationLabel }}
                                              </span>
                                            }
                                          </div>
                                        </div>
                                      }

                                      @if (hasSavedIndicators(savedStudent)) {
                                        <div>
                                          <p class="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">
                                            Indicateurs
                                          </p>
                                          <div class="mt-2 flex flex-wrap gap-2">
                                            @if (savedStudent.fatigue_level !== null) {
                                              <span class="rounded-full bg-orange-100 px-3 py-1.5 text-xs font-medium text-orange-800">
                                                Fatigue : {{ savedStudent.fatigue_level }}/5
                                              </span>
                                            }
                                            @if (savedStudent.concentration_level !== null) {
                                              <span class="rounded-full bg-sky-100 px-3 py-1.5 text-xs font-medium text-sky-800">
                                                Concentration : {{ savedStudent.concentration_level }}/5
                                              </span>
                                            }
                                            @if (savedStudent.motivation_level !== null) {
                                              <span class="rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-medium text-emerald-800">
                                                Motivation : {{ savedStudent.motivation_level }}/5
                                              </span>
                                            }
                                            @if (savedStudent.emotional_wellbeing_level !== null) {
                                              <span class="rounded-full bg-violet-100 px-3 py-1.5 text-xs font-medium text-violet-800">
                                                Bien-être : {{ savedStudent.emotional_wellbeing_level }}/5
                                              </span>
                                            }
                                          </div>
                                        </div>
                                      }
                                    </div>
                                  } @else {
                                    <p class="mt-4 text-sm text-slate-500">Aucune donnée enregistrée pour cet élève à cette date.</p>
                                  }
                                } @else {
                                  @if (getStudentProgramState(slot, student.enrollment_id); as state) {
                                    @if (state.isLoading) {
                                      <p class="mt-4 text-sm text-slate-500">Chargement du programme...</p>
                                    } @else if (state.errorMessage) {
                                      <p class="mt-4 text-sm text-rose-700">{{ state.errorMessage }}</p>
                                    } @else if (state.program?.program; as selectedProgram) {
                                      <div class="mt-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3">
                                        <p class="text-xs font-semibold tracking-[0.16em] text-sky-700 uppercase">
                                          Programme sélectionné
                                        </p>
                                        <p class="mt-1 text-sm font-semibold text-slate-900">
                                          {{ selectedProgram.name || selectedProgram.subject?.name }}
                                        </p>
                                        <p class="mt-1 text-xs text-slate-600">
                                          {{ selectedProgram.subject?.name }} ·
                                          {{ selectedProgram.network?.name }} ·
                                          {{ selectedProgram.hours }} h
                                        </p>
                                      </div>
                                    }
                                  }

                                  <div class="mt-4">
                                    <button
                                      type="button"
                                      (click)="toggleAlternativeProgram(slot, student.enrollment_id)"
                                      class="rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                                    >
                                      {{
                                        isAlternativeProgramOpen(slot, student.enrollment_id)
                                          ? 'Revenir au programme attribué'
                                          : 'Ajouter des compétences d’une autre année'
                                      }}
                                    </button>

                                    @if (isAlternativeProgramOpen(slot, student.enrollment_id)) {
                                      <div class="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                                        <p class="text-xs font-semibold tracking-[0.16em] text-amber-800 uppercase">
                                          Programmes disponibles
                                        </p>
                                        <p class="mt-1 text-sm text-slate-600">
                                          Choisis un programme pour afficher immédiatement ses compétences.
                                        </p>

                                        <div class="mt-4 grid max-h-96 gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
                                          @for (program of getCompatibleProgramsForSlot(slot, student, vm.programs); track program.id) {
                                            <button
                                              type="button"
                                              (click)="selectAlternativeProgram(slot, student.enrollment_id, program)"
                                              class="rounded-2xl border border-amber-200 bg-white p-4 text-left transition hover:border-amber-400 hover:bg-amber-100"
                                            >
                                              <p class="text-xs font-semibold tracking-[0.14em] text-amber-800 uppercase">
                                                {{ program.section_code }} · {{ program.network_code }} · {{ program.hours }} h
                                              </p>
                                              <p class="mt-2 text-sm font-semibold text-slate-950">
                                                {{ program.name || program.subject_name }}
                                              </p>
                                              <p class="mt-1 text-xs leading-5 text-slate-600">
                                                {{ program.subject_name }} · {{ program.network_name }}
                                              </p>
                                              <p class="mt-2 text-xs text-slate-500">{{ program.section_label }}</p>
                                            </button>
                                          } @empty {
                                            <p class="text-sm text-slate-600">Aucun programme disponible.</p>
                                          }
                                        </div>
                                      </div>
                                    }
                                  </div>

                                  <label class="mt-4 block space-y-2">
                                    <span class="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">Commentaire</span>
                                    <textarea
                                      [value]="getStudentComment(slot, student.enrollment_id)"
                                      (input)="setStudentComment(slot, student.enrollment_id, $any($event.target).value)"
                                      rows="3"
                                      class="w-full resize-y rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none"
                                      placeholder="Observation, adaptation, remarque..."
                                    ></textarea>
                                  </label>

                                  <section class="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                                    <div>
                                      <p class="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">
                                        Indicateurs rapides
                                      </p>
                                      <p class="mt-1 text-xs text-slate-500">
                                        Facultatifs, de 0 à 5. Ils permettront de suivre les évolutions dans le temps.
                                      </p>
                                    </div>

                                    <div class="mt-4 grid gap-4 lg:grid-cols-2">
                                      @for (indicator of studentIndicators; track indicator.key) {
                                        <div class="rounded-2xl bg-slate-50 px-4 py-3">
                                          <div class="flex items-center justify-between gap-3">
                                            <div>
                                              <p class="text-sm font-semibold text-slate-900">{{ indicator.label }}</p>
                                              <p class="mt-0.5 text-xs text-slate-500">{{ indicator.scale }}</p>
                                            </div>
                                            <div class="flex items-center gap-2">
                                              <span class="min-w-20 text-right text-xs font-semibold text-slate-700">
                                                @if (getStudentIndicator(slot, student.enrollment_id, indicator.key); as value) {
                                                  {{ value }}/5
                                                } @else if (getStudentIndicator(slot, student.enrollment_id, indicator.key) === 0) {
                                                  0/5
                                                } @else {
                                                  Non évalué
                                                }
                                              </span>
                                              @if (getStudentIndicator(slot, student.enrollment_id, indicator.key) !== null) {
                                                <button
                                                  type="button"
                                                  (click)="setStudentIndicator(slot, student.enrollment_id, indicator.key, null)"
                                                  class="rounded-full bg-white px-2 py-1 text-xs text-slate-500 ring-1 ring-slate-200"
                                                  aria-label="Effacer cet indicateur"
                                                >
                                                  ×
                                                </button>
                                              }
                                            </div>
                                          </div>
                                          <input
                                            type="range"
                                            min="0"
                                            max="5"
                                            step="1"
                                            [value]="getStudentIndicator(slot, student.enrollment_id, indicator.key) ?? 3"
                                            (input)="setStudentIndicator(slot, student.enrollment_id, indicator.key, $any($event.target).value)"
                                            class="mt-3 w-full accent-sky-700"
                                          />
                                        </div>
                                      }
                                    </div>
                                  </section>

                                  <section class="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                                    <button
                                      type="button"
                                      (click)="toggleObservationsPanel(slot, student.enrollment_id)"
                                      class="flex w-full items-center justify-between gap-3 px-4 py-4 text-left"
                                    >
                                      <span>
                                        <span class="block text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">
                                          Observations structurées
                                        </span>
                                        <span class="mt-1 block text-xs text-slate-500">
                                          Coche les constats utiles pour la synthèse de l’élève.
                                        </span>
                                      </span>
                                      <span class="flex items-center gap-2">
                                        @if (getTotalObservationCount(slot, student.enrollment_id) > 0) {
                                          <span class="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-800">
                                            {{ getTotalObservationCount(slot, student.enrollment_id) }}
                                          </span>
                                        }
                                        <span class="text-slate-400">
                                          {{ isObservationsPanelOpen(slot, student.enrollment_id) ? '−' : '+' }}
                                        </span>
                                      </span>
                                    </button>

                                    @if (isObservationsPanelOpen(slot, student.enrollment_id)) {
                                      <div class="space-y-3 border-t border-slate-200 bg-slate-50 p-4">
                                        @for (category of vm.observationCategories; track category.id) {
                                          <section class="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                                            <button
                                              type="button"
                                              (click)="toggleObservationCategory(slot, student.enrollment_id, category.id)"
                                              class="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                                            >
                                              <span class="text-sm font-semibold text-slate-900">{{ category.label }}</span>
                                              <span class="flex items-center gap-2">
                                                @if (getObservationCategoryCount(slot, student.enrollment_id, category) > 0) {
                                                  <span class="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-800">
                                                    {{ getObservationCategoryCount(slot, student.enrollment_id, category) }}
                                                  </span>
                                                }
                                                <span class="text-slate-400">
                                                  {{ isObservationCategoryOpen(slot, student.enrollment_id, category.id) ? '−' : '+' }}
                                                </span>
                                              </span>
                                            </button>

                                            @if (isObservationCategoryOpen(slot, student.enrollment_id, category.id)) {
                                              <div class="space-y-4 border-t border-slate-200 px-4 py-4">
                                                @for (level of category.levels; track level.id) {
                                                  <div>
                                                    <p
                                                      class="inline-flex rounded-full px-3 py-1 text-xs font-semibold"
                                                      [class]="getObservationToneClass(level.tone)"
                                                    >
                                                      {{ level.label }}
                                                    </p>
                                                    <div class="mt-2 grid gap-2 lg:grid-cols-2">
                                                      @for (observation of level.items; track observation.id) {
                                                        <label class="flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-800">
                                                          <input
                                                            type="checkbox"
                                                            class="mt-1"
                                                            [checked]="isObservationSelected(slot, student.enrollment_id, observation.id)"
                                                            (change)="toggleObservation(slot, student.enrollment_id, observation.id)"
                                                          />
                                                          <span>{{ observation.label }}</span>
                                                        </label>
                                                      }
                                                    </div>
                                                  </div>
                                                }
                                              </div>
                                            }
                                          </section>
                                        }
                                      </div>
                                    }
                                  </section>

                                  @if (getStudentProgramState(slot, student.enrollment_id)?.program; as program) {
                                    <div class="mt-4 space-y-3">
                                      @for (uaa of program.uaas; track uaa.id) {
                                        <section class="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                                          <button
                                            type="button"
                                            (click)="toggleUaaAccordion(slot, student.enrollment_id, uaa.id)"
                                            class="flex w-full items-center justify-between gap-3 px-4 py-4 text-left"
                                          >
                                            <div>
                                              <p class="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">{{ uaa.code }}</p>
                                              <p class="mt-1 text-sm font-semibold text-slate-900">{{ uaa.name }}</p>
                                            </div>
                                            <div class="flex items-center gap-3">
                                              @if (getUaaSelectionCount(slot, student.enrollment_id, uaa) > 0) {
                                                <span class="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-800">
                                                  {{ getUaaSelectionCount(slot, student.enrollment_id, uaa) }} sélection(s)
                                                </span>
                                              }
                                              <span class="text-slate-400">{{ isUaaAccordionOpen(slot, student.enrollment_id, uaa.id) ? '−' : '+' }}</span>
                                            </div>
                                          </button>

                                          @if (isUaaAccordionOpen(slot, student.enrollment_id, uaa.id)) {
                                            <div class="border-t border-slate-200 px-4 py-4">
                                              @if (flattenUaaSkills(uaa).length > 0) {
                                                <div>
                                                  <p class="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">Compétences / skills</p>
                                                  <div class="mt-3 space-y-3">
                                                    @for (skill of flattenUaaSkills(uaa); track skill.id) {
                                                      <label class="flex gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-800">
                                                        <input
                                                          type="checkbox"
                                                          class="mt-1"
                                                          [checked]="isSkillSelected(slot, student.enrollment_id, skill.id)"
                                                          (change)="toggleSkill(slot, student.enrollment_id, skill.id)"
                                                        />
                                                        <span>{{ skill.description }}</span>
                                                      </label>
                                                    }
                                                  </div>
                                                </div>
                                              }

                                              @if (uaa.resources.length > 0) {
                                                <div class="mt-4">
                                                  <p class="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">Ressources</p>
                                                  <div class="mt-3 space-y-3">
                                                    @for (resource of uaa.resources; track resource.id) {
                                                      <label class="flex gap-3 rounded-2xl bg-sky-50 px-4 py-3 text-sm leading-6 text-slate-800">
                                                        <input
                                                          type="checkbox"
                                                          class="mt-1"
                                                          [checked]="isResourceSelected(slot, student.enrollment_id, resource.id)"
                                                          (change)="toggleResource(slot, student.enrollment_id, resource.id)"
                                                        />
                                                        <span>{{ resource.description }}</span>
                                                      </label>
                                                    }
                                                  </div>
                                                </div>
                                              }
                                            </div>
                                          }
                                        </section>
                                      }
                                    </div>
                                  }
                                }
                              </article>
                            }
                          </div>
                        </div>

                        @if (saveErrorBySlotKey[getSlotKey(slot)]) {
                          <p class="rounded-2xl bg-rose-100 px-4 py-3 text-sm font-medium text-rose-800">
                            {{ saveErrorBySlotKey[getSlotKey(slot)] }}
                          </p>
                        }

                        @if (saveSuccessBySlotKey[getSlotKey(slot)]) {
                          <p class="rounded-2xl bg-emerald-100 px-4 py-3 text-sm font-medium text-emerald-800">
                            Enregistré à {{ saveSuccessBySlotKey[getSlotKey(slot)] }}
                          </p>
                        }

                        <div class="flex flex-col gap-3 sm:flex-row">
                          @if (hasSavedSlotContent(slot) && !isSlotInForcedEditMode(slot)) {
                            <button
                              type="button"
                              (click)="enableSlotEdit(slot)"
                              class="w-full rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
                            >
                              Repasser en édition
                            </button>
                          }

                          @if (isSlotEditable(slot)) {
                            <button
                              type="button"
                              (click)="saveSlot(slot, vm.students)"
                              [disabled]="isSavingSlotKey === getSlotKey(slot)"
                              class="w-full rounded-2xl bg-sky-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-800 disabled:cursor-wait disabled:bg-slate-400"
                            >
                              {{ isSavingSlotKey === getSlotKey(slot) ? 'Validation...' : 'Valider la séance' }}
                            </button>
                          }
                        </div>
                      </div>
                    </section>
                  </div>
                }
              </article>
              }
            }
          </section>
        }
      }
    </section>
  `
})
export class ClassJournalComponent implements OnInit {
  protected readonly settingsService = inject(SettingsService);
  protected readonly journalService = inject(ClassJournalService);

  protected selectedDate = new Date();
  protected viewMode: 'day' | 'week' | 'month' = 'day';
  protected studentProgramStates: Record<string, SlotProgramState> = {};
  protected entriesBySlotKey: Record<string, ClassJournalEntry> = {};
  protected forcedEditSlotKeys = new Set<string>();
  protected openUaaKeys = new Set<string>();
  protected openObservationCategoryKeys = new Set<string>();
  protected openObservationsPanelKeys = new Set<string>();
  protected alternativeProgramKeys = new Set<string>();
  protected isSavingSlotKey = '';
  protected saveErrorBySlotKey: Record<string, string> = {};
  protected saveSuccessBySlotKey: Record<string, string> = {};
  protected readonly studentIndicators: Array<{
    key: StudentIndicatorKey;
    label: string;
    scale: string;
  }> = [
    { key: 'fatigueLevel', label: 'Fatigue', scale: '0 = reposé · 5 = très fatigué' },
    { key: 'concentrationLevel', label: 'Concentration', scale: '0 = très faible · 5 = excellente' },
    { key: 'motivationLevel', label: 'Motivation', scale: '0 = très faible · 5 = très forte' },
    { key: 'emotionalWellbeingLevel', label: 'Bien-être émotionnel', scale: '0 = difficile · 5 = serein' }
  ];

  protected readonly vm$ = forkJoin({
    schedule: this.settingsService.getWeeklySchedule$(),
    holidays: this.settingsService.getSchoolHolidays$(),
    students: this.settingsService.getStudentOptions$(),
    programs: this.settingsService.getProgramCatalog$(),
    observationCategories: this.journalService.getObservationCatalog$()
  }).pipe(
    map(({ schedule, holidays, students, programs, observationCategories }): ClassJournalViewModel => ({
      schedule,
      holidays,
      students,
      programs,
      observationCategories,
      isLoading: false
    })),
    startWith({
      schedule: null,
      holidays: [],
      students: [],
      programs: [],
      observationCategories: [],
      isLoading: true
    }),
    shareReplay(1)
  );

  ngOnInit(): void {
    void this.loadEntriesForSelectedDate();
  }

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
    void this.loadEntriesForSelectedDate();
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

  protected getCompatibleProgramsForSlot(
    slot: WeeklyScheduleSlot,
    student: StudentOption,
    programs: ProgramCatalogItem[]
  ): ProgramCatalogItem[] {
    if (slot.subject_id) {
      return programs.filter((program) => program.subject_id === slot.subject_id);
    }

    return programs.filter(
      (program) =>
        (!student.section_id || program.section_id === student.section_id)
    );
  }

  protected getHolidayForSelectedDate(holidays: SchoolHoliday[]): SchoolHoliday | null {
    const selectedIsoDate = this.toIsoDate(this.selectedDate);
    return holidays.find((holiday) => holiday.starts_on <= selectedIsoDate && holiday.ends_on >= selectedIsoDate) ?? null;
  }

  protected toggleAlternativeProgram(slot: WeeklyScheduleSlot, studentEnrollmentId: string): void {
    const key = this.getStudentProgramKey(slot, studentEnrollmentId);

    if (this.alternativeProgramKeys.has(key)) {
      this.alternativeProgramKeys.delete(key);
      void this.restoreAssignedProgramForStudent(slot, studentEnrollmentId);
      return;
    }

    this.alternativeProgramKeys.add(key);
  }

  protected isAlternativeProgramOpen(slot: WeeklyScheduleSlot, studentEnrollmentId: string): boolean {
    return this.alternativeProgramKeys.has(this.getStudentProgramKey(slot, studentEnrollmentId));
  }

  protected async selectAlternativeProgram(
    slot: WeeklyScheduleSlot,
    studentEnrollmentId: string,
    program: ProgramCatalogItem
  ): Promise<void> {
    const slotKey = this.getSlotKey(slot);
    if (program.section_id) {
      this.journalService.setStudentSection(slotKey, studentEnrollmentId, program.section_id);
    }
    await this.selectProgramForStudent(
      slotKey,
      studentEnrollmentId,
      program.section_id,
      program.network_id,
      program.id,
      program.subject_id
    );
  }

  protected async saveSlot(slot: WeeklyScheduleSlot, students: StudentOption[]): Promise<void> {
    const slotKey = this.getSlotKey(slot);
    const draft = this.journalService.getDraft(slotKey);
    const slotStudents = this.getStudentsForSlot(slot, students);

    this.isSavingSlotKey = slotKey;
    this.saveErrorBySlotKey = {
      ...this.saveErrorBySlotKey,
      [slotKey]: ''
    };
    this.saveSuccessBySlotKey = {
      ...this.saveSuccessBySlotKey,
      [slotKey]: ''
    };

    try {
      const entry = await firstValueFrom(this.journalService.saveEntry$({
        date: this.toIsoDate(this.selectedDate),
        weeklyScheduleSlotId: slot.id ?? null,
        slotKey,
        title: slot.label,
        startsAt: slot.starts_at,
        endsAt: slot.ends_at,
        teacherIsAbsent: draft.teacherIsAbsent,
        teacherAbsenceHasCm: draft.teacherAbsenceHasCm,
        studentEntries: slotStudents.map((student) => {
          const studentDraft = this.journalService.getStudentDraft(slotKey, student.enrollment_id);

          return {
            studentEnrollmentId: student.enrollment_id,
            sectionId: studentDraft.sectionId || student.section_id || null,
            networkId: studentDraft.networkId || null,
            programId: studentDraft.programId || null,
            attendanceStatus: studentDraft.attendanceStatus,
            comment: studentDraft.comment,
            selectedSkillIds: studentDraft.selectedSkillIds,
            selectedResourceIds: studentDraft.selectedResourceIds,
            selectedObservationIds: studentDraft.selectedObservationIds,
            fatigueLevel: studentDraft.fatigueLevel,
            concentrationLevel: studentDraft.concentrationLevel,
            motivationLevel: studentDraft.motivationLevel,
            emotionalWellbeingLevel: studentDraft.emotionalWellbeingLevel
          };
        })
      }));

      this.journalService.hydrateEntries([entry]);
      this.entriesBySlotKey = {
        ...this.entriesBySlotKey,
        [entry.slot_key]: entry
      };
      this.forcedEditSlotKeys.delete(slotKey);
      this.saveSuccessBySlotKey = {
        ...this.saveSuccessBySlotKey,
        [slotKey]: this.formatSavedTime(new Date())
      };
    } catch (error) {
      this.saveErrorBySlotKey = {
        ...this.saveErrorBySlotKey,
        [slotKey]: error instanceof Error ? error.message : 'Impossible d’enregistrer cette séance.'
      };
    } finally {
      this.isSavingSlotKey = '';
    }
  }

  private async selectProgramForStudent(
    slotKey: string,
    studentEnrollmentId: string,
    sectionId: string | null,
    preferredNetworkId = '',
    preferredProgramId = '',
    subjectId = '',
    options?: { preserveSelections?: boolean }
  ): Promise<void> {
    const stateKey = `${slotKey}-${studentEnrollmentId}`;

    this.studentProgramStates[stateKey] = {
      isLoading: true,
      errorMessage: '',
      networks: [],
      program: null
    };

    try {
      if (!sectionId && preferredProgramId && preferredNetworkId) {
        const program = await firstValueFrom(
          this.settingsService.getProgramBySectionId$(
            null,
            preferredNetworkId,
            subjectId || null,
            preferredProgramId
          )
        );
        this.journalService.setStudentNetwork(slotKey, studentEnrollmentId, preferredNetworkId, {
          preserveSelections: options?.preserveSelections === true
        });
        this.journalService.setStudentProgram(slotKey, studentEnrollmentId, program.program?.id ?? '');
        this.closeProgramUaas(slotKey, studentEnrollmentId);
        this.studentProgramStates[stateKey] = {
          isLoading: false,
          errorMessage: '',
          networks: program.program?.network ? [program.program.network] : [],
          program
        };
        return;
      }

      if (!sectionId) {
        throw new Error('Ce programme sans année doit être sélectionné explicitement.');
      }

      const networks = await firstValueFrom(
        this.settingsService.getProgramNetworksBySectionId$(sectionId, subjectId || null)
      );
      const network = networks.find((item) => item.id === preferredNetworkId) ?? networks[0];

      if (!network) {
        this.studentProgramStates[stateKey] = {
          isLoading: false,
          errorMessage: 'Aucun réseau/programme disponible pour cette section.',
          networks,
          program: null
        };
        return;
      }

      this.journalService.setStudentNetwork(slotKey, studentEnrollmentId, network.id, {
        preserveSelections: options?.preserveSelections === true
      });
      const program = await firstValueFrom(
        this.settingsService.getProgramBySectionId$(
          sectionId,
          network.id,
          subjectId || null,
          preferredProgramId || null
        )
      );
      this.journalService.setStudentProgram(
        slotKey,
        studentEnrollmentId,
        program.program?.id ?? ''
      );
      this.closeProgramUaas(slotKey, studentEnrollmentId);
      this.studentProgramStates[stateKey] = {
        isLoading: false,
        errorMessage: '',
        networks,
        program
      };
    } catch (error) {
      this.studentProgramStates[stateKey] = {
        isLoading: false,
        errorMessage: error instanceof Error ? error.message : 'Impossible de charger le programme.',
        networks: [],
        program: null
      };
    }
  }

  private async restoreAssignedProgramForStudent(
    slot: WeeklyScheduleSlot,
    studentEnrollmentId: string
  ): Promise<void> {
    const vm = await firstValueFrom(this.vm$.pipe(filter((value) => !value.isLoading)));
    const student = vm.students.find((candidate) => candidate.enrollment_id === studentEnrollmentId);

    if (!student) {
      return;
    }

    const slotKey = this.getSlotKey(slot);
    const scheduledProgram = this.getScheduledProgramForStudent(slot, student, vm.programs);

    if (slot.subject_id && !scheduledProgram) {
      this.setMissingScheduledProgramState(slot, studentEnrollmentId, vm.programs);
      return;
    }

    const sectionId = scheduledProgram?.section_id ?? student.section_id;
    if (!sectionId) return;

    this.journalService.setStudentSection(slotKey, studentEnrollmentId, sectionId);
    await this.selectProgramForStudent(
      slotKey,
      studentEnrollmentId,
      sectionId,
      slot.subject_id ? scheduledProgram?.network_id ?? '' : student.program_network_id ?? '',
      slot.subject_id ? scheduledProgram?.id ?? '' : student.program_id ?? '',
      slot.subject_id ?? ''
    );
  }

  protected getStudentProgramState(slot: WeeklyScheduleSlot, studentEnrollmentId: string): SlotProgramState | null {
    return this.studentProgramStates[this.getStudentProgramKey(slot, studentEnrollmentId)] ?? null;
  }

  protected isReadOnlyDate(): boolean {
    return this.toIsoDate(this.selectedDate) !== this.toIsoDate(new Date());
  }

  protected isSlotInForcedEditMode(slot: WeeklyScheduleSlot): boolean {
    return this.forcedEditSlotKeys.has(this.getSlotKey(slot));
  }

  protected hasSavedSlotContent(slot: WeeklyScheduleSlot): boolean {
    const entry = this.entriesBySlotKey[this.getSlotKey(slot)];
    return Boolean(
      entry &&
      (
        entry.teacher_is_absent ||
        entry.teacher_absence_has_cm ||
        entry.students.some((student) => this.hasSavedStudentContent(student))
      )
    );
  }

  protected isSlotEditable(slot: WeeklyScheduleSlot): boolean {
    return !this.hasSavedSlotContent(slot) || this.isSlotInForcedEditMode(slot);
  }

  protected enableSlotEdit(slot: WeeklyScheduleSlot): void {
    this.forcedEditSlotKeys.add(this.getSlotKey(slot));
  }

  protected isTeacherAbsentSummary(slot: WeeklyScheduleSlot): boolean {
    const savedEntry = this.entriesBySlotKey[this.getSlotKey(slot)];
    return Boolean(
      (!this.isSlotEditable(slot) && savedEntry?.teacher_is_absent) ||
      (this.isReadOnlyDate() && !this.isSlotEditable(slot) && this.journalService.getDraft(this.getSlotKey(slot)).teacherIsAbsent)
    );
  }

  protected getTeacherAbsenceLabel(slot: WeeklyScheduleSlot): string {
    const savedEntry = this.entriesBySlotKey[this.getSlotKey(slot)];
    const hasCm = this.isSlotEditable(slot)
      ? this.journalService.getDraft(this.getSlotKey(slot)).teacherAbsenceHasCm
      : savedEntry?.teacher_absence_has_cm ?? this.journalService.getDraft(this.getSlotKey(slot)).teacherAbsenceHasCm;

    return hasCm ? 'CM fourni' : 'Sans CM';
  }

  protected getSavedStudentEntry(slot: WeeklyScheduleSlot, studentEnrollmentId: string) {
    return this.entriesBySlotKey[this.getSlotKey(slot)]?.students.find(
      (student) => student.student_enrollment_id === studentEnrollmentId
    ) ?? null;
  }

  protected isStudentLocked(slot: WeeklyScheduleSlot, studentEnrollmentId: string): boolean {
    if (this.isSlotInForcedEditMode(slot)) {
      return false;
    }

    const savedStudent = this.getSavedStudentEntry(slot, studentEnrollmentId);
    return this.hasSavedStudentContent(savedStudent);
  }

  protected getAttendanceLabel(status: 'present' | 'absent' | 'late' | 'excused'): string {
    switch (status) {
      case 'absent':
        return 'Absent';
      case 'late':
        return 'En retard';
      case 'excused':
        return 'Excusé';
      default:
        return 'Présent';
    }
  }

  protected getSavedSkillDescriptions(slot: WeeklyScheduleSlot, studentEnrollmentId: string): string[] {
    const state = this.getStudentProgramState(slot, studentEnrollmentId);
    const savedStudent = this.getSavedStudentEntry(slot, studentEnrollmentId);

    if (!state?.program || !savedStudent) {
      return [];
    }

    const skillMap = new Map(this.flattenProgramSkills(state.program).map((skill) => [skill.id, skill.description]));
    return savedStudent.selected_skill_ids.map((skillId) => skillMap.get(skillId)).filter((value): value is string => Boolean(value));
  }

  protected getSavedResourceDescriptions(slot: WeeklyScheduleSlot, studentEnrollmentId: string): string[] {
    const state = this.getStudentProgramState(slot, studentEnrollmentId);
    const savedStudent = this.getSavedStudentEntry(slot, studentEnrollmentId);

    if (!state?.program || !savedStudent) {
      return [];
    }

    const resourceMap = new Map(
      this.flattenProgramResources(state.program).map((resource) => [resource.id, resource.description])
    );
    return savedStudent.selected_resource_ids
      .map((resourceId) => resourceMap.get(resourceId))
      .filter((value): value is string => Boolean(value));
  }

  protected getSavedObservationLabels(
    observationIds: string[],
    categories: ObservationCategory[]
  ): string[] {
    const labelMap = new Map(
      categories.flatMap((category) =>
        category.levels.flatMap((level) =>
          level.items.map((item) => [item.id, item.label] as const)
        )
      )
    );
    return observationIds
      .map((observationId) => labelMap.get(observationId))
      .filter((label): label is string => Boolean(label));
  }

  protected getSavedUaaSummaries(
    slot: WeeklyScheduleSlot,
    studentEnrollmentId: string
  ): Array<{ uaa: ProgramUaa; skills: string[]; resources: string[] }> {
    const state = this.getStudentProgramState(slot, studentEnrollmentId);
    const savedStudent = this.getSavedStudentEntry(slot, studentEnrollmentId);

    if (!state?.program || !savedStudent) {
      return [];
    }

    return state.program.uaas
      .map((uaa) => ({
        uaa,
        skills: this.flattenUaaSkills(uaa)
          .filter((skill) => savedStudent.selected_skill_ids.includes(skill.id))
          .map((skill) => skill.description),
        resources: uaa.resources
          .filter((resource) => savedStudent.selected_resource_ids.includes(resource.id))
          .map((resource) => resource.description)
      }))
      .filter((group) => group.skills.length > 0 || group.resources.length > 0);
  }

  protected setTeacherAbsent(slot: WeeklyScheduleSlot, teacherIsAbsent: boolean): void {
    this.journalService.setTeacherAbsence(this.getSlotKey(slot), teacherIsAbsent);
  }

  protected setTeacherAbsenceHasCm(slot: WeeklyScheduleSlot, teacherAbsenceHasCm: boolean): void {
    this.journalService.setTeacherAbsenceHasCm(this.getSlotKey(slot), teacherAbsenceHasCm);
  }

  protected getStudentAttendanceStatus(slot: WeeklyScheduleSlot, studentEnrollmentId: string) {
    return this.journalService.getStudentDraft(this.getSlotKey(slot), studentEnrollmentId).attendanceStatus;
  }

  protected setStudentAttendanceStatus(slot: WeeklyScheduleSlot, studentEnrollmentId: string, attendanceStatus: 'present' | 'absent' | 'late' | 'excused'): void {
    this.journalService.setStudentAttendanceStatus(this.getSlotKey(slot), studentEnrollmentId, attendanceStatus);
  }

  protected getStudentComment(slot: WeeklyScheduleSlot, studentEnrollmentId: string): string {
    return this.journalService.getStudentDraft(this.getSlotKey(slot), studentEnrollmentId).comment;
  }

  protected setStudentComment(slot: WeeklyScheduleSlot, studentEnrollmentId: string, comment: string): void {
    this.journalService.setStudentComment(this.getSlotKey(slot), studentEnrollmentId, comment);
  }

  protected getStudentIndicator(
    slot: WeeklyScheduleSlot,
    studentEnrollmentId: string,
    indicator: StudentIndicatorKey
  ): number | null {
    return this.journalService.getStudentDraft(this.getSlotKey(slot), studentEnrollmentId)[indicator];
  }

  protected setStudentIndicator(
    slot: WeeklyScheduleSlot,
    studentEnrollmentId: string,
    indicator: StudentIndicatorKey,
    value: number | string | null
  ): void {
    this.journalService.setStudentIndicator(
      this.getSlotKey(slot),
      studentEnrollmentId,
      indicator,
      value === null ? null : Number(value)
    );
  }

  protected hasSavedIndicators(student: ClassJournalEntry['students'][number]): boolean {
    return [
      student.fatigue_level,
      student.concentration_level,
      student.motivation_level,
      student.emotional_wellbeing_level
    ].some((value) => typeof value === 'number');
  }

  protected toggleSkill(slot: WeeklyScheduleSlot, studentEnrollmentId: string, skillId: string): void {
    this.journalService.toggleSkill(this.getSlotKey(slot), studentEnrollmentId, skillId);
  }

  protected toggleResource(slot: WeeklyScheduleSlot, studentEnrollmentId: string, resourceId: string): void {
    this.journalService.toggleResource(this.getSlotKey(slot), studentEnrollmentId, resourceId);
  }

  protected toggleObservation(slot: WeeklyScheduleSlot, studentEnrollmentId: string, observationId: string): void {
    this.journalService.toggleObservation(this.getSlotKey(slot), studentEnrollmentId, observationId);
  }

  protected isObservationSelected(
    slot: WeeklyScheduleSlot,
    studentEnrollmentId: string,
    observationId: string
  ): boolean {
    return this.journalService
      .getStudentDraft(this.getSlotKey(slot), studentEnrollmentId)
      .selectedObservationIds.includes(observationId);
  }

  protected toggleObservationCategory(
    slot: WeeklyScheduleSlot,
    studentEnrollmentId: string,
    categoryId: string
  ): void {
    const key = `${this.getStudentProgramKey(slot, studentEnrollmentId)}-observation-${categoryId}`;
    if (this.openObservationCategoryKeys.has(key)) {
      this.openObservationCategoryKeys.delete(key);
    } else {
      this.openObservationCategoryKeys.add(key);
    }
  }

  protected toggleObservationsPanel(slot: WeeklyScheduleSlot, studentEnrollmentId: string): void {
    const key = `${this.getStudentProgramKey(slot, studentEnrollmentId)}-observations-panel`;
    if (this.openObservationsPanelKeys.has(key)) {
      this.openObservationsPanelKeys.delete(key);
    } else {
      this.openObservationsPanelKeys.add(key);
    }
  }

  protected isObservationsPanelOpen(slot: WeeklyScheduleSlot, studentEnrollmentId: string): boolean {
    return this.openObservationsPanelKeys.has(
      `${this.getStudentProgramKey(slot, studentEnrollmentId)}-observations-panel`
    );
  }

  protected getTotalObservationCount(slot: WeeklyScheduleSlot, studentEnrollmentId: string): number {
    return this.journalService.getStudentDraft(
      this.getSlotKey(slot),
      studentEnrollmentId
    ).selectedObservationIds.length;
  }

  protected isObservationCategoryOpen(
    slot: WeeklyScheduleSlot,
    studentEnrollmentId: string,
    categoryId: string
  ): boolean {
    return this.openObservationCategoryKeys.has(
      `${this.getStudentProgramKey(slot, studentEnrollmentId)}-observation-${categoryId}`
    );
  }

  protected getObservationCategoryCount(
    slot: WeeklyScheduleSlot,
    studentEnrollmentId: string,
    category: ObservationCategory
  ): number {
    const selectedIds = this.journalService.getStudentDraft(
      this.getSlotKey(slot),
      studentEnrollmentId
    ).selectedObservationIds;
    return category.levels
      .flatMap((level) => level.items)
      .filter((item) => selectedIds.includes(item.id)).length;
  }

  protected getObservationToneClass(tone: ObservationTone): string {
    switch (tone) {
      case 'positive':
        return 'bg-emerald-100 text-emerald-800';
      case 'mixed':
        return 'bg-amber-100 text-amber-800';
      case 'warning':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-rose-100 text-rose-800';
    }
  }

  protected isSkillSelected(slot: WeeklyScheduleSlot, studentEnrollmentId: string, skillId: string): boolean {
    return this.journalService.getStudentDraft(this.getSlotKey(slot), studentEnrollmentId).selectedSkillIds.includes(skillId);
  }

  protected isResourceSelected(slot: WeeklyScheduleSlot, studentEnrollmentId: string, resourceId: string): boolean {
    return this.journalService.getStudentDraft(this.getSlotKey(slot), studentEnrollmentId).selectedResourceIds.includes(resourceId);
  }

  protected flattenProgramSkills(program: SectionProgram): ProgramSkill[] {
    return program.uaas.flatMap((uaa) => this.flattenUaaSkills(uaa));
  }

  protected flattenProgramResources(program: SectionProgram): ProgramResource[] {
    return program.uaas
      .flatMap((uaa) => uaa.resources)
      .filter((resource, index, collection) => collection.findIndex((item) => item.id === resource.id) === index);
  }

  protected flattenUaaSkills(uaa: ProgramUaa): ProgramSkill[] {
    return uaa.skillGroups.flatMap((group) => group.skills);
  }

  protected toggleUaaAccordion(slot: WeeklyScheduleSlot, studentEnrollmentId: string, uaaId: string): void {
    const key = this.getUaaAccordionKey(slot, studentEnrollmentId, uaaId);

    if (this.openUaaKeys.has(key)) {
      this.openUaaKeys.delete(key);
      return;
    }

    this.openUaaKeys.add(key);
  }

  protected isUaaAccordionOpen(slot: WeeklyScheduleSlot, studentEnrollmentId: string, uaaId: string): boolean {
    return this.openUaaKeys.has(this.getUaaAccordionKey(slot, studentEnrollmentId, uaaId));
  }

  protected getUaaSelectionCount(slot: WeeklyScheduleSlot, studentEnrollmentId: string, uaa: ProgramUaa): number {
    const studentDraft = this.journalService.getStudentDraft(this.getSlotKey(slot), studentEnrollmentId);
    const selectedSkillCount = this.flattenUaaSkills(uaa).filter((skill) => studentDraft.selectedSkillIds.includes(skill.id)).length;
    const selectedResourceCount = uaa.resources.filter((resource) => studentDraft.selectedResourceIds.includes(resource.id)).length;
    return selectedSkillCount + selectedResourceCount;
  }

  protected getStudentProgramKey(slot: WeeklyScheduleSlot, studentEnrollmentId: string): string {
    return `${this.getSlotKey(slot)}-${studentEnrollmentId}`;
  }

  protected getUaaAccordionKey(slot: WeeklyScheduleSlot, studentEnrollmentId: string, uaaId: string): string {
    return `${this.getStudentProgramKey(slot, studentEnrollmentId)}-${uaaId}`;
  }

  private closeProgramUaas(
    slotKey: string,
    studentEnrollmentId: string
  ): void {
    const studentKeyPrefix = `${slotKey}-${studentEnrollmentId}-`;

    for (const key of Array.from(this.openUaaKeys)) {
      if (key.startsWith(studentKeyPrefix)) {
        this.openUaaKeys.delete(key);
      }
    }
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

  private async loadEntriesForSelectedDate(): Promise<void> {
    this.entriesBySlotKey = {};
    this.studentProgramStates = {};
    this.openUaaKeys.clear();
    this.openObservationCategoryKeys.clear();
    this.openObservationsPanelKeys.clear();
    this.alternativeProgramKeys.clear();
    this.journalService.resetDrafts();

    try {
      const entries = await firstValueFrom(this.journalService.getEntriesByDate$(this.toIsoDate(this.selectedDate)));
      this.entriesBySlotKey = entries.reduce<Record<string, ClassJournalEntry>>(
        (collection, entry) => ({
          ...collection,
          [entry.slot_key]: entry
        }),
        {}
      );
      this.forcedEditSlotKeys = new Set();
      this.journalService.hydrateEntries(entries);
      await this.restoreProgramsForEntries(entries);
    } catch {
      // The journal stays usable as a local draft even if the saved entries cannot be loaded.
    }

    const vm = await firstValueFrom(this.vm$.pipe(filter((value) => !value.isLoading)));
    await this.initializeDefaultProgramsForSelectedDate(vm.schedule, vm.students, vm.programs);
  }

  private async restoreProgramsForEntries(entries: ClassJournalEntry[]): Promise<void> {
    await Promise.all(
      entries.flatMap((entry) =>
        entry.students
          .filter((student) => student.section_id || student.program_id)
          .map((student) => {
            return this.selectProgramForStudent(
              entry.slot_key,
              student.student_enrollment_id,
              student.section_id,
              student.network_id ?? '',
              student.program_id ?? '',
              '',
              { preserveSelections: true }
            );
          })
      )
    );
  }

  private async initializeDefaultProgramsForSelectedDate(
    schedule: WeeklyScheduleConfig | null,
    students: StudentOption[],
    programs: ProgramCatalogItem[]
  ): Promise<void> {
    if (!schedule) {
      return;
    }

    const tasks = this.getSlotsForSelectedDate(schedule)
      .filter((slot) => slot.slot_type === 'course')
      .flatMap((slot) =>
        this.getStudentsForSlot(slot, students)
          .map((student) => {
            const stateKey = this.getStudentProgramKey(slot, student.enrollment_id);

            if (this.studentProgramStates[stateKey]) {
              return null;
            }

            const studentDraft = this.journalService.getStudentDraft(this.getSlotKey(slot), student.enrollment_id);
            const hasSavedStudentChoice = Boolean(
              studentDraft.programId || studentDraft.networkId
            );
            const scheduledProgram = this.getScheduledProgramForStudent(slot, student, programs);
            const sectionId = slot.subject_id
              ? scheduledProgram?.section_id ?? null
              : studentDraft.sectionId || student.section_id;
            const networkId = slot.subject_id
              ? scheduledProgram?.network_id ?? ''
              : studentDraft.networkId || student.program_network_id || '';
            const programId = slot.subject_id
              ? scheduledProgram?.id ?? ''
              : hasSavedStudentChoice
                ? studentDraft.programId
                : student.program_id || '';

            if (slot.subject_id && !scheduledProgram) {
              this.setMissingScheduledProgramState(slot, student.enrollment_id, programs);
              return null;
            }

            if (!sectionId && !programId) {
              return null;
            }

            return this.selectProgramForStudent(
              this.getSlotKey(slot),
              student.enrollment_id,
              sectionId,
              networkId,
              programId,
              slot.subject_id ?? '',
              { preserveSelections: true }
            );
          })
      )
      .filter((task): task is Promise<void> => Boolean(task));

    await Promise.all(tasks);
  }

  private getScheduledProgramForStudent(
    slot: WeeklyScheduleSlot,
    student: StudentOption,
    programs: ProgramCatalogItem[]
  ): ProgramCatalogItem | null {
    if (!slot.subject_id) {
      return null;
    }

    const subjectPrograms = programs.filter((program) => program.subject_id === slot.subject_id);
    const assignedProgram = subjectPrograms.find(
      (program) => program.id === student.program_id
    );

    if (assignedProgram) {
      return assignedProgram;
    }

    return subjectPrograms.length === 1 ? subjectPrograms[0] : null;
  }

  private setMissingScheduledProgramState(
    slot: WeeklyScheduleSlot,
    studentEnrollmentId: string,
    programs: ProgramCatalogItem[]
  ): void {
    const subjectProgramCount = programs.filter(
      (program) => program.subject_id === slot.subject_id
    ).length;
    const errorMessage = subjectProgramCount > 1
      ? 'Plusieurs programmes existent pour cette matière. Lie un programme à l’élève ou choisis-en un manuellement.'
      : 'Aucun programme n’est disponible pour la matière de ce cours.';

    this.studentProgramStates[this.getStudentProgramKey(slot, studentEnrollmentId)] = {
      isLoading: false,
      errorMessage,
      networks: [],
      program: null
    };
  }

  private formatSavedTime(date: Date): string {
    return new Intl.DateTimeFormat('fr-BE', {
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  private hasSavedStudentContent(
    savedStudent:
      | ClassJournalEntry['students'][number]
      | null
      | undefined
  ): boolean {
    if (!savedStudent) {
      return false;
    }

    return Boolean(
      savedStudent.section_id ||
      savedStudent.network_id ||
      savedStudent.comment ||
      savedStudent.attendance_status !== 'present' ||
      savedStudent.selected_skill_ids.length > 0 ||
      savedStudent.selected_resource_ids.length > 0 ||
      savedStudent.selected_observation_ids.length > 0 ||
      this.hasSavedIndicators(savedStudent)
    );
  }
}
