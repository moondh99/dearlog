# 5종 동의 실제 집행 설계안

작성일: 2026-07-31
상태: **1~5단계 구현 완료** — 남은 범위는 문서 끝을 참고한다.

## 조사로 확인한 현재 상태

코드를 직접 확인한 사실만 적는다.

| 확인 | 근거 |
| --- | --- |
| **운영 코드는 `Memory` 행을 만들지 않는다** | `prisma.memory.create`가 테스트 파일에만 존재한다. `POST /api/memories`와 `saveLocalMemory` 래퍼는 있으나 호출부가 0건이다 |
| 실제 답변은 전부 `InterviewRecord`가 된다 | 운영 코드의 `prisma.interviewRecord.create`는 `server/app.ts:2600` 하나뿐이다 |
| **5종 동의 화면은 실사용에서 비어 있다** | `ConsentSettingsScreen`이 `fetchLocalMemories()`로 `Memory`를 가져오는데 그 테이블이 비어 있다. 데모 시드에서만 항목이 보인다 |
| 책을 실제로 거르는 것은 `InterviewRecord.publish` | `server/publication.ts:152` `where: { userId, publish: true }` |
| `FreeSpeechRecord`와 `Photo`에는 동의 필드가 아예 없다 | `schema.prisma` 확인 |
| `sensitive`는 쓰기·직렬화 외 분기가 0건 | `server/app.ts:377, 3363, 3370` 뿐 |
| `posthumous`를 소비할 유일한 메커니즘(유산 금고)은 UI 미배선 | `/api/legacy/*`를 호출하는 화면이 없다 |

**요약: 5종 동의는 운영에서 생성되지 않는 테이블에 붙어 있다.** 화면은 존재하지만 조작할
대상이 없고, 실제 콘텐츠(`InterviewRecord`/`FreeSpeechRecord`/`Photo`)는 각각 불리언 2개뿐이거나
아예 동의 개념이 없다.

## 그래서 "집행"은 두 단계다

동의를 소비 지점에서 거르기 전에, **동의가 실제 데이터에 붙어 있어야 한다.**

1. **1단계 — 동의를 데이터가 있는 곳으로 옮긴다.** 이게 없으면 집행할 대상이 없다.
2. **2단계 — 각 목적을 소비 지점에서 강제한다.**

## 정해진 결정과 구현 결과

| 결정 | 선택 | 구현 |
| --- | --- | --- |
| 저장 위치 | 각 테이블에 컬럼 추가(A안) | `InterviewRecord`에 `familyRead`/`posthumous`/`sensitive` 불리언 추가. 기존 `publish`/`chatbot`은 그대로 확장 |
| `사후공개` | 철회하면 사후에도 공개하지 않음 | 유산이 전수된(`deathVerificationStatus === 'released'`) 뒤에도 계속 가린다 |
| `민감정보` | 철회하면 AI 제공자에 보내지 않음 | 출판 입력, 표지 에이전트, 챗봇 chunk, 자서전 초안에서 제외 |

상태값은 불리언으로 정했다. 기존 3상태의 `needs_review`는 동의 상태가 아니라 검수 워크플로이고
`InterviewRecord.reviewStatus`가 이미 그 역할을 한다. 아무 데서도 강제되지 않던 세 번째 상태를
새 설계로 그대로 옮기면 같은 문제를 반복하게 된다.

`FreeSpeechRecord`에는 동의 컬럼을 두지 않았다. 이 행은 `InterviewRecord`의 사본이므로
동의를 복제하면 진실의 원천이 둘이 되어 한쪽만 철회되는 우회로가 그대로 남는다.
대신 `interviewRecordId`로 원본을 가리키고 동의는 원본에서 읽는다. 기존 행은 마이그레이션에서
같은 사용자/오디오키/본문으로 원본을 되찾고, 되찾지 못한 행은 가장 보수적으로(철회로) 다룬다.

