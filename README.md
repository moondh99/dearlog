# Dearlog

Dearlog는 부모님의 기억을 AI 인터뷰로 수집하고 가족이 함께 검수한 뒤, 자서전·음성 기록·분신 대화로 오래 보존하는 가족 기억 아카이브 서비스입니다.

서비스 상품은 1회 제작형 자서전 PDF/실물 책 패키지와, 가족 질문·분신 대화·기념일 트리거를 계속 제공하는 월 구독형 아카이브로 나뉩니다. 모바일 전용(`max-w-[390px]`) 화면으로 설계했으며, 발표 시연에서는 `/settings` 화면에서 사전 데모 데이터를 불러와 서버·AI 호출 없이도 인터뷰, 사진 질문, 분신 대화, 인쇄용 자서전을 보여줄 수 있습니다.

이 문서의 항목은 `src/App.tsx` 라우트 테이블과 `server/app.ts` 라우트 등록을 직접 확인한 현재 코드 상태입니다. 아직 화면에 배선되지 않은 기능은 `구현 범위와 한계` 절에 따로 적었습니다. 마지막 대조: 2026-09-29.

## 아키텍처 한눈에 보기

| 계층 | 실체 |
| --- | --- |
| 프론트 | React 19 + Vite + React Router 7, 모바일 전용 레이아웃, 라우트 단위 lazy 로딩 (`src/App.tsx`) |
| 상태 | Zustand 스토어 8개 (`src/store/*.ts`). 각 스토어는 `persist`로 localStorage 캐시를 두고 서버와 동기화 |
| 서버 통신 | `src/lib/local-server.ts` 단일 API 클라이언트 (약 1,150줄) |
| AI | 프론트 에이전트 7개(`src/lib/agents/*.ts`)가 서버 AI 프록시(`/api/ai/*`)를 호출. 브라우저에는 API 키가 없음 |
| 백엔드 | Express(`server/app.ts`, 기본 포트 8787) + Prisma/SQLite. `/api/*` 라우트 71개, SPA catch-all 1개 |
| 데이터 | Prisma 모델 24개 (`server/prisma/schema.prisma`) |
| 인쇄물 | 서버에서 HTML을 조판하고 `puppeteer-core`로 A5/B5 PDF 렌더 (`server/publication-html.ts`) |
| 모바일 | Capacitor iOS. `dearlog:` 커스텀 스킴 딥링크 처리 (`src/App.tsx`의 `DeepLinkListener`) |

## 핵심 기능

- 휴대폰 번호 기반 로그인/가입. 가입은 자녀(보호자) 계정이고, 부모님은 자녀가 보낸 초대 링크로 들어옵니다
- 자녀가 부모님을 초대하는 링크 발급·재발급·폐기와 부모님 자동 로그인(`/parent/autologin?token=...`)
- 부모님 화면: 질문 카드 낭독(TTS), 마이크 녹음, 서버 STT, AI 정리, 충돌 플래그 표시
- 자녀 화면: 사진 업로드 → 서버 사진 분석 → 추천 질문 자동 생성 → 가족 질문 등록
- 자녀 질문을 시니어 친화 표현으로 다시 쓰는 질문 재구성
- 고정 챕터 7개 기준 진행률과 답변/대기 질문 관리
- 저장된 기억 기반 `나의 분신` 대화와 답변별 원문·신뢰도 배지 확인
- 답변별 동의 5종(출판·챗봇·가족 열람·사후 공개·민감 정보)과 사진별 동의 4종(챗봇 제외) 토글. 출판/챗봇은 전체·챕터 단위 일괄 적용도 지원
- 사진 업로드 시 GPS 좌표 마스킹과 JPEG EXIF 제거
- 문체 3종 중 선택해 챕터별 자서전 초안 생성, 문단별 출처(`sourceChunkIds`) 보존
- 서버 출판 파이프라인 기반 A5 인쇄용 PDF와 판매용 기록집 검수 리포트
- 가족 일정/기념일에서 관련 기억을 찾아 이야기 전달 또는 인터뷰 주제를 제안하는 캘린더 트리거
- 예약 시간에 인터뷰 화면을 띄우는 앱 내 호출 모니터
- 마이페이지의 Web Push 알림 구독 토글과 알림함
- 디지털 유산 금고: 부모님이 금고를 열고(3-of-3 열쇠 분할), 보호자가 사망 심사(신고·유예·승인·취소)를 거쳐 사후 공개 기록을 엽니다
- AI 프록시 사용량·오류율·알림 임계값을 마이페이지에서 확인하는 운영 점검 패널
- 발표용 데모 데이터 주입/초기화와 오프라인 시연 모드(`/settings`)

