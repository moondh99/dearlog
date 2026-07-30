# Dearlog 기능 점검 보고서 (2026-06-28)

PRD(`PRD_Dearlog.md`)에 약속된 7개 영역을 코드 실행·DB 조회·API 호출로 직접 검증했습니다. "코드가 있으니 될 것"이라는 추측은 배제하고, 서버를 실제로 띄워 invitation 재사용, 메모리 삭제, 자서전 PDF 생성 등을 직접 실행해 확인했습니다.

## 가장 중요한 발견: 두 개의 분리된 화면 세트

`src/main.tsx → App.tsx`가 실제로 렌더링하는 라우트는 `SplashScreen / AuthScreen / ParentHomeScreen / ChildHomeScreen / MyPageScreen / ConsentSettingsScreen / CalendarScreen / ChatbotScreen / AutobiographyScreen / PublicationPreviewScreen` 등입니다. 그런데 코드베이스에는 이와 별도로 `Layout.tsx`, `ReviewPage.tsx`, `SettingsPage.tsx`, `ArchivePage.tsx`, `PersonaPage.tsx`, `InterviewPage.tsx`, `OnboardingPage.tsx`, `AutobiographyPage.tsx`, `AuthPage.tsx`라는 두 번째 화면 세트가 존재합니다. 이 세트는 `src/routes/pageLoaders.ts`에서만 참조되고, `App.tsx`의 `<Routes>`에는 단 하나도 연결되어 있지 않습니다. `capstone-demo.test.tsx`/`accessibility-smoke.test.tsx`라는 자체 테스트만 이 화면들을 렌더링하며, 실제 사용자는 이 화면들에 도달할 방법이 없습니다.

이 죽은 코드 세트는 겉보기에 더 완성도 높아 보입니다(MemoryTag 검수, "활용 중지"/"완전 삭제" 버튼, 주간 가족 퀴즈 UI, 실물 책 주문 범위에 대한 명시적 고지 문구 등이 모두 여기 있습니다). 코드 검색만으로 판단했다면 "검수/동의·구독 루프가 잘 구현되어 있다"고 결론 내리기 쉬운데, 실제 사용자가 쓰는 화면은 이보다 훨씬 기능이 적습니다. 아래 표와 평가는 모두 **실제 도달 가능한 화면 기준**으로 작성했습니다.

## 영역별 점검 결과

