export type CommunicationDirection = 'outgoing' | 'incoming' | 'note';

export type StudentCommunication = {
  id: string;
  student_enrollment_id: string;
  teacher_id: string | null;
  teacher_name: string | null;
  direction: CommunicationDirection;
  contact_name: string | null;
  contact_email: string | null;
  subject: string | null;
  content: string;
  occurred_on: string;
  created_at: string;
};

export type CommunicationReminder = {
  id: string;
  student_enrollment_id: string;
  teacher_id: string | null;
  teacher_name: string | null;
  student_name?: string | null;
  title: string;
  notes: string | null;
  due_date: string;
  completed_at: string | null;
  created_at: string;
};

export type StudentCommunicationData = {
  interactions: StudentCommunication[];
  reminders: CommunicationReminder[];
};
