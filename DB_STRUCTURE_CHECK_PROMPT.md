# Dearlog 데이터베이스 구조 점검 프롬프트

새 에이전트 세션에서 아래 내용을 그대로 붙여넣어 사용하세요.

---

당신은 Dearlog 서비스의 현재 데이터베이스 구조를 점검하는 작업을 맡았습니다. 작업 루트는
`/Users/moondh/Downloads/디어로그` 입니다. 한국어로 소통하세요. DB는 SQLite(`server/data/dearlog.db`),
스키마 정의는 Prisma(`server/prisma/schema.prisma`)입니다. 아래 항목을 순서대로 확인하고,
마지막에 결과를 정리해 보고하세요. 불일치나 문제를 발견하면 원인을 설명하고, 수정이 필요한
경우 사용자에게 먼저 확인을 받은 뒤 진행하세요(마이그레이션은 데이터 손실 위험이 있으므로
임의로 적용하지 마세요).

## 1. 스키마 정의 확인

- `server/prisma/schema.prisma`를 읽고 전체 모델(테이블) 목록, 필드, 관계(relation), 인덱스,
  유니크 제약을 정리하세요.
- 현재 모델 수와 이름을 빠짐없이 나열하세요 (예: User, GuardianSeniorLink, Chapter, Question,
  Photo, InterviewSchedule, InterviewSession, InterviewRecord, FreeSpeechRecord,
  PushSubscription, Notification, AiProxyAuditLog, CoverDesign, PublicationRequest,
  PublicationDraftCache, PublicationPreviewJob, LegacyVault, Memory, MemoryTag,
  MemoryConsentSettings, MemoryVectorEntry, AutobiographyDraft, CalendarEvent, Invitation —
  점검 시점에 추가/삭제된 모델이 있는지 이 목록과 비교).

## 2. 실제 DB 파일과의 일치 여부

- 실제 SQLite 파일의 테이블/컬럼 구조를 직접 조회:
  ```bash
  D=$(ls -d /sessions/<session-id>/mnt/*/ | grep -v -E "outputs|uploads|claude|remote"); D="${D%/}"
  cd "$D" && sqlite3 server/data/dearlog.db ".schema"
  ```
  (sqlite3 CLI가 없으면 Python으로 대체: `python3 -c "import sqlite3; ..."`)
- `schema.prisma`에 정의된 모델/필드와 실제 테이블 구조를 1:1로 비교해 차이가 있는지 확인
  (필드 누락, 타입 불일치, `@map`으로 이름이 바뀐 테이블 — 예: `FreeSpeechRecord` →
  `free_speech_db` — 등).

## 3. 마이그레이션 상태

- `server/prisma/migrations/` 디렉터리의 마이그레이션 목록을 확인하고, 가장 최근 마이그레이션이
  `schema.prisma`의 현재 상태를 반영하는지 확인.
- 마이그레이션 적용 상태 확인:
  ```bash
  cd "$D" && npx prisma migrate status
  ```
- "drift detected" 또는 "pending migrations" 등의 경고가 있는지 확인하고, 있다면 원인(스키마를
  직접 수정했는데 마이그레이션 파일을 생성하지 않은 경우 등)을 설명하세요. 이 단계에서
  `prisma migrate dev`나 `db push`를 임의로 실행하지 말고, 필요하면 사용자에게 제안만 하세요.

## 4. 데이터 현황 스냅샷

- 각 테이블의 row 수를 조회해 서비스 사용 현황을 간단히 파악:
  ```bash
  cd "$D" && sqlite3 server/data/dearlog.db "SELECT name FROM sqlite_master WHERE type='table';" | \
    while read t; do echo -n "$t: "; sqlite3 server/data/dearlog.db "SELECT COUNT(*) FROM \"$t\";"; done
  ```

## 5. 코드와의 정합성 (선택)

- `server/db.ts`, `server/prisma/seed.ts`, `server/app.ts` 등에서 Prisma Client를 통해 접근하는
  필드/모델이 실제 스키마와 어긋나지 않는지 빠르게 확인 (타입 에러 여부로 간접 확인 가능:
  `cd "$D" && npx tsc --noEmit` 일부).

## 보고 형식

다음을 포함해 보고하세요:

1. 전체 모델(테이블) 목록과 각 모델의 핵심 필드/관계 요약 (간단한 표 또는 목록)
2. `schema.prisma` ↔ 실제 DB 파일 간 불일치 여부
3. 마이그레이션 상태 (정상/drift/pending)
4. 테이블별 row 수 스냅샷
5. 발견된 문제와 권장 조치 (즉시 수정 vs 사용자 확인 필요 항목 구분)
