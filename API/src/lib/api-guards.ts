import { getBearerToken, getCookieHeader, type AppRole } from './auth.js';
import {
  getAccessTokenFromCookieHeader,
  getRefreshTokenFromCookieHeader,
  refreshAppSession,
  verifyAppJwt,
  type AppSessionRefreshResult,
  type VerifiedAppJwt
} from './app-jwt.js';
import { applyCors, getCorsHeaders } from './cors.js';
import { enforceRateLimit, type RateLimitConfig } from './rate-limit.js';

type RequestLike = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type ResponseLike = {
  end(): void;
  json(value: unknown): void;
  setHeader(name: string, value: string | string[]): void;
  status(code: number): ResponseLike;
  writeHead(statusCode: number, headers: Record<string, string>): void;
};

type HandlerContext = {
  req: RequestLike;
  res: ResponseLike;
};

type AuthenticatedContext = HandlerContext & {
  auth: VerifiedAppJwt;
};

type EndpointOptions = {
  rateLimit?: RateLimitConfig;
};

function handleMethodAndCors(
  req: RequestLike,
  res: ResponseLike,
  methods: string
): boolean {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, getCorsHeaders(methods));
    res.end();
    return true;
  }

  applyCors(res, methods);
  return false;
}

export function withPublicEndpoint(
  methods: string,
  handler: (context: HandlerContext) => Promise<void>,
  options?: EndpointOptions
) {
  return async function endpoint(req: unknown, res: ResponseLike) {
    const request = req as RequestLike;

    if (handleMethodAndCors(request, res, methods)) {
      return;
    }

    if (options?.rateLimit) {
      const rateLimit = await enforceRateLimit(options.rateLimit, { req: request });

      res.setHeader('X-RateLimit-Limit', String(rateLimit.limit));
      res.setHeader('X-RateLimit-Remaining', String(rateLimit.remaining));
      res.setHeader('X-RateLimit-Reset', String(Math.floor(rateLimit.resetAt.getTime() / 1000)));

      if (!rateLimit.allowed) {
        res.setHeader('Retry-After', String(rateLimit.retryAfterSeconds));
        res.status(429).json({
          ok: false,
          error: 'Rate limit exceeded.'
        });
        return;
      }
    }

    await handler({ req: request, res });
  };
}

function setCookies(res: ResponseLike, cookies: string[]): void {
  if (cookies.length > 0) {
    res.setHeader('Set-Cookie', cookies);
  }
}

export function requireAppSession(req: RequestLike): AppSessionRefreshResult {
  const cookieHeader = getCookieHeader(req.headers);
  const accessToken = getAccessTokenFromCookieHeader(cookieHeader);

  if (accessToken) {
    try {
      return {
        auth: verifyAppJwt(accessToken, 'access')
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Authentication failed';

      if (!message.includes('expired')) {
        throw error;
      }
    }
  }

  const refreshToken = getRefreshTokenFromCookieHeader(cookieHeader);

  if (refreshToken) {
    return refreshAppSession(refreshToken);
  }

  const bearerToken = getBearerToken(req.headers);

  return {
    auth: verifyAppJwt(bearerToken, 'access')
  };
}

export function withAuthenticatedEndpoint(
  methods: string,
  handler: (context: AuthenticatedContext) => Promise<void>,
  options?: EndpointOptions
) {
  return withPublicEndpoint(methods, async ({ req, res }) => {
    try {
      const session = requireAppSession(req);
      setCookies(res, session.refreshedCookies ?? []);

      if (options?.rateLimit) {
        const rateLimit = await enforceRateLimit(options.rateLimit, {
          req,
          auth: session.auth
        });

        res.setHeader('X-RateLimit-Limit', String(rateLimit.limit));
        res.setHeader('X-RateLimit-Remaining', String(rateLimit.remaining));
        res.setHeader('X-RateLimit-Reset', String(Math.floor(rateLimit.resetAt.getTime() / 1000)));

        if (!rateLimit.allowed) {
          res.setHeader('Retry-After', String(rateLimit.retryAfterSeconds));
          res.status(429).json({
            ok: false,
            error: 'Rate limit exceeded.'
          });
          return;
        }
      }

      await handler({ req, res, auth: session.auth });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Authentication failed';
      const status = message.includes('token') || message.includes('JWT') ? 401 : 400;

      res.status(status).json({
        ok: false,
        error: message
      });
    }
  }, undefined);
}

export function withRoleProtectedEndpoint(
  methods: string,
  allowedRoles: AppRole[],
  handler: (context: AuthenticatedContext) => Promise<void>,
  options?: EndpointOptions
) {
  return withAuthenticatedEndpoint(methods, async ({ req, res, auth }) => {
    if (!allowedRoles.includes(auth.role)) {
      res.status(403).json({
        ok: false,
        error: `Role ${auth.role} is not allowed for this endpoint.`
      });
      return;
    }

    await handler({ req, res, auth });
  }, options);
}
