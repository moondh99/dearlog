window.DEARLOG_AGENTS = [
  {
    group: "collect",
    name: "Interviewer",
    title: "부모님 답변 다음 질문을 이어줌",
    description: "부모님이 남긴 답변을 읽고 자연스러운 꼬리질문 1개를 만들어 대화가 끊기지 않게 합니다.",
    files: "src/lib/agents/interviewer.ts, ParentInterviewScreen"
  },
  {
    group: "collect",
    name: "Question Queue",
    title: "자녀 질문을 회상형 질문으로 바꿈",
    description: "자녀가 직접 쓴 질문을 부모님이 편하게 답할 수 있는 경험 중심 질문으로 바꾸고 인터뷰 흐름에 주입합니다.",
    files: "src/lib/agents/questionQueue.ts, family-question-queue.ts"
  },
  {
    group: "collect",
    name: "Photo Agent",
    title: "사진에서 질문 후보를 만듦",
    description: "업로드된 가족 사진을 분석해 사람, 장소, 시대 단서를 찾고 사진 기반 질문 후보를 만듭니다. 자녀가 등록한 후보만 부모님에게 공개됩니다.",
    files: "server/domain/photo-agent.ts, ChildPhotosScreen"
  },
  {
    group: "collect",
    name: "Calendar Trigger",
    title: "일정과 기억을 연결함",
    description: "가족 일정이 다가오면 관련 기억을 찾아 이야기로 전달하거나, 기억이 없으면 새 인터뷰 질문을 제안합니다.",
    files: "calendarTrigger.ts, calendar-trigger.ts, CalendarScreen"
  },
  {
    group: "ground",
    name: "Archivist",
    title: "답변을 기억 카드로 정리",
    description: "답변 원문은 보존하고, clean text, tag, 감정, 신뢰도, chapter hint를 가진 MemoryChunk로 구조화합니다.",
    files: "src/lib/agents/archivist.ts"
  },
  {
    group: "ground",
    name: "Verification",
    title: "충돌, 중복, 불확실성을 표시",
    description: "새 기억과 기존 기억을 비교해 사실 충돌이나 중복 가능성을 표시합니다. 기억 내용을 임의로 고치지 않습니다.",
    files: "src/lib/agents/verification.ts"
  },
  {
    group: "ground",
    name: "Tone Calibrator",
    title: "부모님 말투 패턴을 보존",
    description: "부모님 답변의 문장 길이, 호칭, 감정 톤을 분석해 대화방과 자서전 문장에 반영할 수 있게 합니다.",
    files: "src/lib/agents/tone-calibrator.ts"
  },
  {
    group: "ground",
    name: "Agent Router",
    title: "에이전트 실패에도 흐름을 유지",
    description: "여러 에이전트를 묶어 실행하고, 개별 에이전트가 실패하면 fallback 또는 skip 상태로 저장 흐름을 계속 진행합니다.",
    files: "src/lib/agents/router.ts"
  },
  {
    group: "search",
    name: "RAG Index",
    title: "저장된 기억을 다시 찾게 함",
    description: "기억 chunk를 임베딩해 질문, 일정, 자서전 생성 때 관련 기억을 top-K로 찾습니다.",
    files: "src/lib/rag/index.ts"
  },
  {
    group: "search",
    name: "Graph RAG",
    title: "가족 관계 맥락을 강화",
    description: "인물과 장소 관계를 그래프로 엮어 단순 검색보다 가족 맥락이 있는 답변을 돕습니다.",
    files: "src/lib/rag/graph-rag.ts"
  },
  {
    group: "output",
    name: "Digital Twin",
    title: "기억이 있을 때만 대화함",
    description: "저장된 기억 chunk를 근거로 부모님 말투의 답변을 만들고, 근거가 없으면 지어내지 않고 fallback을 반환합니다.",
    files: "src/lib/agents/digitalTwin.ts, persona.ts, ChatbotScreen"
  },
  {
    group: "output",
    name: "Ghostwriter",
    title: "자서전 챕터 초안을 작성",
    description: "답변 기록을 챕터별 문단으로 엮고 각 문단에 실제 source chunk를 연결합니다.",
    files: "src/lib/agents/ghostwriter.ts, AutobiographyScreen"
  },
  {
    group: "output",
    name: "Cover Agent",
    title: "책 표지 방향을 추천",
    description: "기록 분위기에 맞춰 표지 팔레트, 템플릿, 폰트 추천을 만들어 최종 책 느낌을 잡습니다.",
    files: "server/domain/cover-agent.ts"
  },
  {
    group: "output",
    name: "Publication Agent",
    title: "판매용 기록집 편집 설계",
    description: "강한 장과 약한 장, 사진 배치, 추가 질문, 책 매니페스트를 만들어 검수 가능한 기록집과 최종 PDF를 준비합니다.",
    files: "server/domain/publication-agent.ts, PublicationPreviewScreen"
  },
  {
    group: "guard",
    name: "Safety Guard",
    title: "근거 없는 창작을 막음",
    description: "원문 보존, 출처 ID 강제, 권한/동의 필터, 내부 메타데이터 숨김, fallback 규칙으로 가족이 보는 결과를 통제합니다.",
    files: "Publication, Digital Twin, Ghostwriter 공통 원칙"
  }
];
