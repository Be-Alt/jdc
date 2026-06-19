import { Section } from './Section';

export type ProgramSubject = {
  id: string;
  name: string;
};

export type ProgramNetwork = {
  id: string;
  code: string;
  name: string;
  url: string | null;
};

export type ProgramSummary = {
  id: string;
  name: string | null;
  hours: number;
  validFrom: string | null;
  validTo: string | null;
  subject: ProgramSubject | null;
  network: ProgramNetwork | null;
  ownerId: string | null;
  isShared: boolean;
  canEdit: boolean;
};

export type ProgramResource = {
  id: string;
  description: string;
};

export type ProgramSkill = {
  id: string;
  description: string;
};

export type ProgramSkillGroup = {
  processTypeId: string | null;
  processTypeName: string;
  skills: ProgramSkill[];
};

export type ProgramUaa = {
  id: string;
  code: string;
  name: string;
  resources: ProgramResource[];
  competences: ProgramResource[];
  strategies: ProgramResource[];
  skillGroups: ProgramSkillGroup[];
};

export type SectionProgram = {
  section: Section | null;
  program: ProgramSummary | null;
  uaas: ProgramUaa[];
};

export type ProgramCatalogItem = {
  id: string;
  name: string | null;
  hours: number;
  subject_id: string;
  subject_name: string;
  section_id: string | null;
  section_code: string | null;
  section_label: string | null;
  network_id: string;
  network_code: string;
  network_name: string;
  uaa_count: number;
  owner_id: string | null;
  is_shared: boolean;
  can_edit: boolean;
};