## 상품 구조

| 구분 | 고객이 구매하는 것 | 지속 가치 |
| --- | --- | --- |
| 1회 제작 | AI 인터뷰 기반 자서전 A5 PDF, 판매용 기록집 검수 리포트, 표지 시안 | 가족에게 건넬 수 있는 완성 결과물 |
| 월 구독 | 가족 질문 등록, 분신 대화, 기념일·일정 트리거, 다음 인터뷰 예약 | 저장된 기억을 가족 대화와 재방문으로 계속 연결 |

주간 가족 퀴즈는 기획 항목이며 현재 코드에는 구현이 없습니다. `향후 작업`을 참고하세요.

## 기록 범위

Dearlog는 가족의 모든 기억을 무한정 수집하지 않고, 서버에 고정된 챕터 7개(`server/domain/constants.ts`의 `FIXED_CHAPTERS`)로 질문을 구성합니다. 공통 질문 30개가 시드로 들어가고, 챕터별 목표 답변 수는 15개(`MIN_ANSWERS_PER_CHAPTER`)입니다.

챕터 제목의 출처는 `FIXED_CHAPTERS` 하나입니다. 화면은 `src/lib/chapters.ts`가 이 목록을 그대로 가져다 쓰고, 화면에만 필요한 설명문만 덧붙입니다. 제목은 책 목차에 그대로 찍힙니다.

| 챕터 ID | 제목 |
| --- | --- |
| `childhood` | 유년기 |
| `adolescence` | 청소년기 |
| `youth` | 청년기 |
| `family_home` | 가정을 꾸린 이야기 |
| `hobbies` | 취미 |
| `relationships` | 인간관계 |
| `messages` | 전하고 싶은 이야기 |

## 기술 스택

- React 19, TypeScript, Vite 6, React Router 7
- Zustand 5 (스토어 8개, `persist` + 서버 동기화)
- Express 4, Prisma 6, SQLite
- Tailwind CSS 4 유틸리티, lucide-react 아이콘
- Vitest 4, Testing Library, fast-check
- Mindlogic FactChat Gateway(OpenAI 호환) 연동, `OPENAI_API_KEY`는 embeddings·TTS·STT 경로용
- Web Push(web-push)
- `puppeteer-core` 기반 서버 사이드 인쇄용 PDF 렌더
- Capacitor 8 (iOS)

## 화면과 라우트

`src/App.tsx`에 등록된 라우트입니다. `RoleGuard`는 역할이 없으면 `/auth`로, 역할이 다르면 해당 역할 홈으로 보냅니다. `AuthGuard`는 역할과 무관하게 로그인 여부만 봅니다.

