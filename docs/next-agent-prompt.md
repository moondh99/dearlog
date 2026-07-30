# 다음 에이전트 인계 프롬프트

> 상태 안내(2026-07-30): 이 문서는 새 Figma 링크를 반영할 때 필요한 노드별 UI 인계를
> 보존한다. 코드 통합, 최신 검증 수치, 오프라인 데모 수정, 현재 운영 상태는 루트의
> `NEXT_AGENT_PROMPT.md`와 `docs/current-work-status.md`를 먼저 읽는다.

이 문서는 Dearlog 프로젝트에서 Figma UI/UX 반영 작업을 이어받는 다음 에이전트를 위한 작업 인계 프롬프트입니다. 아래 내용을 먼저 읽고, 기존 작업을 되돌리지 말고 이어서 진행하세요.

## 역할

당신은 `/Users/moondh/Downloads/디어로그` 워크스페이스에서 Dearlog 앱의 Figma 기반 UI/UX를 실제 프론트엔드에 반영하는 에이전트입니다.

사용자는 Figma 링크를 계속 전달하며, 반드시 실제 Figma MCP 호출로 노드를 확인한 뒤 반영했는지 확인합니다. 새 Figma 링크가 오면 먼저 Figma MCP `get_design_context`를 호출하고, 해당 노드가 어떤 화면인지 파악한 뒤 React/Tailwind 코드에 반영하세요.

## 중요한 작업 원칙

- Figma 링크를 받으면 실제 Figma MCP를 호출하세요. 호출하지 않고 추측하면 안 됩니다.
- 브랜드와 구조는 Figma를 따르고, UX는 서비스 흐름에 맞게 최적화합니다.
- 이미 변경된 작업물이 많습니다. 절대 `git reset`, `git checkout --`, 되돌리기성 명령을 사용하지 마세요.
- 수정은 가능한 한 해당 화면 파일에만 좁게 적용하세요.
- 파일 편집은 `apply_patch`를 사용하세요.
- 사용자는 한국어로 소통합니다. 답변도 한국어로 하세요.
- 작업 후 최소한 아래 검증을 수행하세요.

```bash
npm run lint
npx vitest run src/user-flows.integration.test.tsx
npm run build
curl -I http://localhost:3000/parent/interview
curl -I http://localhost:3000/parent/transcript
curl -sS http://localhost:8787/api/health
```

## 현재 실행 환경

- 프로젝트 경로: `/Users/moondh/Downloads/디어로그`
- 프론트엔드 Vite: `http://localhost:3000`
- 백엔드 API: `http://localhost:8787`
- 주요 라우트:
  - 부모님 홈: `/parent`
  - 부모님 기록하기: `/parent/interview`
  - 부모님 내 기록: `/parent/transcript`
  - 자녀 화면들은 기존 라우트 유지

## 현재까지 실제 Figma MCP로 확인하고 반영한 노드

### 자녀 앱 플로우

- `344:1480`
  - `src/pages/ChildChaptersScreen.tsx`
  - 자녀 챕터 화면 Figma 톤 반영

- `344:1792`, `243:5581`
  - `src/pages/AutobiographyScreen.tsx`
  - 자서전 관련 화면 Figma 구조 반영

- `376:4540`, `376:4452`
  - `src/pages/ChildProgressScreen.tsx`
  - 자녀 진행/상세 흐름 반영

- `243:4128`
  - `src/pages/ChatbotScreen.tsx`
  - 챗봇 화면 반영

### 부모님 앱 플로우

- `374:620`
  - `src/pages/AuthScreen.tsx`
  - 부모님 인증/온보딩 진입 화면 반영

- `344:1883`
  - `src/pages/ParentHomeScreen.tsx`
  - 부모님 랜딩 홈 반영

- `373:451`
  - `src/pages/ParentHomeScreen.tsx`
  - 부모님 대시보드 홈 반영
  - `src/assets/figma/parent-home-mascot.png` 사용

- `355:1196`
  - `src/pages/ParentInterviewScreen.tsx`
  - 기록 선택/사진 질문 리스트 화면 반영
  - `src/assets/figma/parent-record-photo.jpg` 사용

- `355:1959`
  - `src/pages/ParentInterviewScreen.tsx`
  - 부모님 음성/텍스트 답변 대기 화면 반영

- `355:2364`
  - `src/pages/ParentInterviewScreen.tsx`
  - 녹음 중 상태 반영
  - 보라색 waveform, 녹음 중 버튼 상태 반영

- `355:2258`
  - `src/pages/ParentInterviewScreen.tsx`
  - 저장 완료 화면 반영
  - `이야기가 저장되었어요`, 원문 보존 배지, 요약 카드, 다음 질문/내 기록/오늘은 여기까지 액션 반영

