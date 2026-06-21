export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
}

export interface CurrentUser {
  id?: string;
  email?: string;
  name?: string;
  role?: string;
  organizationId?: string;
}

export interface SchoolYear {
  id: string;
  label: string;
  start_date?: string | null;
  end_date?: string | null;
  student_count?: number;
}

export interface StudentListItem {
  enrollment_id: string;
  first_name: string;
  last_name: string;
  status?: string;
  school_year_id?: string;
  school_year_label?: string;
  section_id?: string | null;
  section_code?: string | null;
  section_label?: string | null;
  section_name?: string | null;
  school_name?: string | null;
  program_name?: string | null;
  program_id?: string | null;
  program_network_id?: string | null;
}

export interface ProgramNetwork {
  id: string;
  code: string;
  name: string;
  url?: string | null;
}

export interface ProgramSummary {
  id: string;
  name: string | null;
  hours: number;
  validFrom: string | null;
  validTo: string | null;
  subject: {
    id: string;
    name: string;
  } | null;
  network: ProgramNetwork | null;
}

export interface ProgramResource {
  id: string;
  description: string;
}

export interface ProgramSkill {
  id: string;
  description: string;
}

export interface ProgramSkillGroup {
  processTypeId: string | null;
  processTypeName: string;
  skills: ProgramSkill[];
}

export interface ProgramUaa {
  id: string;
  code: string;
  name: string;
  resources: ProgramResource[];
  competences: ProgramResource[];
  strategies: ProgramResource[];
  skillGroups: ProgramSkillGroup[];
}

export interface SectionProgram {
  section: {
    id: string;
    code: string;
    level: number;
    type: string;
    label: string;
  };
  program: ProgramSummary | null;
  uaas: ProgramUaa[];
}

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export interface WeeklyScheduleSlot {
  id?: string;
  day_of_week: number;
  slot_type: 'course' | 'break' | 'lunch';
  label: string;
  starts_at: string;
  ends_at: string;
  position: number;
  student_enrollment_ids: string[];
}

export interface WeeklyScheduleConfig {
  id: string;
  label: string;
  valid_from: string;
  valid_to: string | null;
  organization_id: string | null;
  is_shared_with_org: boolean;
  slots: WeeklyScheduleSlot[];
}

export type StudentIndicatorKey =
  | 'fatigueLevel'
  | 'concentrationLevel'
  | 'motivationLevel'
  | 'emotionalWellbeingLevel';

export interface ClassJournalStudentDraft {
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
}

export interface ClassJournalSlotDraft {
  teacherIsAbsent: boolean;
  teacherAbsenceHasCm: boolean;
  studentRecords: Record<string, ClassJournalStudentDraft>;
}

export interface StudentSummary {
  student?: {
    enrollment_id: string;
    first_name: string;
    last_name: string;
    birth_date?: string | null;
    status?: string;
    section_name?: string | null;
    school_name?: string | null;
    program_name?: string | null;
  };
  counters?: {
    skills?: number;
    resources?: number;
    observations?: number;
  };
}

export interface ClassJournalEntry {
  id?: string;
  session_date?: string;
  weekly_schedule_slot_id?: string | null;
  slot_key: string;
  title?: string;
  starts_at?: string;
  ends_at?: string;
  date?: string;
  teacher_is_absent?: boolean;
  teacher_absence_has_cm?: boolean;
  students?: ClassJournalStudent[];
  updated_at?: string;
}

export interface ClassJournalStudent {
  student_enrollment_id: string;
  section_id?: string | null;
  network_id?: string | null;
  program_id?: string | null;
  first_name?: string;
  last_name?: string;
  attendance_status?: AttendanceStatus;
  comment?: string | null;
  selected_skill_ids?: string[];
  selected_resource_ids?: string[];
  selected_observation_ids?: string[];
  fatigue_level?: number | null;
  concentration_level?: number | null;
  motivation_level?: number | null;
  emotional_wellbeing_level?: number | null;
}

export interface ClassJournalEntryPayload {
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
}

export interface ObservationCategory {
  id: string;
  label: string;
  observations?: ObservationItem[];
}

export interface ObservationItem {
  id: string;
  label: string;
}
