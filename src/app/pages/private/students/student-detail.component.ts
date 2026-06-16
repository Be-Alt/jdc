import { AsyncPipe, DatePipe, NgClass } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { getDysIconConfig } from '../../../helpers/dys-icons';
import { BehaviorSubject, catchError, combineLatest, firstValueFrom, map, of, startWith, switchMap } from 'rxjs';
import { Student } from '../../../models/Student';
import { ProgramSkill, ProgramUaa } from '../../../models/Program';
import { StudentAttendancePoint, StudentSummary } from '../../../models/StudentSummary';
import { Teacher } from '../../../models/Teacher';
import { StudentsService } from '../../../services/students.service';
import { StudentCommunicationsComponent } from './student-communications.component';

type StudentDetailViewModel = {
  student: Student | null;
  summary: StudentSummary | null;
  teachers: Teacher[];
  isLoading: boolean;
  errorMessage: string;
  successMessage: string;
};

@Component({
  selector: 'app-student-detail',
  imports: [AsyncPipe, DatePipe, NgClass, RouterLink, StudentCommunicationsComponent],
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
            (click)="openAssessment()"
            class="inline-flex items-center justify-center rounded-2xl bg-sky-700 px-4 py-3 text-sm font-medium text-white transition hover:bg-sky-800"
          >
            Ouvrir le bilan
          </button>
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
                <div class="rounded-2xl bg-slate-50 px-4 py-4 md:col-span-2">
                  <p class="font-medium text-slate-800">Programme attribué</p>
                  @if (vm.student.program_id) {
                    <p class="mt-1 text-slate-700">
                      {{ vm.student.program_name || vm.student.program_subject_name }}
                    </p>
                    <p class="mt-1 text-sm text-slate-500">
                      {{ vm.student.program_subject_name }} ·
                      {{ vm.student.program_network_code || vm.student.program_network_name }} ·
                      {{ vm.student.program_hours }} h
                    </p>
                  } @else {
                    <p class="mt-1 text-slate-600">Aucun programme attribué</p>
                  }
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
                    @for (teacher of getLinkedTeachers(vm.student, vm.teachers); track teacher.id) {
                      @if (teacher.email) {
                        <button
                          type="button"
                          (click)="openTeacherEmail(teacher, vm.student)"
                          class="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm font-medium text-sky-700 ring-1 ring-sky-200 transition hover:bg-sky-50"
                          [title]="'Écrire à ' + teacher.email"
                        >
                          {{ getTeacherName(teacher) }}
                          <span aria-hidden="true">✉</span>
                        </button>
                      } @else {
                        <span class="inline-flex items-center rounded-full bg-white px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200">
                          {{ getTeacherName(teacher) }}
                        </span>
                      }
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

          <article class="rounded-[1.8rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p class="text-sm font-medium tracking-[0.2em] text-slate-500 uppercase">Progression</p>
                <h3 class="mt-2 text-2xl font-semibold text-slate-950">Programme de l’année</h3>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                @if (isProgramOpen && programSummary?.program) {
                  <span class="rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-800">
                    {{ getProgramProgress(programSummary!) }} % travaillé
                  </span>
                }
                <button
                  type="button"
                  (click)="toggleProgram(vm.student.enrollment_id)"
                  [disabled]="isProgramLoading"
                  class="rounded-xl bg-sky-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-800 disabled:opacity-50"
                >
                  {{ isProgramLoading ? 'Chargement...' : isProgramOpen ? 'Fermer le programme' : 'Ouvrir le programme' }}
                </button>
              </div>
            </div>

            @if (programErrorMessage) {
              <div class="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {{ programErrorMessage }}
              </div>
            }

            @if (isProgramOpen && programSummary?.program; as program) {
              <p class="mt-2 text-sm text-slate-600">
                {{ program.program?.name || program.program?.subject?.name }} · {{ program.section.code }}
              </p>
              <div class="mt-5 space-y-3">
                @for (uaa of program.uaas; track uaa.id) {
                  <section class="rounded-2xl border border-slate-200 p-4">
                    <div class="flex items-center justify-between gap-3">
                      <div>
                        <p class="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">{{ uaa.code }}</p>
                        <p class="mt-1 font-semibold text-slate-900">{{ uaa.name }}</p>
                      </div>
                      <span class="text-xs font-medium text-slate-500">
                        {{ getUaaWorkedCount(programSummary!, uaa) }} / {{ getUaaItemCount(uaa) }}
                      </span>
                    </div>
                    <div class="mt-4 grid gap-2 lg:grid-cols-2">
                      @for (skill of flattenUaaSkills(uaa); track skill.id) {
                        <div
                          class="rounded-xl px-3 py-2 text-sm"
                          [class.bg-emerald-100]="programSummary!.workedSkillIds.includes(skill.id)"
                          [class.text-emerald-900]="programSummary!.workedSkillIds.includes(skill.id)"
                          [class.bg-slate-50]="!programSummary!.workedSkillIds.includes(skill.id)"
                          [class.text-slate-500]="!programSummary!.workedSkillIds.includes(skill.id)"
                        >
                          {{ skill.description }}
                        </div>
                      }
                      @for (resource of uaa.resources; track resource.id) {
                        <div
                          class="rounded-xl px-3 py-2 text-sm"
                          [class.bg-sky-100]="programSummary!.workedResourceIds.includes(resource.id)"
                          [class.text-sky-900]="programSummary!.workedResourceIds.includes(resource.id)"
                          [class.bg-slate-50]="!programSummary!.workedResourceIds.includes(resource.id)"
                          [class.text-slate-500]="!programSummary!.workedResourceIds.includes(resource.id)"
                        >
                          {{ resource.description }}
                        </div>
                      }
                    </div>
                  </section>
                }
              </div>
            } @else if (isProgramOpen && !isProgramLoading && programSummary && !programSummary.program) {
              <p class="mt-4 text-sm text-slate-600">Aucun programme attribué à cet élève.</p>
            }
          </article>

          <app-student-communications
            [enrollmentId]="vm.student.enrollment_id"
            [teachers]="getLinkedTeachers(vm.student, vm.teachers)"
          />

          <article class="rounded-[1.8rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p class="text-sm font-medium tracking-[0.2em] text-slate-500 uppercase">Présence</p>
                <h3 class="mt-2 text-2xl font-semibold text-slate-950">Évolution mensuelle</h3>
                <p class="mt-2 text-sm text-slate-600">Les absences du professeur sont exclues du calcul.</p>
              </div>
              <div class="rounded-2xl bg-sky-50 px-5 py-3 text-center">
                <p class="text-3xl font-semibold text-sky-800">{{ vm.summary.attendance.percentage }} %</p>
                <p class="mt-1 text-xs text-sky-700">
                  {{ vm.summary.attendance.attended }} cours suivis sur {{ vm.summary.attendance.total }}
                </p>
              </div>
            </div>

            @if (vm.summary.attendance.points.length > 0) {
              <div class="mt-6 overflow-x-auto">
                <svg class="h-64 min-w-[640px] w-full" viewBox="0 0 700 240" role="img" aria-label="Courbe de présence mensuelle">
                  @for (line of [0, 25, 50, 75, 100]; track line) {
                    <line x1="55" x2="680" [attr.y1]="210 - line * 1.7" [attr.y2]="210 - line * 1.7" stroke="#e2e8f0" />
                    <text x="10" [attr.y]="214 - line * 1.7" class="fill-slate-400 text-[11px]">{{ line }} %</text>
                  }
                  <polyline
                    [attr.points]="getAttendancePolyline(vm.summary!.attendance.points)"
                    fill="none"
                    stroke="#0369a1"
                    stroke-width="4"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                  @for (point of vm.summary!.attendance.points; track point.month; let index = $index) {
                    <circle [attr.cx]="getChartX(index, vm.summary!.attendance.points.length)" [attr.cy]="getChartY(point.percentage)" r="5" fill="#0369a1" />
                    <text [attr.x]="getChartX(index, vm.summary!.attendance.points.length)" y="232" text-anchor="middle" class="fill-slate-500 text-[11px]">
                      {{ formatMonth(point.month) }}
                    </text>
                  }
                </svg>
              </div>
            } @else {
              <p class="mt-5 rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-600">
                Aucune séance enregistrée pour calculer la présence.
              </p>
            }
          </article>
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
      combineLatest([
        this.studentsService.getStudentByEnrollmentId$(enrollmentId),
        this.studentsService.getStudentSummary$(enrollmentId, false),
        this.studentsService.getTeachers$()
      ]).pipe(
        map(([student, summary, teachers]) => ({
          student,
          summary,
          teachers,
          isLoading: false,
          errorMessage,
          successMessage
        })),
        startWith({
          student: null,
          summary: null,
          teachers: [],
          isLoading: true,
          errorMessage,
          successMessage
        } satisfies StudentDetailViewModel),
        catchError((error: unknown) =>
          of({
            student: null,
            summary: null,
            teachers: [],
            isLoading: false,
            errorMessage:
              error instanceof Error ? error.message : 'Impossible de charger la fiche élève.',
            successMessage: ''
          } satisfies StudentDetailViewModel)
        )
      )
    )
  );

  protected isProgramOpen = false;
  protected isProgramLoading = false;
  protected programSummary: StudentSummary | null = null;
  protected programErrorMessage = '';

  protected getDysIconConfig(value: string) {
    return getDysIconConfig(value);
  }

  protected async toggleProgram(enrollmentId: string): Promise<void> {
    this.isProgramOpen = !this.isProgramOpen;
    if (!this.isProgramOpen || this.programSummary || this.isProgramLoading) return;

    this.isProgramLoading = true;
    this.programErrorMessage = '';
    try {
      this.programSummary = await firstValueFrom(
        this.studentsService.getStudentSummary$(enrollmentId, true)
      );
    } catch (error) {
      this.programErrorMessage =
        error instanceof Error ? error.message : 'Impossible de charger le programme.';
    } finally {
      this.isProgramLoading = false;
    }
  }

  protected getLinkedTeachers(student: Student, teachers: Teacher[]): Teacher[] {
    return student.teacher_ids
      .map((teacherId) => teachers.find((teacher) => teacher.id === teacherId))
      .filter((teacher): teacher is Teacher => Boolean(teacher));
  }

  protected getTeacherName(teacher: Teacher): string {
    return `${teacher.first_name ?? ''} ${teacher.last_name ?? ''}`.trim() || teacher.email || 'Professeur';
  }

  protected openTeacherEmail(teacher: Teacher, student: Student): void {
    const email = teacher.email?.trim();
    if (!email) return;
    const subject = `Suivi de ${student.first_name} ${student.last_name}`;
    window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}`;
  }

  protected flattenUaaSkills(uaa: ProgramUaa): ProgramSkill[] {
    return uaa.skillGroups.flatMap((group) => group.skills);
  }

  protected getUaaItemCount(uaa: ProgramUaa): number {
    return this.flattenUaaSkills(uaa).length + uaa.resources.length;
  }

  protected getUaaWorkedCount(summary: StudentSummary, uaa: ProgramUaa): number {
    return this.flattenUaaSkills(uaa).filter((skill) => summary.workedSkillIds.includes(skill.id)).length
      + uaa.resources.filter((resource) => summary.workedResourceIds.includes(resource.id)).length;
  }

  protected getProgramProgress(summary: StudentSummary): number {
    if (!summary.program) return 0;
    const total = summary.program.uaas.reduce((sum, uaa) => sum + this.getUaaItemCount(uaa), 0);
    const worked = summary.program.uaas.reduce((sum, uaa) => sum + this.getUaaWorkedCount(summary, uaa), 0);
    return total > 0 ? Math.round((worked / total) * 100) : 0;
  }

  protected getChartX(index: number, count: number): number {
    return count <= 1 ? 365 : 55 + (index * 625) / (count - 1);
  }

  protected getChartY(percentage: number): number {
    return 210 - percentage * 1.7;
  }

  protected getAttendancePolyline(points: StudentAttendancePoint[]): string {
    return points.map((point, index) => `${this.getChartX(index, points.length)},${this.getChartY(point.percentage)}`).join(' ');
  }

  protected formatMonth(month: string): string {
    return new Intl.DateTimeFormat('fr-BE', { month: 'short' }).format(new Date(`${month}-01T00:00:00`));
  }

  protected goToEdit(): void {
    const enrollmentId = this.route.snapshot.paramMap.get('id');

    if (!enrollmentId) {
      return;
    }

    void this.router.navigate(['/dashboard/students', enrollmentId, 'edit']);
  }

  protected openAssessment(): void {
    const enrollmentId = this.route.snapshot.paramMap.get('id');
    if (!enrollmentId) return;
    const url = this.router.serializeUrl(
      this.router.createUrlTree(['/dashboard/students', enrollmentId, 'assessment'])
    );
    window.open(url, '_blank', 'noopener,noreferrer,width=1200,height=900');
  }
}
