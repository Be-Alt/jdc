export type WeeklyScheduleSlot = {
  id?: string;
  day_of_week: number;
  slot_type: 'course' | 'break' | 'lunch';
  label: string;
  starts_at: string;
  ends_at: string;
  position: number;
  student_enrollment_ids: string[];
};

export type WeeklyScheduleConfig = {
  id: string;
  label: string;
  valid_from: string;
  valid_to: string | null;
  organization_id: string | null;
  is_shared_with_org: boolean;
  slots: WeeklyScheduleSlot[];
};
