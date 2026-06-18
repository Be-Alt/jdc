import { Injectable, signal } from '@angular/core';
import { environment } from '../../environments/environment';
import {
  ApiResponse,
  ClassJournalEntryPayload,
  ClassJournalEntry,
  CurrentUser,
  ObservationCategory,
  ProgramNetwork,
  SchoolYear,
  SectionProgram,
  StudentListItem,
  StudentSummary,
  WeeklyScheduleConfig
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

  async getStudents(): Promise<StudentListItem[]> {
    const schoolYear = await this.getDefaultSchoolYear();

    if (!schoolYear) {
      return [];
    }

    const students = await this.request<StudentListItem[]>(
      `/students?schoolYearId=${encodeURIComponent(schoolYear.id)}`
    );

    return students.map((student) => ({
      ...student,
      section_name: student.section_name ?? student.section_code ?? student.section_label ?? null
    }));
  }

  getSchoolYears(): Promise<SchoolYear[]> {
    return this.request<SchoolYear[]>('/school-years');
  }

  getStudentSummary(enrollmentId: string): Promise<StudentSummary> {
    return this.request<StudentSummary>(
      `/student-summary?enrollmentId=${encodeURIComponent(enrollmentId)}&includeProgram=true`
    );
  }

  getJournalEntries(date: string): Promise<ClassJournalEntry[]> {
    return this.request<ClassJournalEntry[]>(`/class-journal?date=${encodeURIComponent(date)}`);
  }

  async getStudentOptions(): Promise<StudentListItem[]> {
    const students = await this.request<StudentListItem[]>('/student-options');

    return students.map((student) => ({
      ...student,
      section_name: student.section_name ?? student.section_code ?? student.section_label ?? null
    }));
  }

  getWeeklySchedule(): Promise<WeeklyScheduleConfig | null> {
    return this.request<WeeklyScheduleConfig | null>('/weekly-schedule');
  }

  getProgramNetworksBySectionId(sectionId: string): Promise<ProgramNetwork[]> {
    return this.request<ProgramNetwork[]>(`/program-networks?sectionId=${encodeURIComponent(sectionId)}`);
  }

  getProgramBySectionId(
    sectionId: string,
    networkId: string,
    programId?: string | null
  ): Promise<SectionProgram> {
    const params = new URLSearchParams({
      sectionId,
      networkId
    });

    if (programId) {
      params.set('programId', programId);
    }

    return this.request<SectionProgram>(`/program?${params.toString()}`);
  }

  saveJournalEntry(payload: ClassJournalEntryPayload): Promise<ClassJournalEntry> {
    return this.request<ClassJournalEntry>('/class-journal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
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

  private async getDefaultSchoolYear(): Promise<SchoolYear | null> {
    const schoolYears = this.sortSchoolYears(await this.getSchoolYears());
    const currentSchoolYearLabel = this.normalizeSchoolYearLabel(this.getCurrentSchoolYearLabel());

    return (
      schoolYears.find(
        (schoolYear) => this.normalizeSchoolYearLabel(schoolYear.label) === currentSchoolYearLabel
      ) ??
      schoolYears[0] ??
      null
    );
  }

  private getCurrentSchoolYearLabel(referenceDate = new Date()): string {
    const year = referenceDate.getFullYear();
    const month = referenceDate.getMonth();

    if (month >= 8) {
      return `${year}-${year + 1}`;
    }

    return `${year - 1}-${year}`;
  }

  private sortSchoolYears(schoolYears: SchoolYear[]): SchoolYear[] {
    return [...schoolYears].sort((left, right) => {
      const leftDate = left.start_date ?? this.normalizeSchoolYearLabel(left.label);
      const rightDate = right.start_date ?? this.normalizeSchoolYearLabel(right.label);

      return rightDate.localeCompare(leftDate);
    });
  }

  private normalizeSchoolYearLabel(label: string): string {
    return label.replace(/\s+/g, '');
  }
}