| 기능 영역 | PRD상 약속 | 실제 상태 | 괴리/이슈 |
| --- | --- | --- | --- |
| 온보딩/초대 | 휴대폰 가입, 14일 유효 초대 링크, 1회용 토큰, 마이페이지 재발급/폐기 | 구성됨 | 가입·초대·딥링크·재발급/폐기 API는 모두 실제로 동작 확인. 단, **초대 토큰이 원래 재사용을 막지 않는 버그**를 발견해 직접 수정함(아래 버그 목록 참고). 수정 후 동일 토큰 2회 로그인 시 410 차단을 curl로 재확인. |
| 인터뷰 | 공통 질문 풀(6개 기록 범위), 사진 기반 자동 질문, 음성+STT 보관, 통화형 스케줄링 | 일부 구성 | 사진 분석(FactChat vision)·Whisper STT·InterviewRecord/FreeSpeechRecord 동시 저장은 실제 API 호출로 확인됨. 단 공통 질문 풀(`COMMON_QUESTIONS`)은 PRD의 6개 범주("전환점과 감정" 등)와 1:1로 안 맞고 "취미/관계" 같은 별도 분류가 섞여 있어 분류 기준이 PRD와 다름. "앱 콜"은 실제 전화(Twilio)가 아니라 웹푸시+인앱 음성 세션으로 대체된 것이며, 코드 주석에도 의도적 대체임이 명시되어 있음. |
| 검수/동의(데이터 주권) | 보호자가 기억을 검수·태그, 기억별 활용 중지/완전 삭제 가능 | 일부 구성 | 백엔드는 약속대로 동작: `DELETE /api/memories/:id`는 진짜 하드 삭제(Prisma cascade, soft-delete 컬럼 없음)이며, "완전 삭제"가 위장된 소프트 삭제가 아님을 schema와 라우트 코드로 확인. **그러나 실제 도달 가능한 화면(`ConsentSettingsScreen`)에는 record별 "출판/챗봇" 토글만 있고, "활용 중지"/"완전 삭제" 버튼이나 `MemoryTag` 검수 UI가 전혀 없음.** 그 기능은 죽은 코드인 `ReviewPage.tsx`에만 존재함. 즉 데이터 주권 보장 기능은 API 차원에서는 진짜로 동작하지만, 사용자가 실제로 누를 수 있는 버튼이 없음. |
| 자서전 제작 | 챕터→문체→표지→비동기 파이프라인→A5 인쇄 PDF, 실물 주문 준비 단계까지 | 일부 구성 | 실제 라이브 화면(`AutobiographyScreen`/`PublicationPreviewScreen`)에서 챕터 구성→표지 디자인 생성/확정→`PublicationRequest` 생성→A5 PDF 다운로드까지 전 구간이 실제 동작(생성된 PDF를 pypdf로 열어 A5 규격·한글 본문·TOC 정상 렌더링 확인). 결제/배송 연동은 없음 — 이는 PRD에도 "주문 준비 단계까지"로 한정돼 있어 괴리는 아님. **다만 라이브 화면에는 "결제·배송은 시연 범위 밖"이라는 안내 문구가 전혀 없어, PDF 다운로드 후 사용자가 다음 단계(실물 주문)를 어떻게 진행해야 하는지 알 수 없음.** 그 안내 문구는 죽은 코드(`AutobiographyPage.tsx`)에만 존재. |
| 구독 재방문 루프 | AI 분신 대화(Memory/MemoryVectorEntry 기반 검색), 가족 질문/주간 퀴즈, 기념일 알림, 캘린더 | 일부 구성 | AI 분신 채팅(`ChatbotScreen`)은 실제 LLM 호출(FactChat 경유)로 응답을 생성하고 근거 기억이 없으면 "근거 없음"으로 정직하게 거절함 — 환각 방지 로직 확인. **단 PRD가 말하는 "MemoryVectorEntry 기반 검색"이 아니라 토큰/키워드 겹침 점수로 관련 기억을 고르는 방식**(`selectRelevantMemoryChunks`)이며, 실제 임베딩 기반 RAG(`src/lib/rag/index.ts`, OpenAI 임베딩+코사인 유사도)는 구현돼 있지만 AI 분신 채팅 화면에 연결되어 있지 않음. 주간 가족 퀴즈/가족 질문 생성 로직(`buildWeeklyFamilyQuizzes` 등)도 실제 메모리 태그 기반으로 동작하지만, 이 로직을 보여주는 화면(`ReviewPage`)이 죽은 코드라 **실제 사용자는 가족 퀴즈를 볼 수 없음**. 알림(`Notification`/푸시)과 캘린더(`CalendarEvent`)는 실제 라이브 화면(`CalendarScreen`)에서 실 API로 연동 확인. |
| 디지털 유산 | 실험적 기능, 법무 검토 전까지 데모 전용 유지 | 구성됨(범위 격리 양호) | `LegacyVault` 백엔드 API는 실재하지만, 이를 노출하는 유일한 화면(`SettingsPage.tsx`)이 죽은 코드라 **일반 사용자 흐름에서는 완전히 도달 불가능** — PRD가 요구하는 "데모 전용 격리"보다 더 엄격하게 격리된 상태. 정책 위반 리스크는 낮음. |
| 권한/데이터 분리 | seniorId/guardianId 기준 소유권 검사, 보호자 간 데이터 접근 차단 | 구성됨 | `docs/route-authorization-matrix.md`에 기록된 5개 라우트(`/api/invitations/:id/rotate`, `/api/family-members`, `GET /api/memories`, `DELETE /api/memories/:id`, `/api/publication-requests`)를 코드와 1:1 대조해 모두 `assertGuardianCanAccessSenior`/`resolveGuardianSeniorId`로 소유권 검사가 걸려 있음을 확인. 이번 세션에서 두 보호자 계정으로 실제 cross-tenant curl 테스트를 시도했으나 샌드박스 서버 프로세스가 반복적으로 죽어 라이브 재현은 완료하지 못함(코드 정적 검증으로 대체). 이전 세션에서 동일 패턴(타인 토큰으로 접근 시 403 "권한이 없습니다")이 1차 시도에서 이미 관찰됨. |

