import { neon } from '@neondatabase/serverless';
import { withAuthenticatedEndpoint } from './lib/api-guards.js';
import { getEnv } from './lib/env.js';
import { logger } from './lib/logger.js';

type ProgramRow = {
  section_id: string;
  section_code: string;
  section_level: number;
  section_type: string;
  section_label: string;
  program_id: string | null;
  program_name: string | null;
  program_hours: number | null;
  program_valid_from: string | null;
  program_valid_to: string | null;
  uaa_id: string | null;
  uaa_code: string | null;
  uaa_name: string | null;
  subject_id: string | null;
  subject_name: string | null;
  network_id: string | null;
  network_code: string | null;
  network_name: string | null;
  network_url: string | null;
  process_type_id: string | null;
  process_type_name: string | null;
  skill_id: string | null;
  skill_description: string | null;
  resource_id: string | null;
  resource_description: string | null;
  competence_id: string | null;
  competence_description: string | null;
  strategy_id: string | null;
  strategy_description: string | null;
};

type ProgramSubject = {
  id: string;
  name: string;
};

type ProgramNetwork = {
  id: string;
  code: string;
  name: string;
  url: string | null;
};

type ProgramSummary = {
  id: string;
  name: string | null;
  hours: number;
  validFrom: string | null;
  validTo: string | null;
  subject: ProgramSubject | null;
  network: ProgramNetwork | null;
};

type ProgramResource = {
  id: string;
  description: string;
};

type ProgramSkill = {
  id: string;
  description: string;
};

type ProgramSkillGroup = {
  processTypeId: string | null;
  processTypeName: string;
  skills: ProgramSkill[];
};

type ProgramUaa = {
  id: string;
  code: string;
  name: string;
  resources: ProgramResource[];
  competences: ProgramResource[];
  strategies: ProgramResource[];
  skillGroups: ProgramSkillGroup[];
};

type SectionProgram = {
  section: {
    id: string;
    code: string;
    level: number;
    type: string;
    label: string;
  };
  program: ProgramSummary | null;
  uaas: ProgramUaa[];
};

function getQueryParam(url: string | undefined, name: string): string | undefined {
  if (!url) {
    return undefined;
  }

  const query = new URL(url, 'http://localhost').searchParams.get(name)?.trim();
  return query || undefined;
}

function upsertResource(collection: ProgramResource[], resourceId: string, resourceDescription: string): void {
  if (!collection.some((resource) => resource.id === resourceId)) {
    collection.push({
      id: resourceId,
      description: resourceDescription
    });
  }
}

function transformProgramRows(rows: ProgramRow[]): SectionProgram {
  const firstRow = rows[0];
  const uaaMap = new Map<string, ProgramUaa>();
  const subject = firstRow.subject_id && firstRow.subject_name
    ? {
        id: firstRow.subject_id,
        name: firstRow.subject_name
      }
    : null;
  const network = firstRow.network_id && firstRow.network_code && firstRow.network_name
    ? {
        id: firstRow.network_id,
        code: firstRow.network_code,
        name: firstRow.network_name,
        url: firstRow.network_url
      }
    : null;

  for (const row of rows) {
    if (!row.uaa_id || !row.uaa_code || !row.uaa_name) {
      continue;
    }

    let uaa = uaaMap.get(row.uaa_id);

    if (!uaa) {
      uaa = {
        id: row.uaa_id,
        code: row.uaa_code,
        name: row.uaa_name,
        resources: [],
        competences: [],
        strategies: [],
        skillGroups: []
      };

      uaaMap.set(row.uaa_id, uaa);
    }

    if (row.resource_id && row.resource_description) {
      upsertResource(uaa.resources, row.resource_id, row.resource_description);
    }

    if (row.competence_id && row.competence_description) {
      upsertResource(uaa.competences, row.competence_id, row.competence_description);
    }

    if (row.strategy_id && row.strategy_description) {
      upsertResource(uaa.strategies, row.strategy_id, row.strategy_description);
    }

    if (!row.skill_id || !row.skill_description) {
      continue;
    }

    const processTypeName = row.process_type_name ?? 'Autres';
    let group = uaa.skillGroups.find(
      (skillGroup) =>
        skillGroup.processTypeId === row.process_type_id && skillGroup.processTypeName === processTypeName
    );

    if (!group) {
      group = {
        processTypeId: row.process_type_id,
        processTypeName,
        skills: []
      };

      uaa.skillGroups.push(group);
    }

    let skill = group.skills.find((item) => item.id === row.skill_id);

    if (!skill) {
      skill = {
        id: row.skill_id,
        description: row.skill_description
      };

      group.skills.push(skill);
    }
  }

  return {
    section: {
      id: firstRow.section_id,
      code: firstRow.section_code,
      level: firstRow.section_level,
      type: firstRow.section_type,
      label: firstRow.section_label
    },
    program: firstRow.program_id && firstRow.program_hours !== null
      ? {
          id: firstRow.program_id,
          name: firstRow.program_name,
          hours: firstRow.program_hours,
          validFrom: firstRow.program_valid_from,
          validTo: firstRow.program_valid_to,
          subject,
          network
        }
      : null,
    uaas: Array.from(uaaMap.values()).map((uaa) => ({
      ...uaa,
      skillGroups: uaa.skillGroups.filter((group) => group.skills.length > 0)
    }))
  };
}

