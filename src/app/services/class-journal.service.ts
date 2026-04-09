import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, defer, from, switchMap, throwError } from 'rxjs';
import { apiFetch } from '../helpers/api-session';
import {
  ClassJournalEntry,
  ClassJournalEntryPayload,
  ClassJournalSlotDraft
} from '../models/ClassJournal';
import { ApiResponse } from '../models/response';

@Injectable({
  providedIn: 'root'
})
export class ClassJournalService {
  private readonly draftsSubject = new BehaviorSubject<Record<string, ClassJournalSlotDraft>>({});
  readonly drafts$ = this.draftsSubject.asObservable();

  getEntriesByDate$(date: string): Observable<ClassJournalEntry[]> {
    return defer(() =>
      from(
        apiFetch(`/class-journal?date=${encodeURIComponent(date)}`, {
          method: 'GET'
        })
      )
    ).pipe(
      switchMap((response) =>
        from(response.json() as Promise<ApiResponse>).pipe(
          switchMap((payload) => {
            if (!response.ok) {
              return throwError(() => new Error(payload?.error || 'Impossible de récupérer le journal.'));
            }

            return from([(payload.data ?? []) as ClassJournalEntry[]]);
          })
        )
      )
    );
  }

  saveEntry$(payload: ClassJournalEntryPayload): Observable<ClassJournalEntry> {
    return defer(() =>
      from(
        apiFetch('/class-journal', {
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
              return throwError(() => new Error(apiResponse?.error || 'Impossible d’enregistrer le journal.'));
            }

            return from([apiResponse.data as ClassJournalEntry]);
          })
        )
      )
    );
  }

  hydrateEntries(entries: ClassJournalEntry[]): void {
    const drafts = this.draftsSubject.value;
    const hydratedDrafts = entries.reduce<Record<string, ClassJournalSlotDraft>>(
      (collection, entry) => ({
        ...collection,
        [entry.slot_key]: {
          notes: entry.notes,
          sectionId: entry.section_id ?? '',
          networkId: entry.network_id ?? '',
          selectedSkillIds: entry.selected_skill_ids,
          selectedResourceIds: entry.selected_resource_ids,
          teacherIsAbsent: entry.teacher_is_absent,
          teacherAbsenceHasCm: entry.teacher_absence_has_cm,
          studentStatuses: entry.student_statuses.reduce<Record<string, 'present' | 'absent' | 'late' | 'excused'>>(
            (collection, studentStatus) => ({
              ...collection,
              [studentStatus.student_enrollment_id]: studentStatus.attendance_status
            }),
            {}
          )
        }
      }),
      drafts
    );

    this.draftsSubject.next(hydratedDrafts);
  }

  updateDraft(slotKey: string, patch: Partial<ClassJournalSlotDraft>): void {
    const drafts = this.draftsSubject.value;
    const currentDraft = this.getDraft(slotKey);

    this.draftsSubject.next({
      ...drafts,
      [slotKey]: {
        ...currentDraft,
        ...patch
      }
    });
  }

  getDraft(slotKey: string): ClassJournalSlotDraft {
    return this.draftsSubject.value[slotKey] ?? {
      notes: '',
      sectionId: '',
      networkId: '',
      selectedSkillIds: [],
      selectedResourceIds: [],
      teacherIsAbsent: false,
      teacherAbsenceHasCm: false,
      studentStatuses: {}
    };
  }

  toggleSkill(slotKey: string, skillId: string): void {
    const draft = this.getDraft(slotKey);
    this.updateDraft(slotKey, {
      selectedSkillIds: this.toggleId(draft.selectedSkillIds, skillId)
    });
  }

  toggleResource(slotKey: string, resourceId: string): void {
    const draft = this.getDraft(slotKey);
    this.updateDraft(slotKey, {
      selectedResourceIds: this.toggleId(draft.selectedResourceIds, resourceId)
    });
  }

  setTeacherAbsence(slotKey: string, teacherIsAbsent: boolean): void {
    const draft = this.getDraft(slotKey);
    this.updateDraft(slotKey, {
      teacherIsAbsent,
      teacherAbsenceHasCm: teacherIsAbsent ? draft.teacherAbsenceHasCm : false
    });
  }

  setTeacherAbsenceHasCm(slotKey: string, teacherAbsenceHasCm: boolean): void {
    const draft = this.getDraft(slotKey);
    this.updateDraft(slotKey, {
      teacherIsAbsent: draft.teacherIsAbsent,
      teacherAbsenceHasCm: draft.teacherIsAbsent ? teacherAbsenceHasCm : false
    });
  }

  setStudentAttendanceStatus(
    slotKey: string,
    studentEnrollmentId: string,
    attendanceStatus: 'present' | 'absent' | 'late' | 'excused'
  ): void {
    const draft = this.getDraft(slotKey);
    this.updateDraft(slotKey, {
      studentStatuses: {
        ...draft.studentStatuses,
        [studentEnrollmentId]: attendanceStatus
      }
    });
  }

  private toggleId(ids: string[], id: string): string[] {
    return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
  }
}
