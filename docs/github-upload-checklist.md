# GitHub 업로드 체크리스트

## 업로드에서 제외되는 항목

- `.env`, `.env.*`: 실제 API 키와 로컬 URL
- `node_modules/`: 설치된 의존성
- `dist/`, `build/`, `coverage/`, `.vite/`: 빌드와 테스트 산출물
- `artifacts/`: `npm run demo:assets`로 다시 만들 수 있는 PDF/SVG 발표 산출물
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

현재 앱은 프론트엔드 프로토타입이며 OpenAI API 키를 브라우저에서 사용하는 구조입니다. 실제 서비스 배포 전에는 API 호출을 서버/API route 뒤로 옮겨야 키가 사용자 브라우저에 노출되지 않습니다.
