import { getEnv } from './env.js';
export function getCorsHeaders(methods = 'GET,OPTIONS') {
    return {
        'Access-Control-Allow-Origin': getEnv('CORS_ALLOW_ORIGIN'),
        'Access-Control-Allow-Methods': methods,
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true'
    };
}
export function applyCors(res, methods = 'GET,OPTIONS') {
    const headers = getCorsHeaders(methods);
    for (const [name, value] of Object.entries(headers)) {
        res.setHeader(name, value);
    }
}
