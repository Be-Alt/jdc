import { Injectable, signal } from '@angular/core';
import { environment } from '../../environments/environment';
import {
  ApiResponse,
  ClassJournalEntry,
  CurrentUser,
  ObservationCategory,
  StudentListItem,
  StudentSummary
} from '../models/jdc-mobile.models';

@Injectable({
  providedIn: 'root'
})
export class JdcApiService {
  readonly apiBaseUrl = signal(environment.apiBaseUrl);

  async getCurrentUser(): Promise<CurrentUser | null> {
    try {
      const response = await this.request<CurrentUser>('/me');
      return response ?? null;
    } catch {
      return null;
    }
  }

  getStudents(): Promise<StudentListItem[]> {
    return this.request<StudentListItem[]>('/students');
  }

  getStudentSummary(enrollmentId: string): Promise<StudentSummary> {
    return this.request<StudentSummary>(
      `/student-summary?enrollmentId=${encodeURIComponent(enrollmentId)}&includeProgram=true`
    );
  }

  getJournalEntries(date: string): Promise<ClassJournalEntry[]> {
    return this.request<ClassJournalEntry[]>(`/class-journal?date=${encodeURIComponent(date)}`);
  }

  getObservationCatalog(): Promise<ObservationCategory[]> {
    return this.request<ObservationCategory[]>('/observation-catalog');
  }

  async syncProfile(user: { userId: string; email: string; name: string | null }): Promise<void> {
    await this.request('/profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(user)
    });
  }

  async logout(): Promise<void> {
    await this.request('/logout', {
      method: 'POST'
    });
  }

  updateApiBaseUrl(value: string): void {
    this.apiBaseUrl.set(value.trim().replace(/\/$/, ''));
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const method = init?.method ?? 'GET';
    const requestPath = method === 'GET' ? this.withCacheBuster(path) : path;

    const response = await fetch(`${this.apiBaseUrl()}${requestPath}`, {
      method,
      ...init,
      cache: 'no-store',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(init?.headers ?? {})
      }
    });
    const payload = (await response.json().catch(() => ({}))) as ApiResponse<T>;

    if (!response.ok) {
      throw new Error(payload.error ?? `Erreur API ${response.status}`);
    }

    return (payload.data ?? payload) as T;
  }

  private withCacheBuster(path: string): string {
    const separator = path.includes('?') ? '&' : '?';
    return `${path}${separator}_=${Date.now()}`;
  }
}
