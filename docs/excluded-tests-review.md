# Excluded Tests Review

Last checked: 2026-07-30

`vitest.config.ts` 의 `exclude` 목록은 이제 **테스트 파일을 하나도 담고 있지 않다**
(`node_modules`, `dist`, `.git`, `Senior-Friendly Family Autobiography App` 같은
비-테스트 경로만 남았다). 즉 저장소의 모든 테스트 파일이 `npx vitest --run` 에서 실제로 실행된다.

## 2026-07-30 정리 내용

구세대 코드(`src/store.ts`, kebab-case 에이전트, 도달 불가 페이지) 제거와 함께,
제외돼 있던 8개 테스트 파일의 대상 API가 전부 사라진 상태였다. 라이브 에이전트
(`archivist.ts`, `interviewer.ts`, `verification.ts`, `ghostwriter.ts`)는 실제 화면
(ParentInterviewScreen / AutobiographyScreen / ChatbotScreen)에서 쓰이는데 테스트는
사실상 0건이었으므로, 낡은 계약 테스트를 삭제하고 **현재 계약에 대한 테스트를 새로 작성**했다.

### 삭제한 파일 (모두 구세대 계약 테스트)

| 삭제한 파일 | 사라진 대상 API |
| --- | --- |
| `src/lib/agents/archivist-v2.property.test.ts` | `generateDiffRecord`, `applyDiffRecord`, `extractNERTags`, `assignEmotionTags`, `assignConfidenceLabel`, `generateTimelineEntry` |
| `src/lib/agents/interviewer.property.test.ts` | `createSessionState`, `getNextQuestionCategory`, `generateSessionJSON`, `QUESTION_CATEGORY_SEQUENCE` |
| `src/lib/agents/verification.property.test.ts` | `assignConfidenceLabel` |
| `src/lib/agents/verification-v2.property.test.ts` | `classifyConflictType`, `generateVerificationJSON`, `detectUncertainty` |
| `src/lib/agents/ghostwriter-style.test.ts` | `AUTOBIOGRAPHY_STYLE_LABELS`, `getStyleInstruction`, `toPDFReadyAutobiography` |
| `src/lib/agents/ghostwriter-v2.test.ts` | `categorizeMemories`, `toPDFReadyAutobiography`, `CHAPTER_CATEGORIES` |
| `src/lib/agents/ghostwriter-v2.property.test.ts` | `categorizeMemories`, `CHAPTER_CATEGORIES` |
| `src/capstone-demo.test.tsx` | 구세대 `AutobiographyPage` (파일 자체가 구세대 제거 때 이미 삭제됨) |

### 새로 작성해 활성화한 파일

| 파일 | 검증 대상 |
| --- | --- |
| `src/lib/agents/archivist.test.ts` | `archiveTranscript`: 데모 모드 무-네트워크 경로, 프로바이더 응답 파싱, 프롬프트에 챕터/세션 주제/원문이 그대로 실리는지, 실패·빈응답·깨진 JSON 에서 **원문(raw) 유실 없음**(fast-check 속성), chunkId 유일성 |
| `src/lib/agents/interviewer.test.ts` | `generateFollowUpQuestion`: 데모 응답, 프로바이더 JSON 파싱, 주제·이전 질문·답변 원문 전달, 시스템 프롬프트의 금지 사항 유지, 실패/빈 응답 시 한국어 에러 throw, 임의 답변의 바이트 단위 보존(fast-check) |
| `src/lib/agents/verification.test.ts` | `verifyChunk`: 비교 대상이 없을 때 무-네트워크 PASS, 데모 PASS, 충돌 플래그 전달, 모델 응답이 `chunkId`/`verifiedAt` 을 덮어쓰지 못함, 최근 10개만 비교 대상으로 전송, 실패/파싱 실패 시 허위 충돌 없이 PASS 폴백, **입력 chunk 무변경**(fast-check 속성) |
| `src/lib/agents/ghostwriter.test.ts` | `buildMemoryChunksFromTranscripts`(빈 자서전 회귀 방지: 답변 텍스트 보존, aiSummary→clean 승격, 빈 기록 제외, chapterHint 구성)와 `generateChapterDraft`(챕터 스코핑, 미기록 챕터의 missingSections, 프로바이더 실패 시 근거 기반 폴백, 데모 경로) |

에이전트 테스트 수: 34 → 65.

새 테스트를 붙이며 `src/lib/agents/verification.ts` 의 반환 스프레드 순서를 한 줄 고쳤다.
기존 `{ chunkId, verifiedAt, ...result }` 는 모델이 응답에 `chunkId`/`verifiedAt` 을 담아 보내면
호출자 기준값을 덮어써 검증 결과가 다른 기억에 붙을 수 있었다. `{ ...result, chunkId, verifiedAt }` 로 바꿨다.

## 여전히 남은 정리 대상 (테스트 통과와는 무관)

- `src/lib/agents/ghostwriter.property.test.ts` 는 활성 상태로 통과하지만 프로덕션
  함수를 호출하지 않고 자체 생성기가 만든 데이터의 형태만 검사한다. 실제 회귀를 잡지
  못하므로 이후 `generateChapterDraft` 기반 속성 테스트로 교체하거나 삭제하는 것이 좋다.

## 타임아웃 flake

`server/app.test.ts` 의 출판 PDF 테스트는 Puppeteer 로 실제 렌더를 수행해 단독 실행에서도
4초 이상 걸린다. Vitest 기본 `testTimeout` 이 5초라 전체 병렬 실행 부하에서 간헐적으로
타임아웃 실패했다. `vitest.config.ts` 에 `testTimeout: 30000`, `hookTimeout: 30000` 을
지정해 해결했다(테스트 삭제/skip 없음).
