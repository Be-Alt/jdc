import { Injectable } from '@angular/core';
import { Observable, defer, from, switchMap, throwError } from 'rxjs';
import { apiFetch } from '../helpers/api-session';
import { DysType } from '../models/DysType';
import { ProgramCatalogItem, ProgramNetwork, SectionProgram } from '../models/Program';
import { School } from '../models/School';
import { SchoolHoliday } from '../models/SchoolHoliday';
import { Section } from '../models/Section';
import { Subject } from '../models/Subject';
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
    subjectId?: string | null;
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
  getSchoolHolidays$(): Observable<SchoolHoliday[]> {
    return defer(() => from(apiFetch('/school-holidays', { method: 'GET' }))).pipe(
      switchMap((response) =>
        from(response.json() as Promise<ApiResponse>).pipe(
          switchMap((payload) => {
            if (!response.ok) {
              return throwError(() => new Error(payload?.error || 'Impossible de récupérer les congés.'));
            }

            return from([(payload.data ?? []) as SchoolHoliday[]]);
          })
        )
      )
    );
  }

  saveSchoolHolidays$(holidays: Array<{ title: string; startsOn: string; endsOn: string }>): Observable<SchoolHoliday[]> {
    return defer(() =>
      from(
        apiFetch('/school-holidays', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ holidays })
        })
      )
    ).pipe(
      switchMap((response) =>
        from(response.json() as Promise<ApiResponse>).pipe(
          switchMap((payload) => {
            if (!response.ok) {
              return throwError(() => new Error(payload?.error || 'Impossible d’enregistrer les congés.'));
            }

            return from([(payload.data ?? []) as SchoolHoliday[]]);
          })
        )
      )
    );
  }

  getSections$(subjectId?: string | null): Observable<Section[]> {
    const query = subjectId ? `?subjectId=${encodeURIComponent(subjectId)}` : '';

    return defer(() => from(apiFetch(`/sections${query}`, { method: 'GET' }))).pipe(
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

  createSection$(payload: {
    code: string;
    level: number;
    type: string;
    label: string;
  }): Observable<Section> {
    return defer(() =>
      from(
        apiFetch('/sections', {
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
              return throwError(() => new Error(apiResponse?.error || 'Impossible d’ajouter la section.'));
            }

            return from([apiResponse.data as Section]);
          })
        )
      )
    );
  }

  deleteSection$(sectionId: string): Observable<{ sectionId: string }> {
    return defer(() =>
      from(
        apiFetch('/sections', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ sectionId })
        })
      )
    ).pipe(
      switchMap((response) =>
        from(response.json() as Promise<ApiResponse>).pipe(
          switchMap((apiResponse) => {
            if (!response.ok) {
              return throwError(() => new Error(apiResponse?.error || 'Impossible de supprimer la section.'));
            }

            return from([apiResponse.data as { sectionId: string }]);
          })
        )
      )
    );
  }

  getProgramNetworksBySectionId$(sectionId: string, subjectId?: string | null): Observable<ProgramNetwork[]> {
    const params = new URLSearchParams({
      sectionId
    });

    if (subjectId) {
      params.set('subjectId', subjectId);
    }

    return defer(() =>
      from(
        apiFetch(`/program-networks?${params.toString()}`, {
          method: 'GET'
        })
      )
    ).pipe(
      switchMap((response) =>
        from(response.json() as Promise<ApiResponse>).pipe(
          switchMap((payload) => {
            if (!response.ok) {
              return throwError(() => new Error(payload?.error || 'Impossible de récupérer les réseaux.'));
            }

            return from([(payload.data ?? []) as ProgramNetwork[]]);
          })
        )
      )
    );
  }

  getNetworks$(): Observable<ProgramNetwork[]> {
    return defer(() => from(apiFetch('/networks', { method: 'GET' }))).pipe(
      switchMap((response) =>
        from(response.json() as Promise<ApiResponse>).pipe(
          switchMap((payload) => {
            if (!response.ok) {
              return throwError(() => new Error(payload?.error || 'Impossible de récupérer les réseaux.'));
            }

            return from([(payload.data ?? []) as ProgramNetwork[]]);
          })
        )
      )
    );
  }

  createNetwork$(payload: {
    code: string;
    name: string;
    url?: string | null;
  }): Observable<ProgramNetwork> {
    return defer(() =>
      from(
        apiFetch('/networks', {
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
              return throwError(() => new Error(apiResponse?.error || 'Impossible d’ajouter le réseau.'));
            }

            return from([apiResponse.data as ProgramNetwork]);
          })
        )
      )
    );
  }

  updateNetwork$(payload: {
    networkId: string;
    code: string;
    name: string;
    url?: string | null;
  }): Observable<ProgramNetwork> {
    return defer(() =>
      from(
        apiFetch('/networks', {
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
              return throwError(() => new Error(apiResponse?.error || 'Impossible de modifier le réseau.'));
            }

            return from([apiResponse.data as ProgramNetwork]);
          })
        )
      )
    );
  }

  deleteNetwork$(networkId: string): Observable<{ networkId: string }> {
    return defer(() =>
      from(
        apiFetch('/networks', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ networkId })
        })
      )
    ).pipe(
      switchMap((response) =>
        from(response.json() as Promise<ApiResponse>).pipe(
          switchMap((apiResponse) => {
            if (!response.ok) {
              return throwError(() => new Error(apiResponse?.error || 'Impossible de supprimer le réseau.'));
            }

            return from([apiResponse.data as { networkId: string }]);
          })
        )
      )
    );
  }

  getProgramBySectionId$(
    sectionId: string,
    networkId: string,
    subjectId?: string | null,
    programId?: string | null,
    withoutProgram = false
  ): Observable<SectionProgram> {
    const params = new URLSearchParams({
      sectionId,
      networkId
    });

    if (subjectId) {
      params.set('subjectId', subjectId);
    }

    if (programId) {
      params.set('programId', programId);
    }

    if (withoutProgram) {
      params.set('withoutProgram', 'true');
    }

    return defer(() =>
      from(
        apiFetch(`/program?${params.toString()}`, {
          method: 'GET'
        })
      )
    ).pipe(
      switchMap((response) =>
        from(response.json() as Promise<ApiResponse>).pipe(
          switchMap((payload) => {
            if (!response.ok) {
              return throwError(() => new Error(payload?.error || 'Impossible de récupérer le programme.'));
            }

            return from([payload.data as SectionProgram]);
          })
        )
      )
    );
  }

  createProgram$(payload: {
    subjectId: string;
    sectionId: string;
    networkId: string;
    hours: number;
    name?: string | null;
    validFrom?: string | null;
    validTo?: string | null;
  }): Observable<{ id: string }> {
    return this.mutateProgram$({
      action: 'create-program',
      ...payload
    });
  }

  updateProgram$(payload: {
    programId: string;
    hours: number;
    name?: string | null;
  }): Observable<{ id: string }> {
    return this.mutateProgram$({
      action: 'update-program',
      ...payload
    });
  }

  createProgramUaa$(payload: {
    programId: string;
    code: string;
    name: string;
  }): Observable<{ id: string }> {
    return this.mutateProgram$({
      action: 'create-uaa',
      ...payload
    });
  }

  createProgramResource$(payload: {
    uaaId: string;
    description: string;
  }): Observable<{ id: string }> {
    return this.mutateProgram$({
      action: 'create-resource',
      ...payload
    });
  }

  createProgramCompetence$(payload: {
    uaaId: string;
    description: string;
  }): Observable<{ id: string }> {
    return this.mutateProgram$({
      action: 'create-competence',
      ...payload
    });
  }

  createProgramStrategy$(payload: {
    uaaId: string;
    description: string;
  }): Observable<{ id: string }> {
    return this.mutateProgram$({
      action: 'create-strategy',
      ...payload
    });
  }

  createProgramSkill$(payload: {
    uaaId: string;
    processTypeName: string;
    description: string;
  }): Observable<{ id: string }> {
    return this.mutateProgram$({
      action: 'create-skill',
      ...payload
    });
  }

  deleteProgramItem$(payload: {
    itemId: string;
    itemType: 'resource' | 'competence' | 'strategy' | 'skill';
  }): Observable<{ id: string }> {
    return this.mutateProgram$({
      action: 'delete-item',
      ...payload
    });
  }

  updateProgramItem$(payload: {
    itemId: string;
    itemType: 'resource' | 'competence' | 'strategy' | 'skill';
    description: string;
  }): Observable<{ id: string }> {
    return this.mutateProgram$({
      action: 'update-item',
      ...payload
    });
  }

  getProgramCatalog$(subjectId?: string | null, excludeProgramId?: string | null): Observable<ProgramCatalogItem[]> {
    const params = new URLSearchParams();

    if (subjectId) {
      params.set('subjectId', subjectId);
    }

    if (excludeProgramId) {
      params.set('excludeProgramId', excludeProgramId);
    }

    const query = params.toString();

    return defer(() => from(apiFetch(`/program-catalog${query ? `?${query}` : ''}`, { method: 'GET' }))).pipe(
      switchMap((response) =>
        from(response.json() as Promise<ApiResponse>).pipe(
          switchMap((payload) => {
            if (!response.ok) {
              return throwError(() => new Error(payload?.error || 'Impossible de lister les programmes.'));
            }

            return from([(payload.data ?? []) as ProgramCatalogItem[]]);
          })
        )
      )
    );
  }

  cloneProgramUaas$(targetProgramId: string, uaaIds: string[]): Observable<{ ids: string[] }> {
    return defer(() =>
      from(
        apiFetch('/program', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            action: 'clone-uaas',
            targetProgramId,
            uaaIds
          })
        })
      )
    ).pipe(
      switchMap((response) =>
        from(response.json() as Promise<ApiResponse>).pipe(
          switchMap((apiResponse) => {
            if (!response.ok) {
              return throwError(() => new Error(apiResponse?.error || 'Impossible de copier les UAA.'));
            }

            return from([apiResponse.data as { ids: string[] }]);
          })
        )
      )
    );
  }

  private mutateProgram$(payload: Record<string, unknown>): Observable<{ id: string }> {
    return defer(() =>
      from(
        apiFetch('/program', {
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
              return throwError(() => new Error(apiResponse?.error || 'Impossible d’enregistrer le programme.'));
            }

            return from([apiResponse.data as { id: string }]);
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

  getSubjects$(): Observable<Subject[]> {
    return defer(() => from(apiFetch('/subjects', { method: 'GET' }))).pipe(
      switchMap((response) =>
        from(response.json() as Promise<ApiResponse>).pipe(
          switchMap((payload) => {
            if (!response.ok) {
              return throwError(() => new Error(payload?.error || 'Impossible de récupérer les matières.'));
            }

            return from([(payload.data ?? []) as Subject[]]);
          })
        )
      )
    );
  }

  createSubject$(payload: { name: string }): Observable<Subject> {
    return defer(() =>
      from(
        apiFetch('/subjects', {
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
              return throwError(() => new Error(apiResponse?.error || 'Impossible d’ajouter la matière.'));
            }

            return from([apiResponse.data as Subject]);
          })
        )
      )
    );
  }

  deleteSubject$(subjectId: string): Observable<{ subjectId: string }> {
    return defer(() =>
      from(
        apiFetch('/subjects', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ subjectId })
        })
      )
    ).pipe(
      switchMap((response) =>
        from(response.json() as Promise<ApiResponse>).pipe(
          switchMap((apiResponse) => {
            if (!response.ok) {
              return throwError(() => new Error(apiResponse?.error || 'Impossible de supprimer la matière.'));
            }

            return from([apiResponse.data as { subjectId: string }]);
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
    subjectId?: string | null;
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
    subjectId?: string | null;
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
