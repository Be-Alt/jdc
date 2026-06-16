import { Injectable } from '@angular/core';
import { Observable, defer, from, switchMap, throwError } from 'rxjs';
import { DysType } from '../models/DysType';
import { School } from '../models/School';
import { Section } from '../models/Section';
import { Student } from '../models/Student';
import {
  AssessmentItemType,
  AssessmentStatus,
  StudentAssessment,
  StudentSummary
} from '../models/StudentSummary';
import { ProgramCatalogItem } from '../models/Program';
import { Teacher } from '../models/Teacher';
import { ApiResponse } from '../models/response';
import { apiFetch } from '../helpers/api-session';

@Injectable({
  providedIn: 'root',
})
export class StudentsService {
  getDysTypes$(): Observable<DysType[]> {
    return defer(() => from(apiFetch('/dys', { method: 'GET' }))).pipe(
      switchMap((response) =>
        from(response.json() as Promise<ApiResponse>).pipe(
          switchMap((payload) => {
            if (!response.ok) {
              return throwError(() => new Error(payload?.error || 'Impossible de récupérer les DYS.'));
            }

            return from([(payload.data ?? []) as DysType[]]);
          })
        )
      )
    );
  }

  getSections$(): Observable<Section[]> {
    return defer(() => from(apiFetch('/sections', { method: 'GET' }))).pipe(
      switchMap((response) =>
        from(response.json() as Promise<ApiResponse>).pipe(
          switchMap((payload) => {
            if (!response.ok) {
              return throwError(() => new Error(payload?.error || 'Impossible de récupérer les sections.'));
            }

            return from([(payload.data ?? []) as Section[]]);
          })
        )
      )
    );
  }

  getSchools$(): Observable<School[]> {
    return defer(() => from(apiFetch('/schools', { method: 'GET' }))).pipe(
      switchMap((response) =>
        from(response.json() as Promise<ApiResponse>).pipe(
          switchMap((payload) => {
            if (!response.ok) {
              return throwError(() => new Error(payload?.error || 'Impossible de récupérer les écoles.'));
            }

            return from([(payload.data ?? []) as School[]]);
          })
        )
      )
    );
  }

  getTeachers$(): Observable<Teacher[]> {
    return defer(() => from(apiFetch('/teachers', { method: 'GET' }))).pipe(
      switchMap((response) =>
        from(response.json() as Promise<ApiResponse>).pipe(
          switchMap((payload) => {
            if (!response.ok) {
              return throwError(() => new Error(payload?.error || 'Impossible de récupérer les professeurs.'));
            }

            return from([(payload.data ?? []) as Teacher[]]);
          })
        )
      )
    );
  }

  getPrograms$(): Observable<ProgramCatalogItem[]> {
    return defer(() => from(apiFetch('/program-catalog', { method: 'GET' }))).pipe(
      switchMap((response) =>
        from(response.json() as Promise<ApiResponse>).pipe(
          switchMap((payload) => {
            if (!response.ok) {
              return throwError(() => new Error(payload?.error || 'Impossible de récupérer les programmes.'));
            }

            return from([(payload.data ?? []) as ProgramCatalogItem[]]);
          })
        )
      )
    );
  }

  getStudentByEnrollmentId$(enrollmentId: string): Observable<Student> {
    return defer(() =>
      from(
        apiFetch(`/student?enrollmentId=${encodeURIComponent(enrollmentId)}`, {
          method: 'GET'
        })
      )
    ).pipe(
      switchMap((response) =>
        from(response.json() as Promise<ApiResponse>).pipe(
          switchMap((payload) => {
            if (!response.ok) {
              return throwError(
                () => new Error(payload?.error || 'Impossible de récupérer les détails de l’élève.')
              );
            }

            return from([payload.data as Student]);
          })
        )
      )
    );
  }

