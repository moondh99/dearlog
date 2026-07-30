# 실제 가족 기록 파일럿 체크리스트

목표: 5명 이하 테스트에서 실제 인생 기록을 충분히 모아 2명 정도의 자서전 PDF를 만드는 것.

## 테스트 전

- `.env`에 `AUTH_TOKEN_SECRET`을 긴 랜덤 문자열로 설정한다.
- 외부 접속 URL은 현재 Cloudflare Quick Tunnel 주소를 쓴다. 현재 운영 URL은 `https://isa-army-field-designers.trycloudflare.com`이다.
- Quick Tunnel 주소는 재시작 때 바뀔 수 있으므로, 새로 띄운 경우 `.env`의 `APP_URL`과 `LOCAL_SERVER_PUBLIC_URL`을 새 주소로 다시 맞춘다.
- 실제 테스트 중에는 `ALLOW_DEV_AUTH_HEADERS=false`로 둔다.
- `VITE_ALLOWED_HOSTS`는 현재 Cloudflare host로 맞추고, `VITE_NGROK_HOST`는 비워 둔다.
- 이번 파일럿은 Cloudflare Quick Tunnel이 8787 백엔드 서버를 터널링하고, 백엔드가 `dist` 프론트와 API를 같은 origin에서 제공한다. `VITE_LOCAL_API_URL`은 비워 두고 `VITE_USE_NGROK_HMR=false`를 유지한다.
- 시작 전 백업을 만든다: `npm run backup:data`
- 빌드와 서버 공개 상태를 확인한다: `npm run build`, `npm run server:dev`, `npm run pilot:public:check`
- 부모님이 2명 이상이면 자녀 화면에서 `현재 기록 공간` 배너가 표시되고, 질문/사진/기록집 화면에서 같은 부모님 이름이 유지되는지 확인한다.

## 테스트 중

- 한 가족이 여러 부모님 기록 공간을 만들 경우, 새 질문/사진 업로드 전 `현재 기록 공간`을 확인한다.
- 사진 업로드 후 생성된 질문을 등록하고, 질문 관리 화면에 같은 기록 공간 기준으로 보이는지 확인한다.
- 부모님 계정은 `/child` 주소로 직접 들어가지 못해야 한다.
- 자녀 계정은 `/parent` 주소로 직접 들어가지 못해야 한다.
- 긴 녹음이나 중요한 답변을 남긴 직후에는 가능하면 한 번 더 `npm run backup:data`를 실행한다.

## 자서전 제작 전

- 기록집 화면에서 부모님 이름 기준으로 제목과 PDF 파일명이 만들어지는지 확인한다.
- 챕터 검수 화면에서 요약본을 훑고, 잘못된 사실은 수정 요청으로 표시한다.
- 자서전 PDF를 먼저 한 번 생성해 보고, 실제로 다운로드 파일이 열리는지 확인한다.
- 최종 산출물 외에도 원본 데이터 `server/data/dearlog.db`와 업로드 파일 `server/storage/`를 보존한다.

## 보존해야 할 데이터

- `server/data/dearlog.db`
- `server/storage/audio/`
- `server/storage/photos/`
- `server/storage/pdfs/`
- 최종 다운로드한 PDF 파일
- `backups/dearlog-backup-*` 폴더

## 문제 발생 시

- 화면에 다른 부모님 기록이 섞여 보이면 즉시 테스트를 멈추고, `현재 기록 공간` 선택값과 백업 시점을 확인한다.
- 서버 재시작 후 데이터가 비어 보이면 `.env`의 `DATABASE_URL`이 같은 DB 파일을 가리키는지 확인한다.
- 파일 접근이 실패하면 `LOCAL_SERVER_PUBLIC_URL`이 현재 공개 URL과 같은지 확인한다.
- 공개 주소가 열리지 않으면 `cloudflared tunnel --url http://localhost:8787` 프로세스와 8787 서버가 실행 중인지 순서대로 확인한다.
