import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BehaviorSubject, catchError, combineLatest, map, of, shareReplay, startWith, switchMap, tap } from 'rxjs';
import { ProgramNetwork, ProgramSkillGroup, SectionProgram } from '../../../models/Program';
import { Section } from '../../../models/Section';
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

@Component({
  selector: 'app-settings-program-page',
  imports: [AsyncPipe, RouterLink],
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
            Sélectionne d’abord une section puis un réseau pour afficher le programme détaillé.
          </p>
        </div>
      </div>

      <section class="rounded-[1.8rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
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
                  <p class="mt-1 text-sm text-slate-500">Choisis le degré/année avant de sélectionner la section.</p>
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
                        (click)="selectLevel(level, sectionsVm.sections)"
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
                    <p class="text-sm font-medium text-slate-800">Section</p>
                    <p class="mt-1 text-sm text-slate-500">Choisis maintenant le programme précis à consulter.</p>
                  </div>

                  <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    @for (section of getSectionsForSelectedLevel(sectionsVm.sections); track section.id) {
                      <button
                        type="button"
                        (click)="selectSection(section.id)"
                        class="rounded-2xl border p-4 text-left transition"
                        [class.border-sky-300]="isSelectedSection(section.id)"
                        [class.bg-sky-50]="isSelectedSection(section.id)"
                        [class.border-slate-200]="!isSelectedSection(section.id)"
                        [class.bg-white]="!isSelectedSection(section.id)"
                      >
                        <p class="text-xs font-medium tracking-[0.18em] text-slate-500 uppercase">
                          {{ section.type }} · {{ section.level }}e
                        </p>
                        <p class="mt-2 text-base font-semibold text-slate-950">{{ section.code }}</p>
                        <p class="mt-1 text-sm leading-6 text-slate-600">{{ section.label }}</p>
                      </button>
                    }
                  </div>
                </div>
              }

              @if (networksVm$ | async; as networksVm) {
                <div class="space-y-3">
                  <div>
                    <p class="text-sm font-medium text-slate-800">Réseau</p>
                    <p class="mt-1 text-sm text-slate-500">Choisis le réseau avant d’afficher le programme.</p>
                  </div>

                  @if (networksVm.errorMessage) {
                    <div class="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                      {{ networksVm.errorMessage }}
                    </div>
                  } @else if (networksVm.isLoading) {
                    <div class="flex gap-2 overflow-x-auto pb-1">
                      @for (item of [1, 2, 3]; track item) {
                        <div class="h-11 w-28 shrink-0 animate-pulse rounded-2xl bg-slate-100"></div>
                      }
                    </div>
                  } @else if (networksVm.networks.length === 0) {
                    <div class="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                      Aucun réseau disponible pour cette section.
                    </div>
                  } @else {
                    <div class="flex gap-2 overflow-x-auto pb-1">
                      @for (network of networksVm.networks; track network.id) {
                        <button
                          type="button"
                          (click)="selectNetwork(network.id)"
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
            </div>
          }
        }
      </section>

      @if (programVm$ | async; as programVm) {
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
              <p class="text-sm font-medium tracking-[0.18em] text-sky-700 uppercase">Programme affiché</p>
              <h3 class="mt-2 text-2xl font-semibold text-slate-950">{{ program.section.label }}</h3>
              <p class="mt-2 text-sm text-slate-600">
                {{ program.section.code }}
                @if (program.program; as programSummary) {
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
                    <div class="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
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
                                      <li class="rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-800">
                                        {{ skill.description }}
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

                      <aside class="rounded-[1.5rem] border border-sky-100 bg-sky-50/60 p-4">
                        <p class="text-sm font-semibold text-slate-900">Ressources</p>

                        @if (uaa.resources.length > 0) {
                          <ul class="mt-3 space-y-2">
                            @for (resource of uaa.resources; track resource.id) {
                              <li class="rounded-2xl bg-white px-4 py-3 text-sm leading-6 text-slate-800 shadow-sm">
                                {{ resource.description }}
                              </li>
                            }
                          </ul>
                        } @else {
                          <p class="mt-3 text-sm text-slate-500">Aucune ressource renseignée.</p>
                        }
                      </aside>
                    </div>

                    @if (uaa.competences.length > 0) {
                      <div class="mt-5">
                        <p class="text-sm font-semibold text-slate-900">Compétences à développer</p>
                        <ul class="mt-3 space-y-2">
                          @for (competence of uaa.competences; track competence.id) {
                            <li class="rounded-2xl bg-emerald-50 px-4 py-3 text-sm leading-6 text-slate-800">
                              {{ competence.description }}
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
                            <li class="rounded-2xl bg-amber-50 px-4 py-3 text-sm leading-6 text-slate-800">
                              {{ strategy.description }}
                            </li>
                          }
                        </ul>
                      </div>
                    }
                  }
                </article>
              }
            }
          </section>
        } @else {
          <div class="rounded-[1.8rem] border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-500">
            Sélectionne une section et un réseau pour afficher le programme.
          </div>
        }
      }
    </section>
  `
})
export class SettingsProgramPageComponent {
  private readonly settingsService = inject(SettingsService);
  private readonly selectedSectionIdSubject = new BehaviorSubject<string | null>(null);
  private readonly selectedNetworkIdSubject = new BehaviorSubject<string | null>(null);
  private readonly processOrder = ['Connaître', 'Appliquer', 'Transférer'];
  protected selectedLevel: number | null = null;
  protected expandedUaaId: string | null = null;

  protected readonly sectionsVm$ = this.settingsService.getSections$().pipe(
    tap((sections) => {
      if (!this.selectedSectionIdSubject.value && sections.length > 0) {
        this.selectedLevel = sections[0].level;
        this.selectedSectionIdSubject.next(sections[0].id);
      }
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
    ),
    shareReplay(1)
  );

  protected readonly networksVm$ = this.selectedSectionIdSubject.pipe(
    switchMap((sectionId) => {
      if (!sectionId) {
        return of<NetworksViewModel>({
          networks: [],
          isLoading: false,
          errorMessage: ''
        });
      }

      return this.settingsService.getProgramNetworksBySectionId$(sectionId).pipe(
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
    this.selectedNetworkIdSubject
  ]).pipe(
    switchMap(([sectionId, networkId]) => {
      if (!sectionId || !networkId) {
        return of<ProgramViewModel>({
          program: null,
          isLoading: false,
          errorMessage: ''
        });
      }

      return this.settingsService.getProgramBySectionId$(sectionId, networkId).pipe(
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

  protected get selectedSectionId(): string {
    return this.selectedSectionIdSubject.value ?? '';
  }

  protected selectLevel(level: number, sections: Section[]): void {
    this.selectedLevel = level;

    const nextSection = this.getSectionsForSelectedLevel(sections)[0] ?? null;
    this.selectSection(nextSection?.id ?? '');
  }

  protected selectSection(sectionId: string): void {
    this.selectedSectionIdSubject.next(sectionId || null);
    this.selectedNetworkIdSubject.next(null);
    this.expandedUaaId = null;
  }

  protected selectNetwork(networkId: string): void {
    this.selectedNetworkIdSubject.next(networkId);
    this.expandedUaaId = null;
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

  private resolveProcessOrder(processTypeName: string): number {
    const index = this.processOrder.indexOf(processTypeName);
    return index === -1 ? this.processOrder.length : index;
  }
}
