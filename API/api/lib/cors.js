import { getEnv } from './env.js';
function normalizeOrigin(value) {
    return value.trim().replace(/\/+$/, '');
}
function getConfiguredOrigins() {
    const configuredOrigins = getEnv('CORS_ALLOW_ORIGIN')
        .split(',')
        .map((value) => normalizeOrigin(value))
        .filter(Boolean);
    return Array.from(new Set([
        ...configuredOrigins,
        'http://localhost:4300',
        'http://127.0.0.1:4300'
    ]));
}
function getRequestOrigin(req) {
    const originHeader = req?.headers?.origin;
    if (Array.isArray(originHeader)) {
        return originHeader[0] ? normalizeOrigin(originHeader[0]) : null;
    }
    return originHeader ? normalizeOrigin(originHeader) : null;
}
function resolveAllowedOrigin(req) {
    const configuredOrigins = getConfiguredOrigins();
    const requestOrigin = getRequestOrigin(req);
    if (requestOrigin && configuredOrigins.includes(requestOrigin)) {
        return requestOrigin;
    }
    return configuredOrigins[0] ?? '';
}
export function getCorsHeaders(methods = 'GET,OPTIONS', req) {
    return {
        'Access-Control-Allow-Origin': resolveAllowedOrigin(req),
        'Access-Control-Allow-Methods': methods,
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true',
        'Cache-Control': 'no-store',
        Vary: 'Origin'
    };
}
export function applyCors(res, methods = 'GET,OPTIONS', req) {
    const headers = getCorsHeaders(methods, req);
    for (const [name, value] of Object.entries(headers)) {
        res.setHeader(name, value);
    }
}
