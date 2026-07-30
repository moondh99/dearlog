# Dearlog PRD (내부 개발 참고용)

작성일: 2026-06-28
작성 범위: Dearlog 서비스 전체 (웹앱 + iOS 네이티브 패키징)
대상: 내부 개발팀

---

## 1. 한 줄 정의

부모님(시니어)의 기억을 자녀(보호자)가 주도하는 AI 인터뷰로 수집하고, 가족이 함께 검수한 뒤 자서전·음성 아카이브·AI 분신 대화 형태로 오래 보존하는 가족 기억 아카이브 서비스.

## 2. 배경 및 문제 정의

부모님 세대의 생애 기억은 대개 구술로만 존재하다가 자연스럽게 소실된다. 자녀 세대는 "언젠가 여쭤봐야지" 하다가 기회를 놓치는 경우가 많고, 막상 마주 앉아 인터뷰하듯 묻기는 어색하다. Dearlog는 이 공백을, AI가 질문을 설계하고 시니어가 음성으로 답하는 비대면·비동기 인터뷰 구조로 메운다. 보호자는 사진과 질문을 준비하고, 시니어는 편한 시간에 전화/음성으로 답하고, 그 결과는 검수를 거쳐 책과 대화형 콘텐츠로 남는다.

## 3. 타깃 사용자

| 역할 | 정의 | 핵심 행동 |
| --- | --- | --- |
| 보호자(guardian) | 부모님 기억을 기록하고 싶어하는 자녀 세대 | 가입, 초대 발송, 질문/사진 준비, 검수, 자서전 주문 |
| 시니어(senior/parent) | 기억을 답하는 부모님 | 초대 링크로 가입, 음성 인터뷰 응답, 자서전 표지/문체 선택 |

앱 내 역할 명칭은 `parent`(시니어 화면 묶음) / `child`(보호자 화면 묶음)로 라우팅되어 있어 코드 상 역할명과 실제 가족 관계 호칭이 반대로 매핑된다는 점에 주의 (`role: 'parent'` = 답변하는 시니어, `role: 'child'` = 질문을 준비하는 보호자/자녀).

## 4. 상품 구조

| 구분 | 고객이 구매하는 것 | 지속 가치 |
| --- | --- | --- |
| 1회 제작 | AI 인터뷰 기반 자서전 PDF, 인쇄용 교정본, 실물 책 주문 준비 | 가족에게 건넬 수 있는 완성 결과물 |
| 월 구독 | 기억 검색, AI 분신 대화, 가족 질문, 주간 가족 퀴즈, 기념일 알림, 다음 인터뷰 예약 | 저장된 기억을 가족 대화와 재방문으로 계속 연결 |

## 5. 기록 범위 (질문 설계 기준)

| 범위 | 예시 |
| --- | --- |
| 어린시절과 학창시절 | 고향, 학교, 친구, 부모님과 처음 형성된 가치관 |
| 가족과 관계 | 부모, 형제, 배우자, 자녀, 손주와 함께한 장면 |
| 일과 생계 | 첫 월급, 직장, 장사, 살림, 생계를 책임진 시간 |
| 전환점과 감정 | 이사, 결혼, 실패, 상실, 극복처럼 삶의 방향이 바뀐 사건 |
| 가치관과 남길 말 | 가족에게 전하고 싶은 조언, 당부, 감사, 사과 |
| 사진 속 생활사 | 여행, 명절, 음식, 동네, 물건처럼 사진에서 시작되는 일상 기억 |

## 6. 핵심 사용자 흐름

### 6.1 온보딩 및 초대

1. 보호자가 휴대폰 번호로 가입(`/api/auth/phone`).
2. 보호자가 시니어를 초대(`/api/invitations`) → 초대 링크(`dearlog://parent/autologin?token=...` 또는 `https://dear-log.com/...`) 발급, 기본 14일 유효(`INVITATION_TTL_DAYS`).
3. 시니어가 링크 클릭 → `AutoLoginScreen` → `/api/auth/token-login`으로 1회용 토큰 검증 → 자동 로그인 → `/parent/welcome` 온보딩.
4. 보호자는 마이페이지에서 초대 링크 재발급/폐기 가능.

