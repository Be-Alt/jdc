import { AsyncPipe, NgClass } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { combineLatest, map, of, startWith, switchMap, catchError } from 'rxjs';
import { SchoolYear } from '../../../models/SchoolYear';
import { Student } from '../../../models/Student';
import { GeneralService } from '../../../services/general.service';
import { StudentsService } from '../../../services/students.service';

type StudentsViewModel = {
  schoolYears: SchoolYear[];
  selectedSchoolYear: SchoolYear | null;
  showArchives: boolean;
  students: Student[];
  isLoading: boolean;
  errorMessage: string;
};

@Component({
  selector: 'app-students',
  imports: [AsyncPipe, NgClass, RouterLink],
  template: `
    <section class="space-y-6">
      <div class="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p class="text-sm font-medium tracking-[0.2em] text-sky-700 uppercase">Élèves</p>
          <h2 class="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Liste des élèves</h2>
          <p class="mt-3 max-w-3xl text-base leading-7 text-slate-600">
            L’année scolaire en cours est sélectionnée par défaut. Tu peux ensuite afficher les archives et
            basculer sur une autre année quand tu en auras besoin.
          </p>
        </div>

        <div class="flex flex-wrap gap-3">
          <a
            routerLink="/dashboard/students/new"
            class="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Ajouter un élève
          </a>

          <button
            type="button"
            (click)="toggleArchives()"
            class="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-800 transition hover:bg-slate-50"
          >
            {{ (showArchives$ | async) ? 'Masquer les archives' : 'Afficher les archives' }}
          </button>
        </div>
      </div>

      @if (vm$ | async; as vm) {
        <div class="space-y-4">
            <div class="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p class="text-sm font-medium text-slate-500">Année sélectionnée</p>
                  <h3 class="mt-2 text-2xl font-semibold text-slate-950">
                    {{ vm.selectedSchoolYear?.label || 'Aucune année disponible' }}
                  </h3>
                </div>
                @if (vm.selectedSchoolYear) {
                  <div class="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-600">
                    {{ vm.students.length }} élève{{ vm.students.length > 1 ? 's' : '' }} chargé{{ vm.students.length > 1 ? 's' : '' }}
                  </div>
                }
              </div>
            </div>

            @if (vm.errorMessage) {
              <div class="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {{ vm.errorMessage }}
              </div>
            } @else if (vm.isLoading) {
              <div class="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
                @for (item of skeletonItems; track item) {
                  <div class="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm">
                    <div class="h-4 w-16 animate-pulse rounded bg-slate-200"></div>
                    <div class="mt-4 h-5 w-24 animate-pulse rounded bg-slate-100"></div>
                    <div class="mt-3 h-4 w-20 animate-pulse rounded bg-slate-100"></div>
                  </div>
                }
              </div>
            } @else if (!vm.selectedSchoolYear) {
              <div class="rounded-[1.8rem] border border-slate-200 bg-white p-6 shadow-sm">
                <p class="text-base text-slate-600">Aucune année scolaire n’est disponible pour le moment.</p>
              </div>
            } @else if (vm.students.length === 0) {
              <div class="rounded-[1.8rem] border border-slate-200 bg-white p-6 shadow-sm">
                <p class="text-base text-slate-600">
                  Aucun élève n’a encore été trouvé pour l’année {{ vm.selectedSchoolYear.label }}.
                </p>
              </div>
            } @else {
              <div class="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
                @for (student of vm.students; track student.enrollment_id) {
                  <article
                    [routerLink]="['/dashboard/students', student.enrollment_id]"
                    class="cursor-pointer rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-md"
                  >
                    <div class="flex items-start justify-end">
                      <span class="rounded-full px-2.5 py-1 text-[11px] font-medium"
                        [ngClass]="
                          student.status === 'active'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-100 text-slate-600'
                        "
                      >
                        {{ student.status }}
                      </span>
                    </div>

                    <h4 class="mt-4 text-sm font-semibold leading-5 text-slate-950 sm:text-base">
                      {{ student.first_name }} {{ student.last_name }}
                    </h4>
                    <p class="mt-2 text-sm leading-5 text-slate-600">
                      {{ student.section_code || student.section_label || 'Section non définie' }}
                    </p>
                  </article>
                }
              </div>
            }

            <section class="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p class="text-sm font-medium text-slate-500">Années scolaires</p>
                  <p class="mt-1 text-sm text-slate-600">
                    {{ vm.showArchives ? 'Toutes les années disponibles' : 'Basculer rapidement vers une autre année' }}
                  </p>
                </div>

                <div class="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                  {{ vm.schoolYears.length }}
                </div>
              </div>

              <div class="mt-4 flex gap-3 overflow-x-auto pb-1">
                @for (schoolYear of vm.schoolYears; track schoolYear.id) {
                  <button
                    type="button"
                    (click)="selectSchoolYear(schoolYear.id)"
                    class="min-w-44 shrink-0 rounded-2xl border px-4 py-4 text-left transition"
                    [ngClass]="
                      vm.selectedSchoolYear?.id === schoolYear.id
                        ? 'border-sky-200 bg-sky-50 text-sky-950'
                        : 'border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100'
                    "
                  >
                    <div class="flex items-start justify-between gap-3">
                      <div>
                        <p class="font-semibold">{{ schoolYear.label }}</p>
                        <p class="mt-1 text-sm text-slate-500">
                          {{ schoolYear.student_count }} élève{{ schoolYear.student_count > 1 ? 's' : '' }}
                        </p>
                      </div>
                      @if (vm.selectedSchoolYear?.id === schoolYear.id) {
                        <span class="rounded-full bg-sky-600 px-2 py-1 text-xs font-medium text-white">active</span>
                      }
                    </div>
                  </button>
                }
              </div>
            </section>
        </div>
      }
    </section>
  `,
  styles: ``
})
export class Students {
  private readonly generalService = inject(GeneralService);
  private readonly studentsService = inject(StudentsService);

  protected readonly showArchives$ = this.generalService.showArchives$;
  protected readonly skeletonItems = [1, 2, 3, 4];
  protected readonly vm$ = combineLatest([
    this.generalService.visibleSchoolYears$,
    this.generalService.selectedSchoolYear$,
    this.generalService.showArchives$
  ]).pipe(
    switchMap(([schoolYears, selectedSchoolYear, showArchives]) => {
      if (!selectedSchoolYear) {
        return of({
          schoolYears,
          selectedSchoolYear,
          showArchives,
          students: [],
          isLoading: false,
          errorMessage: ''
        } satisfies StudentsViewModel);
      }

      return this.studentsService.getStudentsBySchoolYearId$(selectedSchoolYear.id).pipe(
        map((students) => ({
          schoolYears,
          selectedSchoolYear,
          showArchives,
          students,
          isLoading: false,
          errorMessage: ''
        })),
        startWith({
          schoolYears,
          selectedSchoolYear,
          showArchives,
          students: [],
          isLoading: true,
          errorMessage: ''
        } satisfies StudentsViewModel),
        catchError((error: unknown) =>
          of({
            schoolYears,
            selectedSchoolYear,
            showArchives,
            students: [],
            isLoading: false,
            errorMessage:
              error instanceof Error
                ? error.message
                : 'Impossible de charger les élèves pour cette année.'
          } satisfies StudentsViewModel)
        )
      );
    })
  );

  protected selectSchoolYear(schoolYearId: string): void {
    this.generalService.setSelectedSchoolYear(schoolYearId);
  }

  protected toggleArchives(): void {
    this.generalService.toggleArchives();
  }
}
