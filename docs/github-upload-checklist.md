# GitHub 업로드 체크리스트

## 업로드에서 제외되는 항목

- `.env`, `.env.*`: 실제 API 키와 로컬 URL
- `node_modules/`: 설치된 의존성
- `dist/`, `build/`, `coverage/`, `.vite/`: 빌드와 테스트 산출물
- `artifacts/`: 기존 PDF/SVG 발표 산출물과 로컬 QA 캡처. 자동 재생성 스크립트는 제거됐으므로 필요한 파일은 별도로 보관
- `.claude/`, `.kiro/`, `.vscode/`: 로컬 도구와 개인 작업 상태
- `NEXT_AGENT_PROMPT.md`: 로컬 경로와 작업 인수인계가 포함된 내부 문서
- `.DS_Store`, 로그, 임시 파일

## 업로드 전 확인 명령

```bash
npm run lint
npm test
npm run build
```

## GitHub에 올리는 기본 순서

```bash
git init
git add .
git status --short
git commit -m "Initial Dearlog capstone app"
git branch -M main
git remote add origin <YOUR_GITHUB_REPOSITORY_URL>
git push -u origin main
```

`git status --short`에서 `.env`, `node_modules`, `dist`, `artifacts`, `.claude`, `.kiro`, `NEXT_AGENT_PROMPT.md`가 보이면 커밋하지 말고 `.gitignore`를 다시 확인합니다.

## 주의

현재 AI 호출은 서버의 `/api/ai/*` 프록시를 통하며 브라우저 번들에 API 키를 넣지 않습니다.
실제 배포 전에는 강한 `AUTH_TOKEN_SECRET`, 운영자 접근 토큰, AI 제공자 키를 팀 비밀 저장소에
설정하고 `ALLOW_DEV_AUTH_HEADERS`가 꺼져 있는지 확인합니다.
