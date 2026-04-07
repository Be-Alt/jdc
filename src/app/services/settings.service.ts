import { Injectable } from '@angular/core';
import { Observable, defer, from, switchMap, throwError } from 'rxjs';
import { apiFetch } from '../helpers/api-session';
import { DysType } from '../models/DysType';
import { School } from '../models/School';
import { Teacher } from '../models/Teacher';
import { ApiResponse } from '../models/response';
import { StudentOption } from '../models/StudentOption';
import { WeeklyScheduleConfig } from '../models/WeeklySchedule';

type WeeklySchedulePayload = {
  configId?: string;
  label: string;
  validFrom: string;
  validTo?: string | null;
  slots: Array<{
    dayOfWeek: number;
    slotType: 'course' | 'break' | 'lunch';
    label: string;
    startsAt: string;
    endsAt: string;
    position: number;
    studentEnrollmentIds: string[];
  }>;
};

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
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

  createTeacher$(payload: {
    schoolId?: string | null;
    firstName: string;
    lastName: string;
    email?: string | null;
    phone?: string | null;
    subject?: string | null;
  }): Observable<Teacher> {
    return defer(() =>
      from(
        apiFetch('/teachers', {
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
              return throwError(() => new Error(apiResponse?.error || 'Impossible d’ajouter le professeur.'));
            }

            return from([apiResponse.data as Teacher]);
          })
        )
      )
    );
  }

  updateTeacher$(payload: {
    teacherId: string;
    schoolId?: string | null;
    firstName: string;
    lastName: string;
    email?: string | null;
    phone?: string | null;
    subject?: string | null;
  }): Observable<Teacher> {
    return defer(() =>
      from(
        apiFetch('/teachers', {
          method: 'PUT',
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
              return throwError(() => new Error(apiResponse?.error || 'Impossible de modifier le professeur.'));
            }

            return from([apiResponse.data as Teacher]);
          })
        )
      )
    );
  }

  deleteTeacher$(teacherId: string): Observable<{ teacherId: string }> {
    return defer(() =>
      from(
        apiFetch('/teachers', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ teacherId })
        })
      )
    ).pipe(
      switchMap((response) =>
        from(response.json() as Promise<ApiResponse>).pipe(
          switchMap((apiResponse) => {
            if (!response.ok) {
              return throwError(() => new Error(apiResponse?.error || 'Impossible de supprimer le professeur.'));
            }

            return from([apiResponse.data as { teacherId: string }]);
          })
        )
      )
    );
  }

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

  updateDysType$(payload: {
    id: number;
    code: string;
    nom: string;
    description?: string | null;
    accommodations: string[];
  }): Observable<DysType> {
    return defer(() =>
      from(
        apiFetch('/dys', {
          method: 'PUT',
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
              return throwError(() => new Error(apiResponse?.error || 'Impossible d’enregistrer le DYS.'));
            }

            return from([apiResponse.data as DysType]);
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

  createSchool$(payload: {
    name: string;
    address?: string | null;
    city?: string | null;
    postalCode?: string | null;
    country?: string | null;
    website?: string | null;
  }): Observable<School> {
    return defer(() =>
      from(
        apiFetch('/schools', {
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
              return throwError(() => new Error(apiResponse?.error || 'Impossible d’enregistrer l’école.'));
            }

            return from([apiResponse.data as School]);
          })
        )
      )
    );
  }

  updateSchool$(payload: {
    schoolId: string;
    name: string;
    address?: string | null;
    city?: string | null;
    postalCode?: string | null;
    country?: string | null;
    website?: string | null;
  }): Observable<School> {
    return defer(() =>
      from(
        apiFetch('/schools', {
          method: 'PUT',
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
              return throwError(() => new Error(apiResponse?.error || 'Impossible de modifier l’école.'));
            }

            return from([apiResponse.data as School]);
          })
        )
      )
    );
  }

  deleteSchool$(schoolId: string): Observable<{ schoolId: string }> {
    return defer(() =>
      from(
        apiFetch('/schools', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ schoolId })
        })
      )
    ).pipe(
      switchMap((response) =>
        from(response.json() as Promise<ApiResponse>).pipe(
          switchMap((apiResponse) => {
            if (!response.ok) {
              return throwError(() => new Error(apiResponse?.error || 'Impossible de supprimer l’école.'));
            }

            return from([apiResponse.data as { schoolId: string }]);
          })
        )
      )
    );
  }

  getStudentOptions$(): Observable<StudentOption[]> {
    return defer(() => from(apiFetch('/student-options', { method: 'GET' }))).pipe(
      switchMap((response) =>
        from(response.json() as Promise<ApiResponse>).pipe(
          switchMap((payload) => {
            if (!response.ok) {
              return throwError(() => new Error(payload?.error || 'Impossible de récupérer les élèves.'));
            }

            return from([(payload.data ?? []) as StudentOption[]]);
          })
        )
      )
    );
  }

  getWeeklySchedule$(): Observable<WeeklyScheduleConfig | null> {
    return defer(() => from(apiFetch('/weekly-schedule', { method: 'GET' }))).pipe(
      switchMap((response) =>
        from(response.json() as Promise<ApiResponse>).pipe(
          switchMap((payload) => {
            if (!response.ok) {
              return throwError(() => new Error(payload?.error || 'Impossible de récupérer l’agenda.'));
            }

            return from([(payload.data ?? null) as WeeklyScheduleConfig | null]);
          })
        )
      )
    );
  }

  saveWeeklySchedule$(payload: WeeklySchedulePayload): Observable<WeeklyScheduleConfig | null> {
    return defer(() =>
      from(
        apiFetch('/weekly-schedule', {
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
              return throwError(() => new Error(apiResponse?.error || 'Impossible d’enregistrer l’agenda.'));
            }

            return from([(apiResponse.data ?? null) as WeeklyScheduleConfig | null]);
          })
        )
      )
    );
  }
}
