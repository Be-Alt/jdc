import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, defer, from, switchMap, throwError } from 'rxjs';
import { apiFetch } from '../helpers/api-session';
import {
  AttendanceStatus,
  ClassJournalEntry,
  ClassJournalEntryPayload,
  ClassJournalSlotDraft,
  ClassJournalStudentDraft
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
          teacherIsAbsent: entry.teacher_is_absent,
          teacherAbsenceHasCm: entry.teacher_absence_has_cm,
          studentRecords: entry.students.reduce<Record<string, ClassJournalStudentDraft>>(
            (studentCollection, student) => ({
              ...studentCollection,
              [student.student_enrollment_id]: {
                sectionId: student.section_id ?? '',
                networkId: student.network_id ?? '',
                attendanceStatus: student.attendance_status,
                comment: student.comment,
                selectedSkillIds: student.selected_skill_ids,
                selectedResourceIds: student.selected_resource_ids
              }
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
      teacherIsAbsent: false,
      teacherAbsenceHasCm: false,
      studentRecords: {}
    };
  }

  getStudentDraft(slotKey: string, studentEnrollmentId: string): ClassJournalStudentDraft {
    return this.getDraft(slotKey).studentRecords[studentEnrollmentId] ?? {
      sectionId: '',
      networkId: '',
      attendanceStatus: 'present',
      comment: '',
      selectedSkillIds: [],
      selectedResourceIds: []
    };
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

  setStudentAttendanceStatus(slotKey: string, studentEnrollmentId: string, attendanceStatus: AttendanceStatus): void {
    const studentDraft = this.getStudentDraft(slotKey, studentEnrollmentId);
    this.updateStudentDraft(slotKey, studentEnrollmentId, {
      ...studentDraft,
      attendanceStatus
    });
  }

  setStudentComment(slotKey: string, studentEnrollmentId: string, comment: string): void {
    const studentDraft = this.getStudentDraft(slotKey, studentEnrollmentId);
    this.updateStudentDraft(slotKey, studentEnrollmentId, {
      ...studentDraft,
      comment
    });
  }

  toggleSkill(slotKey: string, studentEnrollmentId: string, skillId: string): void {
    const studentDraft = this.getStudentDraft(slotKey, studentEnrollmentId);
    this.updateStudentDraft(slotKey, studentEnrollmentId, {
      ...studentDraft,
      selectedSkillIds: this.toggleId(studentDraft.selectedSkillIds, skillId)
    });
  }

  toggleResource(slotKey: string, studentEnrollmentId: string, resourceId: string): void {
    const studentDraft = this.getStudentDraft(slotKey, studentEnrollmentId);
    this.updateStudentDraft(slotKey, studentEnrollmentId, {
      ...studentDraft,
      selectedResourceIds: this.toggleId(studentDraft.selectedResourceIds, resourceId)
    });
  }

  private updateStudentDraft(slotKey: string, studentEnrollmentId: string, studentDraft: ClassJournalStudentDraft): void {
    const slotDraft = this.getDraft(slotKey);
    this.updateDraft(slotKey, {
      studentRecords: {
        ...slotDraft.studentRecords,
        [studentEnrollmentId]: studentDraft
      }
    });
  }

  setStudentSection(
    slotKey: string,
    studentEnrollmentId: string,
    sectionId: string,
    options?: { preserveSelections?: boolean }
  ): void {
    const studentDraft = this.getStudentDraft(slotKey, studentEnrollmentId);
    const preserveSelections = options?.preserveSelections === true;
    this.updateStudentDraft(slotKey, studentEnrollmentId, {
      ...studentDraft,
      sectionId,
      networkId: '',
      selectedSkillIds: preserveSelections ? studentDraft.selectedSkillIds : [],
      selectedResourceIds: preserveSelections ? studentDraft.selectedResourceIds : []
    });
  }

  setStudentNetwork(
    slotKey: string,
    studentEnrollmentId: string,
    networkId: string,
    options?: { preserveSelections?: boolean }
  ): void {
    const studentDraft = this.getStudentDraft(slotKey, studentEnrollmentId);
    const preserveSelections = options?.preserveSelections === true;
    this.updateStudentDraft(slotKey, studentEnrollmentId, {
      ...studentDraft,
      networkId,
      selectedSkillIds: preserveSelections ? studentDraft.selectedSkillIds : [],
      selectedResourceIds: preserveSelections ? studentDraft.selectedResourceIds : []
    });
  }

  private toggleId(ids: string[], id: string): string[] {
    return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
  }
}
