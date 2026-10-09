import type { RequestHandler } from 'express';
import { SERVICE_RESTRICTION_CODE, SERVICE_RESTRICTION_MESSAGE } from '../shared/service-access';

// Mounted at /api before authentication and multipart processing. Existing read routes
// keep their own role, family, consent and file-token checks.
export const restrictIntake: RequestHandler = (req, res, next) => {
  const readMethod = req.method === 'GET' || req.method === 'HEAD';
  const createsPreview = /^\/publication-preview\/?$/i.test(req.path);
  const prunesAuditLog = /^\/ai\/audit-summary\/?$/i.test(req.path);
  // The old find-or-create and invitation login paths must never grant a new
  // session in this mode. Explicit existing login still checks name and account.
  const existingLogin = req.method === 'POST'
    && /^\/auth\/phone\/?$/i.test(req.path)
    && req.body?.isLogin === true;
  if ((readMethod && !createsPreview && !prunesAuditLog) || existingLogin) {
    next();
    return;
  }
  res.header('Cache-Control', 'no-store');
  res.status(403).json({ code: SERVICE_RESTRICTION_CODE, error: SERVICE_RESTRICTION_MESSAGE });
};
