# 디어로그 회사 소개 페이지 검증 결과

## 결과 — 2026-10-09

로컬 시안: `http://127.0.0.1:4330/company` (빌드 preview, 루프백 한정).
작업본: `/Users/moondh/Documents/Codex/2026-10-09/task-3/dearlog-company`.
브랜치: `feat/company-introduction`, 기준 HEAD `d39311854a62d8133218905c0b13f285dc55388a`.

| 검사 | 결과 | 증거 |
| --- | --- | --- |
| 최종 Vite build | 통과 | `artifacts/company/build.log` |
| lint / TypeScript | 통과 (`lint`는 프로젝트의 `tsc --noEmit`) | `artifacts/company/lint.log` |
| 전체 기존+신규 테스트 | 39개 파일, 335개 테스트 통과 | `artifacts/company/tests.log` |
| 1440 / 390 / 320px 가로 넘침 | 각각 document/page width=viewport, 없음 | `artifacts/company/qa-report.json` |
| 글꼴 | 로컬 Pretendard / 마루 부리 로드 성공, PC 본문 18px / 모바일 17px | 같은 JSON |
| 문자 대비 | 텍스트 DOM 최소 5.02:1, 4.5:1 미만 없음 | 같은 JSON (제품 이미지 내부는 기존 UI를 육안 확인) |
| 터치 영역 | 모든 소개 페이지 링크 높이 44px 이상 | 같은 JSON |
| 키보드 | Tab 첫 skip link 표시·포커스, Enter로 main, CTA Enter로 `/auth`, 이메일·라이선스까지 Tab 접근 | 같은 JSON, `company-keyboard-focus.png` |
| 내비게이션 | 과정/제품/팀 앵커 정상 스크롤 | 같은 JSON |
| 직접 접속·새로고침 | `/company`, `/company/`, 쿼리 포함 경로 통과 | 같은 JSON |
| 기존 브라우저 라우트 | `/` → `/splash`, `/auth`, `/auth/verify`, `/parent`, `/child`, `/calendar`, 토큰 없는 `/parent/autologin` 확인 | 같은 JSON |
| 기존 서비스 회귀 | 기존 390px 모바일 wrapper 유지, 부모/자녀/캘린더 비로그인 가드 유지. 인증·유효/만료 초대·역할/소유권·API·사용자 흐름은 전체 기존 테스트로 확인 | `App.test.tsx`, `user-flows.integration.test.tsx`, 서버 테스트 로그 |
| 소개 페이지 부작용 | API 요청 0건, 기존 인증·활성 예약 통화 상태 변경 없음, 예약 모니터 리다이렉트 없음 | 같은 JSON |
| 이미지 | 가상 데이터로 캡처한 실제 UI 3장 모두 로드, alt 존재. 설명용 글은 별도 표기 | `public/company/*.png`, 캡처 스크립트/로그 |
| reduced motion | CTA 전환 시간 0s | 같은 JSON |
| 페이지 JS 오류 | 0건 | 같은 JSON |
| 패키지 / 서버 / DB | 신규 패키지 없음. 서버·API·스키마 소스 변경 없음 | Git diff |
| 원본 보존 | 원본 main HEAD/추적 파일 무변경, 최초 미추적 항목 동일 | 원본 git status 최종 확인 |

## 실제 실행과 한계

Ouroboros 및 `/plan`, `/team`, `/design` 명령을 실행하지 않았다. 명세 우선의 목표·제약·완료 기준과 검증 원칙을 문서에 적용했다. 외부 에이전트·설치 스크립트·전역 설치·push·배포·DNS 변경 없음.

QA는 독립 headless Microsoft Edge와 일회성 임시 프로필에서 수행했고 종료 후 프로필을 삭제했다. 기존 Chrome 세션/프로필/CDP를 접속하거나 조작하지 않았다. 모든 QA 요청은 로컬로 제한했으며 `/api` 및 외부 요청을 차단했다. 운영 데이터, DB, 인증정보를 작업본에 복사하지 않았다. 테스트는 독립 작업본과 임시 SQLite로 수행했다.

실제 운영 서버에서 음성 녹음/STT/AI/메일 전달을 새로 수행하거나 검증하지 않았다. 서비스 CTA는 기존 `/auth` UI로 이동하는 것을 검증했다. 이메일 링크는 `mailto:hello@dear-log.com`이며 전송 완료를 표시하지 않는다. 이 페이지는 상용 출시·고객 수·법인/매출·수상 정보를 주장하지 않는다.

첫 시도에서 sandbox가 루프백 bind와 DNS를 제한했으나, 자동 검토를 거친 승인된 로컬 서버/브라우저 및 폰트 읽기 요청으로 진행했다. 자동 검토 거절은 없었다. 부모 메시지 도구는 source thread ID에 대해 `thread not found`를 반환했다. 전달 결과는 이 작업의 최종 보고와 산출물로 부모가 확인할 수 있다.

## 산출물

- 기획: `docs/company/PLAN.md`
- 디자인/출처: `docs/company/DESIGN.md`
- 본 보고서: `docs/company/VERIFICATION.md`
- 구현: `src/pages/CompanyPage.tsx`, `CompanyPage.css`, `src/App.tsx`
- 회귀 테스트: `src/App.test.tsx`
- 실제 제품 UI: `public/company/interview.png`, `review.png`, `autobiography.png`
- 눈누/원저작자 폰트·라이선스: `public/company/fonts/`
- 재현: `scripts/company/capture-product.mjs`, `verify.mjs`
- 최종 시안: `artifacts/company/company-desktop.png`, `company-mobile-390.png`, `company-mobile-320.png` 및 첫 화면/키보드 캡처

실제 UI 캡처는 위 스크립트의 가상 질문·기록만 사용한다. 실사용자 이름·전화·음성·파일 토큰·위치 등의 정보를 주입하지 않았다. 이미지 내 제품의 정적 장식 자산은 기존 저장소 자산 그대로다.

## 다시 보기

빌드된 시안 서버가 종료되면 작업본에서 아래 명령으로 다시 실행한다.

```sh
node_modules/.bin/vite preview --host 127.0.0.1 --port 4330 --strictPort
```

개발 서버는 4329, preview는 4330을 사용해 원본의 3000/8787과 분리했다. 실행 중인 시안 preview만 유지하고 제품 캡처용 개발 서버는 정리한다.

## Library 저장 확인

공식 Library 업로드 도우미가 현재 환경에서 prepared upload 미지원으로 중단되어, 미지원 시 허용되는 직접 파일 생성 경로를 사용했다. 아래 4개 모두 `succeeded`가 확인됐으며 로컬 파일에도 반환된 버전/Library ID 메타데이터를 저장했다.

| 파일 | 확인된 library_file_id |
| --- | --- |
| company-desktop-first-screen.png | libfile_b4c8ce58085481918739a772b8394298 |
| company-desktop.png | libfile_cecd7b6fa0fc8191aadb8995198bdc0f |
| company-mobile-390.png | libfile_dea6eb57baec8191aaedbb1b00833835 |
| company-mobile-320.png | libfile_1267c7b585748191bdb946804ef583dd |

상세 대응은 `artifacts/company/library-captures.json`에 기록했다. 공개 공유/배포는 하지 않았다.
