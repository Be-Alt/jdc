import { createHmac, timingSafeEqual } from 'node:crypto';
import { getEnv, getOptionalEnv } from './env.js';
const ACCESS_COOKIE_NAME = 'app_access';
const REFRESH_COOKIE_NAME = 'app_refresh';
const ACCESS_TTL_SECONDS = 60 * 15;
const REFRESH_TTL_SECONDS = 60 * 60 * 24 * 14;
function encodeBase64Url(value) {
    return Buffer.from(value)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
}
function decodeBase64Url(value) {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
    return Buffer.from(`${normalized}${padding}`, 'base64').toString('utf8');
}
function sign(value) {
    const secret = getEnv('APP_JWT_SECRET');
    return createHmac('sha256', secret)
        .update(value)
        .digest('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
}
function createToken(profile, tokenType, ttlSeconds) {
    const header = {
        alg: 'HS256',
        typ: 'JWT'
    };
    const now = Math.floor(Date.now() / 1000);
    const payload = {
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
function getCookieAttributes(maxAgeSeconds) {
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
function createCookie(name, token, maxAgeSeconds) {
    return [`${name}=${token}`, ...getCookieAttributes(maxAgeSeconds)].join('; ');
}
function createClearedCookie(name) {
    return [
        `${name}=`,
        ...getCookieAttributes(0),
        'Expires=Thu, 01 Jan 1970 00:00:00 GMT'
    ].join('; ');
}
function getCookieValue(cookieHeader, cookieName) {
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
export function createAppSession(profile) {
    return {
        accessToken: createToken(profile, 'access', ACCESS_TTL_SECONDS),
        refreshToken: createToken(profile, 'refresh', REFRESH_TTL_SECONDS)
    };
}
export function createAppSessionCookies(session) {
    return [
        createCookie(ACCESS_COOKIE_NAME, session.accessToken, ACCESS_TTL_SECONDS),
        createCookie(REFRESH_COOKIE_NAME, session.refreshToken, REFRESH_TTL_SECONDS)
    ];
}
export function createClearedAppSessionCookies() {
    return [
        createClearedCookie(ACCESS_COOKIE_NAME),
        createClearedCookie(REFRESH_COOKIE_NAME)
    ];
}
export function getAccessTokenFromCookieHeader(cookieHeader) {
    return getCookieValue(cookieHeader, ACCESS_COOKIE_NAME);
}
export function getRefreshTokenFromCookieHeader(cookieHeader) {
    return getCookieValue(cookieHeader, REFRESH_COOKIE_NAME);
}
export function verifyAppJwt(token, expectedType = 'access') {
    const [encodedHeader, encodedPayload, receivedSignature] = token.split('.');
    if (!encodedHeader || !encodedPayload || !receivedSignature) {
        throw new Error('Invalid JWT format.');
    }
    const unsignedToken = `${encodedHeader}.${encodedPayload}`;
    const expectedSignature = sign(unsignedToken);
    const receivedBuffer = Buffer.from(receivedSignature);
    const expectedBuffer = Buffer.from(expectedSignature);
    if (receivedBuffer.length !== expectedBuffer.length ||
        !timingSafeEqual(receivedBuffer, expectedBuffer)) {
        throw new Error('Invalid JWT signature.');
    }
    const payload = JSON.parse(decodeBase64Url(encodedPayload));
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
export function refreshAppSession(refreshToken) {
    const refreshAuth = verifyAppJwt(refreshToken, 'refresh');
    const profile = {
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
