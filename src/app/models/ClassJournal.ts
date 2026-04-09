export type ClassJournalSlotDraft = {
  notes: string;
  sectionId: string;
  networkId: string;
  selectedSkillIds: string[];
  selectedResourceIds: string[];
  teacherIsAbsent: boolean;
  teacherAbsenceHasCm: boolean;
  studentStatuses: Record<string, 'present' | 'absent' | 'late' | 'excused'>;
};

export type ClassJournalEntry = {
  id: string;
  entry_date: string;
  weekly_schedule_slot_id: string | null;
  slot_key: string;
  title: string;
  starts_at: string;
  ends_at: string;
  section_id: string | null;
  network_id: string | null;
  notes: string;
  teacher_is_absent: boolean;
  teacher_absence_has_cm: boolean;
  status: 'draft' | 'done';
  selected_skill_ids: string[];
  selected_resource_ids: string[];
  student_statuses: Array<{
    student_enrollment_id: string;
    attendance_status: 'present' | 'absent' | 'late' | 'excused';
  }>;
  updated_at: string;
};

export type ClassJournalEntryPayload = {
  date: string;
  weeklyScheduleSlotId?: string | null;
  slotKey: string;
  title: string;
  startsAt: string;
  endsAt: string;
  sectionId?: string | null;
  networkId?: string | null;
  notes: string;
  teacherIsAbsent?: boolean;
  teacherAbsenceHasCm?: boolean;
  status?: 'draft' | 'done';
  selectedSkillIds: string[];
  selectedResourceIds: string[];
  studentStatuses: Array<{
    studentEnrollmentId: string;
    attendanceStatus: 'present' | 'absent' | 'late' | 'excused';
  }>;
};
