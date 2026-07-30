# Dearlog 서비스 점검 프롬프트

새 에이전트 세션에서 아래 내용을 그대로 붙여넣어 사용하세요.

---

당신은 Dearlog 서비스의 현재 상태를 점검하는 작업을 맡았습니다. 작업 루트는
`/Users/moondh/Downloads/디어로그` 입니다. 한국어로 소통하세요. 아래 항목을 순서대로
확인하고, 마지막에 정상/이상 여부를 표로 정리해 보고하세요. 문제를 발견하면 원인을
설명하고 수정까지 직접 진행하세요(사용자에게 떠넘기지 마세요).

## 1. 백엔드 서버

- `localhost:8787`에서 Express + SQLite/Prisma 서버가 떠 있는지 확인:
  `lsof -i :8787` 또는 `curl -s http://localhost:8787/api/health`
- 떠 있지 않다면 `server/` 디렉터리에서 어떻게 기동하는지 `package.json` 스크립트 확인 후 재기동.

## 2. Cloudflare Named Tunnel + 도메인

- `dear-log.com` → `localhost:8787` 포워딩이 살아있는지 확인:
  `curl -s https://dear-log.com/api/health` 결과가
  `{"ok":true,"storage":".../server/storage"}` 형태인지 확인.
- 응답이 없거나 타임아웃이면 cloudflared 터널 프로세스 상태 확인 (`ps aux | grep cloudflared`,
  터널 이름 `dearlog`, id `a8a3c955-4325-48c4-94d6-322c8307bb17`).

## 3. 프론트엔드 빌드 & Capacitor 동기화

- `capacitor.config.ts`의 `webDir`이 `'dist'`로 되어 있는지 확인 (과거 `dist-mobile`로 잘못
  설정되어 빌드가 반영 안 되는 버그가 있었음 — 재발 여부 우선 확인).
- `.env`의 핵심 값이 아래와 일치하는지 확인:
  ```
  APP_URL="https://dear-log.com"
  LOCAL_SERVER_PUBLIC_URL="https://dear-log.com"
  VITE_LOCAL_API_URL="https://dear-log.com"
  VITE_ALLOWED_HOSTS="dear-log.com"
  LOCAL_SERVER_PORT="8787"
  ```
- 필요 시 재빌드/동기화:
  ```bash
  cd "$D" && npm run build && npx cap sync ios
  ```
  (`$D`는 마운트된 디어로그 폴더 경로 — 한글 폴더명 유니코드 정규화 문제 주의, 동적으로 찾기:
  `D=$(ls -d /sessions/<session-id>/mnt/*/ | grep -v -E "outputs|uploads|claude|remote"); D="${D%/}"`)
- 빌드 산출물(`dist/`)의 타임스탬프가 최근인지, iOS 프로젝트(`ios/App`)에 실제로 동기화됐는지
  확인 (예: `dist/` 내 번들 JS에서 `dear-log.com` 문자열 grep으로 반영 여부 확인).

## 4. iOS 네이티브 앱 / 딥링크

- 시뮬레이터에서 앱이 정상 실행되는지 확인 (computer-use로 Xcode/Simulator 직접 조작 가능,
  Xcode는 click tier, Simulator는 full tier).
- 커스텀 URL 스킴 딥링크 동작 확인:
  ```bash
  xcrun simctl openurl booted "dearlog://parent/autologin?token=<유효한 미사용 초대 토큰>"
  ```
  유효한 토큰은 아래로 조회 (1회용이므로 `usedAt IS NULL`인 것만 사용):
  ```python
  import sqlite3
  conn = sqlite3.connect("server/data/dearlog.db")
  cur = conn.execute("SELECT id, token, expiresAt, revokedAt, usedAt FROM Invitation WHERE usedAt IS NULL AND revokedAt IS NULL ORDER BY expiresAt DESC LIMIT 5")
  print(cur.fetchall())
  ```
- 앱이 열리고 `/parent/autologin` → 로그인 성공 → 온보딩까지 정상 진행되는지 확인.

## 5. UI 회귀 점검

- Figma export 과정에서 화면 컴포넌트에 가짜 "9:41" 상태바(`function StatusBar() {...}`)가
  다시 끼어들지 않았는지 확인 (이전에 15개 파일에서 제거한 이력 있음). 새로 추가/수정된 화면
  파일 위주로 grep: `grep -rl "9:41" src/`

## 6. 알려진 차단 사항 (점검만 하고 보고, 진행 X)

- Apple Developer Program 미가입 — Universal Link/실기기 배포 불가. 가입 여부는 사용자 결정
  사항이므로 점검 시 "여전히 미가입 상태"인지만 확인하고 별도로 진행하지 마세요.
- 백엔드가 사용자 Mac에 로컬로 의존 — Mac 절전/재시작 시 서비스 중단 위험. 운영 안정성 개선은
  사용자가 명시적으로 요청하기 전까지 먼저 제안만 하고 진행하지 마세요.

## 보고 형식

마지막에 다음 표로 정리:

| 항목 | 상태 | 비고 |
|---|---|---|
| 백엔드 서버 | 정상/이상 | |
| Cloudflare 터널 + 도메인 | 정상/이상 | |
| 빌드/Capacitor 동기화 | 정상/이상 | |
| iOS 앱 + 딥링크 | 정상/이상 | |
| UI 회귀(가짜 상태바) | 정상/이상 | |

이상이 발견된 항목은 수정 작업까지 진행한 뒤 `NEXT_AGENT_PROMPT.md`를 최신 상태로 업데이트하세요.
