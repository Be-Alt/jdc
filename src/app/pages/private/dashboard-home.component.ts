import { AsyncPipe, NgClass } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { catchError, combineLatest, map, of, startWith } from 'rxjs';
import { StudentOption } from '../../models/StudentOption';
import { WeeklyScheduleConfig, WeeklyScheduleSlot } from '../../models/WeeklySchedule';
import { SettingsService } from '../../services/settings.service';

type DaySchedule = {
  dayOfWeek: number;
  label: string;
  slots: Array<
    WeeklyScheduleSlot & {
      students: StudentOption[];
    }
  >;
};

type DashboardHomeViewModel = {
  isLoading: boolean;
  errorMessage: string;
  schedule: WeeklyScheduleConfig | null;
  days: DaySchedule[];
  visibleDays: DaySchedule[];
  currentDayLabel: string;
  showAllDays: boolean;
  totalCourseSlots: number;
  totalLinkedStudents: number;
};

@Component({
  selector: 'app-dashboard-home',
  imports: [AsyncPipe, NgClass, RouterLink],
  templateUrl: './dashboard-home.component.html'
})
export class DashboardHomeComponent {
  private readonly settingsService = inject(SettingsService);
  private readonly showAllDaysSubject = new BehaviorSubject<boolean>(false);

  private readonly weekdays: Array<{ dayOfWeek: number; label: string }> = [
    { dayOfWeek: 1, label: 'Lundi' },
    { dayOfWeek: 2, label: 'Mardi' },
    { dayOfWeek: 3, label: 'Mercredi' },
    { dayOfWeek: 4, label: 'Jeudi' },
    { dayOfWeek: 5, label: 'Vendredi' }
  ];

  protected readonly vm$ = combineLatest([
    this.settingsService.getWeeklySchedule$().pipe(
      startWith(undefined as WeeklyScheduleConfig | null | undefined),
      catchError((error: unknown) =>
        of({
          __error:
            error instanceof Error ? error.message : 'Impossible de charger l’horaire du professeur.'
        } as const)
      )
    ),
    this.settingsService.getStudentOptions$().pipe(
      startWith([] as StudentOption[]),
      catchError(() => of([] as StudentOption[]))
    ),
    this.showAllDaysSubject.asObservable()
  ]).pipe(
    map(([scheduleState, studentOptions, showAllDays]) => {
      const currentDayOfWeek = this.getCurrentDayOfWeek();
      const currentDay = this.weekdays.find((day) => day.dayOfWeek === currentDayOfWeek);

      if (scheduleState && typeof scheduleState === 'object' && '__error' in scheduleState) {
        const days = this.buildDays(null, studentOptions);

        return {
          isLoading: false,
          errorMessage: scheduleState.__error,
          schedule: null,
          days,
          visibleDays: this.getVisibleDays(days, showAllDays, currentDayOfWeek),
          currentDayLabel: currentDay?.label ?? 'Aujourd’hui',
          showAllDays,
          totalCourseSlots: 0,
          totalLinkedStudents: 0
        } satisfies DashboardHomeViewModel;
      }

      const schedule = scheduleState;
      const days = this.buildDays(schedule ?? null, studentOptions);
      const courseSlots = days.flatMap((day) => day.slots).filter((slot) => slot.slot_type === 'course');
      const totalLinkedStudents = courseSlots.reduce(
        (count, slot) => count + slot.student_enrollment_ids.length,
        0
      );

      return {
        isLoading: scheduleState === undefined,
        errorMessage: '',
        schedule: schedule ?? null,
        days,
        visibleDays: this.getVisibleDays(days, showAllDays, currentDayOfWeek),
        currentDayLabel: currentDay?.label ?? 'Aujourd’hui',
        showAllDays,
        totalCourseSlots: courseSlots.length,
        totalLinkedStudents
      } satisfies DashboardHomeViewModel;
    })
  );

  protected toggleDayView(): void {
    this.showAllDaysSubject.next(!this.showAllDaysSubject.value);
  }

  private buildDays(
    schedule: WeeklyScheduleConfig | null,
    studentOptions: StudentOption[]
  ): DaySchedule[] {
    const studentMap = new Map(studentOptions.map((student) => [student.enrollment_id, student]));

    return this.weekdays.map((day) => ({
      dayOfWeek: day.dayOfWeek,
      label: day.label,
      slots:
        schedule?.slots
          .filter((slot) => slot.day_of_week === day.dayOfWeek)
          .map((slot) => ({
            ...slot,
            students: slot.student_enrollment_ids
              .map((studentId) => studentMap.get(studentId))
              .filter((student): student is StudentOption => Boolean(student))
          })) ?? []
    }));
  }

  private getVisibleDays(days: DaySchedule[], showAllDays: boolean, currentDayOfWeek: number): DaySchedule[] {
    if (showAllDays) {
      return days;
    }

    const currentDay = days.find((day) => day.dayOfWeek === currentDayOfWeek);
    return currentDay ? [currentDay] : [days[0]].filter(Boolean);
  }

  private getCurrentDayOfWeek(referenceDate = new Date()): number {
    const day = referenceDate.getDay();

    if (day === 0) {
      return 1;
    }

    if (day === 6) {
      return 5;
    }

    return day;
  }
}
