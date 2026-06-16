import { SectionProgram } from './Program';

export type StudentAttendancePoint = {
  month: string;
  attended: number;
  total: number;
  percentage: number;
};

export type StudentSummary = {
  program: SectionProgram | null;
  workedSkillIds: string[];
  workedResourceIds: string[];
  attendance: {
    attended: number;
    total: number;
    percentage: number;
    points: StudentAttendancePoint[];
  };
};

export type AssessmentStatus =
  | 'not_acquired'
  | 'in_progress'
  | 'acquired'
  | 'viewed'
  | 'not_viewed';
export type AssessmentItemType = 'skill' | 'competence' | 'resource';

export type StudentAssessment = {
  item_type: AssessmentItemType;
  item_id: string;
  status: AssessmentStatus;
  updated_at: string;
};
