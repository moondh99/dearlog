# 디어로그 소개 페이지 작업 계획

## 출발점 — 2026-10-09

- 실제 호스트: `moondh-2.local`.
- 원본: `/Users/moondh/Downloads/2026_디어로그`, origin `https://github.com/moondh99/dearlog.git`, upstream `https://github.com/dlwlsgus407/dearlog.git`.
- 원본 브랜치 `main`, HEAD `d39311854a62d8133218905c0b13f285dc55388a`. 추적 파일 수정 없음. 미추적 `inbox/`, `reports/`, `status.json`, `submission/`, `tasks.md` 보존.
- 독립 복제본: 이 문서가 속한 `dearlog-company`, 브랜치 `feat/company-introduction`. 로컬 Git 복제, 하드링크 없음. 원본 .env, SQLite DB, 사용자 음성·사진·PDF를 복사하지 않음. 설치된 의존성은 별도 파일 복사로 재사용하며 npm install을 실행하지 않음.
- 원본 및 상위 디렉터리 AGENTS.md와 저장소 .agents/.codex 없음. `~/.agents/skills/frontend-design/SKILL.md`, `emil-design-eng/SKILL.md` 읽음. 외부 설치 스크립트/에이전트 호출 없음.
- React 19 + Vite 6 + Router 7. `/company` 충돌 없음. `/` → `/splash`, `/auth`, `/auth/verify`, `/parent/autologin`과 기존 역할 가드 유지.
- Express는 `dist` 정적 파일 및 SPA catch-all 제공. API·DB·서버 변경 불필요.

## 계획 → 역할 분담 → 디자인 → 구현 → 검증

1. 부모 작업: 사업 문구, 외부 자료, 눈누·폰트 라이선스, Ouroboros 절차 조사.
2. 통합 작업: 저장소 확인, 독립 작업본, 이 문서와 디자인 근거, 공개 라우트 구현, 제품 화면 캡처, QA.
3. 검토 역할: 코드와 사실 근거, 기존 라우트 회귀, 접근성, 개인정보 여부를 증거 문서로 점검.

이는 협업 역할과 실제 작업 순서다. `/plan`, `/team`, `/design`을 실행했다고 주장하지 않는다. Ouroboros 문서 흐름 `ooo interview → ooo seed → ooo run → ooo evaluate`에서 요구 명확화·설계·실행·평가 원칙을 참고하며 도구 설치/실행은 하지 않는다.

## 범위와 사실

대상은 부모님 이야기를 기록하고 싶은 가족과 협업을 검토하는 사람이다. 방문자가 서비스 목적, 실제 화면, 기록 흐름, 팀의 현재 단계와 문의 방법을 이해하는 것이 목적이다. Dear Log는 부모님 음성 인터뷰를 가족이 확인해 자서전으로 남기는 서비스이며 사업화를 준비 중이다. 팀은 '디어로그 팀'으로 소개한다. 법인 등록, 매출, 고객 수, 수상, 상용 출시 여부 등 미확인 정보는 쓰지 않는다. 문의는 확인된 `hello@dear-log.com` mailto 링크만 제공한다. 문의 폼이나 전송 완료 연출 없음.

코드에서 확인한 기능만 설명한다: 가족 질문 등록(ChildQuestionsScreen), 음성 인터뷰(ParentInterviewScreen), 원문/정리본 검수(ParentTranscriptScreen), 자서전(AutobiographyScreen). 제품 캡처는 독립 로컬 앱에 가상 데이터를 주입한 실제 UI이며 실제 사용자·운영 데이터와 구분해 표시한다. 외부 AI/API 호출을 차단한다.

## 검증 기준

- build, lint(tsc --noEmit), 기존 라우트·인증/초대·사용자 흐름 및 관련 서버 테스트.
- 1440, 390, 320px: 가로 넘침 없음, 텍스트 줄바꿈, 실제 이미지 로드.
- 키보드 Tab 순서, focus 표시, skip link, h1/landmark, 내비 앵커·서비스·메일 링크.
- 신규 소개 페이지의 API 요청/기록 변경 없음. 기존 소스/서버/데이터 보존 및 원본 Git 상태 확인.
- QA 브라우저는 별도 headless Microsoft Edge와 임시 프로필. 기존 Chrome 세션, 기존 CDP, 사용자 브라우저 저장소에 접근하지 않음.
- 데스크톱/모바일 캡처, 실행 로그 및 결과 문서 보관. 가능하면 Library 저장 후 반환 ID를 기록.
