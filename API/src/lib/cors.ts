import { getEnv } from './env.js';

type RequestLike = {
  headers?: Record<string, string | string[] | undefined>;
};

function normalizeOrigin(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

function getConfiguredOrigins(): string[] {
  return getEnv('CORS_ALLOW_ORIGIN')
    .split(',')
    .map((value) => normalizeOrigin(value))
    .filter(Boolean);
}

function getRequestOrigin(req?: RequestLike): string | null {
  const originHeader = req?.headers?.origin;

  if (Array.isArray(originHeader)) {
    return originHeader[0] ? normalizeOrigin(originHeader[0]) : null;
  }

  return originHeader ? normalizeOrigin(originHeader) : null;
}

function resolveAllowedOrigin(req?: RequestLike): string {
  const configuredOrigins = getConfiguredOrigins();
  const requestOrigin = getRequestOrigin(req);

  if (requestOrigin && configuredOrigins.includes(requestOrigin)) {
    return requestOrigin;
  }

  return configuredOrigins[0] ?? '';
}

export function getCorsHeaders(methods = 'GET,OPTIONS', req?: RequestLike) {
  return {
    'Access-Control-Allow-Origin': resolveAllowedOrigin(req),
    'Access-Control-Allow-Methods': methods,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    Vary: 'Origin'
  };
}

export function applyCors(res: {
  setHeader(name: string, value: string): void;
}, methods = 'GET,OPTIONS', req?: RequestLike) {
  const headers = getCorsHeaders(methods, req);

  for (const [name, value] of Object.entries(headers)) {
    res.setHeader(name, value);
  }
}