## 참고: 결정 당시의 선택지

### 결정 1. 동의를 어디에 저장할까

세 가지 콘텐츠 타입(`InterviewRecord`, `FreeSpeechRecord`, `Photo`)에 5개 목적이 모두 적용된다.

**A안 — 각 테이블에 컬럼 5개씩 추가**

- 장점: 조인이 없다. 기존 `where: { publish: true }` 형태를 그대로 유지한다. 마이그레이션이
  단순하다(`publish`/`chatbot` 불리언 → 새 컬럼으로 값 이관).
- 단점: 컬럼 15개(5×3). 목적을 하나 추가하면 테이블 3곳을 고쳐야 한다.
- 집행 코드: 각 소비 지점의 `where` 절에 조건 추가. 가장 작은 diff.

**B안 — 폴리모픽 동의 테이블 하나**

```
ContentConsent(subjectType, subjectId, purpose, status)
```

- 장점: 목적 추가·콘텐츠 타입 추가가 한 곳에서 끝난다. 동의 변경 이력을 남기기 쉽다.
- 단점: 모든 읽기에 조인이나 별도 조회가 붙는다. `where: { publish: true }` 같은 단순 필터가
  사라진다. 지금 구조에서는 소비 지점마다 헬퍼를 통과시켜야 한다.

**권고: A안.** 목적이 5개로 고정돼 있고 콘텐츠 타입도 3개로 고정돼 있다. B안의 유연성이
필요해지는 시점(목적을 자주 추가하거나 동의 이력 감사가 요구될 때)이 오면 그때 옮겨도
늦지 않다. 지금 B안을 택하면 모든 소비 지점을 조인 기반으로 다시 쓰는 비용이 먼저 발생한다.

### 결정 2. `sensitive`와 `posthumous`가 무엇을 해야 하는가

**이 두 목적은 현재 의미가 정의돼 있지 않다.** 코드에 분기가 없는 것은 구현 누락이 아니라
"무엇을 해야 하는지 정해진 적이 없어서"로 보인다. 정의 없이 구현하면 추측을 코드로 굳히게 된다.

`publish` / `familyRead` / `chatbot`은 의미가 분명하다.

| 목적 | 의미 | 집행 지점 |
| --- | --- | --- |
| `publish` | 자서전 책에 넣지 않는다 | 출판 파이프라인, 표지 에이전트, 자서전 초안 |
| `familyRead` | 가족(보호자)에게 본문을 보여주지 않는다 | 보호자 대상 조회 API 전부 |
| `chatbot` | 분신 대화의 근거로 쓰지 않는다 | chunk 생성, 서버 응답의 임베딩 |

`posthumous`와 `sensitive`는 아래 중 어느 쪽인지 정해야 한다.

**`사후공개` 후보 해석**

- (a) 사후에 **공개하지 않는다** — 본인 사망 후 가족에게도 열리지 않는다
- (b) 사후에**만** 공개한다 — 생전에는 잠기고 사후에 열린다
- (c) 유산 금고에 담을지 여부만 표시한다 (금고 UI가 생길 때까지 집행 없음)

(b)라면 지금 `granted`가 기본값인 것이 위험하다. 생전 열람을 막아야 하기 때문이다.
현재 화면 문구("사후 공개")는 (b)에 가깝게 읽히지만, 기본값과 동작은 (a)/(c)에 가깝다.

**`민감정보` 후보 해석**

- (a) 이 내용이 민감하다는 **표시**일 뿐, 다른 목적의 동의로 실제 제한을 건다
- (b) 민감 표시 시 **AI 제공자에게 보내지 않는다** (챗봇·표지·초안 생성에서 제외)
- (c) 민감 표시 시 **가족 열람에서 한 번 더 확인**을 요구한다

(b)가 가장 방어적이고 기술적으로 명확하다. 다만 그러면 `chatbot` 동의와 상당 부분 겹친다.

## 2단계: 사진 동의 (완료)