| 라우트 | 화면 | 접근 |
| --- | --- | --- |
| `/` | `/splash`로 리다이렉트 | 공개 |
| `/splash`, `/intro` | 스플래시, 서비스 소개 | 공개 |
| `/auth`, `/auth/verify` | 휴대폰 인증, 코드 확인 | 공개 |
| `/parent/autologin` | 초대 토큰 자동 로그인 | 공개 |
| `/parent/welcome` | 부모님 최소 프로필 입력 | 부모님 |
| `/parent` | 부모님 홈 | 부모님 |
| `/parent/interview` | 인터뷰(TTS·녹음·STT·AI 정리) | 부모님 |
| `/parent/progress` | 부모님 진행률 | 부모님 |
| `/parent/transcript` | 원문/정리본 비교 | 부모님 |
| `/child` | 자녀 홈 | 자녀 |
| `/child/questions` | 가족 질문 등록·관리 | 자녀 |
| `/child/photos` | 사진 업로드와 추천 질문 | 자녀 |
| `/child/progress` | 자녀 진행률 | 자녀 |
| `/child/chapters` | 챕터별 기록 열람 | 자녀 |
| `/child/record-space/new` | 기록 공간 생성과 초대 링크 | 자녀 |
| `/child/chatbot` | 나의 분신 대화 | 자녀 |
| `/child/autobiography`, `/parent/autobiography` | 자서전 미리보기·문체 선택·PDF | 각 역할 |
| `/child/autobiography/preview`, `/parent/autobiography/preview` | 판매용 기록집 검수 리포트 | 각 역할 |
| `/child/mypage`, `/parent/mypage` | 마이페이지(초대 관리, 푸시 알림 구독·알림함, 유산 금고 진입, AI 운영 점검) | 각 역할 |
| `/child/consent-settings`, `/parent/consent-settings` | 동의 5종 설정 | 각 역할 |
| `/parent/vault` | 디지털 유산 금고 개설·해지, 가족 열쇠 조각 보관, 사망 신고 취소 | 부모님 |
| `/child/legacy` | 사망 심사(신고·승인·취소)와 전수 후 기록 열기 | 자녀 |
| `/mypage` | 역할에 맞는 마이페이지로 리다이렉트 | 로그인 필요 |
| `/calendar` | 가족 일정과 캘린더 트리거 | 로그인 필요(`AuthGuard`) |
| `/settings` | 발표 데모 화면 | 가드 없음. 개발 서버(`npm run dev`)이거나 `VITE_ENABLE_DEMO_SETTINGS=true`로 빌드했을 때만 등록 |

## AI 에이전트

프론트 에이전트는 모두 `src/lib/agents/config.ts`의 `isDemoMode()`를 먼저 확인하고, 실제 호출은 `src/lib/openai-client.ts`를 통해 서버 프록시로 나갑니다. 대부분 실패 시 예외를 던지지 않고 안전한 기본값으로 떨어집니다(`interviewer`만 예외를 던집니다).

| 파일 | 함수 | 역할 |
| --- | --- | --- |
| `interviewer.ts` | `generateFollowUpQuestion` | 답변에서 인물·장소·감정·사건·시간을 읽고 꼬리질문 1개 생성 |
| `archivist.ts` | `archiveTranscript` | 원문 보존 + NER 4종·감정 8종 태깅 + 신뢰도 라벨 부여 |
| `verification.ts` | `verifyChunk` | 최근 chunk 10개와 비교해 시기·인물·사실·중복 충돌 플래그 |
| `ghostwriter.ts` | `generateChapterDraft` | 문체 프로필에 맞춰 챕터 초안 생성, 문단별 `sourceChunkIds` 유지 |
| `digitalTwin.ts` | `generatePersonaResponse` | 관련 기억 chunk를 골라 근거 있는 답변 생성 |
| `questionQueue.ts` | `reformulateQuestion` | 자녀 질문을 시니어 친화 표현으로 재구성 |
| `calendarTrigger.ts` | `processCalendarTrigger` | 일정 유형 키워드로 관련 기억을 찾아 전달/인터뷰 분기 |

서버 측에는 별도로 `server/domain/photo-agent.ts`(사진 분석·질문 생성), `server/domain/cover-agent.ts`(표지 팔레트·템플릿·서체 결정), `server/domain/publication-agent.ts`(출판 편집 기획·품질 체크리스트)가 있고, 모두 FactChat 키가 없으면 로컬 fallback으로 동작합니다.

## 서버 구조

`server/app.ts`에 `/api/*` 라우트 71개와 빌드된 프론트를 돌려주는 catch-all 1개가 등록돼 있습니다. 예전의 `/twilio/*` 전화 인터뷰 웹훅은 앱 내 음성 인터뷰(`server/app-call.ts`)로 대체되면서 제거됐습니다. 주요 묶음은 다음과 같습니다.

