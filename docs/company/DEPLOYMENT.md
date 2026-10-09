# 회사 소개 정적 배포

## 승인과 운영 출발점

사용자가 'dearlog 배포해줘'라고 승인한 범위는 `/company`와 필요한 정적 자산의 공개 배포다. 루트 교체, 백엔드/DB 변경, DNS/MX/메일 설정, 유료 리소스, 권한 확대는 포함하지 않는다.

2026-10-09 확인: `dear-log.com`은 Cloudflare named tunnel `dearlog` → `localhost:8787` → `/Users/moondh/Downloads/2026_디어로그/server/index.ts`의 Express가 같은 저장소 `dist`를 제공한다. 운영 서버 PID 15621, 터널 PID 16666. 공개 `/api/health` 정상, 공개 HTML과 로컬 HTML SHA-256 일치: `b8cadda6e932b751bee522faa50e5ab89bfb6ea963fd6bc60e95a00509dd7c48`.

원본 저장소 main `d39311854a62d8133218905c0b13f285dc55388a`는 추적 파일 수정 없음. 기존 미추적 작업 파일은 유지한다. 원격 main `445117f2eadc3d410b56f4f8d4cec61c1d9520dc`에는 OTP 인증 및 서버 변경이 추가되어 있다. 이번 소개 페이지 승인 범위에서 미배포 인증 변경을 함께 운영에 적용하지 않는다. 원격 main은 그대로 보존하고 현재 운영 기준의 별도 `feat/company-introduction` 브랜치를 기록한다.

## 배포 절차

1. 기존 검증한 독립 작업본의 회사 소개 변경만 commit/push. 공개 소스 비밀 패턴 없음, 가상 데이터 UI만 포함. 폰트 저작권/라이선스 동봉 확인.
2. `VITE_LOCAL_API_URL=https://dear-log.com npm run build`로 운영용 프론트 빌드. 로컬 QA 포트가 번들에 포함되지 않게 확인.
3. 기존 정적 `dist`를 별도로 보존하고 새 빌드를 준비. 열린 기존 브라우저의 지연 로딩을 위해 기존 해시 자산도 새 배포에 보존.
4. 지원되는 파일 시스템 디렉터리 교환으로 정적 빌드를 교체. 서버/터널 재시작, DB 변경, DNS 변경 없음.
5. 공개 URL의 정확한 빌드 해시, `/company` 직접 접속/새로고침/모바일/키보드/CTA/mailto 및 기존 홈/인증/초대 경로를 별도 Edge에서 읽기 전용 검증. 실제 사용자 계정·인터뷰·이메일 발송 없음.
6. 실패하면 보존된 이전 정적 디렉터리를 되돌릴 수 있게 배포 기록을 남김.

정확한 커밋·공개 검증 결과·복원 경로는 작업본 `artifacts/company/deployment-report.json`에 기록한다. 기존 원본 소스 브랜치/서버는 변경하지 않고 정적 배포 디렉터리만 반영한다.
