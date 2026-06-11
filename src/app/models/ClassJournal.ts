export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';
export type StudentIndicatorKey =
  | 'fatigueLevel'
  | 'concentrationLevel'
  | 'motivationLevel'
  | 'emotionalWellbeingLevel';

export type ClassJournalStudentDraft = {
  sectionId: string;
  networkId: string;
  programId: string;
  attendanceStatus: AttendanceStatus;
  comment: string;
  selectedSkillIds: string[];
  selectedResourceIds: string[];
  selectedObservationIds: string[];
  fatigueLevel: number | null;
  concentrationLevel: number | null;
  motivationLevel: number | null;
  emotionalWellbeingLevel: number | null;
};

export type ClassJournalSlotDraft = {
  teacherIsAbsent: boolean;
  teacherAbsenceHasCm: boolean;
  studentRecords: Record<string, ClassJournalStudentDraft>;
};

export type ClassJournalStudentEntry = {
  student_enrollment_id: string;
  section_id: string | null;
  network_id: string | null;
  program_id: string | null;
  attendance_status: AttendanceStatus;
  comment: string;
  selected_skill_ids: string[];
  selected_resource_ids: string[];
  selected_observation_ids: string[];
  fatigue_level: number | null;
  concentration_level: number | null;
  motivation_level: number | null;
  emotional_wellbeing_level: number | null;
};

export type ClassJournalEntry = {
  id: string;
  session_date: string;
  weekly_schedule_slot_id: string | null;
  slot_key: string;
  title: string;
  starts_at: string;
  ends_at: string;
  teacher_is_absent: boolean;
  teacher_absence_has_cm: boolean;
  students: ClassJournalStudentEntry[];
  updated_at: string;
};

export type ClassJournalEntryPayload = {
  date: string;
  weeklyScheduleSlotId?: string | null;
  slotKey: string;
  title: string;
  startsAt: string;
  endsAt: string;
  teacherIsAbsent?: boolean;
  teacherAbsenceHasCm?: boolean;
  studentEntries: Array<{
    studentEnrollmentId: string;
    sectionId?: string | null;
    networkId?: string | null;
    programId?: string | null;
    attendanceStatus: AttendanceStatus;
    comment: string;
    selectedSkillIds: string[];
    selectedResourceIds: string[];
    selectedObservationIds: string[];
    fatigueLevel: number | null;
    concentrationLevel: number | null;
    motivationLevel: number | null;
    emotionalWellbeingLevel: number | null;
  }>;
};
