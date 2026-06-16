import { Injectable } from '@angular/core';
import { Observable, defer, from, switchMap, throwError } from 'rxjs';
import { apiFetch } from '../helpers/api-session';
import {
  CommunicationDirection,
  CommunicationReminder,
  StudentCommunicationData
} from '../models/StudentCommunication';
import { ApiResponse } from '../models/response';

@Injectable({ providedIn: 'root' })
export class StudentCommunicationsService {
  getStudentData$(enrollmentId: string): Observable<StudentCommunicationData> {
    return this.request$<StudentCommunicationData>(
      `/student-communications?enrollmentId=${encodeURIComponent(enrollmentId)}`
    );
  }

  getDueReminders$(): Observable<CommunicationReminder[]> {
    return this.request$<CommunicationReminder[]>('/student-communications?due=true');
  }

  createInteraction$(payload: {
    enrollmentId: string;
    teacherId?: string | null;
    direction: CommunicationDirection;
    contactName?: string | null;
    contactEmail?: string | null;
    subject?: string | null;
    content: string;
    occurredOn?: string | null;
  }): Observable<StudentCommunicationData> {
    return this.request$<StudentCommunicationData>('/student-communications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create-interaction', ...payload })
    });
  }

  createReminder$(payload: {
    enrollmentId: string;
    teacherId?: string | null;
    title: string;
    notes?: string | null;
    dueDate?: string | null;
  }): Observable<StudentCommunicationData> {
    return this.request$<StudentCommunicationData>('/student-communications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create-reminder', ...payload })
    });
  }

  updateReminder$(reminderId: string, action: 'complete-reminder' | 'delete-reminder'): Observable<unknown> {
    return this.request$('/student-communications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, reminderId })
    });
  }

  private request$<T>(path: string, init: RequestInit = { method: 'GET' }): Observable<T> {
    return defer(() => from(apiFetch(path, init))).pipe(
      switchMap((response) =>
        from(response.json() as Promise<ApiResponse>).pipe(
          switchMap((payload) => {
            if (!response.ok) {
              return throwError(() => new Error(payload?.error || 'Impossible de gérer les communications.'));
            }
            return from([payload.data as T]);
          })
        )
      )
    );
  }
}
