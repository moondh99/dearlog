import type { RequestHandler } from 'express';
import { isServiceRequestAllowed, SERVICE_RESTRICTION_CODE, SERVICE_RESTRICTION_MESSAGE } from '../shared/service-access';

// Mounted at /api before authentication and multipart processing. Existing read routes
// keep their own role, family, consent and file-token checks.
export const restrictIntake: RequestHandler = (req, res, next) => {
  // Old find-or-create and invitation login must not grant new sessions.
  if (isServiceRequestAllowed(req.method, `/api${req.path}`, req.body?.isLogin)) {
    next();
    return;
  }
  res.header('Cache-Control', 'no-store');
  res.status(403).json({ code: SERVICE_RESTRICTION_CODE, error: SERVICE_RESTRICTION_MESSAGE });
};