| 묶음 | 대표 엔드포인트 |
| --- | --- |
| 인증/초대 | `POST /api/auth/phone`, `POST /api/auth/token-login`, `POST /api/invitations`, `POST /api/invitations/:id/rotate`, `DELETE /api/invitations/:id`, `GET /api/family-members` |
| AI 프록시 | `POST /api/ai/chat-completions`, `POST /api/ai/embeddings`, `GET /api/ai/audit-summary` |
| 음성 | `POST /api/uploads/audio`, `POST /api/audio/speech`, `POST /api/audio/transcriptions` |
| 인터뷰 | `POST /api/interview-sessions`(+ pause/accept/end), `POST /api/interview-records`, `PATCH /api/interview-records/:id`, `PATCH /api/interview-records/bulk-consent` |
| 질문/사진 | `GET /api/chapters`, `GET·POST /api/questions`, `POST /api/uploads/photos`, `GET·PATCH·DELETE /api/photos`, `GET /api/family-questions` |
| 기억 | `GET·POST /api/memories`, `PATCH·DELETE /api/memories/:id` |
| 자서전/출판 | `GET·POST·DELETE /api/autobiography/draft`, `POST /api/cover-designs/generate`, `POST /api/publication-requests`, `POST /api/publication-preview-jobs`, `GET /api/publication-preview` |
| 일정/알림 | `GET·POST·DELETE /api/calendar-events`, `POST /api/interview-schedules`, `POST /api/app-calls`, `GET /api/notifications`, `PATCH /api/notifications/:id/read`, `GET /api/push-public-key`, `POST·DELETE /api/push-subscriptions`, `POST /api/nudges` |
| 디지털 유산 | `POST·GET /api/legacy/vault`, `POST /api/legacy/trigger-death`, `POST /api/legacy/approve-death`, `POST /api/legacy/cancel-death`, `GET /api/legacy/shares`, `POST /api/legacy/reset` |
| 파일 전달 | `GET /api/files/*` (소유권 확인 + 사진은 짧은 만료 서명 토큰) |

권한 경계는 `docs/route-authorization-matrix.md`에 라우트 단위로 정리돼 있습니다.

### 출판 파이프라인

1. `POST /api/publication-preview-jobs`가 잡을 만들고 워커가 `cache_check → editorial_plan → writing_draft → manifest → render → done` 단계를 진행합니다(`server/publication.ts`).
2. 편집 기획(`publication-agent`)이 판매 준비도(`ready_for_paid_book`, `needs_family_review`, `needs_more_records`)와 품질 체크리스트를 만듭니다.
3. 원본 기록 해시로 초안 캐시(`PublicationDraftCache`)를 재사용하고, 회복 가능한 오류는 지연 후 재시도합니다.
4. `server/publication-html.ts`가 A5/B5 조판 HTML을 만들고 `public/fonts/NotoSansKR-Regular.ttf`를 `@font-face`로 심은 뒤 `puppeteer-core`로 PDF를 렌더합니다. Chrome은 `CHROME_PATH` → `PUPPETEER_EXECUTABLE_PATH` → 시스템 Chrome/Chromium(macOS `/Applications`, Linux `/usr/bin`) → Playwright가 받아 둔 Chromium(`PLAYWRIGHT_BROWSERS_PATH` 또는 `~/.cache/ms-playwright`의 `chromium-<리비전>`, 최신 리비전 우선) 순서로 찾습니다.
5. 앱은 `POST /api/publication-requests` 응답의 `pdfFileKey`를 받아 `GET /api/files/*`로 PDF를 내려받습니다.

### 데이터 모델

Prisma 모델 24개: `User`, `GuardianSeniorLink`, `Chapter`, `Question`, `Photo`, `InterviewSchedule`, `InterviewSession`, `InterviewRecord`, `FreeSpeechRecord`, `PushSubscription`, `Notification`, `AiProxyAuditLog`, `CoverDesign`, `PublicationRequest`, `PublicationDraftCache`, `PublicationPreviewJob`, `LegacyVault`, `Memory`, `MemoryTag`, `MemoryConsentSettings`, `MemoryVectorEntry`, `AutobiographyDraft`, `CalendarEvent`, `Invitation`.

## 실행 방법

```bash
npm install
npm run db:migrate
npm run server:dev
npm run dev
```

