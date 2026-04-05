import { withPublicEndpoint } from './lib/api-guards.js';
import { createClearedAppSessionCookies } from './lib/app-jwt.js';

export default withPublicEndpoint('POST,OPTIONS', async ({ res }) => {
  res.setHeader('Set-Cookie', createClearedAppSessionCookies());
  res.status(200).json({
    ok: true
  });
}, {
  rateLimit: {
    name: 'logout',
    windowMs: 10 * 60_000,
    max: 20,
    key: 'ip'
  }
});
