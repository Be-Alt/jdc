export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export type ClassJournalStudentDraft = {
  sectionId: string;
  networkId: string;
  attendanceStatus: AttendanceStatus;
  comment: string;
  selectedSkillIds: string[];
  selectedResourceIds: string[];
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
  attendance_status: AttendanceStatus;
  comment: string;
  selected_skill_ids: string[];
  selected_resource_ids: string[];
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
    attendanceStatus: AttendanceStatus;
    comment: string;
    selectedSkillIds: string[];
    selectedResourceIds: string[];
  }>;
};