사진에 `publish` / `familyRead` / `posthumous` / `sensitive` 4종을 붙였다.
**`chatbot`은 두지 않았다.** 분신 대화는 사진을 근거로 쓰지 않는다. 집행 지점이 없는 컬럼을
만드는 것이 애초에 이 문제를 만들었기 때문에 반복하지 않는다.

| 목적 | 집행 지점 |
| --- | --- |
| `publish` | 출판 파이프라인의 사진 조회. 예전에는 모든 사진이 무조건 책에 들어갔다 |
| `familyRead` | `/api/photos`에서 목록에서 아예 제외한다. 사진은 URL 하나만 남아도 그대로 보인다 |
| `posthumous` | 유산 전수 후에도 철회한 사진은 열리지 않는다 |
| `sensitive` | 업로드 시 `sensitive: false`면 AI 분석 자체를 하지 않는다. 책에서도 빠진다 |

`sensitive`는 업로드 시점이 중요하다. 사진 분석은 업로드할 때 일어나므로, 올린 뒤에 끄면
분석은 이미 끝난 뒤다. 그래서 업로드 요청이 `sensitive`를 받아 분석 자체를 건너뛴다.

## 3단계: 철회의 소급 적용 (완료)

동의를 철회하면 **앞으로** 만드는 책에서는 빠졌지만 **이미 만들어진 PDF는 그대로 남았다.**
`resolveLocalFileAccess`가 `publicationRequest`를 `pdfFileKey`로 찾아 소유권만 확인하고 동의는
전혀 보지 않았다. 동의 집행 작업 전체에서 유일하게 남아 있던 구멍이다.

**결정: 기존 PDF 무효화.** 종이책은 회수할 수 없지만 PDF는 막을 수 있다. 못 막는 것이 있다고
막을 수 있는 것까지 놔두면 동의 기능 전체가 무의미해진다.

**집행 방식: 다운로드 시점의 시점 비교.** 철회할 때 영향받는 `publicationRequest`를 일일이 찾아
표시하지 않는다. 산출물을 여는 시점에 "이 책을 만든 뒤에 동의가 철회된 적이 있는가"만 본다.
집행 지점이 하나라 빠뜨릴 구멍이 없고, 나중에 산출물 종류가 늘어도 같은 게이트를 지나면 된다.

| 항목 | 결정 |
| --- | --- |
| 철회 시점 | `InterviewRecord`/`Photo`에 `consentUpdatedAt` 컬럼 추가 |
| 대상 목적 | `publish`와 `sensitive`. 출판 입력이 이 둘을 함께 보므로(`prepareLocalPublicationInput`) 둘 다 책 내용을 바꾼다 |
| 산출물 시각 | `PublicationRequest.createdAt`, `PublicationPreviewJob.createdAt`. 완료 시각이 아니라 요청 시각이라 생성 도중의 철회도 막힌다 |
| 응답 | `409`와 "다시 만들어 주세요" 메시지. `404`로 막으면 "왜 안 되지"로 끝난다 |
| 부모님 본인 | 계속 볼 수 있다. 자기 이야기를 자기가 못 보게 막을 이유가 없고, 기존 동의 집행도 본인 조회는 전부 열어 두었다 |

`updatedAt`을 쓰지 않은 이유: `InterviewRecord`와 `Photo`에는 애초에 `updatedAt`이 없고,
있었더라도 본문 수정·연결 변경 같은 동의와 무관한 갱신까지 잡아 멀쩡한 책을 막았을 것이다.
동의 전용 컬럼은 `ALTER TABLE ADD COLUMN` 하나로 끝나므로 오탐을 안고 갈 이유가 없다.
기존 행은 `NULL`(= 철회한 적 없음)로 두어 이미 만들어진 책을 소급해서 막지 않는다.

집행 지점은 두 곳이다. 둘 다 같은 본문을 담고 있어 한쪽만 막으면 다른 쪽으로 새어 나간다.

