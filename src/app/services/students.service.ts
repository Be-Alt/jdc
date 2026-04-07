import { Injectable } from '@angular/core';
import { Observable, defer, from, switchMap, throwError } from 'rxjs';
import { DysType } from '../models/DysType';
import { School } from '../models/School';
import { Section } from '../models/Section';
import { Student } from '../models/Student';
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

  saveStudent$(payload: {
    enrollmentId?: string;
    firstName: string;
    lastName: string;
    birthDate?: string | null;
    schoolYearId: string;
    sectionId?: string | null;
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
