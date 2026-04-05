import { withAuthenticatedEndpoint } from './lib/api-guards.js';

export default withAuthenticatedEndpoint('GET,OPTIONS', async ({ res, auth }) => {
  res.status(200).json({
    ok: true,
    user: {
      userId: auth.userId,
      email: auth.email,
      name: auth.name,
      role: auth.role
    }
  });
}, {
  rateLimit: {
    name: 'me',
    windowMs: 60_000,
    max: 120,
    key: 'user'
  }
});
