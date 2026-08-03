# 5종 동의 실제 집행 설계안

작성일: 2026-07-31
상태: **1·2단계 구현 완료** — 남은 범위는 문서 끝을 참고한다.

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

## 남은 범위

1. **철회의 소급 적용.** 이미 만들어진 PDF는 `pdfFileKey`가 살아 있는 한 계속 내려받을 수 있고,
   챗봇 대화 기록은 인용한 원문을 localStorage에 남긴다. 완전 삭제 정책과 함께 결정해야 한다.
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
