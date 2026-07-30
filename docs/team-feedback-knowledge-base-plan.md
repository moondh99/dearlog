# 팀원 피드백: 지식 베이스 활용 계획

작성일: 2026-06-03

## 현재 상태

- RAG/지식 베이스 코드는 이미 존재합니다.
  - 클라이언트 벡터 인덱스: `src/lib/rag/index.ts`
  - 그래프 RAG: `src/lib/rag/graph-rag.ts`
  - 주요 사용처: 디지털 트윈/persona, 캘린더 트리거, 설정 화면의 검색 연결 상태
- 질문 등록 화면과 기록집 편집 기획안에는 아직 직접 연결되어 있지 않습니다.
- 서버 기록집 생성은 현재 `InterviewRecord`, 질문, 사진을 `PublicationSourceRecord`로 묶어 `PublicationEditorialPlan`에 전달합니다.
- 기존 RAG 인덱스는 브라우저 Zustand/localStorage 기반이라 서버 PDF/기록집 생성 단계에서 바로 재사용하기 어렵습니다.

## 이번 피드백 반영 방향

즉시 고친 항목:

- 질문 화면의 명시적 중복 추가 방지는 먼저 적용했습니다.
- 같은 부모님 기록 공간의 기존 질문과 정규화된 문구가 같으면 추천 질문은 `등록됨`으로 잠기고, 직접 질문 저장도 막습니다.

다음 구현 권장 순서:

1. 질문 중복 검사는 현재처럼 비용 없는 로컬/서버 질문 목록 기반으로 유지합니다.
2. 의미상 유사 질문까지 막아야 할 때만 서버 API를 추가합니다.
   - 후보 API 예: `POST /api/questions/similarity-check`
   - 입력: `seniorId`, `questionText`
   - 비교 대상: 같은 senior의 기존 질문, 답변 기록, `MemoryVectorEntry`
   - 출력: `duplicate | related | new`, 유사 항목, 이유
3. 기록집 편집 기획안에는 클라이언트 RAG가 아니라 서버 DB 기반 지식 컨텍스트를 붙입니다.
   - `Memory`, `MemoryTag`, `MemoryVectorEntry`, `InterviewRecord`, `Photo`를 서버에서 모아 `knowledgeContext`를 생성
   - `PublicationEditorialPlan`에는 독자용 문장이 아니라 내부 편집 판단용으로만 전달
   - 독자용 HTML/PDF에는 지식 베이스, 출처, 검증, source id를 노출하지 않습니다.
4. embedding 호출은 비용이 있으므로 파일럿 기본 플로우에서는 자동 호출하지 않습니다.
   - 이미 저장된 `MemoryVectorEntry`가 있을 때 먼저 사용
   - 없으면 exact/keyword overlap으로 fallback
   - 최종 QA나 운영자 요청 때만 새 embedding 생성

## 하지 말아야 할 것

- 질문 추천/등록 클릭마다 OpenAI embedding을 새로 호출하지 않습니다.
- 브라우저 localStorage의 RAG 인덱스를 서버 기록집 생성의 사실 근거로 사용하지 않습니다.
- 지식 베이스 검색 결과를 독자용 기록집 본문에 메타데이터로 노출하지 않습니다.
- 유사하다는 이유만으로 질문을 조용히 버리지 않습니다. 사용자에게 `이미 비슷한 질문이 있어요`처럼 확인 가능한 안내를 보여야 합니다.

## 가장 작은 다음 구현 단위

`POST /api/questions/similarity-check`를 추가해 기존 질문/답변 기록 기준의 비용 없는 유사도 검사를 먼저 제공합니다. 이후 `MemoryVectorEntry`가 충분히 쌓였을 때만 벡터 유사도 점수를 보조 신호로 더하는 방식이 안전합니다.
