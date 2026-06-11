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
