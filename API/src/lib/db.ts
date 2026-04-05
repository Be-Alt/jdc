import { neon } from '@neondatabase/serverless';
import { getEnv } from './env.js';

type HealthcheckRow = {
  now: string;
  database_name: string;
  current_user: string;
};

export async function runDatabaseHealthcheck(): Promise<HealthcheckRow> {
  const databaseUrl = getEnv('DATABASE_URL');
  const sql = neon(databaseUrl);

  const result = await sql`
    select
      now()::text as now,
      current_database() as database_name,
      current_user as current_user
  `;
  const [row] = result as HealthcheckRow[];

  if (!row) {
    throw new Error('Neon healthcheck returned no rows.');
  }

  return row;
}
