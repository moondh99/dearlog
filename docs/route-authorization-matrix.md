# Route Authorization Matrix

Last checked: 2026-05-31

Source of truth: `server/app.ts`. This matrix documents the intended authorization boundary for the local API. New endpoints should be added here during review.

## Legend

| Term | Meaning |
| --- | --- |
| Public | No authenticated `req.user` is required |
| Senior | Requires `requireRole('senior')` |
| Guardian | Requires `requireRole('guardian')` |
| Senior/Guardian | Requires either role, then applies ownership checks where needed |
| Ownership check | Endpoint verifies the requested senior/resource belongs to the current user or linked family |
| Dev headers | `x-user-id` / `x-user-role`; disabled in production unless explicitly allowed |

## Public And Integration Routes

| Method | Route | Access | Notes |
| --- | --- | --- | --- |
| `GET` | `/api/health` | Public | Health and storage path only |
| `GET` | `/api/me` | Public | Returns current attached user or `null`; useful for auth debugging |
| `POST` | `/api/auth/phone` | Public | Login/signup entrypoint; returns signed auth token |
| `POST` | `/api/auth/token-login` | Public | Invitation-token login; rejects expired/revoked tokens |
| `GET` | `/api/push-public-key` | Public | Returns VAPID public key |
| `GET` | `/api/chapters` | Public | Static chapter list |
| `GET` | `/api/questions` | Public with scoped behavior | Common questions are public; senior-scoped questions require auth or linked senior context |
| `POST` | `/api/push-subscriptions` | Public today | Stores push subscription for provided/current user; should be revisited before production |
| `POST` | `/twilio/voice` | Twilio signature when configured | Rejects invalid signature if `TWILIO_AUTH_TOKEN` is set |
| `POST` | `/twilio/status` | Twilio signature not yet enforced | Updates call status from Twilio webhook |
| `POST` | `/twilio/recording` | Public placeholder | Currently returns `<Response/>`; no data mutation |

## Auth And Family

| Method | Route | Access | Ownership check |
| --- | --- | --- | --- |
| `PATCH` | `/api/auth/users/:id/role` | Current user only | `req.user.id` must match `:id` |
| `PATCH` | `/api/auth/users/:id/profile` | Current user only | `req.user.id` must match `:id` |
| `POST` | `/api/invitations` | Guardian | Existing senior IDs require guardian-senior link |
| `POST` | `/api/invitations/:id/rotate` | Guardian | Invitation senior must be linked to guardian |
| `DELETE` | `/api/invitations/:id` | Guardian | Invitation senior must be linked to guardian |
| `GET` | `/api/family-members` | Senior/Guardian | Returns only linked family graph |

## AI Proxy Operations

| Method | Route | Access | Ownership check |
| --- | --- | --- | --- |
| `GET` | `/api/ai/audit-summary` | Guardian | Optional dashboard token; operational summary across proxy usage |
| `POST` | `/api/ai/chat-completions` | Senior/Guardian | Per-user rate/unit limit and audit log |
| `POST` | `/api/ai/embeddings` | Senior/Guardian | Per-user rate/unit limit and audit log |

## Interviews, Calls, And Notifications

| Method | Route | Access | Ownership check |
| --- | --- | --- | --- |
| `POST` | `/api/uploads/audio` | Senior/Guardian | File delivery later requires recorded senior ownership |
| `POST` | `/api/interview-schedules` | Guardian | Target senior resolved through guardian link |
| `GET` | `/api/interview-schedules` | Guardian | Returns schedules for current guardian only |
| `POST` | `/api/interview-schedules/:id/call-now` | Guardian | Schedule must belong to current guardian |
| `POST` | `/api/app-calls` | Guardian | Target senior resolved through guardian link |
| `POST` | `/api/interview-sessions` | Senior/Guardian | Senior uses self; guardian target senior must be linked |
| `PATCH` | `/api/interview-sessions/:id/pause` | Senior/Guardian | Session senior must be accessible |
| `PATCH` | `/api/interview-sessions/:id/accept` | Senior | Session senior must be self |
| `PATCH` | `/api/interview-sessions/:id/end` | Senior/Guardian | Session senior must be accessible |
| `POST` | `/api/interview-records` | Senior/Guardian | Record, question, and session senior must match and be accessible |
| `PATCH` | `/api/interview-records/:id` | Senior/Guardian | Record senior must be accessible |
| `PATCH` | `/api/interview-records/bulk-consent` | Senior/Guardian | All records must belong to accessible senior |
| `GET` | `/api/notifications` | Senior/Guardian | Current user's notifications only |
| `PATCH` | `/api/notifications/:id/read` | Senior/Guardian | Notification must belong to current user |
| `POST` | `/api/nudges` | Guardian | Target senior resolved through guardian link |