로컬 API 서버는 기본적으로 `http://localhost:8787`에서 실행되고, 프론트 개발 서버는 `http://localhost:3000`에서 실행됩니다. 프론트는 `VITE_LOCAL_API_URL`이 없으면 로컬 개발 환경에서 자동으로 `http://localhost:8787`을 호출합니다.

`.env`의 `AUTH_TOKEN_SECRET`은 로컬에서도 채워야 합니다. 비어 있으면 로그인이 503으로 실패합니다(예전처럼 공개된 고정 시크릿으로 대체되지 않습니다). 로그인 시도는 전화번호별·IP별로 제한되며 `AUTH_ATTEMPT_WINDOW_MS`, `AUTH_ATTEMPT_LIMIT_PER_PHONE`, `AUTH_ATTEMPT_LIMIT_PER_IP`로 조정합니다.

인쇄용 PDF를 만들려면 Chrome이나 Chromium이 필요합니다. 찾는 순서는 `출판 파이프라인` 절을 참고하세요. 어디에도 없으면 `CHROME_PATH`를 지정합니다.

## Cloudflare Quick Tunnel 파일럿 실행

현재 파일럿은 Cloudflare Quick Tunnel로 하나의 공개 주소를 만들고, 그 주소가 빌드된 프론트엔드와 API를 함께 제공하는 방식으로 실행합니다. 별도 Vite 개발 서버를 외부에 노출하지 않습니다.

Quick Tunnel 주소는 재시작할 때 바뀔 수 있습니다. 터널을 새로 띄운 뒤 `https://*.trycloudflare.com` 주소를 확인하고, 아래 `.env` 값의 `<cloudflare-url>`과 `<cloudflare-host>`를 그 값으로 바꿉니다.

`.env` 기준값:

```bash
APP_URL="<cloudflare-url>"
LOCAL_SERVER_PORT="8787"
LOCAL_SERVER_PUBLIC_URL="<cloudflare-url>"
ALLOW_DEV_AUTH_HEADERS="false"
VITE_LOCAL_API_URL=""
VITE_ALLOWED_HOSTS="<cloudflare-host>"
VITE_NGROK_HOST=""
VITE_USE_NGROK_HMR="false"
```

실행 순서:

```bash
npm run backup:data
cloudflared tunnel --url http://localhost:8787 --no-autoupdate
npm run build
npm run server:dev
npm run pilot:public:check
```

운영 중에는 Cloudflare 터널과 8787 서버를 각각 screen 세션으로 유지합니다. `npm run pilot:public:check`가 로컬 서버와 공개 주소의 `/api/health`, 빌드된 프론트 응답, 핵심 `.env` 설정을 한 번에 확인합니다. 예전 `npm run pilot:ngrok:check` 명령은 호환용으로 남아 있으며 같은 공개 URL 검증을 실행합니다.

AI 연동 기능을 실제 API로 확인하려면 `.env` 또는 실행 환경에 다음 값을 설정합니다.

```bash
FACTCHAT_API_KEY="..."
FACTCHAT_BASE_URL="https://factchat-cloud.mindlogic.ai/v1/gateway"
FACTCHAT_CHAT_MODEL="gpt-5-mini"
FACTCHAT_VISION_MODEL=""
FACTCHAT_WRITING_MODEL=""
OPENAI_API_KEY="..."
```