export default withAuthenticatedEndpoint('GET,OPTIONS', async ({ req, res, auth }) => {
  try {
    const requestUrl = (req as { url?: string }).url;
    const sectionId = getQueryParam(requestUrl, 'sectionId');
    const networkId = getQueryParam(requestUrl, 'networkId');

    if (!sectionId) {
      res.status(400).json({
        ok: false,
        error: 'Missing sectionId query parameter.'
      });
      return;
    }

    const sql = neon(getEnv('DATABASE_URL'));
    const rows = await sql`
      select
        sec.id as section_id,
        sec.code as section_code,
        sec.level as section_level,
        sec.type as section_type,
        sec.label as section_label,
        p.id as program_id,
        p.name as program_name,
        p.hours as program_hours,
        p.valid_from::text as program_valid_from,
        p.valid_to::text as program_valid_to,
        u.id as uaa_id,
        u.code as uaa_code,
        u.name as uaa_name,
        sub.id as subject_id,
        sub.name as subject_name,
        net.id as network_id,
        net.code as network_code,
        net.name as network_name,
        net.url as network_url,
        pt.id as process_type_id,
        pt.name as process_type_name,
        s.id as skill_id,
        s.description as skill_description,
        r.id as resource_id,
        r.description as resource_description,
        c.id as competence_id,
        c.description as competence_description,
        st.id as strategy_id,
        st.description as strategy_description
      from public.sections sec
      left join public.programs p
        on p.section_id = sec.id
       and (${networkId}::uuid is null or p.network_id = ${networkId}::uuid)
      left join public.uaa u
        on u.program_id = p.id
      left join public.subjects sub
        on sub.id = p.subject_id
      left join public.networks net
        on net.id = p.network_id
      left join public.skills s
        on s.uaa_id = u.id
      left join public.process_types pt
        on pt.id = s.process_type_id
      left join public.resources r
        on r.uaa_id = u.id
      left join public.uaa_competences c
        on c.uaa_id = u.id
      left join public.uaa_strategies st
        on st.uaa_id = u.id
      where sec.id = ${sectionId}::uuid
      order by
        sec.level asc,
        sec.type asc,
        sec.code asc,
        p.hours asc nulls last,
        p.name asc nulls last,
        u.code asc nulls last,
        pt.name asc nulls last,
        s.description asc nulls last,
        r.description asc nulls last,
        c.description asc nulls last,
        st.description asc nulls last
    `;

    if (!rows.length) {
      res.status(404).json({
        ok: false,
        error: 'Section introuvable.'
      });
      return;
    }

    const program = transformProgramRows(rows as ProgramRow[]);

    logger.info('program.get_by_section', {
      userId: auth.userId,
      sectionId,
      networkId,
      uaaCount: program.uaas.length
    });

    res.status(200).json({
      ok: true,
      data: program
    });
  } catch (error) {
    logger.error('program.get_by_section_failed', error, {
      userId: auth.userId
    });

    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unable to fetch program for the selected section.'
    });
  }
}, {
  rateLimit: {
    name: 'program',
    windowMs: 60_000,
    max: 120,
    key: 'user'
  }
});
