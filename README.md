# Dearlog

Dearlog는 어르신의 회상 인터뷰를 기억 카드로 정리하고, 가족 질문, 사진, 분신 대화, 인쇄용 자서전으로 이어주는 캡스톤 디자인 프로젝트입니다.

모바일 사용을 우선으로 설계했으며, 발표 시연에서는 사전에 저장된 데모 DB를 불러와 네트워크 없이도 챗봇 답변과 A5 인쇄용 자서전을 보여줄 수 있습니다.

## 핵심 기능

- 휴대폰 번호 기반 로그인/온보딩 프로토타입
- 대화형 회상 인터뷰와 사진 기반 회상
- 기억 카드, 태그, 사진 메타데이터 정리
- 가족 질문 등록과 공개 범위/동의 검수
- 저장된 기억 기반 `나의 분신` 대화
- 문체 선택 자서전 생성과 A5 인쇄용 PDF
- 캡스톤 발표용 데모 데이터, 발표 대본, 화면 산출물 패키지

## 기술 스택

- React 19, TypeScript, Vite
- Zustand persist
- Vitest, Testing Library, fast-check
- OpenAI API 연동 구조
- jsPDF 기반 PDF 생성
- Tailwind 계열 utility styling

## 실행 방법

```bash
npm install
npm run dev
```

기본 개발 서버는 `http://localhost:3000`에서 실행됩니다. 이미 포트가 사용 중이면 Vite가 안내하는 다른 포트를 사용합니다.

OpenAI 연동 기능을 실제 API로 확인하려면 `.env` 또는 실행 환경에 다음 값을 설정합니다.

```bash
OPENAI_API_KEY="..."
```

캡스톤 발표 모드는 사전 데이터와 오프라인 응답을 사용하므로 API 키 없이도 핵심 시연이 가능합니다.

## 발표 시연 방법

1. 앱 실행 후 `/settings`로 이동합니다.
2. `발표 데모` 탭을 엽니다.
3. `발표용 데이터 불러오기`를 누릅니다.
4. `네트워크 없이 시연`이 켜져 있는지 확인합니다.
5. 화면의 `3~5분 시연 순서`에 따라 이동합니다.
6. `자서전` 화면에서 `사전 자서전 불러오기` 후 `인쇄용 PDF`를 생성합니다.

추천 동선:

```text
로그인/온보딩 -> 발표 데모 준비 -> 말씀 나누기 -> 추억 보관함 -> 가족 공간 -> 나의 분신 -> 자서전 PDF
```

## 발표 산출물 생성

```bash
npm run demo:assets
```

생성 위치:

- `artifacts/capstone-demo/Dearlog_김영자_이야기_A5.pdf`
- `artifacts/capstone-demo/index.html`
- `artifacts/capstone-demo/screenshots/*.svg`
- `artifacts/capstone-demo/manifest.json`

이 산출물은 PPT, 포스터, 최종 보고서에 바로 넣기 위한 발표용 자료입니다.

## 문서

- [캡스톤 발표 패키지](docs/capstone-demo-package.md)
- [기술 설명서](docs/technical-architecture.md)
- [모바일 사용자 여정 와이어플로우](design/README.md)

## 검증

```bash
npm run lint
npm test
npm run build
```

최근 검증 결과:

- `npm run lint` 통과
- `npm test` 통과: 43 files / 262 tests
- `npm run build` 통과

## 구현 범위와 한계

구현 완료:

- 프론트엔드 인증/온보딩 프로토타입
- 로컬 저장 기반 기억/사진/질문/자서전 상태 관리
- 데모 DB 주입과 초기화
- 오프라인 분신 응답
- GPS 민감정보 마스킹
- A5 인쇄용 PDF 생성
- 발표 대본, Q&A, 화면 패키지 생성

향후 작업:

- 실제 SMS 인증과 서버 세션
- 운영용 백엔드/DB/스토리지
- 가족 초대 링크와 권한 관리
- 암호화, 접근 로그, 백업 정책
- 실제 인쇄 주문/배송 연동
- 장기 사용자를 위한 접근성/음성 입력 고도화