`FACTCHAT_API_KEY`는 서버 측 사진/표지/출판 분석과 프론트엔드 AI 기능을 대신 호출하는 로컬 AI 프록시의 채팅 생성에 사용합니다. `FACTCHAT_CHAT_MODEL`은 `GET /v1/gateway/models/`에서 확인한 모델 ID로 설정하고, 사진 분석과 원고 작성 모델을 따로 쓰려면 `FACTCHAT_VISION_MODEL`, `FACTCHAT_WRITING_MODEL`을 지정합니다. `OPENAI_API_KEY`는 FactChat Gateway 문서에서 지원이 명확하지 않은 embeddings/realtime 경로에만 남겨둡니다. 브라우저 번들에는 API 키를 넣지 않습니다.
AI 프록시는 기본적으로 사용자·엔드포인트별 분당 60요청, 입력량 200,000 단위로 제한합니다. 필요하면 `AI_PROXY_RATE_LIMIT_PER_MINUTE`, `AI_PROXY_UNIT_LIMIT_PER_MINUTE`로 조정할 수 있습니다.
AI 프록시 운영 점검 화면은 로컬/개발 환경에서 기본 활성화되고, 운영 환경에서는 `AI_PROXY_DASHBOARD_ENABLED=true`일 때만 열립니다. 대시보드 접근 토큰은 `AI_PROXY_DASHBOARD_TOKEN`, 감사 로그 보존 기간과 알림 임계값은 `AI_PROXY_AUDIT_RETENTION_DAYS`, `AI_PROXY_ALERT_ERROR_RATE_PERCENT`, `AI_PROXY_ALERT_RATE_LIMITED_COUNT`, `AI_PROXY_ALERT_MIN_REQUESTS`로 조정할 수 있습니다.
AI 프록시 운영 알림은 `AI_PROXY_ALERT_NOTIFICATIONS_ENABLED=true`와 `AI_PROXY_ALERT_NOTIFICATION_USER_IDS`로 수신 운영자 계정을 지정해 활성화합니다. 알림 판단 창, 중복 알림 쿨다운, 런북 링크는 `AI_PROXY_ALERT_WINDOW_MINUTES`, `AI_PROXY_ALERT_NOTIFICATION_COOLDOWN_MINUTES`, `AI_PROXY_ALERT_RUNBOOK_URL`로 조정합니다.

운영 환경에서는 로그인/초대 로그인 응답으로 발급되는 서버 서명 Bearer 토큰을 사용합니다. `AUTH_TOKEN_SECRET`을 반드시 강한 비밀값으로 설정하고(비어 있으면 로그인이 503으로 실패), 필요하면 `AUTH_TOKEN_TTL_SECONDS`로 만료 시간을 조정합니다. `x-user-id`, `x-user-role` 개발 헤더는 기본적으로 production에서 비활성화되며, 로컬 검증이 필요할 때만 `ALLOW_DEV_AUTH_HEADERS=true`로 명시적으로 켤 수 있습니다.
Web Push를 실제로 보내려면 `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`를 설정합니다. 키가 없어도 알림 행은 저장되므로 마이페이지 알림함은 동작하고, 푸시 토글은 구독할 수 없는 이유를 화면에 표시합니다.
디지털 유산 금고의 사망 신고 후 승인까지 유예 시간은 `LEGACY_DEATH_REVIEW_HOURS`(기본 72시간)로 조정합니다.
부모님 초대 링크는 기본 14일 동안 유효하며 `INVITATION_TTL_DAYS`로 조정할 수 있습니다. 보호자는 마이페이지에서 초대 링크를 재발급하거나 폐기할 수 있고, 만료/폐기된 링크는 자동 로그인에서 거절됩니다.
로컬 파일 전달은 사진, 음성, 출판 PDF의 DB 소유권을 확인한 뒤 허용합니다. 브라우저 이미지 표시처럼 헤더를 붙이기 어려운 경우를 위해 사진 응답 URL에는 기본 10분짜리 서명 토큰이 포함되며, `FILE_ACCESS_TOKEN_TTL_SECONDS`로 만료 시간을 조정할 수 있습니다.

발표 데모 모드는 사전 데이터와 오프라인 응답을 사용하므로 API 키 없이도 핵심 시연이 가능합니다.

## 발표 시연 방법

`/settings`(`src/pages/DemoSettingsScreen.tsx`)에 시연 준비와 순서가 모두 들어 있습니다. 탭 없이 한 화면에 섹션으로 구성돼 있습니다.

이 화면은 로그인 없이 역할을 바꿀 수 있어서 기본적으로 막혀 있습니다. 개발 서버(`npm run dev`)에서는 자동으로 열리고, 빌드한 앱으로 시연하려면 `VITE_ENABLE_DEMO_SETTINGS=true`로 빌드합니다.

