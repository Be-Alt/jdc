import { createHmac, timingSafeEqual } from 'node:crypto';
import { getEnv, getOptionalEnv } from './env.js';
import { type AppRole, type ProfileRecord } from './auth.js';

const ACCESS_COOKIE_NAME = 'app_access';
const REFRESH_COOKIE_NAME = 'app_refresh';
const ACCESS_TTL_SECONDS = 60 * 15;
const REFRESH_TTL_SECONDS = 60 * 60 * 24 * 14;

type JwtTokenType = 'access' | 'refresh';

type JwtPayload = {
  sub: string;
  email: string;
  name: string | null;
  role: AppRole;
  type: JwtTokenType;
  iat: number;
  exp: number;
};

export type VerifiedAppJwt = {
  userId: string;
  email: string;
  name: string | null;
  role: AppRole;
  tokenType: JwtTokenType;
};

export type AppSessionBundle = {
  accessToken: string;
  refreshToken: string;
};

export type AppSessionRefreshResult = {
  auth: VerifiedAppJwt;
  refreshedCookies?: string[];
};

function encodeBase64Url(value: string): string {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, 'base64').toString('utf8');
}

function sign(value: string): string {
  const secret = getEnv('APP_JWT_SECRET');

  return createHmac('sha256', secret)
    .update(value)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function createToken(profile: ProfileRecord, tokenType: JwtTokenType, ttlSeconds: number): string {
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const now = Math.floor(Date.now() / 1000);
  const payload: JwtPayload = {
    sub: profile.userId,
    email: profile.email,
    name: profile.name,
    role: profile.role,
    type: tokenType,
    iat: now,
    exp: now + ttlSeconds
  };

  const encodedHeader = encodeBase64Url(JSON.stringify(header));
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;
  const signature = sign(unsignedToken);

  return `${unsignedToken}.${signature}`;
}

function getCookieAttributes(maxAgeSeconds: number): string[] {
  const attributes = [
    `Max-Age=${maxAgeSeconds}`,
    'Path=/',
    'HttpOnly',
    'SameSite=None'
  ];

  const secureCookie = getOptionalEnv('APP_JWT_COOKIE_SECURE') !== 'false';

  if (secureCookie) {
    attributes.push('Secure');
  }

  const cookieDomain = getOptionalEnv('APP_JWT_COOKIE_DOMAIN');

  if (cookieDomain) {
    attributes.push(`Domain=${cookieDomain}`);
  }

  return attributes;
}

function createCookie(name: string, token: string, maxAgeSeconds: number): string {
  return [`${name}=${token}`, ...getCookieAttributes(maxAgeSeconds)].join('; ');
}

function createClearedCookie(name: string): string {
  return [
    `${name}=`,
    ...getCookieAttributes(0),
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT'
  ].join('; ');
}

function getCookieValue(cookieHeader: string | undefined, cookieName: string): string | null {
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(';');

  for (const cookie of cookies) {
    const [name, ...rest] = cookie.trim().split('=');

    if (name === cookieName) {
      const value = rest.join('=').trim();
      return value || null;
    }
  }

  return null;
}

export function createAppSession(profile: ProfileRecord): AppSessionBundle {
  return {
    accessToken: createToken(profile, 'access', ACCESS_TTL_SECONDS),
    refreshToken: createToken(profile, 'refresh', REFRESH_TTL_SECONDS)
  };
}

export function createAppSessionCookies(session: AppSessionBundle): string[] {
  return [
    createCookie(ACCESS_COOKIE_NAME, session.accessToken, ACCESS_TTL_SECONDS),
    createCookie(REFRESH_COOKIE_NAME, session.refreshToken, REFRESH_TTL_SECONDS)
  ];
}

export function createClearedAppSessionCookies(): string[] {
  return [
    createClearedCookie(ACCESS_COOKIE_NAME),
    createClearedCookie(REFRESH_COOKIE_NAME)
  ];
}

export function getAccessTokenFromCookieHeader(cookieHeader: string | undefined): string | null {
  return getCookieValue(cookieHeader, ACCESS_COOKIE_NAME);
}

export function getRefreshTokenFromCookieHeader(cookieHeader: string | undefined): string | null {
  return getCookieValue(cookieHeader, REFRESH_COOKIE_NAME);
}

export function verifyAppJwt(token: string, expectedType: JwtTokenType = 'access'): VerifiedAppJwt {
  const [encodedHeader, encodedPayload, receivedSignature] = token.split('.');

  if (!encodedHeader || !encodedPayload || !receivedSignature) {
    throw new Error('Invalid JWT format.');
  }

  const unsignedToken = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = sign(unsignedToken);

  const receivedBuffer = Buffer.from(receivedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    receivedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(receivedBuffer, expectedBuffer)
  ) {
    throw new Error('Invalid JWT signature.');
  }

  const payload = JSON.parse(decodeBase64Url(encodedPayload)) as JwtPayload;
  const now = Math.floor(Date.now() / 1000);

  if (payload.type !== expectedType) {
    throw new Error(`Invalid JWT type. Expected ${expectedType}.`);
  }

  if (payload.exp <= now) {
    throw new Error('JWT expired.');
  }

  return {
    userId: payload.sub,
    email: payload.email,
    name: payload.name,
    role: payload.role,
    tokenType: payload.type
  };
}

export function refreshAppSession(refreshToken: string): AppSessionRefreshResult {
  const refreshAuth = verifyAppJwt(refreshToken, 'refresh');
  const profile: ProfileRecord = {
    userId: refreshAuth.userId,
    email: refreshAuth.email,
    name: refreshAuth.name,
    role: refreshAuth.role
  };
  const session = createAppSession(profile);

  return {
    auth: {
      ...refreshAuth,
      tokenType: 'access'
    },
    refreshedCookies: createAppSessionCookies(session)
  };
}
