import { Component, computed, OnInit, signal } from '@angular/core';
import {
  IonAccordion,
  IonAccordionGroup,
  IonBadge,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCheckbox,
  IonContent,
  IonDatetime,
  IonDatetimeButton,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonNote,
  IonRange,
  IonRefresher,
  IonRefresherContent,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTextarea,
  IonTitle,
  IonToggle,
  IonToolbar,
  RefresherCustomEvent
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { checkmarkCircleOutline, refreshOutline, saveOutline } from 'ionicons/icons';
import {
  AttendanceStatus,
  ClassJournalEntry,
  ClassJournalSlotDraft,
  ClassJournalStudentDraft,
  ProgramSkill,
  ProgramUaa,
  SectionProgram,
  StudentIndicatorKey,
  StudentListItem,
  WeeklyScheduleConfig,
  WeeklyScheduleSlot
} from '../../models/jdc-mobile.models';
import { JdcApiService } from '../../services/jdc-api.service';

@Component({
  selector: 'app-journal',
  standalone: true,
  imports: [
    IonAccordion,
    IonAccordionGroup,
    IonBadge,
    IonButton,
    IonButtons,
    IonCard,
    IonCardContent,
    IonCheckbox,
    IonContent,
    IonDatetime,
    IonDatetimeButton,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonModal,
    IonNote,
    IonRange,
    IonRefresher,
    IonRefresherContent,
    IonSelect,
    IonSelectOption,
    IonSpinner,
    IonTextarea,
    IonTitle,
    IonToggle,
    IonToolbar
  ],
  templateUrl: './journal.page.html'
})
export class JournalPage implements OnInit {
  readonly loading = signal(true);
  readonly error = signal('');
  readonly date = signal(new Date().toISOString().slice(0, 10));
  readonly schedule = signal<WeeklyScheduleConfig | null>(null);
  readonly students = signal<StudentListItem[]>([]);
  readonly entries = signal<ClassJournalEntry[]>([]);
  readonly drafts = signal<Record<string, ClassJournalSlotDraft>>({});
  readonly programStates = signal<Record<string, { isLoading: boolean; error: string; program: SectionProgram | null }>>({});
  readonly savingSlotKey = signal('');
  readonly saveErrors = signal<Record<string, string>>({});
  readonly saveSuccess = signal<Record<string, string>>({});

  readonly slots = computed(() => {
    const schedule = this.schedule();

    if (!schedule) {
      return [];
    }

    const dayOfWeek = this.getScheduleDayOfWeek(this.date());
    return schedule.slots
      .filter((slot) => slot.day_of_week === dayOfWeek)
      .sort((left, right) => left.starts_at.localeCompare(right.starts_at));
  });

  readonly studentCount = computed(() =>
    this.slots().reduce((total, slot) => total + this.getStudentsForSlot(slot).length, 0)
  );

  constructor(private readonly api: JdcApiService) {
    addIcons({ checkmarkCircleOutline, refreshOutline, saveOutline });
  }

  ngOnInit(): void {
    void this.load();
  }

  async refresh(event: RefresherCustomEvent): Promise<void> {
    await this.load();
    event.target.complete();
  }

  async changeDate(value: string | string[] | null | undefined): Promise<void> {
    const nextDate = Array.isArray(value) ? value[0] : value;
    if (!nextDate) {
      return;
    }
    this.date.set(nextDate.slice(0, 10));
    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');

    try {
      const [schedule, students, entries] = await Promise.all([
        this.api.getWeeklySchedule(),
        this.api.getStudentOptions(),
        this.api.getJournalEntries(this.date())
      ]);

      this.schedule.set(schedule);
      this.students.set(students);
      this.entries.set(entries);
      this.hydrateDrafts(entries);
      await this.loadProgramsForStudents(students);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Impossible de charger le journal.');
    } finally {
      this.loading.set(false);
    }
  }

  getSlotKey(slot: WeeklyScheduleSlot): string {
    return `${this.date()}-${slot.id ?? slot.position}-${slot.starts_at}`;
  }

  getEntryForSlot(slot: WeeklyScheduleSlot): ClassJournalEntry | null {
    const slotKey = this.getSlotKey(slot);
    return this.entries().find((entry) => entry.slot_key === slotKey) ?? null;
  }

  isSlotValidated(slot: WeeklyScheduleSlot): boolean {
    return this.getEntryForSlot(slot) !== null;
  }

  isTeacherAbsent(slot: WeeklyScheduleSlot): boolean {
    return this.getDraft(slot).teacherIsAbsent;
  }

  getSlotTypeLabel(slot: WeeklyScheduleSlot): string {
    switch (slot.slot_type) {
      case 'break':
        return 'Recreation';
      case 'lunch':
        return 'Temps de midi';
      default:
        return slot.label;
    }
  }

  getDraft(slot: WeeklyScheduleSlot): ClassJournalSlotDraft {
    return this.drafts()[this.getSlotKey(slot)] ?? this.getEmptySlotDraft();
  }

  getStudentsForSlot(slot: WeeklyScheduleSlot): StudentListItem[] {
    return slot.student_enrollment_ids
      .map((studentId) => this.students().find((student) => student.enrollment_id === studentId))
      .filter((student): student is StudentListItem => Boolean(student));
  }

  getAttendanceLabel(status: AttendanceStatus): string {
    switch (status) {
      case 'absent':
        return 'Absent';
      case 'late':
        return 'Retard';
      case 'excused':
        return 'Excuse';
      default:
        return 'Present';
    }
  }

  getStudentDraft(slot: WeeklyScheduleSlot, studentEnrollmentId: string) {
    return this.getDraft(slot).studentRecords[studentEnrollmentId] ?? this.getEmptyStudentDraft();
  }

  getProgramState(studentEnrollmentId: string) {
    return this.programStates()[studentEnrollmentId] ?? { isLoading: false, error: '', program: null };
  }

  getSubjectLabel(studentEnrollmentId: string): string {
    const program = this.getProgramState(studentEnrollmentId).program?.program;
    return program?.subject?.name ?? program?.name ?? 'Matiere non definie';
  }

  getIndicatorSummary(slot: WeeklyScheduleSlot, studentEnrollmentId: string): string[] {
    const studentDraft = this.getStudentDraft(slot, studentEnrollmentId);
    const indicators = [
      ['Motivation', studentDraft.motivationLevel],
      ['Concentration', studentDraft.concentrationLevel],
      ['Fatigue', studentDraft.fatigueLevel],
      ['Bien-etre', studentDraft.emotionalWellbeingLevel]
    ] as const;

    return indicators
      .filter(([, value]) => value !== null)
      .map(([label, value]) => `${label} ${value}/5`);
  }

  getSelectedWorkCount(slot: WeeklyScheduleSlot, studentEnrollmentId: string): number {
    const studentDraft = this.getStudentDraft(slot, studentEnrollmentId);
    return studentDraft.selectedSkillIds.length + studentDraft.selectedResourceIds.length;
  }

  getSeenWorkSummary(slot: WeeklyScheduleSlot, studentEnrollmentId: string): string[] {
    const studentDraft = this.getStudentDraft(slot, studentEnrollmentId);
    const program = this.getProgramState(studentEnrollmentId).program;

    if (!program) {
      return [];
    }

    return program.uaas.flatMap((uaa) => {
      const skillLabels = this.flattenUaaSkills(uaa)
        .filter((skill) => studentDraft.selectedSkillIds.includes(skill.id))
        .map((skill) => `${uaa.code} - ${skill.description}`);
      const resourceLabels = uaa.resources
        .filter((resource) => studentDraft.selectedResourceIds.includes(resource.id))
        .map((resource) => `${uaa.code} - ${resource.description}`);

      return [...skillLabels, ...resourceLabels];
    });
  }

  setTeacherAbsent(slot: WeeklyScheduleSlot, teacherIsAbsent: boolean): void {
    const draft = this.getDraft(slot);
    this.updateSlotDraft(slot, {
      ...draft,
      teacherIsAbsent,
      teacherAbsenceHasCm: teacherIsAbsent ? draft.teacherAbsenceHasCm : false
    });
  }

  setTeacherAbsenceHasCm(slot: WeeklyScheduleSlot, teacherAbsenceHasCm: boolean): void {
    const draft = this.getDraft(slot);
    this.updateSlotDraft(slot, {
      ...draft,
      teacherAbsenceHasCm: draft.teacherIsAbsent ? teacherAbsenceHasCm : false
    });
  }

  setStudentAttendanceStatus(
    slot: WeeklyScheduleSlot,
    studentEnrollmentId: string,
    attendanceStatus: AttendanceStatus
  ): void {
    this.updateStudentDraft(slot, studentEnrollmentId, {
      ...this.getStudentDraft(slot, studentEnrollmentId),
      attendanceStatus
    });
  }

  setStudentComment(slot: WeeklyScheduleSlot, studentEnrollmentId: string, comment: string): void {
    this.updateStudentDraft(slot, studentEnrollmentId, {
      ...this.getStudentDraft(slot, studentEnrollmentId),
      comment
    });
  }

  setStudentIndicator(
    slot: WeeklyScheduleSlot,
    studentEnrollmentId: string,
    indicator: StudentIndicatorKey,
    value: number | string | { lower: number; upper: number } | null
  ): void {
    const indicatorValue = typeof value === 'object' ? value?.upper ?? null : value;

    this.updateStudentDraft(slot, studentEnrollmentId, {
      ...this.getStudentDraft(slot, studentEnrollmentId),
      [indicator]: indicatorValue === null ? null : Number(indicatorValue)
    });
  }

  flattenUaaSkills(uaa: ProgramUaa): ProgramSkill[] {
    return uaa.skillGroups.flatMap((group) => group.skills);
  }

  isSkillSelected(slot: WeeklyScheduleSlot, studentEnrollmentId: string, skillId: string): boolean {
    return this.getStudentDraft(slot, studentEnrollmentId).selectedSkillIds.includes(skillId);
  }

  toggleSkill(slot: WeeklyScheduleSlot, studentEnrollmentId: string, skillId: string): void {
    const studentDraft = this.getStudentDraft(slot, studentEnrollmentId);

    this.updateStudentDraft(slot, studentEnrollmentId, {
      ...studentDraft,
      selectedSkillIds: this.toggleId(studentDraft.selectedSkillIds, skillId)
    });
  }

  isResourceSelected(slot: WeeklyScheduleSlot, studentEnrollmentId: string, resourceId: string): boolean {
    return this.getStudentDraft(slot, studentEnrollmentId).selectedResourceIds.includes(resourceId);
  }

  toggleResource(slot: WeeklyScheduleSlot, studentEnrollmentId: string, resourceId: string): void {
    const studentDraft = this.getStudentDraft(slot, studentEnrollmentId);

    this.updateStudentDraft(slot, studentEnrollmentId, {
      ...studentDraft,
      selectedResourceIds: this.toggleId(studentDraft.selectedResourceIds, resourceId)
    });
  }

  getUaaSelectionCount(slot: WeeklyScheduleSlot, studentEnrollmentId: string, uaa: ProgramUaa): number {
    const studentDraft = this.getStudentDraft(slot, studentEnrollmentId);
    const selectedSkillCount = this.flattenUaaSkills(uaa).filter((skill) =>
      studentDraft.selectedSkillIds.includes(skill.id)
    ).length;
    const selectedResourceCount = uaa.resources.filter((resource) =>
      studentDraft.selectedResourceIds.includes(resource.id)
    ).length;

    return selectedSkillCount + selectedResourceCount;
  }

  async saveSlot(slot: WeeklyScheduleSlot): Promise<void> {
    const slotKey = this.getSlotKey(slot);
    const draft = this.getDraft(slot);
    const slotStudents = this.getStudentsForSlot(slot);

    this.savingSlotKey.set(slotKey);
    this.saveErrors.update((errors) => ({ ...errors, [slotKey]: '' }));
    this.saveSuccess.update((success) => ({ ...success, [slotKey]: '' }));

    try {
      const entry = await this.api.saveJournalEntry({
        date: this.date(),
        weeklyScheduleSlotId: slot.id ?? null,
        slotKey,
        title: slot.label,
        startsAt: slot.starts_at,
        endsAt: slot.ends_at,
        teacherIsAbsent: draft.teacherIsAbsent,
        teacherAbsenceHasCm: draft.teacherAbsenceHasCm,
        studentEntries: slotStudents.map((student) => {
          const studentDraft = this.getStudentDraft(slot, student.enrollment_id);

          return {
            studentEnrollmentId: student.enrollment_id,
            sectionId: studentDraft.sectionId || student.section_id || null,
            networkId: studentDraft.networkId || student.program_network_id || null,
            programId: studentDraft.programId || student.program_id || null,
            attendanceStatus: studentDraft.attendanceStatus,
            comment: studentDraft.comment,
            selectedSkillIds: studentDraft.selectedSkillIds,
            selectedResourceIds: studentDraft.selectedResourceIds,
            selectedObservationIds: studentDraft.selectedObservationIds,
            fatigueLevel: studentDraft.fatigueLevel,
            concentrationLevel: studentDraft.concentrationLevel,
            motivationLevel: studentDraft.motivationLevel,
            emotionalWellbeingLevel: studentDraft.emotionalWellbeingLevel
          };
        })
      });

      this.entries.update((entries) => [
        ...entries.filter((item) => item.slot_key !== entry.slot_key),
        entry
      ]);
      this.hydrateDrafts([entry]);
      this.saveSuccess.update((success) => ({
        ...success,
        [slotKey]: new Date().toLocaleTimeString('fr-BE', {
          hour: '2-digit',
          minute: '2-digit'
        })
      }));
    } catch (error) {
      this.saveErrors.update((errors) => ({
        ...errors,
        [slotKey]: error instanceof Error ? error.message : 'Impossible d enregistrer cette seance.'
      }));
    } finally {
      this.savingSlotKey.set('');
    }
  }

  private hydrateDrafts(entries: ClassJournalEntry[]): void {
    const nextDrafts = { ...this.drafts() };

    for (const entry of entries) {
      nextDrafts[entry.slot_key] = {
        teacherIsAbsent: entry.teacher_is_absent === true,
        teacherAbsenceHasCm: entry.teacher_absence_has_cm === true,
        studentRecords: (entry.students ?? []).reduce<Record<string, ClassJournalStudentDraft>>(
          (records, student) => ({
            ...records,
            [student.student_enrollment_id]: {
              sectionId: student.section_id ?? '',
              networkId: student.network_id ?? '',
              programId: student.program_id ?? '',
              attendanceStatus: student.attendance_status ?? 'present',
              comment: student.comment ?? '',
              selectedSkillIds: student.selected_skill_ids ?? [],
              selectedResourceIds: student.selected_resource_ids ?? [],
              selectedObservationIds: student.selected_observation_ids ?? [],
              fatigueLevel: student.fatigue_level ?? null,
              concentrationLevel: student.concentration_level ?? null,
              motivationLevel: student.motivation_level ?? null,
              emotionalWellbeingLevel: student.emotional_wellbeing_level ?? null
            }
          }),
          {}
        )
      };
    }

    this.drafts.set(nextDrafts);
  }

  private updateSlotDraft(slot: WeeklyScheduleSlot, draft: ClassJournalSlotDraft): void {
    const slotKey = this.getSlotKey(slot);
    this.drafts.update((drafts) => ({
      ...drafts,
      [slotKey]: draft
    }));
  }

  private updateStudentDraft(
    slot: WeeklyScheduleSlot,
    studentEnrollmentId: string,
    studentDraft: ClassJournalStudentDraft
  ): void {
    const draft = this.getDraft(slot);
    this.updateSlotDraft(slot, {
      ...draft,
      studentRecords: {
        ...draft.studentRecords,
        [studentEnrollmentId]: studentDraft
      }
    });
  }

  private getEmptySlotDraft(): ClassJournalSlotDraft {
    return {
      teacherIsAbsent: false,
      teacherAbsenceHasCm: false,
      studentRecords: {}
    };
  }

  private getEmptyStudentDraft(): ClassJournalStudentDraft {
    return {
      sectionId: '',
      networkId: '',
      programId: '',
      attendanceStatus: 'present' as AttendanceStatus,
      comment: '',
      selectedSkillIds: [],
      selectedResourceIds: [],
      selectedObservationIds: [],
      fatigueLevel: null,
      concentrationLevel: null,
      motivationLevel: null,
      emotionalWellbeingLevel: null
    };
  }

  private getScheduleDayOfWeek(isoDate: string): number {
    const day = new Date(`${isoDate}T12:00:00`).getDay();
    return day === 0 ? 7 : day;
  }

  private async loadProgramsForStudents(students: StudentListItem[]): Promise<void> {
    const studentIdsForCurrentDay = new Set(
      this.slots().flatMap((slot) => slot.student_enrollment_ids)
    );
    const studentsToLoad = students.filter(
      (student) => studentIdsForCurrentDay.has(student.enrollment_id) && student.section_id
    );

    this.programStates.update((states) => ({
      ...states,
      ...Object.fromEntries(
        studentsToLoad.map((student) => [
          student.enrollment_id,
          { isLoading: true, error: '', program: states[student.enrollment_id]?.program ?? null }
        ])
      )
    }));

    await Promise.all(
      studentsToLoad.map(async (student) => {
        try {
          const sectionId = student.section_id as string;
          const networkId = student.program_network_id || (await this.getFirstNetworkId(sectionId));

          if (!networkId) {
            throw new Error('Aucun reseau disponible pour cette section.');
          }

          const program = await this.api.getProgramBySectionId(sectionId, networkId, student.program_id);

          this.programStates.update((states) => ({
            ...states,
            [student.enrollment_id]: { isLoading: false, error: '', program }
          }));

          this.initializeProgramDraftsForStudent(student, networkId, program);
        } catch (error) {
          this.programStates.update((states) => ({
            ...states,
            [student.enrollment_id]: {
              isLoading: false,
              error: error instanceof Error ? error.message : 'Programme indisponible.',
              program: null
            }
          }));
        }
      })
    );
  }

  private async getFirstNetworkId(sectionId: string): Promise<string> {
    const networks = await this.api.getProgramNetworksBySectionId(sectionId);
    return networks[0]?.id ?? '';
  }

  private initializeProgramDraftsForStudent(
    student: StudentListItem,
    networkId: string,
    program: SectionProgram
  ): void {
    for (const slot of this.slots()) {
      if (!slot.student_enrollment_ids.includes(student.enrollment_id)) {
        continue;
      }

      const studentDraft = this.getStudentDraft(slot, student.enrollment_id);
      this.updateStudentDraft(slot, student.enrollment_id, {
        ...studentDraft,
        sectionId: studentDraft.sectionId || student.section_id || '',
        networkId: studentDraft.networkId || networkId,
        programId: studentDraft.programId || program.program?.id || student.program_id || ''
      });
    }
  }

  private toggleId(ids: string[], id: string): string[] {
    return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
  }
}