## Content And Memory

| Method | Route | Access | Ownership check |
| --- | --- | --- | --- |
| `POST` | `/api/questions` | Guardian | Target senior resolved through guardian link |
| `POST` | `/api/uploads/photos` | Guardian | Target senior resolved through guardian link |
| `GET` | `/api/free-speech` | Guardian | Target senior resolved through guardian link |
| `GET` | `/api/interview-records` | Senior/Guardian | Senior self or guardian-linked senior |
| `GET` | `/api/memories` | Senior/Guardian | Senior self or guardian-linked senior |
| `POST` | `/api/memories` | Senior/Guardian | Senior self or guardian-linked senior |
| `PATCH` | `/api/memories/:id` | Senior/Guardian | Memory senior must be accessible |
| `DELETE` | `/api/memories/:id` | Senior/Guardian | Memory senior must be accessible |
| `GET` | `/api/photos` | Senior/Guardian | Senior self or guardian-linked senior |
| `PATCH` | `/api/photos/:id` | Senior/Guardian | Photo senior must be accessible; linked memories must belong to same senior |
| `DELETE` | `/api/photos/:id` | Senior/Guardian | Photo senior must be accessible |
| `GET` | `/api/family-questions` | Senior/Guardian | Senior self or guardian-linked senior |
| `PATCH` | `/api/questions/:id` | Senior/Guardian | Question senior/photo/creator relationship must be accessible |
| `DELETE` | `/api/questions/:id` | Senior/Guardian | Question senior/photo/creator relationship must be accessible |

## Calendar, Progress, And Autobiography

| Method | Route | Access | Ownership check |
| --- | --- | --- | --- |
| `GET` | `/api/calendar-events` | Senior/Guardian | Senior self or guardian-linked senior |
| `POST` | `/api/calendar-events` | Senior/Guardian | Senior self or guardian-linked senior |
| `DELETE` | `/api/calendar-events/:id` | Senior/Guardian | Event senior must be accessible |
| `GET` | `/api/progress` | Senior/Guardian | Senior self or guardian-linked senior |
| `GET` | `/api/progress/:seniorId` | Senior/Guardian | Requested senior must be accessible |
| `GET` | `/api/autobiography/draft` | Senior/Guardian | Senior self or guardian-linked senior |
| `POST` | `/api/autobiography/draft` | Senior/Guardian | Senior self or guardian-linked senior |
| `DELETE` | `/api/autobiography/draft` | Senior/Guardian | Senior self or guardian-linked senior |

## Publication And Legacy

| Method | Route | Access | Ownership check |
| --- | --- | --- | --- |
| `POST` | `/api/cover-designs/generate` | Guardian | Target senior resolved through guardian link |
| `PATCH` | `/api/cover-designs/:id/confirm` | Guardian | Cover senior must be accessible |
| `POST` | `/api/publication-requests` | Guardian | Target senior resolved through guardian link |
| `POST` | `/api/legacy/vault` | Senior/Guardian | Senior self or guardian-linked senior |
| `GET` | `/api/legacy/vault` | Senior/Guardian | Senior self or guardian-linked senior |
| `POST` | `/api/legacy/trigger-death` | Guardian | Target senior resolved through guardian link |
| `POST` | `/api/legacy/approve-death` | Guardian | Target senior resolved through guardian link; requires pending verification |
| `GET` | `/api/legacy/shares` | Guardian | Target senior resolved through guardian link; requires released state |
| `POST` | `/api/legacy/reset` | Senior/Guardian | Senior self or guardian-linked senior |

## File Delivery

| Method | Route | Access | Ownership check |
| --- | --- | --- | --- |
| `GET` | `/api/files/*` | Signed short-lived token or Senior/Guardian | File key must map to a photo, interview/free-speech audio record, or publication PDF owned by an accessible senior |

## Known Follow-Ups

| Area | Follow-up |
| --- | --- |
| Push subscription registration | Require authenticated ownership before production; current route can accept a supplied user ID |
| Twilio status webhook | Add signature validation if the route starts mutating sensitive records from public internet traffic |
| Dev auth headers | Keep disabled in production; prefer signed Bearer tokens |
| New routes | Add route, role, and ownership row here in the same change that introduces the route |