## 사용자에게 보여줄 만큼 완성된 기능

온보딩/초대(가입→딥링크→자동로그인→재발급/폐기), 사진 기반 질문 생성과 Whisper STT 인터뷰 기록, 자서전 챕터 구성부터 A5 PDF 다운로드까지의 파이프라인, AI 분신 채팅의 근거 기반 응답(환각 방지), 캘린더/알림 연동, 그리고 라우트별 소유권 검사는 실제 화면에서 그대로 작동하며 시연에 써도 되는 수준입니다.

## 아직 프로토타입/약속만 있는 기능

기억별 "활용 중지/완전 삭제"와 `MemoryTag` 검수, 주간 가족 퀴즈는 백엔드·로직은 진짜로 동작하지만 그것을 노출하는 화면이 라우터에 연결되지 않아 실사용자에게는 보이지 않습니다. AI 분신의 검색 방식도 PRD가 명시한 벡터 검색이 아니라 키워드 매칭이며, 실물 책 주문 경계에 대한 사용자 안내도 라이브 화면에는 없습니다. 디지털 유산은 PRD 의도보다 더 안전하게(아예 도달 불가) 격리되어 있어 문제는 아니지만, 이 또한 "화면 연결 안 됨"이 원인입니다. 이 모두는 구조적 판단(어느 화면 세트를 정식으로 채택할지)이 필요한 사안이라 코드를 직접 고치지 않고 보고만 합니다.

## 발견 후 직접 수정한 버그

1. **초대 토큰 재사용 차단 누락**: `getInvitationStatus()`가 `usedAt`을 확인하지 않아, 이미 한 번 로그인에 사용된 초대 토큰을 폐기 전까지 무한히 재사용할 수 있었습니다(PRD의 "1회용 처리" 약속과 불일치). `server/app.ts`의 `getInvitationStatus`에 `usedAt` 체크를 추가하고, `/api/auth/token-login`에 `status === 'used'`일 때 410 응답을 추가했습니다. `src/pages/MyPageScreen.tsx`의 `formatInvitationStatus()`에도 'used' 상태 표시를 추가했습니다. 수정 후 동일 토큰으로 2회 로그인 시도 시 1회차는 200, 2회차는 410 + 안내 메시지로 정상 차단됨을 curl로 재확인했습니다.

## 구조적 판단이 필요해 수정하지 않고 보고만 한 사안

- 화면 세트 이원화(`App.tsx` 라이브 라우트 vs `pageLoaders.ts`/`Layout.tsx` 죽은 코드): 어느 쪽을 정식 채택할지, 죽은 코드를 삭제할지 라이브 라우트에 연결할지는 제품/개발 의사결정이 필요합니다.
- `ConsentSettingsScreen`에 "활용 중지/완전 삭제" UI가 없는 것: 데이터 주권 약속을 실제로 지키려면 이 UI를 라이브 화면에 추가해야 하는데, 이는 화면 설계 변경이라 임의로 추가하지 않았습니다.
- AI 분신 검색을 키워드 매칭에서 임베딩 기반 RAG로 교체하는 것: 이미 구현된 `src/lib/rag` 모듈을 어떻게 연결할지는 성능/비용 트레이드오프 판단이 필요해 보고만 합니다.
- 자서전 PDF 다운로드 이후 "실물 주문은 시연 범위 밖"이라는 사용자 안내 문구가 라이브 화면에 없는 것: 문구를 어디에 어떻게 추가할지는 UX 결정이라 보고만 합니다.
