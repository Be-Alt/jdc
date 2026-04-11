import { Injectable } from '@angular/core';
import {
  BehaviorSubject,
  Observable,
  combineLatest,
  defer,
  from,
  map,
  shareReplay,
  switchMap,
  tap,
  throwError
} from 'rxjs';
import { apiFetch } from '../helpers/api-session';
import { SchoolYear } from '../models/SchoolYear';
import { ApiResponse } from '../models/response';

@Injectable({
  providedIn: 'root',
})
export class GeneralService {
  private readonly showArchivesSubject = new BehaviorSubject<boolean>(false);
  private readonly selectedSchoolYearIdSubject = new BehaviorSubject<string | null>(null);
  private readonly refreshSchoolYearsSubject = new BehaviorSubject<void>(undefined);

  private readonly schoolYearsRequest$ = this.refreshSchoolYearsSubject.pipe(
    switchMap(() => defer(() => from(apiFetch('/school-years', { method: 'GET' })))),
    switchMap((response) =>
      from(response.json() as Promise<ApiResponse>).pipe(
        switchMap((payload) => {
          if (!response.ok) {
            return throwError(() => new Error(payload?.error || 'Impossible de récupérer les années scolaires.'));
          }

          return from([this.sortSchoolYears(payload.data ?? [])]);
        })
      )
    ),
    tap((schoolYears) => {
      const currentSelection = this.selectedSchoolYearIdSubject.value;
      const currentSelectionStillExists = schoolYears.some((schoolYear) => schoolYear.id === currentSelection);

      if (currentSelection && currentSelectionStillExists) {
        return;
      }

      const defaultYear = this.resolveDefaultSchoolYear(schoolYears);
      this.selectedSchoolYearIdSubject.next(defaultYear?.id ?? null);
    }),
    shareReplay(1)
  );

  readonly schoolYears$ = this.schoolYearsRequest$;
  readonly showArchives$ = this.showArchivesSubject.asObservable();
  readonly selectedSchoolYear$ = combineLatest([
    this.schoolYears$,
    this.selectedSchoolYearIdSubject.asObservable()
  ]).pipe(
    map(([schoolYears, selectedId]) => {
      const selectedYear = schoolYears.find((schoolYear) => schoolYear.id === selectedId);
      return selectedYear ?? this.resolveDefaultSchoolYear(schoolYears) ?? null;
    }),
    shareReplay(1)
  );
  readonly visibleSchoolYears$ = combineLatest([
    this.schoolYears$,
    this.selectedSchoolYear$,
    this.showArchives$
  ]).pipe(
    map(([schoolYears, selectedSchoolYear, showArchives]) => {
      if (showArchives) {
        return schoolYears;
      }

      return selectedSchoolYear ? [selectedSchoolYear] : [];
    }),
    shareReplay(1)
  );

  getSchoolYears$(): Observable<SchoolYear[]> {
    return this.schoolYears$;
  }

  setSelectedSchoolYear(schoolYearId: string): void {
    this.selectedSchoolYearIdSubject.next(schoolYearId);
  }

  refreshSchoolYears(): void {
    this.refreshSchoolYearsSubject.next();
  }

  setShowArchives(showArchives: boolean): void {
    this.showArchivesSubject.next(showArchives);
  }

  toggleArchives(): void {
    this.showArchivesSubject.next(!this.showArchivesSubject.value);
  }

  getCurrentSchoolYearLabel(referenceDate = new Date()): string {
    const year = referenceDate.getFullYear();
    const month = referenceDate.getMonth();

    if (month >= 8) {
      return `${year}-${year + 1}`;
    }

    return `${year - 1}-${year}`;
  }

  private resolveDefaultSchoolYear(schoolYears: SchoolYear[]): SchoolYear | null {
    const currentSchoolYearLabel = this.normalizeSchoolYearLabel(this.getCurrentSchoolYearLabel());
    const currentSchoolYear = schoolYears.find(
      (schoolYear) => this.normalizeSchoolYearLabel(schoolYear.label) === currentSchoolYearLabel
    );

    return currentSchoolYear ?? schoolYears[0] ?? null;
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
