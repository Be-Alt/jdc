import { neon } from '@neondatabase/serverless';
import { getEnv } from './env.js';
function getHeaderValue(value) {
    if (Array.isArray(value)) {
        return value[0];
    }
    return value;
}
function getClientIp(req) {
    const forwardedFor = getHeaderValue(req.headers?.['x-forwarded-for'] ?? req.headers?.['X-Forwarded-For']);
    if (forwardedFor) {
        return forwardedFor.split(',')[0]?.trim() || 'unknown';
    }
    return (getHeaderValue(req.headers?.['x-real-ip'] ?? req.headers?.['X-Real-IP']) ||
        getHeaderValue(req.headers?.['x-vercel-forwarded-for'] ?? req.headers?.['X-Vercel-Forwarded-For']) ||
        'unknown');
}
function resolveKey(config, context) {
    if (typeof config.key === 'function') {
        return config.key(context);
    }
    if (config.key === 'user') {
        return context.auth?.userId || getClientIp(context.req);
    }
    return getClientIp(context.req);
}
export async function enforceRateLimit(config, context) {
    const sql = neon(getEnv('DATABASE_URL'));
    const now = Date.now();
    const bucketMs = Math.floor(now / config.windowMs) * config.windowMs;
    const resetAt = new Date(bucketMs + config.windowMs);
    const keyValue = resolveKey(config, context);
    const result = await sql `
    insert into public.rate_limit_counters (scope, key_value, bucket_start, hit_count)
    values (
      ${config.name},
      ${keyValue},
      to_timestamp(${bucketMs} / 1000.0),
      1
    )
    on conflict (scope, key_value, bucket_start) do update
    set
      hit_count = public.rate_limit_counters.hit_count + 1,
      updated_at = now()
    returning hit_count
  `;
    const [row] = result;
    const hitCount = row?.hit_count ?? 1;
    const remaining = Math.max(config.max - hitCount, 0);
    const retryAfterSeconds = Math.max(Math.ceil((resetAt.getTime() - now) / 1000), 1);
    return {
        allowed: hitCount <= config.max,
        limit: config.max,
        remaining,
        resetAt,
        retryAfterSeconds
    };
}