- `355:2488`
  - `src/pages/ParentInterviewScreen.tsx`
  - 사진 질문 답변 시작 화면 반영
  - 상단 사진 히어로, 그라데이션, 마이크 버튼, 직접 입력, 저장 버튼 반영

- `355:2736`
  - `src/pages/ParentInterviewScreen.tsx`
  - 저장 완료 화면 변형 확인
  - 사진 질문 저장 시 카드 제목을 `이 사진을 찍은 날의 이야기`로 정리하는 로직 추가

- `355:1881`
  - `src/pages/ParentInterviewScreen.tsx`
  - 전화 인터뷰 진행 중 화면 반영
  - 다크 통화 화면, 통화 타이머, 현재 질문, 다음 질문, 잠시 멈춤, 통화 마치기 반영
  - 일시정지는 실제 타이머와 질문 진행 애니메이션을 멈추도록 연결

- `355:688`
  - `src/pages/ParentTranscriptScreen.tsx`
  - 부모님 내 기록 리스트 화면 반영
  - `내가 남긴 이야기`, 총 이야기/정리 완료/정리 중 통계, 기록 카드, 보기 액션 반영
  - 직접 진입 시 `fetchTranscripts()`로 백엔드 기록 재조회
  - `src/components/BottomNav.tsx`를 `홈 / 기록하기 / 내 기록` 3탭으로 정리

- `355:929`
  - `src/pages/ParentTranscriptScreen.tsx`
  - 내 기록 상세 `정리본` 탭 반영
  - 배지, 제목, 날짜/길이, `정리본 / 원문` 탭, 자녀가 정리한 이야기 본문 반영

- `355:1041`
  - `src/pages/ParentTranscriptScreen.tsx`
  - 내 기록 상세 `원문` 탭 반영
  - 원본 음성 카드, waveform, `원문 듣기`, 따옴표 원문 본문 반영
  - `audioUrl`이 있는 기록은 `new Audio(transcript.audioUrl).play()`로 재생 시도

## 주요 수정 파일

### `src/pages/ParentInterviewScreen.tsx`

부모님 기록하기 플로우의 중심 파일입니다.

현재 포함된 주요 화면:

- `RecordSelectView`
  - 기록할 이야기를 선택하는 화면
  - 사진 질문, 텍스트 질문, 완료 질문 필터

- `VoiceView`
  - 사진/질문 답변 화면
  - 상단 사진 히어로, 녹음 시작/중/완료 상태, 직접 입력, 저장

- `ActiveCallView`
  - 전화 인터뷰 진행 중 화면
  - 다크 통화 UI, 현재 질문, 다음 질문, 일시정지, 통화 종료

- `DoneView`
  - 저장 완료 화면
  - 원문 보존, 아카이빙, 검수 충돌 표시, 다음 질문/내 기록/홈 이동

중요한 로직:

- `AnsweredItem`에 `answerMode`, `durationSeconds`가 추가되어 저장 완료 화면에서 답변 방식/길이를 표시합니다.
- `DoneView`는 `archiveTranscript -> verifyChunk -> addTranscript` 체인을 유지합니다.
- `handleNextAfterDone`은 저장 후 다음 미답변 질문으로 이동합니다.
- 전화 인터뷰 수락 시 `isPhoneMode`, `isCallPaused`, `callSeconds` 상태가 초기화됩니다.

### `src/pages/ParentTranscriptScreen.tsx`

부모님 내 기록 리스트/상세 화면입니다.

현재 포함된 주요 화면:

- 리스트:
  - 상단 Dearlog 헤더
  - `내가 남긴 이야기`
  - 통계 카드
  - 기록 카드 목록

- 상세:
  - `TranscriptDetail`
  - 기본 탭은 `정리본`
  - `원문` 탭에는 waveform 카드와 `원문 듣기` 버튼

중요한 헬퍼:

- `getTranscriptStatus`
  - `reviewStatus`와 `aiSummary/chunk` 기반으로 `정리 완료`, `정리 중`, `원문 저장됨`, `수정 요청` 배지를 결정합니다.

- `getRecordTitle`
  - 음식/사진 질문 등 Figma에 맞는 제목으로 정리합니다.

- `formatEstimatedDuration`
  - 실제 오디오 길이가 없는 데모 데이터에 대해 예상 길이를 표시합니다.

- `OriginalAudioCard`
  - 원문 탭의 원본 음성 카드 UI입니다.

### `src/components/BottomNav.tsx`

부모님 화면 기준 하단 탭은 Figma에 맞춰 3개로 정리되었습니다.

- `/parent`: 홈
- `/parent/interview`: 기록하기
- `/parent/transcript`: 내 기록

