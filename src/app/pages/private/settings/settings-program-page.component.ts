import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BehaviorSubject, catchError, combineLatest, forkJoin, map, of, shareReplay, startWith, switchMap, tap } from 'rxjs';
import { apiFetch } from '../../../helpers/api-session';
import { ProgramCatalogItem, ProgramNetwork, ProgramSkillGroup, SectionProgram } from '../../../models/Program';
import { Section } from '../../../models/Section';
import { Subject } from '../../../models/Subject';
import { Teacher } from '../../../models/Teacher';
import { SettingsService } from '../../../services/settings.service';

type SectionsViewModel = {
  isLoading: boolean;
  errorMessage: string;
  sections: Section[];
};

type NetworksViewModel = {
  isLoading: boolean;
  errorMessage: string;
  networks: ProgramNetwork[];
};

type ProgramViewModel = {
  isLoading: boolean;
  errorMessage: string;
  program: SectionProgram | null;
};

type ProgramCatalogViewModel = {
  isLoading: boolean;
  errorMessage: string;
  programs: ProgramCatalogItem[];
};

type SubjectsViewModel = {
  isLoading: boolean;
  errorMessage: string;
  subjects: Subject[];
};

type CurrentUser = {
  email: string;
};

type ProgramEditorStep = 'competences' | 'resources' | 'know' | 'apply' | 'transfer' | 'strategies';
type ProgramItemType = 'resource' | 'competence' | 'strategy' | 'skill';

