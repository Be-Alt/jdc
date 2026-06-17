export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
}

export interface CurrentUser {
  id?: string;
  email?: string;
  name?: string;
  role?: string;
}

export interface StudentListItem {
  enrollment_id: string;
  first_name: string;
  last_name: string;
  status?: string;
  section_name?: string | null;
  school_name?: string | null;
  program_name?: string | null;
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
  slot_key: string;
  date?: string;
  teacher_is_absent?: boolean;
  students?: ClassJournalStudent[];
}

export interface ClassJournalStudent {
  student_enrollment_id: string;
  first_name?: string;
  last_name?: string;
  attendance_status?: string;
  comment?: string | null;
  fatigue_level?: number | null;
  concentration_level?: number | null;
  motivation_level?: number | null;
  emotional_wellbeing_level?: number | null;
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
