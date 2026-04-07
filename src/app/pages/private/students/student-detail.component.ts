import { AsyncPipe, DatePipe, NgClass } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { getDysIconConfig } from '../../../helpers/dys-icons';
import { BehaviorSubject, catchError, combineLatest, map, of, startWith, switchMap } from 'rxjs';
import { Student } from '../../../models/Student';
import { StudentsService } from '../../../services/students.service';

type StudentDetailViewModel = {
  student: Student | null;
  isLoading: boolean;
  errorMessage: string;
  successMessage: string;
};

@Component({
  selector: 'app-student-detail',
  imports: [AsyncPipe, DatePipe, NgClass, RouterLink],
  template: `
    <section class="space-y-6">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <a
            routerLink="/dashboard/students"
            class="inline-flex items-center gap-2 text-sm font-medium text-sky-700 transition hover:text-sky-800"
          >
            ← Retour à la liste
          </a>
          <p class="mt-4 text-sm font-medium tracking-[0.2em] text-sky-700 uppercase">Fiche élève</p>
          @if (vm$ | async; as vm) {
            <h2 class="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              {{ vm.student ? vm.student.first_name + ' ' + vm.student.last_name : 'Chargement...' }}
            </h2>
          }
        </div>

        <div class="flex flex-wrap gap-3">
          <button
            type="button"
            (click)="goToEdit()"
            class="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Modifier
          </button>
        </div>
      </div>

      @if (vm$ | async; as vm) {
        @if (vm.errorMessage) {
          <div class="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {{ vm.errorMessage }}
          </div>
        }

        @if (vm.successMessage) {
          <div class="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {{ vm.successMessage }}
          </div>
        }

        @if (vm.isLoading) {
          <div class="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <div class="rounded-[1.8rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div class="h-6 w-44 animate-pulse rounded bg-slate-200"></div>
              <div class="mt-4 h-10 w-72 animate-pulse rounded bg-slate-100"></div>
              <div class="mt-6 h-28 animate-pulse rounded-3xl bg-slate-50"></div>
            </div>
            <div class="rounded-[1.8rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div class="h-6 w-32 animate-pulse rounded bg-slate-200"></div>
              <div class="mt-4 h-28 animate-pulse rounded-3xl bg-slate-50"></div>
            </div>
          </div>
        } @else if (vm.student) {
          <div class="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <article class="rounded-[1.8rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div class="flex items-start justify-between gap-4">
                <div>
                  <p class="text-sm font-medium text-slate-500">
                    {{ vm.student.section_code || vm.student.section_label || 'Section non définie' }}
                  </p>
                  <h3 class="mt-2 text-3xl font-semibold text-slate-950">
                    {{ vm.student.first_name }} {{ vm.student.last_name }}
                  </h3>
                  <p class="mt-3 text-base leading-7 text-slate-600">
                    {{ vm.student.section_label || 'Aucune section renseignée pour le moment.' }}
                  </p>
                </div>

                <span
                  class="rounded-full px-3 py-1 text-xs font-medium"
                  [ngClass]="
                    vm.student.status === 'active'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-100 text-slate-600'
                  "
                >
                  {{ vm.student.status }}
                </span>
              </div>

              <div class="mt-6 grid gap-3 md:grid-cols-2">
                <div class="rounded-2xl bg-slate-50 px-4 py-4">
                  <p class="font-medium text-slate-800">Année scolaire</p>
                  <p class="mt-1 text-slate-600">{{ vm.student.school_year_label }}</p>
                </div>
                <div class="rounded-2xl bg-slate-50 px-4 py-4">
                  <p class="font-medium text-slate-800">Date de naissance</p>
                  <p class="mt-1 text-slate-600">
                    {{ vm.student.birth_date ? (vm.student.birth_date | date: 'dd/MM/yyyy') : 'Non renseignée' }}
                  </p>
                </div>
                <div class="rounded-2xl bg-slate-50 px-4 py-4">
                  <p class="font-medium text-slate-800">École</p>
                  <p class="mt-1 text-slate-600">{{ vm.student.school_name || 'Non renseignée' }}</p>
                </div>
              </div>

              <div class="mt-6 rounded-2xl bg-slate-50 px-4 py-4">
                <div class="flex items-center justify-between gap-3">
                  <p class="font-medium text-slate-800">Professeurs liés</p>
                  <span class="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600">
                    {{ vm.student.teacher_names.length }}
                  </span>
                </div>

                @if (vm.student.teacher_names.length > 0) {
                  <div class="mt-4 flex flex-wrap gap-2">
                    @for (teacherName of vm.student.teacher_names; track teacherName) {
                      <span class="inline-flex items-center rounded-full bg-white px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200">
                        {{ teacherName }}
                      </span>
                    }
                  </div>
                } @else {
                  <p class="mt-3 text-sm text-slate-600">Aucun professeur lié pour le moment.</p>
                }
              </div>

              <div class="mt-6 rounded-2xl bg-slate-50 px-4 py-4">
                <div class="flex items-center justify-between gap-3">
                  <p class="font-medium text-slate-800">DYS associés</p>
                  <span class="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600">
                    {{ vm.student.dys_names.length }}
                  </span>
                </div>

                @if (vm.student.dys_names.length > 0) {
                  <div class="mt-4 flex flex-wrap gap-2">
                    @for (dysName of vm.student.dys_names; track dysName) {
                      <span
                        class="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium"
                        [class]="getDysIconConfig(dysName).bgClass + ' ' + getDysIconConfig(dysName).textClass"
                      >
                        <span class="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/80 text-xs font-semibold">
                          {{ getDysIconConfig(dysName).icon }}
                        </span>
                        <span>{{ dysName }}</span>
                      </span>
                    }
                  </div>
                } @else {
                  <p class="mt-3 text-sm text-slate-600">Aucun DYS renseigné pour le moment.</p>
                }
              </div>

              <div class="mt-6 rounded-2xl bg-slate-50 px-4 py-4">
                <div class="flex items-center justify-between gap-3">
                  <p class="font-medium text-slate-800">Aménagements en place</p>
                  <span class="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600">
                    {{ vm.student.accommodation_names.length }}
                  </span>
                </div>

                @if (vm.student.accommodation_names.length > 0) {
                  <div class="mt-4 space-y-2">
                    @for (accommodationName of vm.student.accommodation_names; track accommodationName) {
                      <div class="flex items-start gap-3 rounded-2xl bg-white px-4 py-3 text-sm text-slate-700 ring-1 ring-slate-200">
                        <span class="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700">
                          ✓
                        </span>
                        <span>{{ accommodationName }}</span>
                      </div>
                    }
                  </div>
                } @else {
                  <p class="mt-3 text-sm text-slate-600">Aucun aménagement coché pour le moment.</p>
                }
              </div>
            </article>

            <article class="rounded-[1.8rem] border border-slate-200 bg-white p-6 shadow-sm">
              <p class="text-sm font-medium tracking-[0.2em] text-slate-500 uppercase">Section</p>
              <div class="mt-4 space-y-4">
                <div class="rounded-2xl bg-slate-50 px-4 py-4">
                  <p class="font-medium text-slate-800">Code</p>
                  <p class="mt-1 text-slate-600">{{ vm.student.section_code || 'Non renseigné' }}</p>
                </div>
                <div class="rounded-2xl bg-slate-50 px-4 py-4">
                  <p class="font-medium text-slate-800">Niveau</p>
                  <p class="mt-1 text-slate-600">
                    {{ vm.student.section_level !== null ? vm.student.section_level + 'e' : 'Non renseigné' }}
                  </p>
                </div>
                <div class="rounded-2xl bg-slate-50 px-4 py-4">
                  <p class="font-medium text-slate-800">Type</p>
                  <p class="mt-1 text-slate-600">{{ vm.student.section_type || 'Non renseigné' }}</p>
                </div>
              </div>
            </article>
          </div>
        }
      }
    </section>
  `
})
export class StudentDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly studentsService = inject(StudentsService);

  private readonly refreshSubject = new BehaviorSubject<void>(undefined);
  private readonly successMessageSubject = new BehaviorSubject<string>('');
  private readonly errorMessageSubject = new BehaviorSubject<string>('');

  protected readonly vm$ = combineLatest([
    this.route.paramMap.pipe(map((params) => params.get('id') ?? '')),
    this.refreshSubject,
    this.successMessageSubject,
    this.errorMessageSubject
  ]).pipe(
    switchMap(([enrollmentId, _refresh, successMessage, errorMessage]) =>
      this.studentsService.getStudentByEnrollmentId$(enrollmentId).pipe(
        map((student) => ({
          student,
          isLoading: false,
          errorMessage,
          successMessage
        })),
        startWith({
          student: null,
          isLoading: true,
          errorMessage,
          successMessage
        } satisfies StudentDetailViewModel),
        catchError((error: unknown) =>
          of({
            student: null,
            isLoading: false,
            errorMessage:
              error instanceof Error ? error.message : 'Impossible de charger la fiche élève.',
            successMessage: ''
          } satisfies StudentDetailViewModel)
        )
      )
    )
  );

  protected getDysIconConfig(value: string) {
    return getDysIconConfig(value);
  }

  protected goToEdit(): void {
    const enrollmentId = this.route.snapshot.paramMap.get('id');

    if (!enrollmentId) {
      return;
    }

    void this.router.navigate(['/dashboard/students', enrollmentId, 'edit']);
  }
}