1. `/settings`로 이동합니다.
2. `발표용 데이터 불러오기`를 누릅니다. 대화 기록, 사진, 가족 질문, 인터뷰 챕터, 자서전 챕터, 가족 일정 개수가 채워집니다.
3. `네트워크 없이 시연`을 켭니다. 이 토글은 AI 에이전트의 사전 응답 모드(`isDemoMode`)를 함께 켭니다.
4. `시연 역할`에서 부모님/자녀 화면을 전환합니다.
5. `발표 준비 4/4`가 되면 `3~5분 시연 순서` 카드의 이동 버튼을 눌러 진행합니다.

화면에 박혀 있는 시연 동선(라우트 그대로):

```text
/settings -> /parent/interview -> /child/photos -> /child/questions -> /child/chatbot -> /child/autobiography
```

`데모 데이터 초기화`를 누르면 주입한 스토어 데이터가 모두 비워집니다. 데모 시드는 `src/lib/demo/demo-seed-adapter.ts`의 `buildNewGenDemoSeed()`가 `src/lib/demo/capstone-demo-data.ts`를 신세대 스토어 모양으로 변환해 만듭니다.

## 문서

- [현재 작업 현황](docs/current-work-status.md)
- [AI 프록시 운영 런북](docs/ai-proxy-ops-runbook.md)
- [API 라우트 권한 매트릭스](docs/route-authorization-matrix.md)
- [제외 테스트 리뷰](docs/excluded-tests-review.md)
- [캡스톤 발표 패키지](docs/capstone-demo-package.md)
- [기술 설명서](docs/technical-architecture.md)
- [모바일 사용자 여정 와이어플로우](design/README.md)

## 검증

```bash
npm run lint     # tsc --noEmit
npm test         # vitest --run
npm run build    # vite build
```

테스트 파일/케이스 수는 `npm test` 출력에 표시됩니다. 최근 측정값은 [현재 작업 현황](docs/current-work-status.md)에 시점과 함께 기록합니다. 테스트가 계속 추가되므로 문서에 옮겨 적기 전에 직접 실행해 확인하세요.

참고: 제한된 샌드박스에서는 Supertest가 임시 HTTP 서버를 열 때 `listen EPERM: operation not permitted 0.0.0.0`로 실패할 수 있습니다. 로컬 권한에서 동일 명령을 실행하면 통과합니다.

출판 PDF 테스트(`server/app.test.ts`, `server/publication-html.browser.test.ts`)는 실제 Chrome으로 렌더합니다. Chrome을 찾지 못하면 이 테스트들이 `Chrome 실행 파일을 찾을 수 없습니다`로 실패하니, 위 찾는 순서 중 하나를 갖추거나 `CHROME_PATH`를 지정하세요.

## 구현 범위와 한계

구현 완료(화면에서 도달 가능):

- 휴대폰 번호 기반 로그인/가입과 온보딩
- 자녀-부모 초대 링크 발급/재발급/폐기와 부모님 자동 로그인
- Express/SQLite 기반 로컬 API와 Prisma 데이터 모델
- 서버 동기화 기반 기억/사진/질문/자서전/일정/동의 상태 관리
- 서버 서명 Bearer 토큰 기반 인증 경계와 production 개발 헤더 차단
- 사진, 음성, 출판 PDF 로컬 파일 전달의 소유권 확인과 짧은 만료 서명 URL
- 질문 낭독(TTS), 녹음 업로드, 서버 STT, AI 정리, 충돌 플래그 표시
- 사진 업로드 시 GPS 좌표 마스킹과 JPEG EXIF 세그먼트 제거
- 사진 분석 기반 추천 질문 생성과 가족 질문 등록
- 답변별 동의 5종·사진별 동의 4종 토글과 출판/챗봇 일괄 적용, 답변별 활용 중지(5종 일괄 철회)
- 동의 5종의 소비 지점 집행: `publish`(출판 입력·표지), `chatbot`(분신 대화 chunk), `familyRead`(보호자 조회 응답 마스킹), `sensitive`(출판 입력·표지·분신 대화·자서전 초안에서 제외), `posthumous`(유산 전수 뒤에도 미동의 기록 마스킹). 설계와 결정은 `docs/consent-enforcement-design.md`
- 철회·삭제의 소급 적용: 이미 만든 PDF와 미리보기는 `publish`/`sensitive` 철회나 책에 들어가는 사진 삭제 뒤 가족에게 409로 막히고, 챗봇 동의 철회는 브라우저에 남은 지난 대화까지 지웁니다
- 저장된 기억 chunk 기반 분신 대화와 답변별 원문·신뢰도 표시
- 문체 선택 자서전 초안 생성과 문단별 출처 보존
- 서버 출판 파이프라인, 표지 시안 생성, A5 인쇄용 PDF 내려받기, 검수 리포트
- 인터뷰 예약과 앱 내 호출, 알림 저장, Web Push 구독(서비스워커 등록·해지)과 마이페이지 알림함
- 디지털 유산 금고: 부모님 금고 개설·해지(`/parent/vault`)와 보호자 사망 심사(`/child/legacy`). 열쇠는 세 조각으로 나눠 셋이 모두 모여야 열립니다(서버가 두 조각을 들고 있으므로 서버 혼자서는 열 수 없음). 신고한 보호자는 자기 신고를 승인할 수 없고(연결된 보호자가 한 명뿐이면 유예 시간 동안 부모님이 취소하지 않은 것을 확인으로 삼음), 신고 뒤 유예 시간이 지나야 승인됩니다
- 프론트엔드 AI 호출의 서버 프록시 전환과 사용량 제한/감사 로그/운영 알림
- 발표용 데모 데이터 주입·초기화와 오프라인 시연 모드

