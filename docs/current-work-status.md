# Current Work Status

Last checked: 2026-09-29

Sections dated 2026-07-30/31 below are kept as a historical log. Where they disagree with
`Changes Since 2026-07-31`, the newer section wins.

## Changes Since 2026-07-31 (reconciled 2026-09-29)

The last code commit is `d393118` (2026-08-05). Merged PRs #2–#16 changed several things this
document and `README.md` still described as missing. Reconciled against `src/App.tsx`,
`server/app.ts`, and the commit messages:

| Area | Change | Commits |
| --- | --- | --- |
| Dead code | `/twilio/voice`, `/twilio/status`, `/twilio/recording`, the `/twilio/media` WebSocket, `server/phone.ts`, `server/realtime-bridge.ts`, and unused deps (`twilio`, `date-fns`, `motion`, `autoprefixer`, `@capacitor/camera`) removed. Phone interviews had already been replaced by the in-app call (`server/app-call.ts`) | `b45bd7f` (#3) |
| Route count | `server/app.ts` now registers 71 `/api/*` routes plus the SPA catch-all, and no `/twilio/*` routes | — |
| Auth | `AUTH_TOKEN_SECRET` is required in every environment (empty → login 503, no public fallback secret). Login attempts are rate-limited per phone number (default 10) and per IP (default 100) in a 10-minute window. `/settings` is registered only in dev or when built with `VITE_ENABLE_DEMO_SETTINGS=true`; `/calendar` now requires login | `c5a5bc9` (#2), `fce203e` (#4) |
| Consent | All five purposes moved onto `InterviewRecord` columns (photos carry four; no `chatbot`) and are enforced at consumers: `publish` (publication input, cover), `chatbot` (twin chunks), `familyRead` (guardian-facing masking), `sensitive` (publication, cover, twin, draft), `posthumous` (masked even after vault release). See `docs/consent-enforcement-design.md` | `4094743`, `79671aa` (#7, #8) |
| Retroactive consent | `publish`/`sensitive` revocation and deleting a book-eligible photo block previously generated PDFs and preview jobs for family (409). Consent toggles that do not affect the book no longer block it. Chatbot revocation deletes older chat sessions from browser storage | `ccf903b`, `2e2322b`, `fdc8740`, `0012b17`, `5eea731` (#10, #11) |
| Publication | Failures end in `failed` instead of staying `generating`; recoverable preview errors are capped at 6 attempts. Chrome is launched once per process and reused | `3cdbf41` (#9), `5412715` (#6) |
| Chapters | Chapter titles come only from `server/domain/constants.ts` `FIXED_CHAPTERS`; screens derive from `src/lib/chapters.ts`. The old app-side labels (e.g. `hobbies` = '일과 삶') are gone | `ac67fae` (#12) |
| Web Push | My Page push toggle reflects the real browser subscription, registers `public/push-sw.js`, and unsubscribes (new `DELETE /api/push-subscriptions`). Notifications are readable in a My Page inbox even without VAPID keys | `0454795` (#13) |
| Digital legacy vault | `/parent/vault` (senior: create, show/save family share, revoke, cancel a death report) and `/child/legacy` (guardian: report, approve, cancel, open records after release). 3-of-3 Shamir split with `crypto.getRandomValues`. The reporter cannot approve their own report (single-guardian families fall back to the review window), approval waits `LEGACY_DEATH_REVIEW_HOURS` (default 72), and every linked guardian plus the senior is notified. `POST /api/legacy/cancel-death` added | `d668551`, `a7a9cc1`, `d393118` (#14–#16) |

### This pass (2026-09-29)

- `server/publication-html.ts` now falls back to a Playwright-downloaded Chromium
  (`$PLAYWRIGHT_BROWSERS_PATH/chromium-<rev>/chrome-linux/chrome`, then
  `~/.cache/ms-playwright`, newest revision first) after `CHROME_PATH`,
  `PUPPETEER_EXECUTABLE_PATH`, and the system Chrome/Chromium paths. Without it, the six PDF
  tests in `server/app.test.ts` and `server/publication-html.browser.test.ts` failed in Linux
  containers that have no system Chrome. Covered by `server/chrome-path.test.ts`.
- `README.md` and `PRD_Dearlog.md` updated to match the table above. `docs/technical-architecture.md`
  followed in a separate change: removed files (`SelectModeScreen.tsx`, `server/phone.ts`,
  `server/realtime-bridge.ts`) and Twilio config dropped; consent, retroactive gating, vault,
  push, chapters, and publication failure handling rewritten against the code; the chatbot section now
  says transcript chunks come from `InterviewRecord` and are relabeled `UNVERIFIED` → `ESTIMATED`
  (the old text only described the demo-only `Memory` path).
- `POST /api/auth/phone` no longer has the legacy find-or-create branch. Omitting `isLogin`
  used to return an existing account's token from the phone number alone, with no name check.
  `isLogin` must now be a boolean or the request gets 400. The app and QA scripts already send it.
  Covered by three tests in `server/legacy-api.test.ts`, which fail against the old code.
- `POST /api/legacy/vault` is now `requireRole('senior')`. A linked guardian could previously open the
  senior's vault (holding the key shares) or overwrite an existing one, replacing the shares and resetting
  a pending death review to `alive`. `scripts/db-table-coverage-qa.mjs` now creates the vault with the
  senior token. Two tests in `server/legacy-api.test.ts` fail against the old code.
- `POST /api/legacy/reset` is now `requireRole('senior')` as well. A linked guardian could delete the
  senior's vault and so lift the lock that hides vaulted records from family. The only app caller is the
  senior-only `/parent/vault` screen. One test in `server/legacy-api.test.ts` fails against the old code.
- `scripts/db-table-coverage-qa.mjs` had been failing at `approve-death` since #15 (403: the review window
  had not elapsed). It now reads the pending review from `GET /api/legacy/vault` and, only for the QA senior
  it created in that run, moves `deathTriggeredAt` back past the window before approving, so the server's
  `LEGACY_DEATH_REVIEW_HOURS` stays untouched for real families. Reproduced the 403 against a local server
  with the default 72 h window, then ran the fixed script end to end: all 13 table deltas and
  `released|1|1` passed. (The container has no `sqlite3` CLI; the run used a `node:sqlite` stand-in with
  the same list-mode output.) The script expects a seeded DB (`npm run db:seed`) for chapter rows.
- Phone OTP for login and signup. `POST /api/auth/otp/request` sends a 6-digit code (`crypto.randomInt`,
  hashed in memory, 3 min, 60 s resend gap, per-phone 5 / per-IP 50 sends per window); `POST /api/auth/otp/verify`
  allows 5 tries per code and returns a single-use 10-minute token bound to phone + purpose;
  `POST /api/auth/phone` requires that token and only reveals a name mismatch after it. SMS delivery is
  pluggable (`server/sms.ts`): unset `SMS_PROVIDER` means no codes and login/signup return 503 (fail-closed,
  not keyed on `NODE_ENV`, same as the auth settings); `SMS_PROVIDER=dev` writes codes to the server log and
  `server/data/sms-outbox.jsonl` (gitignored) for local dev and QA. No real SMS vendor is wired yet, so the
  pilot cannot log in until one is. The signup screen's code step used to accept any 6 digits; it now calls
  the server, and login gained a code step with resend. The unreachable `/auth/verify` page (also accepted any
  code) was removed. Both QA scripts read the code from the dev outbox.
- Dependency pass: `npm audit` 15 → 0 without `--force` and without a major upgrade.
  - Direct: `multer` ^2.4.0, `express` ^4.22.3 (pulls `qs` 6.16 / `body-parser` 1.20.8), `vitest` ^4.1.11,
    `tsx` ^4.23.15 (pulls `esbuild` 0.28.2).
  - Transitive, within existing ranges: `@xmldom/xmldom` 0.9.12, `browserslist` 4.29.2,
    `baseline-browser-mapping` 2.11.26, `nanoid` 3.3.19, `undici` 7.30.0.
  - `prisma` 6.19.3 is the newest 6.x and pins `deepmerge-ts` 7.1.5 (fixed in 8.0.0). Prisma 7 is a
    breaking migration, so `package.json` `overrides` pins `@prisma/config` → `deepmerge-ts` ^8.0.2 instead.
    `@prisma/config` only calls `deepmerge()` as the c12 merger when loading a `prisma.config.*` file;
    8.0's breaking changes are in `deepmergeInto`, type names, and Map merging. Verified by loading a
    temporary `prisma.config.ts` with `prisma validate --config`. Drop the override once Prisma ships
    `deepmerge-ts` 8.
  - `@types/react` is now an explicit devDependency. It was only installed as an optional peer of
    `zustand` / `@testing-library/react`; npm 11 prunes optional peers and `npm run lint` then fails with
    JSX `key` errors.
  - npm 10.9.7 crashes (`Cannot read properties of null (reading 'edgesOut')`) in `npm audit fix` and
    when upgrading `vitest`. The `vitest`, `@types/react`, transitive, and override steps were run with
    `npx npm@11`; the resulting lockfile (v3) installs cleanly with npm 10 `npm ci`.

### Verification (2026-09-29, Linux cloud container, Node v22.22.2)

| Command | Result |
| --- | --- |
| `npm ci` | Passed |
| `npm run lint` | Passed |
| `npm test` before the Chrome fallback | 37 files passed, 2 failed (6 tests): `Chrome 실행 파일을 찾을 수 없습니다` |
| `npm test` with `CHROME_PATH` set, before the fallback | Passed: 39 files / 333 tests |
| `npm test` after the fallback, no `CHROME_PATH` | Passed: 40 files / 335 tests |
| `npm test` after the login fix | Passed: 40 files / 337 tests |
| `npm test` after phone OTP | Passed: 41 files / 358 tests. Forcing the token check to pass fails 4 of the new OTP tests |
| Phone OTP against real servers | `SMS_PROVIDER=dev`: `db-table-coverage-qa.mjs` passed end to end; Chromium (390 px) completed signup and login through the code step, and a wrong code showed "4번 더 입력할 수 있습니다". Unset `SMS_PROVIDER`: `otp/request` 503, `auth/phone` without a token 401 |
| `npm run build` | Passed; entry chunk `index-*.js` 286.00 kB (gzip 91.77 kB) |
| `npm audit` | 15 findings (1 low, 7 moderate, 7 high) before the dependency pass below |
| `npm audit` after the dependency pass | 0 vulnerabilities; `npm ci` from a clean `node_modules` with npm 10.9.7 also reports 0 |
| After the dependency pass | `npm run lint` passed, `npm test` 40 files / 337 tests passed, `npm run build` passed, `npm run db:generate` and `npm run db:migrate` passed, `npm run server:dev` served `/api/health` |

## Codebase Consolidation (2026-07-30)

The repository used to carry two parallel generations of the app. The legacy generation was unreachable from `src/App.tsx` and has now been removed; the live generation is the only one left.

| Item | Result |
| --- | --- |
| Deleted legacy files | 83 files (`git status` shows them as deleted): `src/store.ts`, `src/pages/{ArchivePage,ReviewPage,PersonaPage,InterviewPage,AutobiographyPage,SettingsPage,AuthPage,OnboardingPage}.tsx`, kebab-case agents (`router`, `persona`, `photo-recall`, `tone-calibrator`, `family-question-queue`, `calendar-trigger`, `emotion-analyzer`, `coherence-truth`, `reminiscence-therapy`, `voice-twin`, `editorial-layout`), `src/lib/{rag,tags,insights,journey,interview,pdf,consent}/**`, `src/lib/openai.ts`, `src/lib/roles.ts`, `src/routes/pageLoaders.ts`, legacy components (`Layout`, `JourneyRail`, `ChapterPreview`, `ConsentControls`, `SourceEvidencePanel`, `TrustSafetyPanel`, `ConfidenceLabel`, `SilenceIndicator`), and their tests |
| Also removed | `scripts/generate-capstone-assets.ts` and the `demo:assets` npm script |
| Live state | 8 Zustand stores in `src/store/`, 7 camelCase agents in `src/lib/agents/`, screens under `src/pages/{Parent*,Child*}Screen.tsx` plus Auth/Splash/Intro/MyPage/Consent/Calendar/Chatbot/Autobiography/PublicationPreview/CreateRecordSpace/AutoLogin/ParentWelcome/Verify/DemoSettings |
| New demo route | `/settings` now renders `src/pages/DemoSettingsScreen.tsx` (the old `SettingsPage.tsx` is gone) |

## Documentation Rewrite (2026-07-30)

`README.md` and `docs/technical-architecture.md` had been written against the legacy generation and were misleading for new contributors. Both were rewritten against the live code. Corrections applied:

| Claim in old docs | Verified reality |
| --- | --- |
| Frontend table pointed at `src/store.ts`, `InterviewPage`, `ArchivePage`, `ReviewPage`, `PersonaPage`, `AutobiographyPage`, `lib/rag/index.ts`, `lib/tags/tag-db.ts`, `lib/pdf/generator.ts`, `Layout`/`JourneyRail`/`ChapterPreview` | All deleted. Replaced with the live store/screen/agent files |
| Data flow diagram stored everything in "Zustand Persist" | Storage is the Express + Prisma/SQLite server. `/api/*` routes: 69, plus 3 `/twilio/*` webhooks and one SPA catch-all in `server/app.ts`. Prisma models: 24. Frontend syncs through `src/lib/local-server.ts`; `persist` is only an offline cache |
| `npm test` 통과: 44 files / 264 tests | Wrong. See `Verification` below; the figure was removed from `README.md` because the test set is still changing |
| Demo steps referenced a "발표 데모 탭" and legacy screen names | `/settings` is a single screen with sections. Its built-in 6-step route list is `/settings → /parent/interview → /child/photos → /child/questions → /child/chatbot → /child/autobiography` |
| 주간 가족 퀴즈 listed as a shipped feature | No implementation anywhere in `src/` or `server/` (only a demo-data description string). Moved to 향후 작업 in both docs |
| 분신 대화 described as `lib/rag/` + `persona.ts` with embeddings | `src/lib/agents/digitalTwin.ts` selects chunks with Korean token scoring (particle stripping, stopwords, domain-keyword expansion, exact 3 / substring 2, top 5), drops `UNVERIFIED` chunks, and falls back to quoting raw text. `MemoryVectorEntry` and `/api/ai/embeddings` exist but are not used on this path |
| 디지털 유산 금고 listed under 구현 완료 | Server API (`/api/legacy/*`, 6 routes) and `LegacyVault` model work, but no live screen calls them, and `src/lib/security/{shamir,encryption}.ts` have unit tests and zero importers. Documented as prototype / UI 미배선 |
| GPS 마스킹 described only as a display rule | Now wired into the live upload path: `src/pages/ChildPhotosScreen.tsx` calls `sanitizePhotoForUpload` before `uploadLocalPhoto`, which nulls the coordinates, sets `gpsMasked`/`locationLabel`, strips the JPEG APP1 `Exif` segment, and sends `공개 전 확인 필요` in the location text |
| PDF generation attributed to client-side `jsPDF` | PDF is rendered on the server: `server/publication-html.ts` builds A5/B5 HTML with `NotoSansKR-Regular.ttf` and renders it via `puppeteer-core`. The unused client PDF component and dependencies were removed in the continuation cleanup |
| Server architecture underdocumented | Added server file map, route groups, publication pipeline stages (`cache_check → editorial_plan → writing_draft → manifest → render → done`), readiness values, draft cache, and the 24-model list |

Additional gaps recorded in the docs rather than glossed over:

- `DELETE /api/memories/:id` still must not be described as complete deletion: it does not yet cover
  every JSON reference, derived publication/cache copy, `LegacyVault`, or backup/retention policy.
- `MemoryConsentSettings` now exposes all 5 purposes in `ConsentSettingsScreen`, but
  `familyRead`, `posthumous`, and `sensitive` still need enforcement at every downstream consumer.

## Continuation Cleanup and Browser QA (2026-07-30)

The post-consolidation follow-up was completed:

- Cleaned `vitest.config.ts`; it now excludes only standard generated/vendor paths and the separate
  `Senior-Friendly Family Autobiography App` reference project. Current interviewer tests are included.
- Removed the unused `src/components/AutobiographyPDF.tsx` component and the unused `jspdf` and
  `@react-pdf/renderer` dependencies. PDF generation now has one supported path: the server publication pipeline.
- Corrected `docs/capstone-demo-package.md` and `docs/github-upload-checklist.md`. The preserved files under
  `artifacts/capstone-demo/` are legacy snapshots; the removed `npm run demo:assets` command cannot regenerate them.
- Ran a mobile-width browser pass through `/settings`, `/child/photos`, `/child/questions`, `/child/chatbot`,
  `/child/autobiography`, and `/parent/interview`. Korean direct input and the parent answer-completion screen worked.
- Fixed the offline demo record-space context so the child question controls no longer remain disabled at
  `기록 공간 확인 중`.
- Fixed offline demo data access across the child/interview/calendar/consent stores. Offline mode now preserves
  seeded state and avoids background server calls; demo mutations remain local.
- Fixed offline autobiography rendering. Seeded 24-chapter drafts now open directly in the chapter reader instead
  of showing `Failed to fetch`; the last chapter loops back to the beginning without attempting a server PDF request.
- Added `src/hooks/useActiveSeniorContext.test.ts` for the seeded demo record-space fallback.

## Security and Data Sovereignty Continuation (2026-07-31)

- Upgraded the affected direct dependencies without `npm audit fix --force`:
  - Express `^4.22.2`
  - Multer `^2.2.0`
  - React Router DOM `^7.18.2`
  - Vite `^6.4.3`, now only in `devDependencies`
  - `@types/multer` `^2.2.0`, now only in `devDependencies`
- Added bounded Multer upload policies in `server/storage.ts`:
  - photos: 20 MiB, 1 file, 8 fields, 10 parts, nesting depth 0
  - audio: 25 MiB, 1 file, 1 field, 3 parts, nesting depth 0
  - `server/storage.test.ts` verifies normal uploads, nested-field rejection, size/file limits,
    and removal of partial disk files.
- Added a Memory-level section to both live consent routes. It exposes publish, family read,
  chatbot, posthumous, and sensitive purposes as `granted` / `revoked` / `needs_review`.
- Added reversible per-memory stop-use. One PATCH sets `privacy=private`, revokes all five
  purposes, and removes the embedding; the UI changes only after the server succeeds.
- Added server validation for Memory consent keys and values. Invalid or unknown values return 400.
- Closed the chatbot bypass where a revoked `Memory` could be reintroduced through a duplicate
  `InterviewRecord`: interview records now carry their `chatbot` flag into the live transcript
  store and the chatbot excludes records with `chatbot === false`.
- Permanent deletion was deliberately not exposed. Derived copies, retention, backup scope,
  guardian authority, and reauthentication must be settled first.
- Orca orchestration run: `run_0271a82ecdee`. The dependency and data-sovereignty tasks
  completed. The read-only worktree-audit Claude worker stopped when its Claude quota was
  exhausted, so the staged/unstaged audit notes below remain important.
- Antigravity IDE CLI 1.107.0 was invoked from
  `/Applications/Antigravity IDE.app/Contents/Resources/app/bin/antigravity-ide`. It opened the
  workspace and Agent panel, but its `chat` subcommand did not inject the prompt in this install;
  no Antigravity review artifact was produced and no repository edit was attributed to it.

## Verification

| Command | Result |
| --- | --- |
| `npm run lint` | Passed (`tsc --noEmit`, measured 2026-07-31 00:58 KST) |
| `npm test` | Passed: 30 files / 240 tests (measured 2026-07-31 00:58 KST) |
| `npm run build` | Passed: 1,786 modules transformed with Vite 6.4.3 (measured 2026-07-31 00:58 KST) |
| `git diff --check` | Passed (measured 2026-07-31 00:58 KST) |
| Post-commit `npm run lint` | Passed (measured 2026-07-31 01:11 KST) |
| Post-commit `npm test` | Passed: 30 files / 240 tests. One run reported a single failure that did not reproduce across six later runs, including two concurrent runs; the failing test name was not captured. Treat as a suspected port/timing flake in the Supertest-backed server tests and capture the name if it recurs |
| Post-commit `npm run build` | Passed (measured 2026-07-31 01:11 KST) |
| Tracked-asset check | Passed: every image/font path imported from `src/` and `server/` resolves to a tracked file, and `git status` is clean |
| Mobile-width browser QA | Passed for demo seed, child questions/chatbot/autobiography, parent interview, Korean text answer, and save-complete screen; post-fix browser error/warning log was empty |
| Current Browser-plugin pass | Not run: the in-app browser runtime reported zero available browsers. React consent-screen tests and the full suite passed instead |

Sandbox note:

- `npm test` may fail inside a restricted sandbox with `listen EPERM: operation not permitted 0.0.0.0` because Supertest opens an ephemeral listener. The same command passed when run with local permission.

## Working Tree Groups

| Area | Files |
| --- | --- |
| Routing and app shell | `src/App.tsx`, `src/main.tsx`, `src/index.css`, `src/App.css` |
| Auth and onboarding | `src/pages/AuthScreen.tsx`, `AutoLoginScreen.tsx`, `ParentWelcomeScreen.tsx`, `SelectModeScreen.tsx`, `VerifyPage.tsx`, `src/store/authStore.ts`, `src/types/user.ts` |
| Parent experience | `src/pages/ParentHomeScreen.tsx`, `ParentInterviewScreen.tsx`, `ParentProgressScreen.tsx`, `ParentTranscriptScreen.tsx`, `src/components/BottomNav.tsx`, `src/hooks/useScheduledCall.ts`, `src/store/scheduledCallStore.ts` |
| Child experience | `src/pages/ChildHomeScreen.tsx`, `ChildQuestionsScreen.tsx`, `ChildPhotosScreen.tsx`, `ChildProgressScreen.tsx`, `ChildChaptersScreen.tsx`, `CreateRecordSpaceScreen.tsx`, `src/components/ChildBottomNav.tsx`, `src/store/childStore.ts`, `src/types/child.ts` |
| Autobiography and publication | `src/pages/AutobiographyScreen.tsx`, `PublicationPreviewScreen.tsx`, `src/components/PublicationBookPreview.tsx`, `src/store/autobiographyStore.ts`, `server/publication.ts`, `server/publication-html.ts` |
| Chatbot and agents | `src/pages/ChatbotScreen.tsx`, `src/lib/agents/*`, `src/types/agents.ts` |
| Consent and privacy | `src/pages/ConsentSettingsScreen.tsx`, `src/store/consentStore.ts`, `src/lib/photos/metadata.ts` |
| Demo | `src/pages/DemoSettingsScreen.tsx`, `src/lib/demo/demo-seed-adapter.ts`, `src/lib/demo/capstone-demo-data.ts`, `src/store/devModeStore.ts` |
| Local server and persistence | `server/app.ts`, `server/prisma/schema.prisma`, `server/prisma/init.ts`, `src/lib/local-server.ts` |
| Docs | `README.md`, `docs/technical-architecture.md`, `docs/current-work-status.md` |
| Tests and config | `vitest.config.ts`, `vite.config.ts`, `tsconfig.json`, `package.json`, `package-lock.json` |

## Working Tree Commit Split (2026-07-31)

The consolidation working tree (167 tracked changes + 76 untracked paths, with a stale index where
18 paths were `MM`, 18 were `AM`, and `src/components/AutobiographyPDF.tsx` was `AD`) was committed
in eight logical commits on `integrate-upstream-ui`. Each commit used `git commit -- <paths>` so the
working-tree content was recorded and the stale index could never leak into a commit. No
`git reset`, `git checkout --`, or `git clean` was used, and no file was deleted from disk.

| Commit | Scope |
| --- | --- |
| `b86b4d0` | `.gitignore`: exclude QA artifacts, business documents, and one-off temp files |
| `86f4b5f` | Dependency upgrades and build/test config (`package.json`, lock, `tsconfig`, `vite`, `vitest`, `.env.example`) |
| `7d0cf06` | `src/assets/` — 25 files including the 22 Figma images |
| `e124662` | `src/` consolidation: legacy generation removed, live screens/stores/agents in (166 files) |
| `4a519ce` | `server/`: publication pipeline, AI proxy, upload limits, consent validation (17 files) |
| `531b41c` | Capacitor iOS project, icon/splash sources, `capacitor.config.ts` (30 files) |
| `56653b8` | `scripts/`: pilot health checks, QA automation, backup, demo seeds, launchd |
| `cbccbbb` | Docs rewrite plus operational docs, PRD, and the workflow presentation export |

Defect found and fixed by this pass:

- `src/assets/figma/` (22 images) was untracked while 13 live screens imported it. A fresh clone
  could not build. It is now committed. Every asset and font path referenced from `src/` and
  `server/` was re-verified as tracked afterwards.

Checks before committing:

- Untracked text files were scanned for API keys, Twilio SIDs, private keys, phone numbers, and
  personal email addresses. None were found. `.env.example` contains only empty placeholders.
- `.git/index.lock` was a stale 0-byte file from a crashed 2026-06-02 process with no live git
  process; it was removed so commits could proceed.

Known cosmetic residue: `git diff --check` reports trailing whitespace in
`docs/service-cost-model.md` and `scripts/qa-automation.mjs`. Both are pre-existing in the newly
tracked files and were not rewritten.

## Earlier QA (carried forward, 2026-05-31)

| Flow | Result |
| --- | --- |
| API health | `GET /api/health` returned `ok: true` |
| Chapters/questions seed | 7 chapters and 30 common questions returned |
| Auth/signup API | Guardian signup, senior invite, token login completed |
| Parent invite UI route | `/parent/autologin?token=...` redirected to `/parent/welcome` and showed guardian/senior names |
| Question and answer API | Guardian question creation, senior answer storage, progress total increment completed |
| Photo upload API | Demo photo upload created 3 generated questions |
| Autobiography draft API | Draft save and fetch returned one narrative |
| Browser smoke | `/splash`, `/intro`, `/auth`, `/child`, `/parent/welcome` rendered |
| Ownership guards | API checks and regression tests for family question filtering and unrelated-user mutation attempts |
| AI proxy | Frontend OpenAI SDK usage replaced with local server `/api/ai/*` proxy calls |
| Family question scoping | `Question.seniorId` records the target senior directly |
| Cover/publication/legacy audit | Cover confirmation checks target senior ownership; publication and legacy cross-family access covered by regression tests |
| AI proxy hardening | Per-user rate limits, estimated usage limits, `AiProxyAuditLog`, config-error logging, provider-error telemetry |
| AI proxy operations dashboard | Guardian-visible audit summary, endpoint/user/error rollups, alert thresholds, dashboard token gate, retention pruning |
| AI proxy alert routing | Operator notification routing, duplicate-alert cooldown, alert metadata, `docs/ai-proxy-ops-runbook.md` |
| Auth boundary hardening | Signed Bearer auth tokens; production disables forged `x-user-*` dev headers by default |
| Invitation lifecycle | Configurable expiry, used/revoked metadata, guardian-only rotation/revoke APIs, My Page controls |
| File delivery access | `/api/files/*` checks DB-backed ownership; photo URLs use short-lived signed tokens |
| Route authorization matrix | `docs/route-authorization-matrix.md` |

Notes:

- The 2026-07-30 continuation pass successfully entered Korean text in the parent interview UI and reached the
  save-complete screen. It used offline demo state, then reloaded the canonical demo seed to remove the temporary answer.
- Earlier API QA-created users, invitations, DB records, and uploaded test files were cleaned up after each check.

## Release Risks

| Risk | Status | Immediate action |
| --- | --- | --- |
| Test configuration drift | Resolved; current tests are included and the full suite passes | Keep the excludes limited to vendor/generated/reference-project paths |
| Server AI proxy operations | Browser API key exposure removed; proxy calls rate-limited, audited, summarized in the guardian My Page dashboard, threshold-checked, routed to operators, pruned by retention | Set real production operator IDs, keep `AI_PROXY_DASHBOARD_TOKEN` in the team secret store, review thresholds after live traffic |
| SMS vendor for OTP | Login and signup now require a phone code, but only the dev sender exists. With `SMS_PROVIDER` unset the pilot returns 503 for login and signup | Pick a vendor (Solapi, NCP SENS, …), register the sender number, implement `SmsSender` in `server/sms.ts`, then set `SMS_PROVIDER` on the pilot |
| Auth token operations | Signed Bearer tokens preferred and dev headers blocked outside allowed environments; no refresh/revocation storage yet | Set a strong production `AUTH_TOKEN_SECRET`, add refresh/revocation policy, keep `ALLOW_DEV_AUTH_HEADERS` off in production |
| Digital legacy vault | UI is wired (`/parent/vault`, `/child/legacy`) with a 3-of-3 split and two-person death review. Creating (`POST /api/legacy/vault`) and revoking (`POST /api/legacy/reset`) the vault are senior-only on the server too | Treat as demo-only until key management, legal, and audit review are done |
| Memory-level data sovereignty | All five purposes are enforced at consumers and revocation/deletion is retroactive for generated books. `Memory`/`MemoryConsentSettings`/`MemoryVectorEntry` are demo-seed only, and `GET /api/memories` still returns `Memory` bodies when its chatbot consent is revoked. Complete deletion scope/policy is unresolved | Decide the `Memory` table cleanup, define retention/backup/derived-copy deletion, then add reauthenticated deletion with an explicit guardian policy |
| PDF implementation duplication | Resolved; unused client component and both unused PDF dependencies were removed | Keep server publication rendering as the single supported PDF path |
| Weekly family quiz | Documented as a planned feature with no implementation | Design and implement, or drop it from product materials |
| Presentation assets | Existing `artifacts/capstone-demo/` files are preserved snapshots, but there is no regeneration command | Capture new assets from live routes if a new presentation package is needed |
| Public tunnel | Local `/api/health` is healthy, but `https://dear-log.com/api/health` returned Cloudflare error 1033 during the 2026-07-30 pass | Restart the named `dearlog` tunnel only when public access is intentionally required |
| Dependency advisories | 2026-09-29: 0. It had climbed back to 15 after new advisories; fixed by in-range upgrades plus one `overrides` entry for `deepmerge-ts` under `@prisma/config` (see `This pass`) | Remove the `deepmerge-ts` override when Prisma updates it; re-run `npm audit` periodically; do not use `npm audit fix --force` |

## Recommended Next Steps

1. ~~Review the large consolidation working tree in logical groups before any commit.~~ Done
   2026-07-31; see `Working Tree Commit Split` below. The working tree is now clean.
2. ~~Decide whether untracked one-off artifacts belong in Git.~~ Done 2026-07-31. QA PDFs/JSON,
   the business-plan documents, `screenshot.png`, `server/.write-test-*`,
   `remove_fake_statusbar.py`, and `scripts/launchd/logs/` are excluded via `.gitignore`.
   No file was deleted from disk.
3. Run a signed-in, non-demo browser pass against the intended API target before a real family pilot.
4. Define complete-delete semantics: references, publication/cache copies, `LegacyVault`, backups,
   retention period, guardian authority, and reauthentication.
5. ~~Enforce `familyRead`, `posthumous`, and `sensitive` at all downstream consumers.~~ Done
   (#7, #8); see `docs/consent-enforcement-design.md`.
6. ~~Triage the 15 `npm audit` findings.~~ Done 2026-09-29 (0 remaining). Remove the `deepmerge-ts`
   override once Prisma ships `deepmerge-ts` 8.
7. When public access is wanted, restart the Cloudflare named tunnel and run `npm run pilot:public:check`.
8. Complete key-management, legal, and audit review before treating the digital legacy vault as
   production-ready. The UI is wired (#14–#16).
9. Decide whether to drop the unused `Memory` table family and how `GET /api/memories` should
   treat revoked chatbot consent.
10. Handle the `/?callSessionId=...` link that in-app call notifications carry; nothing reads it yet.
