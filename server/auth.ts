import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { config } from './config';
import { prisma } from './db';

type RequestRole = 'senior' | 'guardian';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: RequestRole;
      };
    }
  }
}

type AuthTokenPayload = {
  sub: string;
  role: RequestRole;
  iat: number;
  exp: number;
};

function base64UrlEncode(value: string | Buffer) {
  return Buffer.from(value).toString('base64url');
}

function base64UrlJson(value: unknown) {
  return base64UrlEncode(JSON.stringify(value));
}

function parseRole(value: unknown): RequestRole | null {
  return value === 'senior' || value === 'guardian' ? value : null;
}

function configuredDevHeaderAllowance() {
  if (process.env.ALLOW_DEV_AUTH_HEADERS === 'true') return true;
  if (process.env.ALLOW_DEV_AUTH_HEADERS === 'false') return false;
  return config.auth.allowDevHeaders;
}

function getTokenSecret() {
  if (config.auth.tokenSecret) return config.auth.tokenSecret;
  throw Object.assign(new Error('AUTH_TOKEN_SECRET이 설정되지 않았습니다.'), { statusCode: 503 });
}

function signJwtPart(headerPart: string, payloadPart: string) {
  return crypto
    .createHmac('sha256', getTokenSecret())
    .update(`${headerPart}.${payloadPart}`)
    .digest('base64url');
}

export function issueAuthToken(user: { id: string; role: RequestRole }) {
  const now = Math.floor(Date.now() / 1000);
  const ttlSeconds = Number.isFinite(config.auth.tokenTtlSeconds) && config.auth.tokenTtlSeconds > 0
    ? Math.floor(config.auth.tokenTtlSeconds)
    : 60 * 60 * 24 * 30;
  const headerPart = base64UrlJson({ alg: 'HS256', typ: 'JWT' });
  const payloadPart = base64UrlJson({
    sub: user.id,
    role: user.role,
    iat: now,
    exp: now + ttlSeconds,
  });
  return `${headerPart}.${payloadPart}.${signJwtPart(headerPart, payloadPart)}`;
}

function verifyAuthToken(token: string): AuthTokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerPart, payloadPart, signature] = parts;
  const expectedSignature = signJwtPart(headerPart, payloadPart);
  const actual = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;

  try {
    const header = JSON.parse(Buffer.from(headerPart, 'base64url').toString('utf8'));
    const payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8')) as Partial<AuthTokenPayload>;
    if (header?.alg !== 'HS256' || header?.typ !== 'JWT') return null;
    const role = parseRole(payload.role);
    if (!payload.sub || !role || typeof payload.exp !== 'number') return null;
    if (payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return {
      sub: String(payload.sub),
      role,
      iat: typeof payload.iat === 'number' ? payload.iat : 0,
      exp: payload.exp,
    };
  } catch {
    return null;
  }
}

function readBearerToken(req: Request) {
  const authorization = req.header('authorization');
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

export async function attachLocalUser(req: Request, _res: Response, next: NextFunction) {
  try {
    const bearerToken = readBearerToken(req);
    if (bearerToken) {
      const payload = verifyAuthToken(bearerToken);
      if (payload) {
        const user = await prisma.user.findUnique({ where: { id: payload.sub } });
        const dbRole = parseRole(user?.role);
        if (user && dbRole === payload.role) {
          req.user = { id: user.id, role: payload.role };
        }
      }
      next();
      return;
    }

    if (!configuredDevHeaderAllowance()) {
      next();
      return;
    }

    const requestedUserId = req.header('x-user-id') ?? req.query.userId?.toString();
    const requestedRole = parseRole(req.header('x-user-role'));
    const fallbackId = requestedRole === 'senior' ? 'local_senior' : 'local_guardian';
    const userId = requestedUserId || fallbackId;
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (user) {
      // 개발/테스트 모드에서는 기존 로컬 프로필 전환 흐름을 유지합니다.
      if (requestedRole) {
        req.user = { id: user.id, role: requestedRole };
        next();
        return;
      }
      const role = parseRole(user.role);
      if (role) {
        req.user = { id: user.id, role };
      }
    }

    next();
  } catch (error) {
    next(error);
  }
}

export function requireRole(...roles: RequestRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: '권한이 없습니다.' });
      return;
    }
    next();
  };
}

export async function assertGuardianCanAccessSenior(guardianId: string, seniorId: string) {
  const link = await prisma.guardianSeniorLink.findUnique({
    where: { guardianId_seniorId: { guardianId, seniorId } },
  });
  if (!link) {
    throw Object.assign(new Error('연결된 시니어가 아닙니다.'), { statusCode: 403 });
  }
}
