import { withAuthenticatedEndpoint } from './lib/api-guards.js';
export default withAuthenticatedEndpoint('POST,OPTIONS', async ({ res }) => {
    res.status(410).json({
        ok: false,
        error: 'Le partage à l’organisation est désactivé pour le moment.'
    });
}, {
    rateLimit: {
        name: 'student-share',
        windowMs: 60_000,
        max: 30,
        key: 'user'
    }
});
