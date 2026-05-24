import type { NextFunction, Request, Response } from 'express';
import { prisma } from './db';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: 'senior' | 'guardian';
      };
    }
  }
}

export async function attachLocalUser(req: Request, _res: Response, next: NextFunction) {
  const requestedUserId = req.header('x-user-id') ?? req.query.userId?.toString();
  const requestedRole = req.header('x-user-role') === 'senior' ? 'senior' : req.header('x-user-role') === 'guardian' ? 'guardian' : null;
  const fallbackId = requestedRole === 'senior' ? 'local_senior' : 'local_guardian';
  const userId = requestedUserId || fallbackId;
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (user) {
    // 한 휴대폰 번호 계정을 넷플릭스 프로필처럼 쓰므로, 요청 헤더의 현재 선택 역할을 우선합니다.
    if (requestedRole) {
      req.user = { id: user.id, role: requestedRole };
      next();
      return;
    }
    if (user.role === 'senior' || user.role === 'guardian') {
      req.user = { id: user.id, role: user.role };
    }
  }

  next();
}

export function requireRole(...roles: Array<'senior' | 'guardian'>) {
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