제한이 남아 있는 것:

- 디지털 유산 금고는 화면까지 붙었지만 운영 출시 전 단계입니다. 금고는 답변 원문을 지우지 않고 읽는 시점에 가립니다(원문은 DB에 그대로 남음). 잠긴 동안에는 부모님 본인도 앱에서 본문을 읽지 못하며, 되돌리는 길은 금고 해지뿐입니다. 키 관리와 법무·감사 검토가 끝나기 전에는 데모용으로 취급합니다.
- 기억 단위 완전 삭제: `DELETE /api/memories/:id`는 있으나 호출하는 화면이 없습니다. 화면에서 지울 수 있는 것은 사진과 가족 질문이고, `InterviewRecord`에는 삭제 라우트가 없습니다.
- `Memory`/`MemoryConsentSettings`/`MemoryVectorEntry` 테이블은 운영 코드에서 만들어지지 않습니다(데모 시드 전용). 동의는 이제 `InterviewRecord`와 `Photo` 컬럼에 있습니다. `GET /api/memories`는 `Memory`의 챗봇 동의가 철회돼도 본문을 내려보내므로, 테이블 정리와 함께 결정해야 합니다.
- 알림을 눌렀을 때 화면이 있는 경로만 따라갑니다. 앱 내 호출 알림이 넣는 `/?callSessionId=...`는 읽는 곳이 없어 따라가지 않습니다.
- PDF 생성 경로는 서버의 `server/publication-html.ts`와 `server/publication.ts`로 일원화되어 있습니다. 사용되지 않던 클라이언트 PDF 컴포넌트와 `jspdf`·`@react-pdf/renderer` 의존성은 제거했습니다.

향후 작업:

- 주간 가족 퀴즈: 구현 없음. 저장된 기억을 가족 대화로 되돌리는 재방문 루프 기능으로 새로 설계·구현 필요
- 실제 SMS/OTP 인증(현재는 OTP 없이 전화번호와 이름이 맞으면 로그인되고 시도 횟수만 제한), 토큰 갱신/폐기, 세션 운영 정책
- 운영용 DB/스토리지/백업 정책
- 카카오톡 링크/전화형 인터뷰 같은 저마찰 참여 채널
- 디지털 유산 금고 키 관리, 법무/개인정보 검토
- 기억 단위 완전 삭제 UI와 삭제 시 연쇄 정리, 쓰이지 않는 `Memory` 계열 테이블 정리
- 앱 내 호출 알림의 `callSessionId` 딥링크 처리
- PDF 렌더 지연 최적화와 실제 인쇄 주문/배송 연동
- 장기 사용자를 위한 접근성/음성 입력 고도화
- 발표 산출물 자동 생성 스크립트 재작성(`scripts/generate-capstone-assets.ts`와 `npm run demo:assets`는 제거됨)
