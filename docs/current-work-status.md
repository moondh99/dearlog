# Current Work Status

Last checked: 2026-07-31

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
| Auth token operations | Signed Bearer tokens preferred and dev headers blocked outside allowed environments; no refresh/revocation storage yet | Set a strong production `AUTH_TOKEN_SECRET`, add refresh/revocation policy, keep `ALLOW_DEV_AUTH_HEADERS` off in production |
| Digital legacy vault | Server API and model work, but no live UI calls them and the client crypto modules (`shamir.ts`, `encryption.ts`) have no importers; release policy is simulated | Treat as demo-only until UI, key management, legal, and audit review are done |
| Memory-level data sovereignty | Five purposes and reversible stop-use are now live; three downstream purposes are not fully enforced and complete deletion scope/policy is unresolved | Enforce every purpose at consumers, define retention/backup/derived-copy deletion, then add reauthenticated deletion with an explicit guardian policy |
| PDF implementation duplication | Resolved; unused client component and both unused PDF dependencies were removed | Keep server publication rendering as the single supported PDF path |
| Weekly family quiz | Documented as a planned feature with no implementation | Design and implement, or drop it from product materials |
| Presentation assets | Existing `artifacts/capstone-demo/` files are preserved snapshots, but there is no regeneration command | Capture new assets from live routes if a new presentation package is needed |
| Public tunnel | Local `/api/health` is healthy, but `https://dear-log.com/api/health` returned Cloudflare error 1033 during the 2026-07-30 pass | Restart the named `dearlog` tunnel only when public access is intentionally required |
| Dependency advisories | Reduced from 15 to 3: 2 high React Router RSC-only entries and 1 low Windows `tsx → esbuild` dev-server entry. The current published React Router line has no audit-clean upgrade, and this SPA does not use RSC | Keep the documented exception narrow, monitor for a patched Router release and a `tsx` update, and never downgrade to 7.11.0 or use `npm audit fix --force` |

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
5. Enforce `familyRead`, `posthumous`, and `sensitive` at all downstream consumers.
6. Monitor React Router and `tsx` for patched releases; keep the current three audit findings documented.
7. When public access is wanted, restart the Cloudflare named tunnel and run `npm run pilot:public:check`.
8. Complete UI, key-management, legal, and audit review before treating the digital legacy vault as production-ready.