### 6.2 인터뷰 (보호자 → 시니어)

- 보호자가 질문 등록(공통 질문 풀 + 사진 기반 자동 생성 질문 + 직접 작성).
- 시니어는 음성으로 답변(`InterviewRecord`, `FreeSpeechRecord`), 통화형 인터뷰 스케줄링(`InterviewSchedule`, `InterviewSession`)도 지원.
- 답변은 STT로 텍스트화되어 원문 음성 조각과 함께 보관 (근거 추적 가능).

### 6.3 검수 및 동의

- 보호자가 답변/기억(`Memory`)을 검수, 태그(`MemoryTag`) 정리.
- 시니어 또는 보호자가 공개 범위와 활용 동의를 `MemoryConsentSettings`에서 조정. 기억별로 활용 중지/완전 삭제 가능 (데이터 주권 보장).

### 6.4 자서전 제작

- 답변과 사진을 챕터(`Chapter`)별로 구성, 문체 선택 후 표지 디자인(`CoverDesign`) 확정.
- `PublicationDraftCache` → `PublicationPreviewJob` → `PublicationRequest`로 이어지는 비동기 생성 파이프라인.
- A5 인쇄용 PDF는 jsPDF/React PDF로 생성, 실물 책 주문 준비 단계까지 지원.

### 6.5 구독 재방문 루프

- 저장된 기억 기반 AI 분신(`나의 분신`) 대화 — `Memory`/`MemoryVectorEntry` 기반 검색 후 응답.
- 가족 질문, 주간 가족 퀴즈, 기념일/다음 인터뷰 알림(`Notification`, `PushSubscription`).
- 캘린더(`CalendarEvent`)로 인터뷰 일정과 가족 이벤트 관리.

### 6.6 디지털 유산 (실험적, 프로토타입)

- `LegacyVault` — 암호화된 콘텐츠/공유 정책을 저장하는 프로토타입. **법무/감사/키관리 검토 전까지는 데모 전용으로 취급** (release policy가 시뮬레이션 단계).

## 7. 데이터 모델 개요 (Prisma/SQLite)

핵심 엔티티: `User`(단일 테이블에 senior/guardian 속성 모두 포함), `GuardianSeniorLink`, `Invitation`, `Chapter`/`Question`, `Photo`, `InterviewSchedule`/`InterviewSession`/`InterviewRecord`/`FreeSpeechRecord`, `Memory`/`MemoryTag`/`MemoryConsentSettings`/`MemoryVectorEntry`, `AutobiographyDraft`, `CoverDesign`/`PublicationDraftCache`/`PublicationPreviewJob`/`PublicationRequest`, `CalendarEvent`, `Notification`/`PushSubscription`, `LegacyVault`, `AiProxyAuditLog`.

가족 단위 데이터 소유권은 `seniorId`/`guardianId` 기준으로 분리되며, 모든 변경 라우트에 소유권 검사가 적용되어 있음(`docs/route-authorization-matrix.md` 참고).

## 8. 기술 아키텍처

- 프론트엔드: React 19 + TypeScript + Vite, Zustand(persist) 상태관리, Tailwind 유틸리티 스타일.
- 백엔드: Express + Prisma + SQLite, 로컬 단일 서버(`localhost:8787`)로 동작.
- AI 연동: 브라우저에 API 키를 넣지 않고, 서버의 `/api/ai/*` 프록시를 통해 Mindlogic FactChat Gateway(주) / OpenAI(embeddings 등 일부)를 호출. 사용자·엔드포인트별 분당 요청/단위 rate limit과 감사 로그(`AiProxyAuditLog`) 운영.
- 공개 접근: Cloudflare Named Tunnel로 구입 도메인 `dear-log.com` → 사용자 개인 Mac의 로컬 서버로 포워딩.
- iOS 네이티브: Capacitor로 `dist/`를 패키징(`webDir: 'dist'`), 커스텀 URL 스킴 `dearlog://`로 딥링크 처리. Apple Developer Program 미가입 상태로 TestFlight/App Store 배포 및 Universal Link는 보류.
- PDF 생성: jsPDF + React PDF, 초기 로드 성능을 위해 PDF 엔진은 내보내기 시점에만 지연 로드.