@Component({
  selector: 'app-settings-program-page',
  imports: [AsyncPipe, RouterLink, ReactiveFormsModule],
  template: `
    <section class="space-y-6">
      <div class="flex flex-col gap-4">
        <div>
          <a
            routerLink="/dashboard/settings"
            class="inline-flex items-center gap-2 text-sm font-medium text-sky-700 transition hover:text-sky-800"
          >
            ← Retour aux paramètres
          </a>
          <p class="mt-4 text-sm font-medium tracking-[0.2em] text-sky-700 uppercase">Programme</p>
          <h2 class="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Référentiel par section</h2>
          <p class="mt-3 max-w-3xl text-base leading-7 text-slate-600">
            La matière de ton profil professeur est sélectionnée par défaut. Tu peux la modifier avant de choisir une section.
          </p>
        </div>
      </div>

      <section class="rounded-[1.8rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        @if (subjectsVm$ | async; as subjectsVm) {
          <div class="mb-6 space-y-3">
            <div>
              <p class="text-sm font-medium text-slate-800">Matière</p>
              <p class="mt-1 text-sm text-slate-500">Filtre les programmes par matière. Par défaut, celle du profil professeur est utilisée.</p>
            </div>

            @if (subjectsVm.errorMessage) {
              <div class="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {{ subjectsVm.errorMessage }}
              </div>
            } @else if (subjectsVm.isLoading) {
              <div class="h-12 max-w-md animate-pulse rounded-2xl bg-slate-100"></div>
            } @else {
              <select
                class="w-full max-w-md rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400"
                [formControl]="selectedSubjectControl"
                (change)="selectSubject(selectedSubjectControl.value)"
              >
                <option value="">Toutes les matières</option>
                @for (subject of subjectsVm.subjects; track subject.id) {
                  <option [value]="subject.id">{{ subject.name }}</option>
                }
              </select>
            }
          </div>
        }

        @if (sectionsVm$ | async; as sectionsVm) {
          @if (sectionsVm.errorMessage) {
            <div class="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {{ sectionsVm.errorMessage }}
            </div>
          } @else {
            <div class="space-y-5">
              <div class="space-y-3">
                <div>
                  <p class="text-sm font-medium text-slate-800">Année</p>
                  <p class="mt-1 text-sm text-slate-500">Choisis le degré/année avant de sélectionner le programme.</p>
                </div>

                @if (sectionsVm.isLoading) {
                  <div class="flex gap-2 overflow-x-auto pb-1">
                    @for (item of [1, 2, 3, 4, 5, 6]; track item) {
                      <div class="h-11 w-20 shrink-0 animate-pulse rounded-2xl bg-slate-100"></div>
                    }
                  </div>
                } @else {
                  <div class="flex gap-2 overflow-x-auto pb-1">
                    @for (level of getSectionLevels(sectionsVm.sections); track level) {
                      <button
                        type="button"
                        (click)="selectLevel(level)"
                        class="shrink-0 rounded-2xl border px-4 py-2.5 text-sm font-semibold transition"
                        [class.border-slate-950]="isSelectedLevel(level)"
                        [class.bg-slate-950]="isSelectedLevel(level)"
                        [class.text-white]="isSelectedLevel(level)"
                        [class.border-slate-200]="!isSelectedLevel(level)"
                        [class.bg-white]="!isSelectedLevel(level)"
                        [class.text-slate-700]="!isSelectedLevel(level)"
                      >
                        {{ getLevelLabel(level) }}
                      </button>
                    }
                  </div>
                }
              </div>

              @if (!sectionsVm.isLoading) {
                <div class="space-y-3">
                  <div>
                    <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p class="text-sm font-medium text-slate-800">Programmes</p>
                        <p class="mt-1 text-sm text-slate-500">Clique sur un intitulé pour afficher ses UAA.</p>
                      </div>
                      @if (selectedSubjectId) {
                        <button
                          type="button"
                          (click)="toggleProgramCreation()"
                          class="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                        >
                          {{ isProgramCreateOpen ? 'Fermer l’ajout' : 'Ajouter un programme' }}
                        </button>
                      }
                    </div>
                  </div>

                  @if (yearProgramsVm$ | async; as yearProgramsVm) {
                    @if (yearProgramsVm.errorMessage) {
                      <div class="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        {{ yearProgramsVm.errorMessage }}
                      </div>
                    } @else if (yearProgramsVm.isLoading) {
                      <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        @for (item of [1, 2, 3]; track item) {
                          <div class="h-24 animate-pulse rounded-2xl bg-slate-100"></div>
                        }
                      </div>
                    } @else if (yearProgramsVm.programs.length === 0) {
                      <div class="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                        Aucun programme disponible pour cette année.
                      </div>
                    } @else {
                      <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        @for (catalogProgram of yearProgramsVm.programs; track catalogProgram.id) {
                          <button
                            type="button"
                            (click)="selectCatalogProgram(catalogProgram)"
                            class="rounded-2xl border p-4 text-left transition hover:bg-slate-50"
                            [class.border-sky-300]="isSelectedCatalogProgram(catalogProgram)"
                            [class.bg-sky-50]="isSelectedCatalogProgram(catalogProgram)"
                            [class.border-slate-200]="!isSelectedCatalogProgram(catalogProgram)"
                            [class.bg-white]="!isSelectedCatalogProgram(catalogProgram)"
                          >
                            <p class="text-xs font-medium tracking-[0.18em] text-slate-500 uppercase">
                              {{ catalogProgram.section_code }} · {{ catalogProgram.network_code }} · {{ catalogProgram.hours }} h
                            </p>
                            <p class="mt-2 text-base font-semibold text-slate-950">
                              {{ catalogProgram.name || catalogProgram.subject_name }}
                            </p>
                            <p class="mt-1 text-sm leading-6 text-slate-600">
                              {{ catalogProgram.section_label }}
                            </p>
                            <p class="mt-2 text-xs font-medium text-slate-500">
                              {{ catalogProgram.uaa_count }} UAA
                            </p>
                          </button>
                        }
                      </div>
                    }
                  }

                  @if (isProgramCreateOpen) {
                    <div class="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                      <p class="text-sm font-semibold text-slate-900">Choisir la section</p>
                      <div class="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        @for (section of getSectionsForSelectedLevel(sectionsVm.sections); track section.id) {
                          <button
                            type="button"
                            (click)="selectSectionForProgramCreation(section.id)"
                            class="rounded-2xl border bg-white p-4 text-left transition hover:bg-slate-50"
                            [class.border-sky-300]="isSelectedSection(section.id)"
                            [class.bg-sky-50]="isSelectedSection(section.id)"
                            [class.border-slate-200]="!isSelectedSection(section.id)"
                          >
                            <p class="text-xs font-medium tracking-[0.18em] text-slate-500 uppercase">
                              {{ section.type }} · {{ section.level }}e
                            </p>
                            <p class="mt-2 text-base font-semibold text-slate-950">{{ section.code }}</p>
                            <p class="mt-1 text-sm leading-6 text-slate-600">{{ section.label }}</p>
                          </button>
                        }
                      </div>

                      @if (selectedSectionId) {
                        @if (networksVm$ | async; as networksVm) {
                          <div class="mt-5 space-y-3">
                            <p class="text-sm font-semibold text-slate-900">Choisir le réseau</p>
                            @if (networksVm.errorMessage) {
                              <div class="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                                {{ networksVm.errorMessage }}
                              </div>
                            } @else if (networksVm.isLoading) {
                              <div class="flex gap-2 overflow-x-auto pb-1">
                                @for (item of [1, 2, 3]; track item) {
                                  <div class="h-11 w-28 shrink-0 animate-pulse rounded-2xl bg-white"></div>
                                }
                              </div>
                            } @else {
                              <div class="flex gap-2 overflow-x-auto pb-1">
                                @for (network of networksVm.networks; track network.id) {
                                  <button
                                    type="button"
                                    (click)="selectNetworkForProgramCreation(network.id)"
                                    class="shrink-0 rounded-2xl border px-4 py-2.5 text-sm font-medium transition"
                                    [class.border-sky-300]="isSelectedNetwork(network.id)"
                                    [class.bg-sky-50]="isSelectedNetwork(network.id)"
                                    [class.text-sky-800]="isSelectedNetwork(network.id)"
                                    [class.border-slate-200]="!isSelectedNetwork(network.id)"
                                    [class.bg-white]="!isSelectedNetwork(network.id)"
                                    [class.text-slate-700]="!isSelectedNetwork(network.id)"
                                  >
                                    {{ network.code }} · {{ network.name }}
                                  </button>
                                }
                              </div>
                            }
                          </div>
                        }
                      }
                    </div>
                  }
                </div>
              }

            </div>
          }
        }
      </section>

      @if (programVm$ | async; as programVm) {
        @if (programEditorError) {
          <div class="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {{ programEditorError }}
          </div>
        }

        @if (programEditorMessage) {
          <div class="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {{ programEditorMessage }}
          </div>
        }

        @if (programVm.errorMessage) {
          <div class="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {{ programVm.errorMessage }}
          </div>
        } @else if (programVm.isLoading) {
          <div class="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div class="h-6 w-52 animate-pulse rounded bg-slate-200"></div>
            <div class="mt-4 h-4 w-64 animate-pulse rounded bg-slate-100"></div>
            <div class="mt-6 space-y-4">
              @for (item of [1, 2, 3]; track item) {
                <div class="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                  <div class="h-5 w-28 animate-pulse rounded bg-slate-200"></div>
                  <div class="mt-3 h-24 animate-pulse rounded bg-white"></div>
                </div>
              }
            </div>
          </div>
        } @else if (programVm.program; as program) {
          <section class="space-y-4">
            <div class="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p class="text-sm font-medium tracking-[0.18em] text-sky-700 uppercase">Programme affiché</p>
                  <h3 class="mt-2 text-2xl font-semibold text-slate-950">{{ program.section.label }}</h3>
                  <p class="mt-2 text-sm text-slate-600">
                    {{ program.section.code }}
                    @if (program.program; as programSummary) {
                      @if (programSummary.name) {
                        <span> · {{ programSummary.name }}</span>
                      }
                      <span> · {{ programSummary.subject?.name || 'Matière non renseignée' }}</span>
                      <span> · {{ programSummary.hours }} h</span>
                      @if (programSummary.network) {
                        <span> · {{ programSummary.network.name }}</span>
                      }
                    } @else if (selectedNetworkName$ | async; as selectedNetworkName) {
                      <span> · {{ selectedNetworkName }}</span>
                    }
                  </p>
                </div>

                <div class="flex shrink-0 flex-wrap gap-2">
                  @if (program.program) {
                    <button
                      type="button"
                      (click)="toggleProgramEditing(program.program)"
                      class="rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
                    >
                      {{ isProgramEditing ? 'Fermer l’édition' : 'Modifier le programme' }}
                    </button>
                  } @else if (selectedSubjectId && selectedSectionId && selectedNetworkId) {
                    <button
                      type="button"
                      (click)="toggleProgramCreation()"
                      class="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      {{ isProgramCreateOpen ? 'Fermer l’ajout' : 'Ajouter un programme' }}
                    </button>
                  }
                </div>
              </div>
            </div>

            @if (selectedSubjectId && selectedSectionId && selectedNetworkId && isProgramCreateOpen) {
              <form
                [formGroup]="programForm"
                (ngSubmit)="createProgram()"
                class="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm"
              >
                <p class="text-sm font-medium tracking-[0.18em] text-sky-700 uppercase">Nouveau programme</p>
                <h3 class="mt-2 text-2xl font-semibold text-slate-950">Créer le programme sélectionné</h3>
                <p class="mt-2 text-sm leading-6 text-slate-600">
                  Une fois créé, tu pourras ajouter les UAA, les ressources, les compétences et les stratégies étape par étape.
                </p>

                <div class="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <label class="space-y-2 xl:col-span-2">
                    <span class="text-sm font-medium text-slate-800">Nom</span>
                    <input
                      type="text"
                      formControlName="name"
                      class="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400"
                      placeholder="Nom du programme"
                    />
                  </label>
                  <label class="space-y-2">
                    <span class="text-sm font-medium text-slate-800">Heures</span>
                    <input
                      type="number"
                      min="1"
                      formControlName="hours"
                      class="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400"
                      placeholder="4"
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

                <div class="mt-5 flex justify-end">
                  <button
                    type="submit"
                    [disabled]="programForm.invalid || isSavingProgram"
                    class="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {{ isSavingProgram ? 'Création...' : 'Créer le programme' }}
                  </button>
                </div>
              </form>
            }

            @if (isProgramEditing) {
              @if (program.program; as programSummary) {
                <form
                  [formGroup]="programDetailsForm"
                  (ngSubmit)="updateProgram(programSummary.id)"
                  class="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p class="text-sm font-medium tracking-[0.18em] text-sky-700 uppercase">Informations du programme</p>
                      <h3 class="mt-2 text-xl font-semibold text-slate-950">Modifier l’intitulé et les heures</h3>
                    </div>
                    <button
                      type="submit"
                      [disabled]="programDetailsForm.invalid || isSavingProgramDetails"
                      class="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {{ isSavingProgramDetails ? 'Enregistrement...' : 'Enregistrer' }}
                    </button>
                  </div>

                  <div class="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
                    <label class="space-y-2">
                      <span class="text-sm font-medium text-slate-800">Intitulé</span>
                      <input
                        type="text"
                        formControlName="name"
                        class="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400"
                        placeholder="Nom du programme"
                      />
                    </label>
                    <label class="space-y-2">
                      <span class="text-sm font-medium text-slate-800">Heures</span>
                      <input
                        type="number"
                        min="1"
                        formControlName="hours"
                        class="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400"
                        placeholder="4"
                      />
                    </label>
                  </div>
                </form>
              }
            }

            @if (program.uaas.length === 0) {
              <div class="rounded-[1.8rem] border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                Aucun programme n’est encore défini pour cette section et ce réseau.
              </div>
            } @else {
              @for (uaa of program.uaas; track uaa.id) {
                <article class="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm">
                  <button
                    type="button"
                    (click)="toggleUaa(uaa.id)"
                    class="flex w-full items-start justify-between gap-4 text-left"
                  >
                    <div class="min-w-0">
                      <p class="text-xs font-medium tracking-[0.18em] text-sky-700 uppercase">{{ uaa.code }}</p>
                      <h4 class="mt-1 text-xl font-semibold text-slate-950">{{ uaa.name }}</h4>
                    </div>

                    <span class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-lg text-slate-700">
                      {{ isUaaExpanded(uaa.id) ? '−' : '+' }}
                    </span>
                  </button>

                  @if (isUaaExpanded(uaa.id)) {
                    @if (isProgramEditing) {
                      <div class="mt-6 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                        <div class="flex gap-2 overflow-x-auto pb-1">
                          @for (step of editorSteps; track step) {
                            <button
                              type="button"
                              (click)="selectEditorStep(uaa.id, step)"
                              class="shrink-0 rounded-2xl border px-4 py-2.5 text-sm font-semibold transition"
                              [class.border-slate-950]="isActiveEditorStep(uaa.id, step)"
                              [class.bg-slate-950]="isActiveEditorStep(uaa.id, step)"
                              [class.text-white]="isActiveEditorStep(uaa.id, step)"
                              [class.border-slate-200]="!isActiveEditorStep(uaa.id, step)"
                              [class.bg-white]="!isActiveEditorStep(uaa.id, step)"
                              [class.text-slate-700]="!isActiveEditorStep(uaa.id, step)"
                            >
                              {{ getEditorStepLabel(step) }}
                            </button>
                          }
                        </div>

                        @switch (getActiveEditorStep(uaa.id)) {
                          @case ('competences') {
                            <form [formGroup]="getCompetenceForm(uaa.id)" (ngSubmit)="addCompetence(uaa.id)" class="mt-4 grid gap-3">
                              <p class="text-sm font-semibold text-slate-900">Ajouter les compétences à développer</p>
                              <textarea formControlName="description" rows="5" class="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400" placeholder="Une compétence par ligne"></textarea>
                              <button type="submit" [disabled]="getCompetenceForm(uaa.id).invalid || savingItemKey === getItemKey('competence', uaa.id)" class="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
                                {{ savingItemKey === getItemKey('competence', uaa.id) ? 'Ajout...' : 'Ajouter les compétences' }}
                              </button>
                            </form>
                          }

                          @case ('resources') {
                            <form [formGroup]="getResourceForm(uaa.id)" (ngSubmit)="addResource(uaa.id)" class="mt-4 grid gap-3">
                              <p class="text-sm font-semibold text-slate-900">Ajouter les ressources</p>
                              <textarea formControlName="description" rows="5" class="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400" placeholder="Une ressource par ligne"></textarea>
                              <button type="submit" [disabled]="getResourceForm(uaa.id).invalid || savingItemKey === getItemKey('resource', uaa.id)" class="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
                                {{ savingItemKey === getItemKey('resource', uaa.id) ? 'Ajout...' : 'Ajouter les ressources' }}
                              </button>
                            </form>
                          }

                          @case ('know') {
                            <form [formGroup]="getSkillForm(uaa.id)" (ngSubmit)="addSkill(uaa.id, 'Connaître')" class="mt-4 grid gap-3">
                              <p class="text-sm font-semibold text-slate-900">Ajouter les processus · Connaître</p>
                              <textarea formControlName="description" rows="5" class="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400" placeholder="Une compétence par ligne"></textarea>
                              <button type="submit" [disabled]="getSkillForm(uaa.id).invalid || savingItemKey === getItemKey('skill', uaa.id)" class="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
                                {{ savingItemKey === getItemKey('skill', uaa.id) ? 'Ajout...' : 'Ajouter les compétences' }}
                              </button>
                            </form>
                          }

                          @case ('apply') {
                            <form [formGroup]="getSkillForm(uaa.id)" (ngSubmit)="addSkill(uaa.id, 'Appliquer')" class="mt-4 grid gap-3">
                              <p class="text-sm font-semibold text-slate-900">Ajouter les processus · Appliquer</p>
                              <textarea formControlName="description" rows="5" class="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400" placeholder="Une compétence par ligne"></textarea>
                              <button type="submit" [disabled]="getSkillForm(uaa.id).invalid || savingItemKey === getItemKey('skill', uaa.id)" class="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
                                {{ savingItemKey === getItemKey('skill', uaa.id) ? 'Ajout...' : 'Ajouter les compétences' }}
                              </button>
                            </form>
                          }

                          @case ('transfer') {
                            <form [formGroup]="getSkillForm(uaa.id)" (ngSubmit)="addSkill(uaa.id, 'Transférer')" class="mt-4 grid gap-3">
                              <p class="text-sm font-semibold text-slate-900">Ajouter les processus · Transférer</p>
                              <textarea formControlName="description" rows="5" class="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400" placeholder="Une compétence par ligne"></textarea>
                              <button type="submit" [disabled]="getSkillForm(uaa.id).invalid || savingItemKey === getItemKey('skill', uaa.id)" class="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
                                {{ savingItemKey === getItemKey('skill', uaa.id) ? 'Ajout...' : 'Ajouter les compétences' }}
                              </button>
                            </form>
                          }

                          @case ('strategies') {
                            <form [formGroup]="getStrategyForm(uaa.id)" (ngSubmit)="addStrategy(uaa.id)" class="mt-4 grid gap-3">
                              <p class="text-sm font-semibold text-slate-900">Ajouter les stratégies transversales</p>
                              <textarea formControlName="description" rows="5" class="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400" placeholder="Une stratégie par ligne"></textarea>
                              <button type="submit" [disabled]="getStrategyForm(uaa.id).invalid || savingItemKey === getItemKey('strategy', uaa.id)" class="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
                                {{ savingItemKey === getItemKey('strategy', uaa.id) ? 'Ajout...' : 'Ajouter les stratégies' }}
                              </button>
                            </form>
                          }
                        }
                      </div>
                    }

                    @if (isProgramEditing || uaa.skillGroups.length > 0 || uaa.resources.length > 0) {
                    <div class="mt-6 grid gap-5 lg:grid-cols-[repeat(auto-fit,minmax(280px,1fr))]">
                      @if (isProgramEditing || uaa.skillGroups.length > 0) {
                        <section class="rounded-[1.5rem] border border-slate-200 bg-white p-4">
                        <p class="text-sm font-semibold text-slate-900">Processus</p>

                        @if (uaa.skillGroups.length > 0) {
                          <div class="mt-4 space-y-5">
                            @for (group of orderedSkillGroups(uaa.skillGroups); track trackSkillGroup(group)) {
                              <section class="border-t border-slate-100 pt-5 first:border-t-0 first:pt-0">
                                <p class="text-sm font-semibold text-slate-900">{{ getProcessTitle(group.processTypeName) }}</p>
                                @if (group.skills.length === 0) {
                                  <p class="mt-2 text-sm text-slate-500">Aucun élément dans cette catégorie.</p>
                                } @else {
                                  <ul class="mt-3 space-y-2">
                                    @for (skill of group.skills; track skill.id) {
                                      <li class="flex items-start justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-800">
                                        @if (isEditingProgramItem('skill', skill.id)) {
                                          <textarea
                                            class="min-h-20 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-sky-400"
                                            [value]="editingItemDescription"
                                            (input)="editingItemDescription = $any($event.target).value"
                                          ></textarea>
                                        } @else {
                                          <span>{{ skill.description }}</span>
                                        }
                                        @if (isProgramEditing) {
                                          <div class="flex shrink-0 gap-2">
                                            @if (isEditingProgramItem('skill', skill.id)) {
                                              <button type="button" (click)="updateProgramItem('skill', skill.id)" [disabled]="updatingItemKey === getItemKey('skill', skill.id)" class="rounded-xl bg-slate-950 px-3 py-1 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
                                                {{ updatingItemKey === getItemKey('skill', skill.id) ? '...' : 'OK' }}
                                              </button>
                                              <button type="button" (click)="cancelProgramItemEdit()" class="rounded-xl border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">Annuler</button>
                                            } @else {
                                              <button type="button" title="Modifier" (click)="startProgramItemEdit('skill', skill.id, skill.description)" class="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50">
                                                <svg class="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path d="M535.6 85.7C513.7 63.8 478.3 63.8 456.4 85.7L432 110.1L529.9 208L554.3 183.6C576.2 161.7 576.2 126.3 554.3 104.4L535.6 85.7zM236.4 305.7C230.3 311.8 225.6 319.3 222.9 327.6L193.3 416.4C190.4 425 192.7 434.5 199.1 441C205.5 447.5 215 449.7 223.7 446.8L312.5 417.2C320.7 414.5 328.2 409.8 334.4 403.7L496 241.9L398.1 144L236.4 305.7zM160 128C107 128 64 171 64 224L64 480C64 533 107 576 160 576L416 576C469 576 512 533 512 480L512 384C512 366.3 497.7 352 480 352C462.3 352 448 366.3 448 384L448 480C448 497.7 433.7 512 416 512L160 512C142.3 512 128 497.7 128 480L128 224C128 206.3 142.3 192 160 192L256 192C273.7 192 288 177.7 288 160C288 142.3 273.7 128 256 128L160 128z"/></svg>
                                              </button>
                                              <button type="button" title="Supprimer" (click)="deleteProgramItem('skill', skill.id)" [disabled]="deletingItemKey === getItemKey('skill', skill.id)" class="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-rose-200 bg-white text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60">
                                                <svg class="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path d="M232.7 69.9L224 96L128 96C110.3 96 96 110.3 96 128C96 145.7 110.3 160 128 160L512 160C529.7 160 544 145.7 544 128C544 110.3 529.7 96 512 96L416 96L407.3 69.9C402.9 56.8 390.7 48 376.9 48L263.1 48C249.3 48 237.1 56.8 232.7 69.9zM512 208L128 208L149.1 531.1C150.7 556.4 171.7 576 197 576L443 576C468.3 576 489.3 556.4 490.9 531.1L512 208z"/></svg>
                                              </button>
                                            }
                                          </div>
                                        }
                                      </li>
                                    }
                                  </ul>
                                }
                              </section>
                            }
                          </div>
                        } @else {
                          <p class="mt-3 text-sm text-slate-500">Aucun processus renseigné.</p>
                        }
                        </section>
                      }

                      @if (isProgramEditing || uaa.resources.length > 0) {
                        <aside class="rounded-[1.5rem] border border-sky-100 bg-sky-50/60 p-4">
                        <p class="text-sm font-semibold text-slate-900">Ressources</p>

                        @if (uaa.resources.length > 0) {
                          <ul class="mt-3 space-y-2">
                            @for (resource of uaa.resources; track resource.id) {
                              <li class="flex items-start justify-between gap-3 rounded-2xl bg-white px-4 py-3 text-sm leading-6 text-slate-800 shadow-sm">
                                @if (isEditingProgramItem('resource', resource.id)) {
                                  <textarea class="min-h-20 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-sky-400" [value]="editingItemDescription" (input)="editingItemDescription = $any($event.target).value"></textarea>
                                } @else {
                                  <span>{{ resource.description }}</span>
                                }
                                @if (isProgramEditing) {
                                  <div class="flex shrink-0 gap-2">
                                    @if (isEditingProgramItem('resource', resource.id)) {
                                      <button type="button" (click)="updateProgramItem('resource', resource.id)" [disabled]="updatingItemKey === getItemKey('resource', resource.id)" class="rounded-xl bg-slate-950 px-3 py-1 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">{{ updatingItemKey === getItemKey('resource', resource.id) ? '...' : 'OK' }}</button>
                                      <button type="button" (click)="cancelProgramItemEdit()" class="rounded-xl border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">Annuler</button>
                                    } @else {
                                      <button type="button" title="Modifier" (click)="startProgramItemEdit('resource', resource.id, resource.description)" class="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50">
                                        <svg class="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path d="M535.6 85.7C513.7 63.8 478.3 63.8 456.4 85.7L432 110.1L529.9 208L554.3 183.6C576.2 161.7 576.2 126.3 554.3 104.4L535.6 85.7zM236.4 305.7C230.3 311.8 225.6 319.3 222.9 327.6L193.3 416.4C190.4 425 192.7 434.5 199.1 441C205.5 447.5 215 449.7 223.7 446.8L312.5 417.2C320.7 414.5 328.2 409.8 334.4 403.7L496 241.9L398.1 144L236.4 305.7zM160 128C107 128 64 171 64 224L64 480C64 533 107 576 160 576L416 576C469 576 512 533 512 480L512 384C512 366.3 497.7 352 480 352C462.3 352 448 366.3 448 384L448 480C448 497.7 433.7 512 416 512L160 512C142.3 512 128 497.7 128 480L128 224C128 206.3 142.3 192 160 192L256 192C273.7 192 288 177.7 288 160C288 142.3 273.7 128 256 128L160 128z"/></svg>
                                      </button>
                                      <button type="button" title="Supprimer" (click)="deleteProgramItem('resource', resource.id)" [disabled]="deletingItemKey === getItemKey('resource', resource.id)" class="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-rose-200 bg-white text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60">
                                        <svg class="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path d="M232.7 69.9L224 96L128 96C110.3 96 96 110.3 96 128C96 145.7 110.3 160 128 160L512 160C529.7 160 544 145.7 544 128C544 110.3 529.7 96 512 96L416 96L407.3 69.9C402.9 56.8 390.7 48 376.9 48L263.1 48C249.3 48 237.1 56.8 232.7 69.9zM512 208L128 208L149.1 531.1C150.7 556.4 171.7 576 197 576L443 576C468.3 576 489.3 556.4 490.9 531.1L512 208z"/></svg>
                                      </button>
                                    }
                                  </div>
                                }
                              </li>
                            }
                          </ul>
                        } @else {
                          <p class="mt-3 text-sm text-slate-500">Aucune ressource renseignée.</p>
                        }
                        </aside>
                      }
                    </div>
                    }

                    @if (uaa.competences.length > 0) {
                      <div class="mt-5">
                        <p class="text-sm font-semibold text-slate-900">Compétences à développer</p>
                        <ul class="mt-3 space-y-2">
                          @for (competence of uaa.competences; track competence.id) {
                            <li class="flex items-start justify-between gap-3 rounded-2xl bg-emerald-50 px-4 py-3 text-sm leading-6 text-slate-800">
                              @if (isEditingProgramItem('competence', competence.id)) {
                                <textarea class="min-h-20 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-sky-400" [value]="editingItemDescription" (input)="editingItemDescription = $any($event.target).value"></textarea>
                              } @else {
                                <span>{{ competence.description }}</span>
                              }
                              @if (isProgramEditing) {
                                <div class="flex shrink-0 gap-2">
                                  @if (isEditingProgramItem('competence', competence.id)) {
                                    <button type="button" (click)="updateProgramItem('competence', competence.id)" [disabled]="updatingItemKey === getItemKey('competence', competence.id)" class="rounded-xl bg-slate-950 px-3 py-1 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">{{ updatingItemKey === getItemKey('competence', competence.id) ? '...' : 'OK' }}</button>
                                    <button type="button" (click)="cancelProgramItemEdit()" class="rounded-xl border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">Annuler</button>
                                  } @else {
                                    <button type="button" title="Modifier" (click)="startProgramItemEdit('competence', competence.id, competence.description)" class="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50">
                                      <svg class="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path d="M535.6 85.7C513.7 63.8 478.3 63.8 456.4 85.7L432 110.1L529.9 208L554.3 183.6C576.2 161.7 576.2 126.3 554.3 104.4L535.6 85.7zM236.4 305.7C230.3 311.8 225.6 319.3 222.9 327.6L193.3 416.4C190.4 425 192.7 434.5 199.1 441C205.5 447.5 215 449.7 223.7 446.8L312.5 417.2C320.7 414.5 328.2 409.8 334.4 403.7L496 241.9L398.1 144L236.4 305.7zM160 128C107 128 64 171 64 224L64 480C64 533 107 576 160 576L416 576C469 576 512 533 512 480L512 384C512 366.3 497.7 352 480 352C462.3 352 448 366.3 448 384L448 480C448 497.7 433.7 512 416 512L160 512C142.3 512 128 497.7 128 480L128 224C128 206.3 142.3 192 160 192L256 192C273.7 192 288 177.7 288 160C288 142.3 273.7 128 256 128L160 128z"/></svg>
                                    </button>
                                    <button type="button" title="Supprimer" (click)="deleteProgramItem('competence', competence.id)" [disabled]="deletingItemKey === getItemKey('competence', competence.id)" class="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-rose-200 bg-white text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60">
                                      <svg class="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path d="M232.7 69.9L224 96L128 96C110.3 96 96 110.3 96 128C96 145.7 110.3 160 128 160L512 160C529.7 160 544 145.7 544 128C544 110.3 529.7 96 512 96L416 96L407.3 69.9C402.9 56.8 390.7 48 376.9 48L263.1 48C249.3 48 237.1 56.8 232.7 69.9zM512 208L128 208L149.1 531.1C150.7 556.4 171.7 576 197 576L443 576C468.3 576 489.3 556.4 490.9 531.1L512 208z"/></svg>
                                    </button>
                                  }
                                </div>
                              }
                            </li>
                          }
                        </ul>
                      </div>
                    }

                    @if (uaa.strategies.length > 0) {
                      <div class="mt-5">
                        <p class="text-sm font-semibold text-slate-900">Stratégies transversales</p>
                        <ul class="mt-3 space-y-2">
                          @for (strategy of uaa.strategies; track strategy.id) {
                            <li class="flex items-start justify-between gap-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm leading-6 text-slate-800">
                              @if (isEditingProgramItem('strategy', strategy.id)) {
                                <textarea class="min-h-20 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-sky-400" [value]="editingItemDescription" (input)="editingItemDescription = $any($event.target).value"></textarea>
                              } @else {
                                <span>{{ strategy.description }}</span>
                              }
                              @if (isProgramEditing) {
                                <div class="flex shrink-0 gap-2">
                                  @if (isEditingProgramItem('strategy', strategy.id)) {
                                    <button type="button" (click)="updateProgramItem('strategy', strategy.id)" [disabled]="updatingItemKey === getItemKey('strategy', strategy.id)" class="rounded-xl bg-slate-950 px-3 py-1 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">{{ updatingItemKey === getItemKey('strategy', strategy.id) ? '...' : 'OK' }}</button>
                                    <button type="button" (click)="cancelProgramItemEdit()" class="rounded-xl border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">Annuler</button>
                                  } @else {
                                    <button type="button" title="Modifier" (click)="startProgramItemEdit('strategy', strategy.id, strategy.description)" class="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50">
                                      <svg class="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path d="M535.6 85.7C513.7 63.8 478.3 63.8 456.4 85.7L432 110.1L529.9 208L554.3 183.6C576.2 161.7 576.2 126.3 554.3 104.4L535.6 85.7zM236.4 305.7C230.3 311.8 225.6 319.3 222.9 327.6L193.3 416.4C190.4 425 192.7 434.5 199.1 441C205.5 447.5 215 449.7 223.7 446.8L312.5 417.2C320.7 414.5 328.2 409.8 334.4 403.7L496 241.9L398.1 144L236.4 305.7zM160 128C107 128 64 171 64 224L64 480C64 533 107 576 160 576L416 576C469 576 512 533 512 480L512 384C512 366.3 497.7 352 480 352C462.3 352 448 366.3 448 384L448 480C448 497.7 433.7 512 416 512L160 512C142.3 512 128 497.7 128 480L128 224C128 206.3 142.3 192 160 192L256 192C273.7 192 288 177.7 288 160C288 142.3 273.7 128 256 128L160 128z"/></svg>
                                    </button>
                                    <button type="button" title="Supprimer" (click)="deleteProgramItem('strategy', strategy.id)" [disabled]="deletingItemKey === getItemKey('strategy', strategy.id)" class="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-rose-200 bg-white text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60">
                                      <svg class="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path d="M232.7 69.9L224 96L128 96C110.3 96 96 110.3 96 128C96 145.7 110.3 160 128 160L512 160C529.7 160 544 145.7 544 128C544 110.3 529.7 96 512 96L416 96L407.3 69.9C402.9 56.8 390.7 48 376.9 48L263.1 48C249.3 48 237.1 56.8 232.7 69.9zM512 208L128 208L149.1 531.1C150.7 556.4 171.7 576 197 576L443 576C468.3 576 489.3 556.4 490.9 531.1L512 208z"/></svg>
                                    </button>
                                  }
                                </div>
                              }
                            </li>
                          }
                        </ul>
                      </div>
                    }
                  }
                </article>
              }
            }

            @if (isProgramEditing) {
              @if (program.program; as programSummary) {
                <section class="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm">
                  <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p class="text-sm font-medium tracking-[0.18em] text-sky-700 uppercase">Copier depuis un autre programme</p>
                      <p class="mt-2 text-sm leading-6 text-slate-600">
                        Sélectionne un programme source, puis coche les UAA à copier dans ce programme.
                      </p>
                    </div>
                    <button
                      type="button"
                      (click)="toggleClonePanel()"
                      class="rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
                    >
                      {{ isClonePanelOpen ? 'Fermer la copie' : 'Copier des UAA' }}
                    </button>
                  </div>

                  @if (isClonePanelOpen) {
                    @if (programCatalogVm$ | async; as catalogVm) {
                      <div class="mt-5 space-y-4">
                        @if (catalogVm.errorMessage) {
                          <div class="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                            {{ catalogVm.errorMessage }}
                          </div>
                        } @else if (catalogVm.isLoading) {
                          <div class="h-12 max-w-lg animate-pulse rounded-2xl bg-slate-100"></div>
                        } @else if (catalogVm.programs.length === 0) {
                          <div class="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                            Aucun programme source disponible pour cette matière.
                          </div>
                        } @else {
                          <select
                            class="w-full max-w-2xl rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400"
                            [value]="selectedSourceProgramId"
                            (change)="selectSourceProgram($any($event.target).value)"
                          >
                            <option value="">Choisir un programme source</option>
                            @for (sourceProgram of catalogVm.programs; track sourceProgram.id) {
                              <option [value]="sourceProgram.id">
                                {{ sourceProgram.section_code }} · {{ sourceProgram.network_code }} · {{ sourceProgram.hours }} h · {{ sourceProgram.name || sourceProgram.subject_name }}
                              </option>
                            }
                          </select>

                          @if (getSelectedSourceProgram(catalogVm.programs); as sourceProgram) {
                            @if (sourceProgramVm$ | async; as sourceVm) {
                              @if (sourceVm.errorMessage) {
                                <div class="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                                  {{ sourceVm.errorMessage }}
                                </div>
                              } @else if (sourceVm.isLoading) {
                                <div class="grid gap-3 sm:grid-cols-2">
                                  @for (item of [1, 2, 3]; track item) {
                                    <div class="h-20 animate-pulse rounded-2xl bg-slate-100"></div>
                                  }
                                </div>
                              } @else if (sourceVm.program?.uaas?.length) {
                                <div class="grid gap-3 sm:grid-cols-2">
                                  @for (sourceUaa of sourceVm.program?.uaas ?? []; track sourceUaa.id) {
                                    <label class="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:bg-white">
                                      <input
                                        type="checkbox"
                                        class="mt-1"
                                        [checked]="isSourceUaaSelected(sourceUaa.id)"
                                        (change)="toggleSourceUaa(sourceUaa.id, $any($event.target).checked)"
                                      />
                                      <span>
                                        <span class="block text-sm font-semibold text-slate-950">{{ sourceUaa.code }} · {{ sourceUaa.name }}</span>
                                        <span class="mt-1 block text-xs text-slate-500">
                                          {{ sourceUaa.resources.length }} ressource{{ sourceUaa.resources.length > 1 ? 's' : '' }},
                                          {{ sourceUaa.competences.length }} compétence{{ sourceUaa.competences.length > 1 ? 's' : '' }}
                                        </span>
                                      </span>
                                    </label>
                                  }
                                </div>

                                <div class="flex justify-end">
                                  <button
                                    type="button"
                                    (click)="cloneSelectedUaas(programSummary.id)"
                                    [disabled]="selectedSourceUaaIds.length === 0 || isCloningUaas"
                                    class="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {{ isCloningUaas ? 'Copie...' : 'Copier les UAA sélectionnées' }}
                                  </button>
                                </div>
                              } @else {
                                <div class="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                                  Ce programme source ne contient aucune UAA.
                                </div>
                              }
                            }
                          }
                        }
                      </div>
                    }
                  }
                </section>

                <form
                  [formGroup]="uaaForm"
                  (ngSubmit)="addUaa(programSummary.id)"
                  class="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <p class="text-sm font-medium tracking-[0.18em] text-sky-700 uppercase">Nouvelle UAA</p>
                  <div class="mt-4 grid gap-4 md:grid-cols-[0.5fr_1fr_auto] md:items-end">
                    <label class="space-y-2">
                      <span class="text-sm font-medium text-slate-800">Code</span>
                      <input
                        type="text"
                        formControlName="code"
                        class="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400"
                        placeholder="UAA 1"
                      />
                    </label>
                    <label class="space-y-2">
                      <span class="text-sm font-medium text-slate-800">Nom</span>
                      <input
                        type="text"
                        formControlName="name"
                        class="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400"
                        placeholder="Titre de l’UAA"
                      />
                    </label>
                    <button
                      type="submit"
                      [disabled]="uaaForm.invalid || isSavingUaa"
                      class="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {{ isSavingUaa ? 'Ajout...' : 'Ajouter l’UAA' }}
                    </button>
                  </div>
                </form>
              }
            }
          </section>
        } @else {
          @if (selectedSubjectId && selectedSectionId && selectedNetworkId) {
            <form
              [formGroup]="programForm"
              (ngSubmit)="createProgram()"
              class="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm"
            >
              <p class="text-sm font-medium tracking-[0.18em] text-sky-700 uppercase">Nouveau programme</p>
              <h3 class="mt-2 text-2xl font-semibold text-slate-950">Créer le programme sélectionné</h3>
              <p class="mt-2 text-sm leading-6 text-slate-600">
                Une fois créé, tu pourras ajouter les UAA, les ressources, les compétences et les stratégies étape par étape.
              </p>

              <div class="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <label class="space-y-2 xl:col-span-2">
                  <span class="text-sm font-medium text-slate-800">Nom</span>
                  <input
                    type="text"
                    formControlName="name"
                    class="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400"
                    placeholder="Nom du programme"
                  />
                </label>
                <label class="space-y-2">
                  <span class="text-sm font-medium text-slate-800">Heures</span>
                  <input
                    type="number"
                    min="1"
                    formControlName="hours"
                    class="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400"
                    placeholder="4"
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

              <div class="mt-5 flex justify-end">
                <button
                  type="submit"
                  [disabled]="programForm.invalid || isSavingProgram"
                  class="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {{ isSavingProgram ? 'Création...' : 'Créer le programme' }}
                </button>
              </div>
            </form>
          } @else {
            <div class="rounded-[1.8rem] border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-500">
              Sélectionne une matière, une section et un réseau pour afficher ou créer un programme.
            </div>
          }
        }
      }
    </section>
  `
})
export class SettingsProgramPageComponent {
  private readonly settingsService = inject(SettingsService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly selectedSubjectIdSubject = new BehaviorSubject<string | null>(null);
  private readonly selectedSectionIdSubject = new BehaviorSubject<string | null>(null);
  private readonly selectedNetworkIdSubject = new BehaviorSubject<string | null>(null);
  private readonly selectedProgramIdSubject = new BehaviorSubject<string | null>(null);
  private readonly selectedLevelSubject = new BehaviorSubject<number | null>(null);
  private readonly selectedSourceProgramIdSubject = new BehaviorSubject<string>('');
  private readonly refreshProgramSubject = new BehaviorSubject<void>(undefined);
  protected readonly processOrder = ['Connaître', 'Appliquer', 'Transférer'];
  protected readonly editorSteps: ProgramEditorStep[] = ['competences', 'resources', 'know', 'apply', 'transfer', 'strategies'];
  private hasInitializedSubjectSelection = false;
  private readonly activeEditorStepByUaa = new Map<string, ProgramEditorStep>();
  private lastProgramCatalog: ProgramCatalogItem[] = [];
  protected selectedLevel: number | null = null;
  protected expandedUaaId: string | null = null;
  protected isSavingProgram = false;
  protected isSavingProgramDetails = false;
  protected isSavingUaa = false;
  protected isClonePanelOpen = false;
  protected isCloningUaas = false;
  protected selectedSourceProgramId = '';
  protected selectedSourceUaaIds: string[] = [];
  protected isProgramEditing = false;
  protected isProgramCreateOpen = false;
  protected savingItemKey = '';
  protected deletingItemKey = '';
  protected editingItemKey = '';
  protected updatingItemKey = '';
  protected editingItemDescription = '';
  protected programEditorMessage = '';
  protected programEditorError = '';
  protected readonly selectedSubjectControl = new FormControl('', { nonNullable: true });
  protected readonly programForm = this.formBuilder.group({
    name: [''],
    hours: [null as number | null, [Validators.required, Validators.min(1)]],
    validFrom: [''],
    validTo: ['']
  });
  protected readonly programDetailsForm = this.formBuilder.group({
    name: [''],
    hours: [null as number | null, [Validators.required, Validators.min(1)]]
  });
  protected readonly uaaForm = this.formBuilder.group({
    code: ['', Validators.required],
    name: ['', Validators.required]
  });
  private readonly skillForms = new Map<string, FormGroup>();
  private readonly resourceForms = new Map<string, FormGroup>();
  private readonly competenceForms = new Map<string, FormGroup>();
  private readonly strategyForms = new Map<string, FormGroup>();

  protected readonly subjectsVm$ = combineLatest([
    this.settingsService.getSubjects$(),
    this.resolveTeacherSubjectId$()
  ]).pipe(
    tap(([subjects, teacherSubjectId]) => {
      if (this.hasInitializedSubjectSelection) {
        return;
      }

      const initialSubjectId = teacherSubjectId && subjects.some((subject) => subject.id === teacherSubjectId)
        ? teacherSubjectId
        : '';

      this.hasInitializedSubjectSelection = true;
      this.selectedSubjectControl.setValue(initialSubjectId, { emitEvent: false });
      this.selectedSubjectIdSubject.next(initialSubjectId || null);
    }),
    map(
      ([subjects]): SubjectsViewModel => ({
        subjects,
        isLoading: false,
        errorMessage: ''
      })
    ),
    startWith({
      subjects: [],
      isLoading: true,
      errorMessage: ''
    }),
    catchError((error: unknown) =>
      of({
        subjects: [],
        isLoading: false,
        errorMessage: error instanceof Error ? error.message : 'Impossible de charger les matières.'
      })
    ),
    shareReplay(1)
  );

  protected readonly sectionsVm$ = this.selectedSubjectIdSubject.pipe(
    switchMap((subjectId) =>
      this.settingsService.getSections$().pipe(
        tap((sections) => {
          const selectedSectionId = this.selectedSectionIdSubject.value;
          const hasSelectedSection = selectedSectionId && sections.some((section) => section.id === selectedSectionId);

          if (hasSelectedSection) {
            return;
          }

          this.selectedLevel = sections[0]?.level ?? null;
          this.selectedLevelSubject.next(this.selectedLevel);
        }),
        map(
          (sections): SectionsViewModel => ({
            sections,
            isLoading: false,
            errorMessage: ''
          })
        ),
        startWith({
          sections: [],
          isLoading: true,
          errorMessage: ''
        }),
        catchError((error: unknown) =>
          of({
            sections: [],
            isLoading: false,
            errorMessage: error instanceof Error ? error.message : 'Impossible de charger les sections.'
          })
        )
      )
    ),
    shareReplay(1)
  );

  protected readonly yearProgramsVm$ = combineLatest([
    this.selectedSubjectIdSubject,
    this.sectionsVm$,
    this.selectedLevelSubject,
    this.refreshProgramSubject
  ]).pipe(
    switchMap(([subjectId, sectionsVm, selectedLevel]) => {
      if (sectionsVm.isLoading || selectedLevel === null) {
        return of<ProgramCatalogViewModel>({
          programs: [],
          isLoading: sectionsVm.isLoading,
          errorMessage: sectionsVm.errorMessage
        });
      }

      const sectionIds = new Set(
        sectionsVm.sections
          .filter((section) => section.level === selectedLevel)
          .map((section) => section.id)
      );

      return this.settingsService.getProgramCatalog$(subjectId).pipe(
        map(
          (programs): ProgramCatalogViewModel => ({
            programs: programs.filter((program) => sectionIds.has(program.section_id)),
            isLoading: false,
            errorMessage: ''
          })
        ),
        startWith({
          programs: [],
          isLoading: true,
          errorMessage: ''
        }),
        catchError((error: unknown) =>
          of({
            programs: [],
            isLoading: false,
            errorMessage: error instanceof Error ? error.message : 'Impossible de lister les programmes.'
          })
        )
      );
    }),
    shareReplay(1)
  );

  protected readonly networksVm$ = combineLatest([
    this.selectedSectionIdSubject,
    this.selectedSubjectIdSubject
  ]).pipe(
    switchMap(([sectionId, subjectId]) => {
      if (!sectionId) {
        return of<NetworksViewModel>({
          networks: [],
          isLoading: false,
          errorMessage: ''
        });
      }

      return this.settingsService.getNetworks$().pipe(
        tap((networks) => {
          const selectedNetworkId = this.selectedNetworkIdSubject.value;
          const hasSelectedNetwork = selectedNetworkId && networks.some((network) => network.id === selectedNetworkId);

          if (!hasSelectedNetwork) {
            this.selectedNetworkIdSubject.next(networks[0]?.id ?? null);
          }
        }),
        map(
          (networks): NetworksViewModel => ({
            networks,
            isLoading: false,
            errorMessage: ''
          })
        ),
        startWith({
          networks: [],
          isLoading: true,
          errorMessage: ''
        }),
        catchError((error: unknown) =>
          of({
            networks: [],
            isLoading: false,
            errorMessage: error instanceof Error ? error.message : 'Impossible de charger les réseaux.'
          })
        )
      );
    }),
    shareReplay(1)
  );

  protected readonly programVm$ = combineLatest([
    this.selectedSectionIdSubject,
    this.selectedNetworkIdSubject,
    this.selectedProgramIdSubject,
    this.selectedSubjectIdSubject,
    this.refreshProgramSubject
  ]).pipe(
    switchMap(([sectionId, networkId, programId, subjectId]) => {
      if (!sectionId || !networkId) {
        return of<ProgramViewModel>({
          program: null,
          isLoading: false,
          errorMessage: ''
        });
      }

      return this.settingsService.getProgramBySectionId$(sectionId, networkId, subjectId, programId, !programId).pipe(
        map(
          (program): ProgramViewModel => ({
            program,
            isLoading: false,
            errorMessage: ''
          })
        ),
        startWith({
          program: null,
          isLoading: true,
          errorMessage: ''
        }),
        catchError((error: unknown) =>
          of({
            program: null,
            isLoading: false,
            errorMessage: error instanceof Error ? error.message : 'Impossible de charger le programme.'
          })
        )
      );
    }),
    shareReplay(1)
  );

  protected readonly selectedNetworkName$ = combineLatest([
    this.networksVm$,
    this.selectedNetworkIdSubject
  ]).pipe(
    map(([networksVm, selectedNetworkId]) => {
      return networksVm.networks.find((network) => network.id === selectedNetworkId)?.name ?? null;
    })
  );

  protected readonly programCatalogVm$ = combineLatest([
    this.selectedSubjectIdSubject,
    this.programVm$,
    this.refreshProgramSubject
  ]).pipe(
    switchMap(([subjectId, programVm]) => {
      const currentProgramId = programVm.program?.program?.id ?? null;

      if (!this.isProgramEditing || !currentProgramId) {
        return of<ProgramCatalogViewModel>({
          programs: [],
          isLoading: false,
          errorMessage: ''
        });
      }

      return this.settingsService.getProgramCatalog$(subjectId, currentProgramId).pipe(
        tap((programs) => {
          this.lastProgramCatalog = programs;

          if (this.selectedSourceProgramId && !programs.some((program) => program.id === this.selectedSourceProgramId)) {
            this.selectSourceProgram('');
          }
        }),
        map(
          (programs): ProgramCatalogViewModel => ({
            programs,
            isLoading: false,
            errorMessage: ''
          })
        ),
        startWith({
          programs: [],
          isLoading: true,
          errorMessage: ''
        }),
        catchError((error: unknown) =>
          of({
            programs: [],
            isLoading: false,
            errorMessage: error instanceof Error ? error.message : 'Impossible de lister les programmes sources.'
          })
        )
      );
    }),
    shareReplay(1)
  );

  protected readonly sourceProgramVm$ = combineLatest([
    this.selectedSourceProgramIdSubject,
    this.refreshProgramSubject
  ]).pipe(
    switchMap(([sourceProgramId]) => {
      if (!sourceProgramId) {
        return of<ProgramViewModel>({
          program: null,
          isLoading: false,
          errorMessage: ''
        });
      }

      const source = this.lastProgramCatalog.find((program) => program.id === sourceProgramId);

      if (!source) {
        return of<ProgramViewModel>({
          program: null,
          isLoading: false,
          errorMessage: ''
        });
      }

      return this.settingsService.getProgramBySectionId$(source.section_id, source.network_id, source.subject_id, source.id).pipe(
        map(
          (program): ProgramViewModel => ({
            program,
            isLoading: false,
            errorMessage: ''
          })
        ),
        startWith({
          program: null,
          isLoading: true,
          errorMessage: ''
        }),
        catchError((error: unknown) =>
          of({
            program: null,
            isLoading: false,
            errorMessage: error instanceof Error ? error.message : 'Impossible de charger le programme source.'
          })
        )
      );
    }),
    shareReplay(1)
  );

  protected get selectedSectionId(): string {
    return this.selectedSectionIdSubject.value ?? '';
  }

  protected get selectedSubjectId(): string {
    return this.selectedSubjectIdSubject.value ?? '';
  }

  protected get selectedNetworkId(): string {
    return this.selectedNetworkIdSubject.value ?? '';
  }

  protected selectSubject(subjectId: string): void {
    if (this.selectedSubjectControl.value !== subjectId) {
      this.selectedSubjectControl.setValue(subjectId, { emitEvent: false });
    }

    this.selectedSubjectIdSubject.next(subjectId || null);
    this.selectedSectionIdSubject.next(null);
    this.selectedNetworkIdSubject.next(null);
    this.selectedProgramIdSubject.next(null);
    this.selectedLevel = null;
    this.selectedLevelSubject.next(null);
    this.expandedUaaId = null;
    this.closeProgramActions();
  }

  protected selectLevel(level: number): void {
    this.selectedLevel = level;
    this.selectedLevelSubject.next(level);
    this.selectedSectionIdSubject.next(null);
    this.selectedNetworkIdSubject.next(null);
    this.selectedProgramIdSubject.next(null);
    this.expandedUaaId = null;
    this.closeProgramActions();
  }

  protected selectCatalogProgram(program: ProgramCatalogItem): void {
    this.selectedSectionIdSubject.next(program.section_id);
    this.selectedNetworkIdSubject.next(program.network_id);
    this.selectedProgramIdSubject.next(program.id);
    this.expandedUaaId = null;
    this.closeProgramActions();
  }

  protected isSelectedCatalogProgram(program: ProgramCatalogItem): boolean {
    return this.selectedProgramIdSubject.value === program.id;
  }

  protected selectSectionForProgramCreation(sectionId: string): void {
    this.selectedSectionIdSubject.next(sectionId || null);
    this.selectedNetworkIdSubject.next(null);
    this.selectedProgramIdSubject.next(null);
    this.expandedUaaId = null;
    this.isProgramEditing = false;
    this.isProgramCreateOpen = true;
    this.programEditorError = '';
    this.programEditorMessage = '';
  }

  protected selectNetworkForProgramCreation(networkId: string): void {
    this.selectedNetworkIdSubject.next(networkId);
    this.selectedProgramIdSubject.next(null);
    this.expandedUaaId = null;
    this.isProgramEditing = false;
    this.isProgramCreateOpen = true;
    this.programEditorError = '';
    this.programEditorMessage = '';
  }

  protected selectSection(sectionId: string): void {
    this.selectedSectionIdSubject.next(sectionId || null);
    this.selectedNetworkIdSubject.next(null);
    this.selectedProgramIdSubject.next(null);
    this.expandedUaaId = null;
    this.closeProgramActions();
  }

  protected selectNetwork(networkId: string): void {
    this.selectedNetworkIdSubject.next(networkId);
    this.selectedProgramIdSubject.next(null);
    this.expandedUaaId = null;
    this.closeProgramActions();
  }

  protected isSelectedNetwork(networkId: string): boolean {
    return this.selectedNetworkIdSubject.value === networkId;
  }

  protected isSelectedSection(sectionId: string): boolean {
    return this.selectedSectionIdSubject.value === sectionId;
  }

  protected isSelectedLevel(level: number): boolean {
    return this.selectedLevel === level;
  }

  protected getSectionLevels(sections: Section[]): number[] {
    return Array.from(new Set(sections.map((section) => section.level))).sort((left, right) => left - right);
  }

  protected getSectionsForSelectedLevel(sections: Section[]): Section[] {
    if (this.selectedLevel === null) {
      return sections;
    }

    return sections.filter((section) => section.level === this.selectedLevel);
  }

  protected getLevelLabel(level: number): string {
    return level === 1 ? '1er' : `${level}e`;
  }

  protected orderedSkillGroups(groups: ProgramSkillGroup[]): ProgramSkillGroup[] {
    return [...groups].sort(
      (left, right) => this.resolveProcessOrder(left.processTypeName) - this.resolveProcessOrder(right.processTypeName)
    );
  }

  protected trackSkillGroup(group: ProgramSkillGroup): string {
    return `${group.processTypeId ?? 'unknown'}-${group.processTypeName}`;
  }

  protected getProcessTitle(processTypeName: string): string {
    switch (processTypeName) {
      case 'Connaître':
        return 'Processus · Connaître';
      case 'Appliquer':
        return 'Processus · Appliquer';
      case 'Transférer':
        return 'Processus · Transférer';
      default:
        return `Processus · ${processTypeName}`;
    }
  }

  protected toggleUaa(uaaId: string): void {
    this.expandedUaaId = this.expandedUaaId === uaaId ? null : uaaId;
  }

  protected isUaaExpanded(uaaId: string): boolean {
    return this.expandedUaaId === uaaId;
  }

  protected toggleProgramEditing(programSummary?: SectionProgram['program']): void {
    this.isProgramEditing = !this.isProgramEditing;
    this.isProgramCreateOpen = false;
    this.programEditorError = '';
    this.programEditorMessage = '';

    if (this.isProgramEditing && programSummary) {
      this.programDetailsForm.reset({
        name: programSummary.name ?? '',
        hours: programSummary.hours
      });
    }
  }

  protected toggleProgramCreation(): void {
    this.isProgramCreateOpen = !this.isProgramCreateOpen;
    this.isProgramEditing = false;
    this.programEditorError = '';
    this.programEditorMessage = '';
  }

  protected getSkillForm(uaaId: string): FormGroup {
    return this.getCachedForm(this.skillForms, uaaId, {
      processTypeName: ['Connaître', Validators.required],
      description: ['', Validators.required]
    });
  }

  protected getResourceForm(uaaId: string): FormGroup {
    return this.getDescriptionForm(this.resourceForms, uaaId);
  }

  protected getCompetenceForm(uaaId: string): FormGroup {
    return this.getDescriptionForm(this.competenceForms, uaaId);
  }

  protected getStrategyForm(uaaId: string): FormGroup {
    return this.getDescriptionForm(this.strategyForms, uaaId);
  }

  protected getItemKey(type: string, uaaId: string): string {
    return `${type}:${uaaId}`;
  }

  protected getActiveEditorStep(uaaId: string): ProgramEditorStep {
    return this.activeEditorStepByUaa.get(uaaId) ?? 'competences';
  }

  protected selectEditorStep(uaaId: string, step: ProgramEditorStep): void {
    this.activeEditorStepByUaa.set(uaaId, step);
  }

  protected isActiveEditorStep(uaaId: string, step: ProgramEditorStep): boolean {
    return this.getActiveEditorStep(uaaId) === step;
  }

  protected getEditorStepLabel(step: ProgramEditorStep): string {
    switch (step) {
      case 'competences':
        return 'Compétences';
      case 'resources':
        return 'Ressources';
      case 'know':
        return 'Connaître';
      case 'apply':
        return 'Appliquer';
      case 'transfer':
        return 'Transférer';
      case 'strategies':
        return 'Stratégies';
    }
  }

  protected toggleClonePanel(): void {
    this.isClonePanelOpen = !this.isClonePanelOpen;
    this.programEditorError = '';
    this.programEditorMessage = '';

    if (!this.isClonePanelOpen) {
      this.selectSourceProgram('');
    }
  }

  protected selectSourceProgram(programId: string): void {
    this.selectedSourceProgramId = programId;
    this.selectedSourceProgramIdSubject.next(programId);
    this.selectedSourceUaaIds = [];
  }

  protected getSelectedSourceProgram(programs: ProgramCatalogItem[]): ProgramCatalogItem | null {
    return programs.find((program) => program.id === this.selectedSourceProgramId) ?? null;
  }

  protected isSourceUaaSelected(uaaId: string): boolean {
    return this.selectedSourceUaaIds.includes(uaaId);
  }

  protected toggleSourceUaa(uaaId: string, checked: boolean): void {
    this.selectedSourceUaaIds = checked
      ? Array.from(new Set([...this.selectedSourceUaaIds, uaaId]))
      : this.selectedSourceUaaIds.filter((id) => id !== uaaId);
  }

  protected cloneSelectedUaas(targetProgramId: string): void {
    if (this.selectedSourceUaaIds.length === 0 || this.isCloningUaas) {
      return;
    }

    this.isCloningUaas = true;
    this.programEditorError = '';
    this.programEditorMessage = '';

    this.settingsService.cloneProgramUaas$(targetProgramId, this.selectedSourceUaaIds).subscribe({
      next: (result) => {
        const count = result.ids.length;
        this.isCloningUaas = false;
        this.programEditorMessage = `${count} UAA copiée${count > 1 ? 's' : ''}.`;
        this.selectSourceProgram('');
        this.isClonePanelOpen = false;
        this.refreshProgramSubject.next();
      },
      error: (error: unknown) => {
        this.isCloningUaas = false;
        this.programEditorError = error instanceof Error ? error.message : 'Impossible de copier les UAA.';
      }
    });
  }

  protected createProgram(): void {
    if (this.programForm.invalid || this.isSavingProgram || !this.selectedSubjectId || !this.selectedSectionId || !this.selectedNetworkId) {
      this.programForm.markAllAsTouched();
      return;
    }

    this.isSavingProgram = true;
    this.programEditorError = '';
    this.programEditorMessage = '';

    const rawValue = this.programForm.getRawValue();

    this.settingsService.createProgram$({
      subjectId: this.selectedSubjectId,
      sectionId: this.selectedSectionId,
      networkId: this.selectedNetworkId,
      hours: Number(rawValue.hours),
      name: rawValue.name?.trim() || null,
      validFrom: rawValue.validFrom || null,
      validTo: rawValue.validTo || null
    }).subscribe({
      next: (result) => {
        this.isSavingProgram = false;
        this.isProgramCreateOpen = false;
        this.isProgramEditing = true;
        this.programEditorMessage = 'Le programme a bien été créé.';
        this.selectedProgramIdSubject.next(result.id);
        this.programForm.reset({
          name: '',
          hours: null,
          validFrom: '',
          validTo: ''
        });
        this.refreshProgramSubject.next();
      },
      error: (error: unknown) => {
        this.isSavingProgram = false;
        this.programEditorError = error instanceof Error ? error.message : 'Impossible de créer le programme.';
      }
    });
  }

  protected updateProgram(programId: string): void {
    if (this.programDetailsForm.invalid || this.isSavingProgramDetails) {
      this.programDetailsForm.markAllAsTouched();
      return;
    }

    this.isSavingProgramDetails = true;
    this.programEditorError = '';
    this.programEditorMessage = '';

    const rawValue = this.programDetailsForm.getRawValue();

    this.settingsService.updateProgram$({
      programId,
      hours: Number(rawValue.hours),
      name: rawValue.name?.trim() || null
    }).subscribe({
      next: () => {
        this.isSavingProgramDetails = false;
        this.programEditorMessage = 'Le programme a bien été mis à jour.';
        this.refreshProgramSubject.next();
      },
      error: (error: unknown) => {
        this.isSavingProgramDetails = false;
        this.programEditorError = error instanceof Error ? error.message : 'Impossible de modifier le programme.';
      }
    });
  }

  protected addUaa(programId: string): void {
    if (this.uaaForm.invalid || this.isSavingUaa) {
      this.uaaForm.markAllAsTouched();
      return;
    }

    this.isSavingUaa = true;
    this.programEditorError = '';
    this.programEditorMessage = '';

    const rawValue = this.uaaForm.getRawValue();

    this.settingsService.createProgramUaa$({
      programId,
      code: rawValue.code?.trim() || '',
      name: rawValue.name?.trim() || ''
    }).subscribe({
      next: (uaa) => {
        this.isSavingUaa = false;
        this.programEditorMessage = 'L’UAA a bien été ajoutée.';
        this.expandedUaaId = uaa.id;
        this.activeEditorStepByUaa.set(uaa.id, 'competences');
        this.uaaForm.reset({
          code: '',
          name: ''
        });
        this.refreshProgramSubject.next();
      },
      error: (error: unknown) => {
        this.isSavingUaa = false;
        this.programEditorError = error instanceof Error ? error.message : 'Impossible d’ajouter l’UAA.';
      }
    });
  }

  protected addSkill(uaaId: string, processTypeName?: string): void {
    const form = this.getSkillForm(uaaId);

    if (form.invalid) {
      form.markAllAsTouched();
      return;
    }

    const rawValue = form.getRawValue() as { processTypeName?: string; description: string };
    const descriptions = this.getInputLines(rawValue.description);

    if (descriptions.length === 0) {
      this.programEditorError = 'Ajoute au moins une ligne à enregistrer.';
      return;
    }

    this.saveUaaItem(this.getItemKey('skill', uaaId), () =>
      descriptions.map((description) =>
        this.settingsService.createProgramSkill$({
          uaaId,
          processTypeName: processTypeName || rawValue.processTypeName || 'Connaître',
          description
        })
      ),
      form,
      (count) => `${count} compétence${count > 1 ? 's' : ''} de processus ajoutée${count > 1 ? 's' : ''}.`
    );
  }

  protected addResource(uaaId: string): void {
    this.addDescriptionItem(
      this.getResourceForm(uaaId),
      this.getItemKey('resource', uaaId),
      (description) => this.settingsService.createProgramResource$({ uaaId, description }),
      (count) => `${count} ressource${count > 1 ? 's' : ''} ajoutée${count > 1 ? 's' : ''}.`
    );
  }

  protected addCompetence(uaaId: string): void {
    this.addDescriptionItem(
      this.getCompetenceForm(uaaId),
      this.getItemKey('competence', uaaId),
      (description) => this.settingsService.createProgramCompetence$({ uaaId, description }),
      (count) => `${count} compétence${count > 1 ? 's' : ''} ajoutée${count > 1 ? 's' : ''}.`
    );
  }

  protected addStrategy(uaaId: string): void {
    this.addDescriptionItem(
      this.getStrategyForm(uaaId),
      this.getItemKey('strategy', uaaId),
      (description) => this.settingsService.createProgramStrategy$({ uaaId, description }),
      (count) => `${count} stratégie${count > 1 ? 's' : ''} ajoutée${count > 1 ? 's' : ''}.`
    );
  }

  protected deleteProgramItem(itemType: ProgramItemType, itemId: string): void {
    const itemKey = this.getItemKey(itemType, itemId);

    if (this.deletingItemKey) {
      return;
    }

    this.deletingItemKey = itemKey;
    this.programEditorError = '';
    this.programEditorMessage = '';

    this.settingsService.deleteProgramItem$({ itemId, itemType }).subscribe({
      next: () => {
        this.deletingItemKey = '';
        this.programEditorMessage = 'L’élément a bien été supprimé.';
        this.refreshProgramSubject.next();
      },
      error: (error: unknown) => {
        this.deletingItemKey = '';
        this.programEditorError = error instanceof Error ? error.message : 'Impossible de supprimer l’élément.';
      }
    });
  }

  protected startProgramItemEdit(itemType: ProgramItemType, itemId: string, description: string): void {
    if (this.updatingItemKey || this.deletingItemKey) {
      return;
    }

    this.editingItemKey = this.getItemKey(itemType, itemId);
    this.editingItemDescription = description;
    this.programEditorError = '';
    this.programEditorMessage = '';
  }

  protected cancelProgramItemEdit(): void {
    this.editingItemKey = '';
    this.editingItemDescription = '';
  }

  protected isEditingProgramItem(itemType: ProgramItemType, itemId: string): boolean {
    return this.editingItemKey === this.getItemKey(itemType, itemId);
  }

  protected updateProgramItem(itemType: ProgramItemType, itemId: string): void {
    const itemKey = this.getItemKey(itemType, itemId);
    const description = this.editingItemDescription.trim();

    if (!description) {
      this.programEditorError = 'Le texte modifié ne peut pas être vide.';
      return;
    }

    if (this.updatingItemKey) {
      return;
    }

    this.updatingItemKey = itemKey;
    this.programEditorError = '';
    this.programEditorMessage = '';

    this.settingsService.updateProgramItem$({ itemId, itemType, description }).subscribe({
      next: () => {
        this.updatingItemKey = '';
        this.cancelProgramItemEdit();
        this.programEditorMessage = 'L’élément a bien été modifié.';
        this.refreshProgramSubject.next();
      },
      error: (error: unknown) => {
        this.updatingItemKey = '';
        this.programEditorError = error instanceof Error ? error.message : 'Impossible de modifier l’élément.';
      }
    });
  }

  private resolveProcessOrder(processTypeName: string): number {
    const index = this.processOrder.indexOf(processTypeName);
    return index === -1 ? this.processOrder.length : index;
  }

  private closeProgramActions(): void {
    this.isProgramEditing = false;
    this.isProgramCreateOpen = false;
    this.isClonePanelOpen = false;
    this.selectSourceProgram('');
    this.programEditorError = '';
    this.programEditorMessage = '';
  }

  private getDescriptionForm(collection: Map<string, FormGroup>, uaaId: string): FormGroup {
    return this.getCachedForm(collection, uaaId, {
      description: ['', Validators.required]
    });
  }

  private getCachedForm(collection: Map<string, FormGroup>, key: string, controls: Record<string, unknown>): FormGroup {
    const currentForm = collection.get(key);

    if (currentForm) {
      return currentForm;
    }

    const form = this.formBuilder.group(controls);
    collection.set(key, form);
    return form;
  }

  private addDescriptionItem(
    form: FormGroup,
    savingKey: string,
    createItem: (description: string) => ReturnType<SettingsService['createProgramResource$']>,
    buildSuccessMessage: (count: number) => string
  ): void {
    if (form.invalid) {
      form.markAllAsTouched();
      return;
    }

    const rawValue = form.getRawValue() as { description: string };
    const descriptions = this.getInputLines(rawValue.description);

    if (descriptions.length === 0) {
      this.programEditorError = 'Ajoute au moins une ligne à enregistrer.';
      return;
    }

    this.saveUaaItem(savingKey, () => descriptions.map((description) => createItem(description)), form, buildSuccessMessage);
  }

  private saveUaaItem(
    savingKey: string,
    createItems: () => Array<ReturnType<SettingsService['createProgramResource$']>>,
    form: FormGroup,
    buildSuccessMessage: (count: number) => string
  ): void {
    if (this.savingItemKey) {
      return;
    }

    this.savingItemKey = savingKey;
    this.programEditorError = '';
    this.programEditorMessage = '';

    const requests = createItems();

    if (requests.length === 0) {
      this.savingItemKey = '';
      this.programEditorError = 'Ajoute au moins une ligne à enregistrer.';
      return;
    }

    forkJoin(requests).subscribe({
      next: (items) => {
        this.savingItemKey = '';
        this.programEditorMessage = buildSuccessMessage(items.length);
        form.reset();

        if (form.controls['processTypeName']) {
          form.patchValue({
            processTypeName: 'Connaître'
          });
        }

        this.refreshProgramSubject.next();
      },
      error: (error: unknown) => {
        this.savingItemKey = '';
        this.programEditorError = error instanceof Error ? error.message : 'Impossible d’ajouter l’élément.';
      }
    });
  }

  private getInputLines(value: string | null | undefined): string[] {
    return (value ?? '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  private resolveTeacherSubjectId$() {
    return this.settingsService.getTeachers$().pipe(
      switchMap((teachers) =>
        this.loadCurrentUser().then((currentUser) => {
          const teacher = teachers.find(
            (item: Teacher) => item.email?.trim().toLowerCase() === currentUser.email.trim().toLowerCase()
          );

          return teacher?.subject_id ?? null;
        })
      ),
      catchError(() => of(null))
    );
  }

  private async loadCurrentUser(): Promise<CurrentUser> {
    const response = await apiFetch('/me', { method: 'GET' });
    const payload = (await response.json().catch(() => null)) as
      | { user?: CurrentUser }
      | null;

    if (!response.ok || !payload?.user) {
      throw new Error('Impossible de charger le compte connecté.');
    }

    return payload.user;
  }
}
