import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  BehaviorSubject,
  catchError,
  combineLatest,
  map,
  of,
  take,
  startWith,
  switchMap,
  tap
} from 'rxjs';
import { DysType } from '../../../models/DysType';
import { School } from '../../../models/School';
import { SchoolYear } from '../../../models/SchoolYear';
import { Section } from '../../../models/Section';
import { Student } from '../../../models/Student';
import { Teacher } from '../../../models/Teacher';
import { GeneralService } from '../../../services/general.service';
import { StudentsService } from '../../../services/students.service';

type StudentFormViewModel = {
  isEditMode: boolean;
  enrollmentId: string | null;
  schoolYears: SchoolYear[];
  sections: Section[];
  schools: School[];
  teachers: Teacher[];
  filteredTeachers: Teacher[];
  dysTypes: DysType[];
  filteredAccommodations: Array<{ id: number; amenagement: string; dysName: string }>;
  selectedSchoolId: string;
  isLoading: boolean;
  errorMessage: string;
};

@Component({
  selector: 'app-student-form',
  imports: [AsyncPipe, ReactiveFormsModule, RouterLink],
  template: `
    <section class="space-y-6">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <a
            [routerLink]="backLink"
            class="inline-flex items-center gap-2 text-sm font-medium text-sky-700 transition hover:text-sky-800"
          >
            ← Retour
          </a>
          <p class="mt-4 text-sm font-medium tracking-[0.2em] text-sky-700 uppercase">Formulaire élève</p>
          <h2 class="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            {{ isEditMode ? 'Modifier un élève' : 'Ajouter un élève' }}
          </h2>
          <p class="mt-3 max-w-3xl text-base leading-7 text-slate-600">
            Renseigne l’identité, l’année scolaire, la section et l’école active de l’élève.
          </p>
        </div>
      </div>

      @if (vm$ | async; as vm) {
        @if (vm.errorMessage) {
          <div class="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {{ vm.errorMessage }}
          </div>
        }

        @if (successMessage) {
          <div class="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {{ successMessage }}
          </div>
        }

        @if (vm.isLoading) {
          <div class="rounded-[1.8rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div class="h-6 w-40 animate-pulse rounded bg-slate-200"></div>
            <div class="mt-4 h-10 w-72 animate-pulse rounded bg-slate-100"></div>
            <div class="mt-6 h-60 animate-pulse rounded-3xl bg-slate-50"></div>
          </div>
        } @else {
          <form
            [formGroup]="form"
            (ngSubmit)="submit(vm)"
            class="grid gap-6 xl:grid-cols-[1fr_320px]"
          >
            <div class="space-y-6">
              <section class="rounded-[1.8rem] border border-slate-200 bg-white p-6 shadow-sm">
                <p class="text-sm font-medium tracking-[0.2em] text-slate-500 uppercase">Identité</p>
                <div class="mt-5 grid gap-4 md:grid-cols-2">
                  <label class="space-y-2">
                    <span class="text-sm font-medium text-slate-800">Prénom</span>
                    <input
                      type="text"
                      formControlName="firstName"
                      class="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400"
                    />
                  </label>

                  <label class="space-y-2">
                    <span class="text-sm font-medium text-slate-800">Nom</span>
                    <input
                      type="text"
                      formControlName="lastName"
                      class="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400"
                    />
                  </label>

                  <label class="space-y-2 md:col-span-2">
                    <span class="text-sm font-medium text-slate-800">Date de naissance</span>
                    <input
                      type="date"
                      formControlName="birthDate"
                      class="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400"
                    />
                  </label>
                </div>
              </section>

              <section class="rounded-[1.8rem] border border-slate-200 bg-white p-6 shadow-sm">
                <p class="text-sm font-medium tracking-[0.2em] text-slate-500 uppercase">Scolarité</p>
                <div class="mt-5 grid gap-4 md:grid-cols-2">
                  <label class="space-y-2">
                    <span class="text-sm font-medium text-slate-800">Année scolaire</span>
                    <select
                      formControlName="schoolYearId"
                      class="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400"
                    >
                      <option value="">Sélectionner une année</option>
                      @for (schoolYear of vm.schoolYears; track schoolYear.id) {
                        <option [value]="schoolYear.id">{{ schoolYear.label }}</option>
                      }
                    </select>
                  </label>

                  <label class="space-y-2">
                    <span class="text-sm font-medium text-slate-800">Statut</span>
                    <select
                      formControlName="status"
                      class="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400"
                    >
                      <option value="active">Actif</option>
                      <option value="inactive">Inactif</option>
                    </select>
                  </label>

                  <label class="space-y-2">
                    <span class="text-sm font-medium text-slate-800">Section</span>
                    <select
                      formControlName="sectionId"
                      class="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400"
                    >
                      <option value="">Aucune section</option>
                      @for (section of vm.sections; track section.id) {
                        <option [value]="section.id">{{ section.code }} · {{ section.label }}</option>
                      }
                    </select>
                  </label>

                  <label class="space-y-2">
                    <span class="text-sm font-medium text-slate-800">École</span>
                    <select
                      formControlName="schoolId"
                      class="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400"
                    >
                      <option value="">Aucune école</option>
                      @for (school of vm.schools; track school.id) {
                        <option [value]="school.id">
                          {{ school.name }}{{ school.city ? ' · ' + school.city : '' }}
                        </option>
                      }
                    </select>
                  </label>
                </div>
              </section>

              <section class="rounded-[1.8rem] border border-slate-200 bg-white p-6 shadow-sm">
                <div class="flex items-center justify-between gap-3">
                  <div>
                    <p class="text-sm font-medium tracking-[0.2em] text-slate-500 uppercase">Professeurs liés</p>
                    <p class="mt-2 text-sm text-slate-600">
                      Choisis un ou plusieurs professeurs de l’école d’origine pour les lier à l’élève.
                    </p>
                  </div>
                  <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                    {{ selectedTeacherIds.length }}
                  </span>
                </div>

                @if (!vm.selectedSchoolId) {
                  <div class="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                    Sélectionne d’abord une école pour voir ses professeurs.
                  </div>
                } @else if (vm.filteredTeachers.length === 0) {
                  <div class="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                    Aucun professeur n’est encore lié à cette école.
                  </div>
                } @else {
                  <div class="mt-5 grid gap-3 md:grid-cols-2">
                    @for (teacher of vm.filteredTeachers; track teacher.id) {
                      <label class="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700 transition hover:bg-slate-100">
                        <input
                          type="checkbox"
                          class="mt-1 h-4 w-4"
                          [checked]="isTeacherSelected(teacher.id)"
                          (change)="toggleTeacher(teacher.id, $any($event.target).checked)"
                        />
                        <span>
                          <span class="block font-medium text-slate-900">
                            {{ teacher.first_name || '' }} {{ teacher.last_name || '' }}
                          </span>
                          <span class="mt-1 block text-xs text-slate-500">
                            {{ teacher.subject || 'Matière non renseignée' }}
                          </span>
                          @if (teacher.email || teacher.phone) {
                            <span class="mt-2 block text-xs leading-5 text-slate-500">
                              {{ teacher.email || teacher.phone }}
                            </span>
                          }
                        </span>
                      </label>
                    }
                  </div>
                }
              </section>

              <section class="rounded-[1.8rem] border border-slate-200 bg-white p-6 shadow-sm">
                <div class="flex items-center justify-between gap-3">
                  <div>
                    <p class="text-sm font-medium tracking-[0.2em] text-slate-500 uppercase">Aménagements en place</p>
                    <p class="mt-2 text-sm text-slate-600">
                      Coche les aménagements réellement mis en place pour cet élève.
                    </p>
                  </div>
                  <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                    {{ selectedAccommodationIds.length }}
                  </span>
                </div>

                @if (selectedDysIds.length === 0) {
                  <div class="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                    Sélectionne d’abord un ou plusieurs DYS pour afficher les aménagements associés.
                  </div>
                } @else if (vm.filteredAccommodations.length === 0) {
                  <div class="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                    Aucun aménagement disponible pour les DYS sélectionnés.
                  </div>
                } @else {
                  <div class="mt-5 grid gap-3 md:grid-cols-2">
                    @for (accommodation of vm.filteredAccommodations; track accommodation.id) {
                      <label class="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700 transition hover:bg-slate-100">
                        <input
                          type="checkbox"
                          class="mt-1 h-4 w-4"
                          [checked]="isAccommodationSelected(accommodation.id)"
                          (change)="toggleAccommodation(accommodation.id, $any($event.target).checked)"
                        />
                        <span>
                          <span class="block font-medium text-slate-900">{{ accommodation.amenagement }}</span>
                          <span class="mt-1 block text-xs text-slate-500">{{ accommodation.dysName }}</span>
                        </span>
                      </label>
                    }
                  </div>
                }
              </section>

              <section class="rounded-[1.8rem] border border-slate-200 bg-white p-6 shadow-sm">
                <div class="flex items-center justify-between gap-3">
                  <div>
                    <p class="text-sm font-medium tracking-[0.2em] text-slate-500 uppercase">Besoins spécifiques</p>
                    <p class="mt-2 text-sm text-slate-600">
                      Attribue un ou plusieurs DYS à l’élève via les cases à cocher.
                    </p>
                  </div>
                  <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                    {{ selectedDysIds.length }}
                  </span>
                </div>

                <div class="mt-5 grid gap-3 md:grid-cols-2">
                  @for (dysType of vm.dysTypes; track dysType.id) {
                    <label class="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700 transition hover:bg-slate-100">
                      <input
                        type="checkbox"
                        class="mt-1 h-4 w-4"
                        [checked]="isDysSelected(dysType.id)"
                        (change)="toggleDys(dysType.id, $any($event.target).checked)"
                      />
                      <span>
                        <span class="block font-medium text-slate-900">{{ dysType.nom }}</span>
                        <span class="mt-1 block text-xs text-slate-500">{{ dysType.code }}</span>
                        @if (dysType.description) {
                          <span class="mt-2 block text-xs leading-5 text-slate-500">{{ dysType.description }}</span>
                        }
                      </span>
                    </label>
                  }
                </div>
              </section>
            </div>

            <aside class="rounded-[1.8rem] border border-slate-200 bg-white p-6 shadow-sm">
              <p class="text-sm font-medium tracking-[0.2em] text-slate-500 uppercase">Actions</p>
              <div class="mt-5 space-y-4">
                <button
                  type="submit"
                  [disabled]="form.invalid || isSubmitting"
                  class="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {{ isSubmitting ? 'Enregistrement...' : (isEditMode ? 'Enregistrer les modifications' : 'Créer l’élève') }}
                </button>

                <a
                  [routerLink]="backLink"
                  class="block w-full rounded-2xl border border-slate-300 px-4 py-3 text-center text-sm font-medium text-slate-800 transition hover:bg-slate-50"
                >
                  Annuler
                </a>
              </div>
            </aside>
          </form>
        }
      }
    </section>
  `
})
export class StudentFormComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(FormBuilder);
  private readonly generalService = inject(GeneralService);
  private readonly studentsService = inject(StudentsService);

  protected readonly enrollmentId = this.route.snapshot.paramMap.get('id');
  protected readonly isEditMode = Boolean(this.enrollmentId);
  protected readonly backLink = this.enrollmentId
    ? ['/dashboard/students', this.enrollmentId]
    : ['/dashboard/students'];

  protected isSubmitting = false;
  protected successMessage = '';
  private readonly loadErrorSubject = new BehaviorSubject<string>('');

  protected readonly form = this.formBuilder.nonNullable.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    birthDate: [''],
    schoolYearId: ['', Validators.required],
    sectionId: [''],
    schoolId: [''],
    status: ['active', Validators.required],
    teacherIds: [[] as string[]],
    accommodationIds: [[] as number[]],
    dysIds: [[] as number[]]
  });

  protected readonly vm$ = combineLatest([
    this.generalService.schoolYears$,
    this.studentsService.getSections$(),
    this.studentsService.getSchools$(),
    this.studentsService.getTeachers$(),
    this.studentsService.getDysTypes$(),
    this.form.controls.schoolId.valueChanges.pipe(startWith(this.form.controls.schoolId.value)),
    this.form.controls.dysIds.valueChanges.pipe(startWith(this.form.controls.dysIds.value)),
    this.loadErrorSubject.asObservable(),
    this.isEditMode
      ? this.studentsService.getStudentByEnrollmentId$(this.enrollmentId!).pipe(
          tap((student) => this.patchForm(student)),
          map((student) => ({ student, isLoading: false })),
          startWith({ student: null as Student | null, isLoading: true }),
          catchError((error: unknown) => {
            this.loadErrorSubject.next(
              error instanceof Error ? error.message : 'Impossible de charger la fiche élève.'
            );

            return of({ student: null as Student | null, isLoading: false });
          })
        )
      : of({ student: null as Student | null, isLoading: false }).pipe(
          tap(() => this.patchDefaultSchoolYear())
        )
  ]).pipe(
    tap(([, , , , dysTypes, , selectedDysIds]) => {
      const allowedAccommodationIds = dysTypes
        .filter((dysType) => (selectedDysIds ?? []).includes(dysType.id))
        .flatMap((dysType) => (dysType.accommodations ?? []).map((accommodation) => accommodation.id));

      const nextSelectedAccommodationIds = this.selectedAccommodationIds.filter((id) =>
        allowedAccommodationIds.includes(id)
      );

      if (nextSelectedAccommodationIds.length !== this.selectedAccommodationIds.length) {
        this.form.controls.accommodationIds.setValue(nextSelectedAccommodationIds, { emitEvent: false });
      }
    }),
    map(([schoolYears, sections, schools, teachers, dysTypes, selectedSchoolId, selectedDysIds, errorMessage, studentState]) => ({
      isEditMode: this.isEditMode,
      enrollmentId: this.enrollmentId,
      schoolYears,
      sections,
      schools,
      teachers,
      filteredTeachers: teachers.filter((teacher) => teacher.school_id === (selectedSchoolId || null)),
      dysTypes,
      filteredAccommodations: dysTypes
        .filter((dysType) => (selectedDysIds ?? []).includes(dysType.id))
        .flatMap((dysType) =>
          (dysType.accommodations ?? []).map((accommodation) => ({
            id: accommodation.id,
            amenagement: accommodation.amenagement,
            dysName: dysType.nom
          }))
        ),
      selectedSchoolId: selectedSchoolId || '',
      isLoading: studentState.isLoading,
      errorMessage
    }) satisfies StudentFormViewModel)
  );

  protected submit(vm: StudentFormViewModel): void {
    if (this.form.invalid || this.isSubmitting) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    this.successMessage = '';
    this.loadErrorSubject.next('');

    const rawValue = this.form.getRawValue();
    const allowedTeacherIds = vm.filteredTeachers.map((teacher) => teacher.id);
    const teacherIds = (rawValue.teacherIds ?? []).filter((teacherId) => allowedTeacherIds.includes(teacherId));
    const allowedAccommodationIds = vm.filteredAccommodations.map((accommodation) => accommodation.id);
    const accommodationIds = (rawValue.accommodationIds ?? []).filter((id) => allowedAccommodationIds.includes(id));

    this.studentsService.saveStudent$({
      enrollmentId: vm.enrollmentId ?? undefined,
      firstName: rawValue.firstName,
      lastName: rawValue.lastName,
      birthDate: rawValue.birthDate || null,
      schoolYearId: rawValue.schoolYearId,
      sectionId: rawValue.sectionId || null,
      schoolId: rawValue.schoolId || null,
      status: rawValue.status,
      teacherIds,
      accommodationIds,
      dysIds: rawValue.dysIds
    }).subscribe({
      next: ({ enrollmentId }) => {
        this.isSubmitting = false;
        this.successMessage = this.isEditMode
          ? 'Les modifications ont bien été enregistrées.'
          : 'L’élève a bien été créé.';
        void this.router.navigate(['/dashboard/students', enrollmentId]);
      },
      error: (error: unknown) => {
        this.isSubmitting = false;
        this.loadErrorSubject.next(
          error instanceof Error ? error.message : 'Impossible d’enregistrer l’élève.'
        );
      }
    });
  }

  private patchDefaultSchoolYear(): void {
    if (this.form.controls.schoolYearId.value) {
      return;
    }

    this.generalService.selectedSchoolYear$
      .pipe(take(1))
      .subscribe((schoolYear) => {
        if (!schoolYear || this.form.controls.schoolYearId.value) {
          return;
        }

        this.form.patchValue({
          schoolYearId: schoolYear.id
        });
      });
  }

  private patchForm(student: Student): void {
    this.form.patchValue({
      firstName: student.first_name,
      lastName: student.last_name,
      birthDate: student.birth_date ?? '',
      schoolYearId: student.school_year_id,
      sectionId: student.section_id ?? '',
      schoolId: student.school_id ?? '',
      status: student.status,
      teacherIds: student.teacher_ids ?? [],
      accommodationIds: student.accommodation_ids ?? [],
      dysIds: student.dys_ids ?? []
    });
  }

  protected get selectedTeacherIds(): string[] {
    return this.form.controls.teacherIds.value;
  }

  protected isTeacherSelected(teacherId: string): boolean {
    return this.selectedTeacherIds.includes(teacherId);
  }

  protected toggleTeacher(teacherId: string, checked: boolean): void {
    const currentIds = this.selectedTeacherIds;
    const nextIds = checked
      ? Array.from(new Set([...currentIds, teacherId]))
      : currentIds.filter((id) => id !== teacherId);

    this.form.controls.teacherIds.setValue(nextIds);
  }

  protected get selectedDysIds(): number[] {
    return this.form.controls.dysIds.value;
  }

  protected get selectedAccommodationIds(): number[] {
    return this.form.controls.accommodationIds.value;
  }

  protected isDysSelected(dysId: number): boolean {
    return this.selectedDysIds.includes(dysId);
  }

  protected toggleDys(dysId: number, checked: boolean): void {
    const currentIds = this.selectedDysIds;
    const nextIds = checked
      ? Array.from(new Set([...currentIds, dysId]))
      : currentIds.filter((id) => id !== dysId);

    this.form.controls.dysIds.setValue(nextIds);
  }

  protected isAccommodationSelected(accommodationId: number): boolean {
    return this.selectedAccommodationIds.includes(accommodationId);
  }

  protected toggleAccommodation(accommodationId: number, checked: boolean): void {
    const currentIds = this.selectedAccommodationIds;
    const nextIds = checked
      ? Array.from(new Set([...currentIds, accommodationId]))
      : currentIds.filter((id) => id !== accommodationId);

    this.form.controls.accommodationIds.setValue(nextIds);
  }
}
