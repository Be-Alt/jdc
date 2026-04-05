import { withPublicEndpoint } from './lib/api-guards.js';
import { runDatabaseHealthcheck } from './lib/db.js';

export default withPublicEndpoint('GET,OPTIONS', async ({ res }) => {
  try {
    const db = await runDatabaseHealthcheck();

    res.status(200).json({
      ok: true,
      message: 'pong',
      vercel: true,
      database: {
        connected: true,
        name: db.database_name,
        user: db.current_user,
        now: db.now
      }
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: 'ping failed',
      vercel: true,
      database: {
        connected: false
      },
      error: error instanceof Error ? error.message : 'Unknown database error'
    });
  }
}, {
  rateLimit: {
    name: 'ping',
    windowMs: 60_000,
    max: 60,
    key: 'ip'
  }
});