  getStudentSummary$(enrollmentId: string, includeProgram = true): Observable<StudentSummary> {
    return defer(() =>
      from(
        apiFetch(
          `/student-summary?enrollmentId=${encodeURIComponent(enrollmentId)}&includeProgram=${includeProgram}`,
          { method: 'GET' }
        )
      )
    ).pipe(
      switchMap((response) =>
        from(response.json() as Promise<ApiResponse>).pipe(
          switchMap((payload) => {
            if (!response.ok) {
              return throwError(() => new Error(payload?.error || 'Impossible de charger la synthèse élève.'));
            }
            return from([payload.data as StudentSummary]);
          })
        )
      )
    );
  }

  getStudentAssessments$(enrollmentId: string, programId: string): Observable<StudentAssessment[]> {
    return defer(() =>
      from(
        apiFetch(
          `/student-assessment?enrollmentId=${encodeURIComponent(enrollmentId)}&programId=${encodeURIComponent(programId)}`,
          { method: 'GET' }
        )
      )
    ).pipe(
      switchMap((response) =>
        from(response.json() as Promise<ApiResponse>).pipe(
          switchMap((payload) => {
            if (!response.ok) {
              return throwError(() => new Error(payload?.error || 'Impossible de charger le bilan.'));
            }
            return from([(payload.data ?? []) as StudentAssessment[]]);
          })
        )
      )
    );
  }

  saveStudentAssessments$(
    enrollmentId: string,
    programId: string,
    assessments: Array<{ itemType: AssessmentItemType; itemId: string; status: AssessmentStatus }>
  ): Observable<{ count: number }> {
    return defer(() =>
      from(
        apiFetch('/student-assessment', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enrollmentId, programId, assessments })
        })
      )
    ).pipe(
      switchMap((response) =>
        from(response.json() as Promise<ApiResponse>).pipe(
          switchMap((payload) => {
            if (!response.ok) {
              return throwError(() => new Error(payload?.error || 'Impossible d’enregistrer le bilan.'));
            }
            return from([payload.data as { count: number }]);
          })
        )
      )
    );
  }

  saveStudent$(payload: {
    enrollmentId?: string;
    firstName: string;
    lastName: string;
    birthDate?: string | null;
    schoolYearId: string;
    sectionId?: string | null;
    programId?: string | null;
    schoolId?: string | null;
    status: string;
    teacherIds: string[];
    accommodationIds: number[];
    dysIds: number[];
  }): Observable<{ enrollmentId: string }> {
    return defer(() =>
      from(
        apiFetch('/student-upsert', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        })
      )
    ).pipe(
      switchMap((response) =>
        from(response.json() as Promise<ApiResponse>).pipe(
          switchMap((apiResponse) => {
            if (!response.ok) {
              return throwError(() => new Error(apiResponse?.error || 'Impossible d’enregistrer l’élève.'));
            }

            return from([apiResponse.data as { enrollmentId: string }]);
          })
        )
      )
    );
  }

  getStudentsBySchoolYearId$(schoolYearId: string): Observable<Student[]> {
    return defer(() =>
      from(
        apiFetch(`/students?schoolYearId=${encodeURIComponent(schoolYearId)}`, {
          method: 'GET'
        })
      )
    ).pipe(
      switchMap((response) =>
        from(response.json() as Promise<ApiResponse>).pipe(
          switchMap((payload) => {
            if (!response.ok) {
              return throwError(
                () => new Error(payload?.error || 'Impossible de récupérer les élèves pour cette année.')
              );
            }

            return from([(payload.data ?? []) as Student[]]);
          })
        )
      )
    );
  }

  getStudentsBySchoolYearLabel$(schoolYearLabel: string): Observable<Student[]> {
    return defer(() =>
      from(
        apiFetch(`/students?schoolYearLabel=${encodeURIComponent(schoolYearLabel)}`, {
          method: 'GET'
        })
      )
    ).pipe(
      switchMap((response) =>
        from(response.json() as Promise<ApiResponse>).pipe(
          switchMap((payload) => {
            if (!response.ok) {
              return throwError(
                () => new Error(payload?.error || 'Impossible de récupérer les élèves pour cette année.')
              );
            }

            return from([(payload.data ?? []) as Student[]]);
          })
        )
      )
    );
  }
}
