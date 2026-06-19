import { neon } from '@neondatabase/serverless';
import { withPermissionEndpoint } from './lib/api-guards.js';
import { getEnv } from './lib/env.js';
import { logger } from './lib/logger.js';
export default withPermissionEndpoint('GET,OPTIONS', 'teaching.manage', async ({ res, auth }) => {
    try {
        const sql = neon(getEnv('DATABASE_URL'));
        const rows = await sql `
      select
        c.id as category_id, c.label as category_label,
        l.id as level_id, l.label as level_label, l.tone as level_tone,
        i.id as item_id, i.label as item_label
      from public.observation_items i
      join public.observation_categories c on c.id = i.category_id
      join public.observation_levels l on l.id = i.level_id
      order by c.position, l.position, i.position
    `;
        const categories = [];
        for (const row of rows) {
            let category = categories.find((item) => item.id === row.category_id);
            if (!category) {
                category = { id: row.category_id, label: row.category_label, levels: [] };
                categories.push(category);
            }
            let level = category.levels.find((item) => item.id === row.level_id);
            if (!level) {
                level = { id: row.level_id, label: row.level_label, tone: row.level_tone, items: [] };
                category.levels.push(level);
            }
            level.items.push({ id: row.item_id, label: row.item_label });
        }
        res.status(200).json({ ok: true, data: categories });
    }
    catch (error) {
        logger.error('observation_catalog.failed', error, { userId: auth.userId });
        res.status(500).json({
            ok: false,
            error: error instanceof Error ? error.message : 'Impossible de charger les observations.'
        });
    }
});