## 9. 비기능 요구사항 및 알려진 리스크

| 영역 | 현황 | 권장 조치 |
| --- | --- | --- |
| 인증 강도 | `/api/auth/phone` 로그인이 전화번호+이름 일치만으로 통과, rate limit 없음 | OTP 또는 추가 인증요소, 로그인 시도 rate limit 추가 (출시 전 권장) |
| 토큰 체계 | Bearer 토큰은 서버 서명(HMAC) + 만료시간 적용, 초대 토큰은 1회용 + 만료/폐기 검사 적용 | 양호. 토큰 refresh/revocation 저장소는 아직 없음 — 추가 검토 필요 |
| 파일 접근 | 사진/음성/PDF는 DB 소유권 확인 + 단기 서명 토큰(기본 10분) | 양호 |
| 운영 안정성 | 백엔드가 사용자 개인 Mac에서 구동, Mac 절전/재시작 시 서비스 중단 | 실 운영 전 클라우드 호스팅 이전 필요 (iOS 심사 거절 리스크와도 연결) |
| AI 프록시 | rate limit, 감사 로그, 운영 대시보드, 알림 라우팅까지 구현됨 | 실 트래픽 관찰 후 임계값 재조정 |
| 디지털 유산 금고 | 암호화 저장은 있으나 release policy 시뮬레이션 단계 | 법무/감사/키관리 검토 전 정식 출시 제외 |
| 번들 크기 | 초기 JS 약 263KB, PDF 엔진(약 1.47MB)은 내보내기 시에만 로드 | 양호, 추가 경량화는 선택 사항 |
| 테스트 | 44개 파일 / 264개 테스트 통과, 일부 구버전 데모 테스트 9개 제외 상태 | 구버전 테스트 재작성 또는 정리 |

## 10. iOS 패키징 현황 (이번 작업분)

- Capacitor 빌드 파이프라인 정상화(`webDir` 오타 수정), 시뮬레이터 동작 확인 완료.
- 커스텀 스킴 딥링크(`dearlog://parent/autologin?token=...`) 시뮬레이터 검증 완료, 백엔드 로그인부터 온보딩까지 정상 동작.
- Figma export 잔재였던 가짜 상태바 컴포넌트 15개 파일에서 제거 완료.
- 차단 항목: Apple Developer Program 미가입(사용자 결정 대기), Universal Link/`apple-app-site-association` 미배포, `PrivacyInfo.xcprivacy` 부재, 백엔드의 개인 Mac 의존(App Store 심사 시 "웹사이트 래퍼" 거절 리스크).
- 무료 Apple ID로 본인 기기에 직접 설치하는 모의테스트는 가능(7일 인증서 만료, TestFlight/Universal Link는 불가).

## 11. 다음 단계 제안 (우선순위)

1. 로그인 인증 강도 보강 (OTP 또는 rate limit) — 가족 개인정보를 다루는 서비스 특성상 우선 처리.
2. 백엔드를 개인 Mac 의존에서 클라우드 호스팅으로 이전 — 운영 안정성 + App Store 심사 리스크 동시 해결.
3. Apple Developer Program 가입 후 Universal Link, Associated Domains, `PrivacyInfo.xcprivacy` 설정.
4. 디지털 유산 금고 기능의 법무/보안 검토 및 정식 출시 여부 결정.
5. 구버전 데모 테스트 정리, 토큰 refresh/revocation 정책 추가.

---

부록: 위 내용은 `README.md`, `docs/current-work-status.md`, `server/prisma/schema.prisma`, `server/app.ts`, `server/auth.ts`, `NEXT_AGENT_PROMPT.md` 코드/문서를 직접 확인하여 작성했습니다.
