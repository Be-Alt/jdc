import { withPublicEndpoint } from './lib/api-guards.js';
import {
  type AuthenticatedUser,
  getProfileRecord,
  parseAuthenticatedUser,
  requireAllowedUser,
  upsertProfile
} from './lib/auth.js';
import { createAppSession, createAppSessionCookies } from './lib/app-jwt.js';
import { logger } from './lib/logger.js';

export default withPublicEndpoint('GET,POST,OPTIONS', async ({ req, res }) => {
  try {
    const user = parseAuthenticatedUser((req as { body?: AuthenticatedUser | string }).body);
    const allowedUser = await requireAllowedUser(user);

    logger.info('profile.user_resolved', {
      userId: allowedUser.userId,
      email: allowedUser.email,
      allowed: true
    });

    await upsertProfile(allowedUser);
    const profile = await getProfileRecord(allowedUser);
    const appSession = createAppSession(profile);
    res.setHeader('Set-Cookie', createAppSessionCookies(appSession));

    logger.info('profile.upserted', {
      userId: allowedUser.userId,
      email: allowedUser.email,
      role: profile.role
    });

    res.status(200).json({
      ok: true,
      allowed: true,
      profile: {
        userId: profile.userId,
        email: profile.email,
        name: profile.name,
        role: profile.role
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid profile request';
    const status = message.includes('not allowed') ? 403 : 400;

    logger.error('profile.request_failed', error, {
      status
    });

    res.status(status).json({
      ok: false,
      error: message
    });
  }
}, {
  rateLimit: {
    name: 'profile-sync',
    windowMs: 10 * 60_000,
    max: 10,
    key: 'ip'
  }
});