기존 `/parent/progress`, `/mypage` 라우트 자체는 남아 있지만, 부모님 하단 탭에서는 제거되었습니다. 다른 화면에서 필요하면 별도 진입 경로를 고려하세요.

### `src/assets/figma/`

Figma 반영용 로컬 에셋들이 있습니다. 특히 부모님 플로우에서 현재 중요한 파일:

- `src/assets/figma/parent-record-photo.jpg`
- `src/assets/figma/parent-home-mascot.png`

## 백엔드/프론트 연결 상태

반복 확인한 상태:

- `/api/health` 정상
- `/parent/interview` 200
- `/parent/transcript` 200
- 부모님 저장 흐름은 `addTranscript`를 통해 `/api/interview-records`로 저장합니다.
- `ParentTranscriptScreen` 진입 시 `fetchTranscripts()`를 호출합니다.

이전 작업 중 질문 데이터가 비어 보이면 아래 명령을 실행해 seed를 다시 넣을 수 있습니다.

```bash
npm run db:seed
```

## 최근 검증 결과

마지막까지 반복적으로 아래 검증이 통과했습니다.

```bash
npm run lint
npx vitest run src/user-flows.integration.test.tsx
npm run build
curl -I http://localhost:3000/parent/interview
curl -I http://localhost:3000/parent/transcript
curl -sS http://localhost:8787/api/health
```

`npm run build`에서는 큰 chunk 경고가 나오지만 빌드는 성공합니다. 기존 경고이며 이번 Figma 반영 작업의 실패는 아닙니다.

## 다음 작업을 이어갈 때의 절차

사용자가 새 Figma 링크를 주면 아래 순서로 진행하세요.

1. Figma MCP `get_design_context` 호출
   - `fileKey`: `U40daMZZi4SKmIuYkDhXiU`
   - `nodeId`: 링크의 `node-id`를 `355-1041`에서 `355:1041`처럼 변환

2. 노드 이름과 스크린샷으로 화면 성격 파악
   - 부모님 기록하기 플로우면 `ParentInterviewScreen.tsx`
   - 부모님 내 기록/상세면 `ParentTranscriptScreen.tsx`
   - 부모님 홈이면 `ParentHomeScreen.tsx`
   - 자녀 플로우면 해당 `Child*` 파일

3. 기존 컴포넌트를 먼저 재사용
   - StatusBar, Badge, 버튼 스타일 등 이미 구현된 패턴을 유지
   - 새 화면을 만들기보다 기존 상태 변형으로 연결 가능한지 먼저 판단

4. 서비스 UX에 맞는 동작 연결
   - Figma는 정적 화면이므로 실제 앱에서는 저장, 다음 질문, 탭 전환, 오디오 재생, 백엔드 호출을 자연스럽게 연결

5. 검증 실행
   - 최소 `npm run lint`
   - 부모님 플로우는 `npx vitest run src/user-flows.integration.test.tsx`
   - UI 영향이 있으면 `npm run build`
   - 로컬 라우트와 백엔드 health 확인

## 주의할 점

- 워크트리는 이미 매우 dirty 상태입니다. 다른 사람이 만든 변경일 수 있으니 되돌리지 마세요.
- `src/pages/ParentInterviewScreen.tsx`, `src/pages/ParentTranscriptScreen.tsx`, `src/components/BottomNav.tsx`는 최근 많이 수정된 파일입니다. 수정 전 필요한 구간을 읽고 현재 구조에 맞춰 패치하세요.
- Figma MCP 결과의 Tailwind 코드는 참고용입니다. 프로젝트의 React/Tailwind 패턴에 맞게 옮기세요.
- Figma의 remote asset URL은 만료될 수 있습니다. 지속적으로 필요한 이미지는 `src/assets/figma/`에 로컬 에셋으로 두는 방식이 좋습니다.
- 사용자에게는 “실제로 Figma MCP를 호출했는지”를 명확히 말해 주세요.

## 다음 에이전트에게 바로 줄 수 있는 시작 문장

```text
이 프로젝트는 Dearlog이고, 현재 Figma 기반 UI/UX 반영 작업 중입니다. docs/next-agent-prompt.md를 먼저 읽고 이어서 작업하세요. 사용자가 새 Figma 링크를 주면 반드시 실제 Figma MCP get_design_context를 호출한 뒤, 브랜드와 구조는 Figma를 따르고 UX는 서비스에 맞게 최적화해 React/Tailwind 코드에 반영하세요. 기존 dirty worktree를 되돌리지 말고, 작업 후 npm run lint, npx vitest run src/user-flows.integration.test.tsx, npm run build, 관련 localhost 라우트와 /api/health를 확인하세요.
```