| 경로 | 비고 |
| --- | --- |
| `GET /api/files/pdfs/*` | PDF에 도달하는 유일한 경로. 서명 토큰 경로와 로그인 경로가 여기서 만난다 |
| `GET /api/publication-preview-jobs/:id` | 예전 job id로 조회하면 철회 전 초안 HTML이 그대로 열렸다 |

미리보기 **초안 캐시**는 이미 철회를 반영하고 있어 손대지 않았다. `sourceHash`가 동의로 걸러진
뒤의 기록·사진 목록에서 계산되므로 철회하면 해시가 달라져 캐시에 맞지 않고, 최신 캐시를
재사용하는 경로는 `draftUsesOnlyAvailableRecords`가 이미 막는다.

## 4단계: 삭제의 소급 적용 (완료)

삭제는 철회보다 강한 의사 표시다. 그런데 기록이나 사진을 지우면 `consentUpdatedAt`을 남길
**행 자체가 사라져** 이미 만들어진 책이 그대로 열렸다. 철회는 막고 삭제는 안 막는 것은
앞뒤가 안 맞는다.

**결정: 시니어 단위 시각 하나.** `User.publicationContentDeletedAt`을 추가하고 3단계의 같은
게이트가 이것도 함께 본다. 지운 행마다 흔적(tombstone)을 남기는 쪽은 표가 늘고 모든 조회가
그 표를 걸러야 한다. 게이트는 "산출물보다 나중인 사건이 있었는가"만 알면 되므로 시각 하나로 족하다.

| 항목 | 결정 |
| --- | --- |
| 남기는 조건 | 지운 것이 **책에 들어갈 수 있던 것일 때만**. `publish=false`거나 `sensitive=false`인 것을 지운 것은 책 내용을 바꾸지 않는다 |
| 게이트 | `hasPublicationConsentRevokedSince`에서 `publicationContentDeletedAt > producedAt`을 함께 본다. 집행 지점은 3단계와 동일하다 |
| 기존 행 | `NULL`(= 지운 적 없음). 이미 만들어진 책을 소급해서 막지 않는다 |

책에 들어가는 내용을 지우는 운영 경로는 `DELETE /api/photos/:id` **하나뿐이다.**
`InterviewRecord`와 `FreeSpeechRecord`에는 삭제 라우트가 아예 없고, 계정 전체 삭제 경로도 없다.
`FreeSpeechRecord`의 `onDelete: Cascade`는 원본 삭제 경로가 없어 실제로 타지 않는다.
`DELETE /api/memories/:id`는 `Memory`가 책 입력이 아니므로 출판 게이트와 무관하다.

## 5단계: 챗봇 대화 기록의 인용문 (완료)

챗봇이 부모님 기록을 인용해 답한 내용이 브라우저 `localStorage`에 남는다. `chatbot` 동의를
철회해도 지워지지 않았다. 서버가 지울 수 없는 저장소이므로 **화면이 지우게 한다.**

**결정: 세션 단위 시점 비교.** 저장된 메시지(`DigitalTwinResult`)에는 출처 기록 id가 없다.
인용한 기록만 골라 지우려면 저장 포맷에 출처를 남기고 기존 저장분을 마이그레이션해야 하는데,
그 대가로 얻는 정밀도는 "관계없는 세션도 함께 버려진다"를 피하는 것뿐이다. 세션 단위는
지우는 쪽으로 틀리므로 안전한 방향이고, 저장 포맷을 건드리지 않는다.

