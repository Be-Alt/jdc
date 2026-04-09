import { neon } from '@neondatabase/serverless';
import { withAuthenticatedEndpoint } from './lib/api-guards.js';
import { getEnv } from './lib/env.js';
import { logger } from './lib/logger.js';
function getQueryParam(url, name) {
    if (!url) {
        return undefined;
    }
    const query = new URL(url, 'http://localhost').searchParams.get(name)?.trim();
    return query || undefined;
}
export default withAuthenticatedEndpoint('GET,OPTIONS', async ({ req, res, auth }) => {
    try {
        const requestUrl = req.url;
        const sectionId = getQueryParam(requestUrl, 'sectionId');
        if (!sectionId) {
            res.status(400).json({
                ok: false,
                error: 'Missing sectionId query parameter.'
            });
            return;
        }
        const sql = neon(getEnv('DATABASE_URL'));
        const rows = await sql `
      select distinct
        net.id,
        net.code,
        net.name,
        net.url
      from public.programs p
      inner join public.networks net
        on net.id = p.network_id
      where p.section_id = ${sectionId}::uuid
      order by net.code asc, net.name asc
    `;
        logger.info('program_networks.list_by_section', {
            userId: auth.userId,
            sectionId,
            count: Array.isArray(rows) ? rows.length : 0
        });
        res.status(200).json({
            ok: true,
            data: rows
        });
    }
    catch (error) {
        logger.error('program_networks.list_by_section_failed', error, {
            userId: auth.userId
        });
        res.status(500).json({
            ok: false,
            error: error instanceof Error ? error.message : 'Unable to fetch program networks for the selected section.'
        });
    }
}, {
    rateLimit: {
        name: 'program-networks',
        windowMs: 60_000,
        max: 120,
        key: 'user'
    }
});