| 항목 | 결정 |
| --- | --- |
| 철회 시각 | `User.chatbotConsentUpdatedAt`. **`consentUpdatedAt`과 컬럼을 나눈다.** 거기에 챗봇 목적을 섞으면 책과 무관한 토글이 멀쩡한 책을 막는 과잉 차단이 되살아난다(`2e2322b` 참조) |
| 대상 목적 | `chatbot`과 `sensitive`. 챗봇 chunk가 이 둘을 함께 본다 |
| 전달 경로 | `GET /api/memories` 응답에 얹는다. 분신 대화 화면이 열릴 때마다 부르는 경로라 이것만을 위한 엔드포인트를 만들 이유가 없다 |
| 버리는 기준 | 세션의 `updatedAt`이 철회 시각보다 이르면 버린다. 화면에서 가리는 것이 아니라 `localStorage`에서 지운다 |
| 통신 실패 | 지우지 않고 다음 성공한 조회로 미룬다. 통신 장애만으로 대화가 영영 사라지면 안 된다 |

`digitalTwin.ts`가 철회된 기록을 **새로** 읽지 못하는 것은 2단계에서 이미 집행됐다.
여기서 막은 것은 이미 저장된 과거 대화다.

## 남은 범위

1. **`Memory` 동의의 챗봇 집행.** `GET /api/memories`는 `consentSettings.챗봇`이 `revoked`면
   임베딩만 빼고 본문은 그대로 내려보내며, 화면은 그 본문으로 chunk를 만든다. `Memory`는
   운영에서 생성되지 않아(데모 시드 전용) 지금은 실사용 영향이 없지만, 아래 정리와 함께 결정해야 한다.
2. **`Memory` 테이블 정리.** 이제 동의가 `InterviewRecord`와 `Photo`에 있으므로 `Memory`와
   `MemoryConsentSettings`, `MemoryVectorEntry`는 쓰이지 않는다. 삭제는 마이그레이션이 필요하므로
   별도 과제로 둔다.

## 참고: 결정 전에 예상했던 작업 범위

1. **스키마**: `InterviewRecord`에 `familyRead`/`posthumous`/`sensitive` 추가,
   `FreeSpeechRecord`와 `Photo`에 5종 추가. 기존 `publish`/`chatbot`은 그대로 두고 확장한다
   (컬럼명 변경은 마이그레이션 위험만 늘린다).
2. **마이그레이션**: `server/prisma/init.ts`의 raw SQL에 `ALTER TABLE ... ADD COLUMN` 추가.
   기존 행은 기본값 `granted`로 채운다.
3. **동의 화면**: `ConsentSettingsScreen`의 5종 섹션이 `Memory`가 아니라 `InterviewRecord`를
   대상으로 하도록 바꾼다. 이게 화면이 실제로 동작하게 되는 지점이다.
4. **집행**:
   - `publish`: 출판 파이프라인(이미 됨), 표지 에이전트(이미 됨), 자서전 초안(이미 됨),
     `FreeSpeechRecord`(신규)
   - `familyRead`: 보호자 대상 조회 API 전부 — `/api/interview-records`, `/api/free-speech`,
     `/api/photos`, `/api/memories`(이미 부분)
   - `chatbot`: 이미 클라이언트에서 됨. **서버 응답에서도 걸러야 한다**
   - `posthumous`/`sensitive`: 결정 2에 따라
5. **철회의 소급 적용**: 이미 만들어진 PDF, 초안 캐시, `FreeSpeechRecord` 사본, 챗봇 대화
   기록. 이건 별도 과제로 남긴다(`docs/audit-2026-07-31.md` 참조).
6. **회귀 테스트**: 목적×소비지점 조합. 각 목적을 철회한 뒤 해당 소비 지점에서 내용이
   빠지는지 확인한다.

## 지금 하지 말아야 할 것

- **결정 2 없이 `posthumous`/`sensitive`를 구현하는 것.** 추측한 의미를 코드와 마이그레이션에
  굳히면 나중에 되돌리는 비용이 지금 정하는 비용보다 크다.
- **`Memory` 테이블을 서둘러 지우는 것.** 지금은 쓰이지 않지만, 5종 동의를 `InterviewRecord`로
  옮기고 화면을 전환한 뒤에 정리해도 된다.
