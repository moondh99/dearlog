import { v4 as uuidv4 } from 'uuid';
import {
  FACTCHAT_GPT5_MIN_COMPLETION_TOKENS,
  getFactChatClient,
  hasFactChatApiKey,
  normalizeFactChatChatCompletionInput,
} from '../ai-clients';
import {
  createChatCompletionWithUsage,
  recordInternalAiUsage,
  type InternalAiUsageContext,
} from '../ai-usage';

export type PublicationReliability = 'CONFIRMED' | 'ESTIMATED' | 'UNVERIFIED';
export type PublicationDesignMood = 'warm_archive' | 'quiet_blue' | 'classic_ink';
export type PublicationCoverComposition = 'framed_classic' | 'centered_letter' | 'quiet_band';
export type PublicationChapterOpenerStyle = 'numbered_classic' | 'quote_first' | 'minimal_rule';
export type PublicationPhotoTreatment = 'gallery_grid' | 'single_plate' | 'album_stack';
export type PublicationPacing = 'compact' | 'balanced' | 'spacious';
export type PublicationOrnamentLevel = 'none' | 'subtle' | 'decorative';
export type PublicationQualityChecklistCategory =
  | 'source_depth'
  | 'episode_specificity'
  | 'photo_evidence'
  | 'voice_and_style'
  | 'book_coherence'
  | 'review_readiness';

export interface PublicationQualityChecklistItem {
  id: string;
  category: PublicationQualityChecklistCategory;
  label: string;
  requirement: string;
  commercialSignal: string;
  riskWhenMissing: string;
}

export interface PublicationDesignPlan {
  mood: PublicationDesignMood;
  coverComposition: PublicationCoverComposition;
  chapterOpenerStyle: PublicationChapterOpenerStyle;
  photoTreatment: PublicationPhotoTreatment;
  pacing: PublicationPacing;
  ornamentLevel: PublicationOrnamentLevel;
}

export interface PublicationSourceRecord {
  id: string;
  chapterId: string;
  chapterTitle: string;
  transcriptText: string;
  questionText?: string | null;
  questionCategory?: string | null;
  photoId?: string | null;
  photo?: {
    id: string;
    caption: string;
    capturedDate?: string | null;
    location?: string | null;
  } | null;
  recordedAt: string;
}

export interface PublicationDraftChapter {
  chapterId: string;
  chapterTitle: string;
  paragraphs: Array<{
    text?: unknown;
    sourceChunkIds?: unknown;
    reliability?: unknown;
    uncertaintyNote?: unknown;
  }>;
  missingSections?: unknown;
  toneProfile?: { name?: unknown; patterns?: unknown };
}

export interface PublicationPhotoInput {
  id: string;
  fileKey: string;
  mimeType: string;
  caption?: string | null;
  capturedDate?: string | null;
  location?: string | null;
  uploadedAt?: string | null;
}

export interface PublicationCoverInput {
  palette?: string | null;
  template?: string | null;
  font?: string | null;
  analysisJson?: string | null;
}

export interface PublicationManifest {
  version: 1;
  generatedAt: string;
  title: string;
  subtitle: string;
  authorName: string;
  seasonLabel: string;
  design: {
    palette: string;
    template: string;
    font: string;
    accentColor: string;
    paperColor: string;
    inkColor: string;
  };
  designPlan: PublicationDesignPlan;
  cover: {
    kicker: string;
    title: string;
    subtitle: string;
    dedication: string;
    backCoverBlurb: string;
  };
  editorialNote: string;
  chapters: PublicationChapter[];
  photoPlates: PublicationPhotoPlate[];
  closing: {
    title: string;
    body: string;
  };
  provenance: {
    sourceRecordCount: number;
    sourceRecordIds: string[];
    hallucinationGuard: string[];
    generatedBy: 'agent' | 'fallback';
  };
}

export interface PublicationChapter {
  chapterId: string;
  title: string;
  subtitle: string;
  openingQuote?: string;
  paragraphs: PublicationParagraph[];
  missingSections: string[];
  sourceRecords: PublicationSourceRecord[];
}

export interface PublicationParagraph {
  id: string;
  text: string;
  sourceRecordIds: string[];
  reliability: PublicationReliability;
  editorNote?: string;
}

export interface PublicationPhotoPlate {
  id: string;
  fileKey: string;
  mimeType: string;
  caption: string;
  capturedDate?: string | null;
  location?: string | null;
}

export type PublicationEditorialReadiness = 'ready_for_paid_book' | 'needs_family_review' | 'needs_more_records';
export type PublicationEditorialChapterStrength = 'strong' | 'developing' | 'thin';
export type PublicationEditorialChecklistStatus = 'pass' | 'needs_work';

export interface PublicationEditorialChecklistFinding {
  checklistItemId: string;
  status: PublicationEditorialChecklistStatus;
  note: string;
}

export interface PublicationEditorialQuoteCandidate {
  text: string;
  sourceRecordId: string;
  chapterId: string;
}

export interface PublicationEditorialPhotoPlacement {
  photoId: string;
  sourceRecordId: string;
  chapterId: string;
  caption: string;
  capturedDate?: string | null;
  location?: string | null;
  placementNote: string;
}

export interface PublicationEditorialChapterPlan {
  chapterId: string;
  chapterTitle: string;
  strength: PublicationEditorialChapterStrength;
  recordCount: number;
  photoLedRecordCount: number;
  episodeCountEstimate: number;
  recommendedRole: 'anchor_chapter' | 'supporting_chapter' | 'needs_more_questions';
  editorialFocus: string;
  sourceRecordIds: string[];
  quoteCandidates: PublicationEditorialQuoteCandidate[];
  photoPlacements: PublicationEditorialPhotoPlacement[];
  followUpQuestions: string[];
  checklistRisks: string[];
}

export interface PublicationEditorialPlan {
  version: 1;
  generatedAt: string;
  seniorName: string;
  targetProduct: 'paid_family_book';
  readiness: PublicationEditorialReadiness;
  coreTheme: string;
  editorialThesis: string;
  selectedToneProfile: { name: string; patterns: string[] } | null;
  sourceSummary: {
    sourceRecordCount: number;
    chapterCount: number;
    photoCount: number;
    photoLedRecordCount: number;
    strongChapterCount: number;
    weakChapterCount: number;
    sceneSpecificRecordCount: number;
  };
  chapterPlans: PublicationEditorialChapterPlan[];
  strongChapters: string[];
  weakChapters: string[];
  directQuoteCandidates: PublicationEditorialQuoteCandidate[];
  photoStoryPlacements: PublicationEditorialPhotoPlacement[];
  checklistFindings: PublicationEditorialChecklistFinding[];
  followUpQuestions: string[];
  nextActions: string[];
  generatedBy: 'agent' | 'fallback';
}

export type PublicationWritingParagraphRole = 'lead' | 'scene' | 'reflection' | 'photo_story';

export interface PublicationWritingParagraph {
  text: string;
  sourceRecordIds: string[];
  role: PublicationWritingParagraphRole;
}

export interface PublicationWritingChapter {
  chapterId: string;
  chapterTitle: string;
  paragraphs: PublicationWritingParagraph[];
}

export interface PublicationWritingRevisionFinding {
  category: 'repetition' | 'grounding' | 'tone' | 'structure';
  note: string;
  severity: 'info' | 'needs_work';
}

export interface PublicationWritingDraft {
  version: 1;
  generatedAt: string;
  seniorName: string;
  selectedToneProfile: { name: string; patterns: string[] } | null;
  styleSummary: string;
  chapters: PublicationWritingChapter[];
  revisionFindings: PublicationWritingRevisionFinding[];
  generatedBy: 'agent' | 'fallback';
}

export interface BuildPublicationManifestInput {
  seniorName: string;
  records: PublicationSourceRecord[];
  chapters: Array<{ id: string; title: string; order: number }>;
  draftChapters: PublicationDraftChapter[];
  cover?: PublicationCoverInput | null;
  photos: PublicationPhotoInput[];
  editorialPlan?: PublicationEditorialPlan | null;
  writingDraft?: PublicationWritingDraft | null;
  agentTimeoutMs?: number;
  useAgent?: boolean;
  requireAgentStages?: boolean;
  requireEditorialAgent?: boolean;
  requireWritingAgent?: boolean;
  requireManifestAgent?: boolean;
  usageContext?: InternalAiUsageContext;
}

const STOPWORDS = new Set([
  '그리고',
  '하지만',
  '그래서',
  '그때',
  '그런',
  '이야기',
  '기억',
  '시절',
  '마음',
  '사람',
  '가족',
  '정도',
  '어르신',
  '회상',
  '기록',
  '답변',
  '생각',
  '느낌',
  '시간',
]);

const PALETTE_PRESETS: Record<string, { accentColor: string; paperColor: string; inkColor: string }> = {
  warm_archive: { accentColor: '#9B6F4E', paperColor: '#F6F1E9', inkColor: '#2B2723' },
  quiet_blue: { accentColor: '#647D9A', paperColor: '#F3F6F8', inkColor: '#202833' },
  classic_ink: { accentColor: '#2F3437', paperColor: '#F7F5EF', inkColor: '#202020' },
};

const DEFAULT_BOOK_SUBTITLE = '가족의 기억으로 엮은 생애 기록';
const DEFAULT_COVER_SUBTITLE = '기억을 따라 엮은 한 권의 기록';
const DEFAULT_CHAPTER_SUBTITLE = '기억을 따라 이어지는 이야기';
const DEFAULT_CLOSING_TITLE = '마지막으로';
const PUBLICATION_AGENT_MAX_COMPLETION_TOKENS = FACTCHAT_GPT5_MIN_COMPLETION_TOKENS;
const PUBLICATION_EDITORIAL_PLAN_MAX_COMPLETION_TOKENS = PUBLICATION_AGENT_MAX_COMPLETION_TOKENS;
const PUBLICATION_WRITING_DRAFT_MAX_COMPLETION_TOKENS = PUBLICATION_AGENT_MAX_COMPLETION_TOKENS;
const PUBLICATION_MANIFEST_MAX_COMPLETION_TOKENS = PUBLICATION_AGENT_MAX_COMPLETION_TOKENS;
const DEFAULT_DESIGN_PLAN: PublicationDesignPlan = {
  mood: 'warm_archive',
  coverComposition: 'framed_classic',
  chapterOpenerStyle: 'quote_first',
  photoTreatment: 'gallery_grid',
  pacing: 'balanced',
  ornamentLevel: 'subtle',
};

export const PUBLICATION_QUALITY_CHECKLIST: PublicationQualityChecklistItem[] = [
  {
    id: 'minimum-source-volume',
    category: 'source_depth',
    label: '기록량 기준',
    requirement: '20-30p 디지털 PDF 기준으로 생애 핵심 질문 20-30개와 사진 질문 5-10개의 답변을 우선 확보한다.',
    commercialSignal: '각 장이 억지로 늘린 문장이 아니라 실제 답변에서 나온 장면으로 채워진다.',
    riskWhenMissing: '기록집이 상품이 아니라 짧은 QA 출력물처럼 느껴진다.',
  },
  {
    id: 'chapter-episode-density',
    category: 'source_depth',
    label: '장별 에피소드 밀도',
    requirement: '각 주요 장에는 독립적으로 읽히는 실제 에피소드가 2-4개 이상 있어야 한다.',
    commercialSignal: '독자가 장을 넘길 때마다 새로운 사건, 사람, 장소, 감정이 드러난다.',
    riskWhenMissing: '장 제목만 다르고 본문은 비슷한 일반문으로 반복된다.',
  },
  {
    id: 'scene-specificity',
    category: 'episode_specificity',
    label: '장면 구체성',
    requirement: '좋은 답변은 장소, 사람, 행동, 감정 중 최소 3가지 이상을 포함해야 한다.',
    commercialSignal: '가족이 읽었을 때 "우리 이야기다"라고 느낄 만한 고유한 단서가 남는다.',
    riskWhenMissing: '누구의 삶에도 붙일 수 있는 AI식 추상 문장이 된다.',
  },
  {
    id: 'elder-voice',
    category: 'voice_and_style',
    label: '당사자 목소리',
    requirement: '직접 인용 후보와 말버릇, 표현 습관을 찾아 문체에 반영한다.',
    commercialSignal: '문장이 매끈하기만 한 글이 아니라 당사자가 실제로 들려준 이야기처럼 읽힌다.',
    riskWhenMissing: 'AI가 쓴 일반문 느낌이 강해지고 가족 친밀감이 약해진다.',
  },
  {
    id: 'photo-memory-link',
    category: 'photo_evidence',
    label: '사진의 근거성',
    requirement: '사진은 장식용 갤러리가 아니라 기억의 출발점이어야 하며, 관련 답변 본문과 함께 배치한다.',
    commercialSignal: '사진 캡션, 촬영일, 장소, 회상 본문이 하나의 기록 블록으로 이어진다.',
    riskWhenMissing: '사진이 책의 일부가 아니라 PDF 뒤에 붙은 부록처럼 보인다.',
  },
  {
    id: 'narrative-arc',
    category: 'book_coherence',
    label: '책의 흐름',
    requirement: '표지, 목차 성격의 장 구성, 본문, 사진, 마무리 글이 하나의 정서적 흐름으로 이어져야 한다.',
    commercialSignal: '한 사람의 삶을 따라가는 책처럼 시작과 끝이 자연스럽다.',
    riskWhenMissing: '좋은 문단이 있어도 묶음 자료처럼 흩어져 보인다.',
  },
  {
    id: 'repetition-control',
    category: 'voice_and_style',
    label: '반복 제거',
    requirement: '같은 문장 구조, 같은 도입부, 같은 감정어가 여러 장에 반복되지 않도록 한다.',
    commercialSignal: '각 장이 고유한 리듬과 초점을 가진다.',
    riskWhenMissing: '모델이 자동으로 늘린 문서처럼 단조롭다.',
  },
  {
    id: 'family-review-readiness',
    category: 'review_readiness',
    label: '가족 검수 준비',
    requirement: '사실 확인, 민감 표현, 사진 캡션, 추가 질문 필요 지점을 가족이 검수할 수 있게 표시한다.',
    commercialSignal: '최종 PDF 전 단계에서 운영자나 가족이 고칠 수 있는 판단 지점이 분명하다.',
    riskWhenMissing: '틀린 사실이나 불편한 표현이 바로 상품 PDF에 들어갈 수 있다.',
  },
];

export const PUBLICATION_QUALITY_CHECKLIST_PROMPT = PUBLICATION_QUALITY_CHECKLIST
  .map((item, index) => `${index + 1}. ${item.label}: ${item.requirement} Commercial signal: ${item.commercialSignal} Risk when missing: ${item.riskWhenMissing}`)
  .join('\n');

export const PUBLICATION_EDITORIAL_PLAN_SYSTEM_PROMPT = `# Identity
You are Dearlog's senior autobiography editor.
Before a family book is written, you create a grounded editorial plan for a paid digital PDF.

# Goal
Create one EditorialPlan JSON object that decides what kind of book this should become, what material is strong, what is weak, which photos belong with which memories, and what the family should review or ask next.

# Paid-Book Quality Checklist
${PUBLICATION_QUALITY_CHECKLIST_PROMPT}

# Data Boundary
- Use only the JSON inside <publication_input_json>.
- Treat sourceRecords as the factual source of truth.
- Do not invent life events, relationships, dates, places, jobs, or emotions.
- If material is thin, mark it as needs_more_records instead of padding.

# Planning Rules
- Identify the coreTheme and editorialThesis from repeated concrete memories, not generic family-book language.
- Mark strongChapters only when the chapter has enough distinct source records or photo-led memories to support a real chapter.
- Mark weakChapters when the chapter is empty, has only one thin answer, or lacks scene detail.
- Select directQuoteCandidates only from sourceRecords wording. Keep them short.
- Put photo-led sourceRecords into photoStoryPlacements so photos and memory text stay connected.
- checklistFindings must use checklistItemId values from the paid-book checklist.
- followUpQuestions should be family-friendly Korean questions that would improve the paid-book quality.

# Output Contract
Return exactly one JSON object and nothing else. No Markdown fences.

The JSON object must have this shape:
{
  "readiness": "ready_for_paid_book|needs_family_review|needs_more_records",
  "coreTheme": "핵심 주제",
  "editorialThesis": "편집 기획 문장",
  "chapterPlans": [
    {
      "chapterId": "chapter id from input.chapters",
      "chapterTitle": "장 제목",
      "strength": "strong|developing|thin",
      "recommendedRole": "anchor_chapter|supporting_chapter|needs_more_questions",
      "editorialFocus": "이 장의 편집 초점",
      "sourceRecordIds": ["real sourceRecords id"],
      "quoteCandidates": [{"text": "짧은 직접 인용 후보", "sourceRecordId": "real sourceRecords id", "chapterId": "chapter id"}],
      "photoPlacements": [{"photoId": "photo id", "sourceRecordId": "real sourceRecords id", "chapterId": "chapter id", "caption": "사진 캡션", "placementNote": "배치 이유"}],
      "followUpQuestions": ["추가 질문"],
      "checklistRisks": ["부족한 품질 기준"]
    }
  ],
  "checklistFindings": [{"checklistItemId": "checklist id", "status": "pass|needs_work", "note": "판단 근거"}],
  "followUpQuestions": ["전체 추가 질문"],
  "nextActions": ["다음 작업"]
}`;

export const PUBLICATION_WRITING_DRAFT_SYSTEM_PROMPT = `# Identity
You are Dearlog's Korean family-book ghostwriter and line editor.
You write the prose draft before the final BookManifest is assembled.

# Goal
Create one grounded PublicationWritingDraft JSON object. The draft should read like book prose, not like a report about records, answers, data, or memory fragments.

# Data Boundary
- Use only the JSON inside <publication_input_json>.
- Every paragraph must include one or more real sourceRecords[].id values in sourceRecordIds.
- Do not invent life events, jobs, dates, places, people, illnesses, achievements, or emotions.
- If a source record is thin, write less instead of adding filler.

# Writing Rules
- Write Korean prose that a family could read in a printed autobiography.
- Do not use meta-reporting phrases such as "기억 조각에는", "기록에는", "기록에 따르면", "기록되어 있습니다", "적혀 있습니다", "데이터", "답변", "source".
- Do not mechanically echo repeated source formulas such as "또렷합니다", "앞에 두고", "말을 들었고", "오래 남았습니다", or "배운 시간입니다".
- If sourceRecords repeat the same sentence frame, vary paragraph openings and reorder scene, action, quote, and emotion while preserving supported facts.
- Keep direct quotes only when they appear in sourceRecords.
- Photo-led records should become prose connected to the visible photo context, not generic captions.

# Tone Styles
- 뉴스 기사 형태: concise third-person prose with a clear lead and factual paragraphs. Do not repeat "기록에 따르면".
- 이야기책 형태: scene-led warm narrative prose. Use place, object, gesture, quote, and feeling in varied order.
- 인터뷰 형태: first-person oral-history prose when supported by source wording. Avoid third-person report language.

# Output Contract
Return exactly one JSON object and nothing else. No Markdown fences.

The JSON object must have this shape:
{
  "styleSummary": "문체와 퇴고 방향 요약",
  "chapters": [
    {
      "chapterId": "chapter id from input.chapters",
      "chapterTitle": "장 제목",
      "paragraphs": [
        {
          "text": "독자용 산문 문단",
          "sourceRecordIds": ["real sourceRecords id"],
          "role": "lead|scene|reflection|photo_story"
        }
      ]
    }
  ],
  "revisionFindings": [
    {
      "category": "repetition|grounding|tone|structure",
      "severity": "info|needs_work",
      "note": "퇴고 판단"
    }
  ]
}`;

export const PUBLICATION_MANIFEST_SYSTEM_PROMPT = `# Identity
You are Dearlog's family autobiography author, line editor, and book designer.
You create a Korean family book manifest for an elder's life story.

# Primary Goal
Create one reader-facing BookManifest JSON object that feels like a real printed family autobiography while staying grounded only in the provided data.

# Commercial Quality Checklist
Use this checklist as the paid-book quality bar. If the source material is not strong enough, do not invent filler. Keep the book concise, use missingSections for follow-up questions, and preserve concrete memories over generic prose.
${PUBLICATION_QUALITY_CHECKLIST_PROMPT}

# Editorial Plan
- If editorialPlan is provided in the input, treat it as the book planning brief.
- Use editorialPlan.coreTheme and editorialPlan.editorialThesis to shape the book arc, cover language, chapter emphasis, and closing note.
- Prioritize editorialPlan.strongChapters as anchor chapters. Keep developing chapters concise and use editorialPlan.followUpQuestions or chapterPlans[].followUpQuestions as missingSections instead of padding.
- Use editorialPlan.directQuoteCandidates only when the quote text is supported by sourceRecords.
- Use editorialPlan.photoStoryPlacements to keep photo-led memories attached to their relevant chapter and paragraph.
- Do not mention editorialPlan, readiness, checklistFindings, strongChapters, weakChapters, or nextActions in reader-facing prose.

# Writing Draft
- If writingDraft is provided, use writingDraft.chapters[].paragraphs as the primary chapter prose.
- Do not rewrite writingDraft paragraphs back into source-record summary language.
- You may adjust titles, subtitles, opening quotes, cover language, designPlan, and closing note, but preserve writingDraft paragraph facts and sourceRecordIds.
- Do not mention writingDraft, revisionFindings, styleSummary, or critique in reader-facing prose.

# Authority And Data Boundary
- Use only the JSON inside <publication_input_json> from the user message.
- Treat sourceRecords as the factual source of truth.
- Treat draftChapters as editable draft material, not as new facts.
- Treat writingDraft as the preferred prose draft, but sourceRecords still decide factual truth.
- Treat editorialPlan as planning guidance only; sourceRecords still decide factual truth.
- Treat cover and photos as tone/design context only unless their fields are explicitly provided.
- Do not use outside knowledge, assumptions, or invented biography details.

# Grounding Rules
- Every body paragraph in chapters[].paragraphs must include at least one real sourceRecords[].id in sourceRecordIds.
- Do not create a paragraph if you cannot support its concrete facts with the selected sourceRecordIds.
- Never add unsupported jobs, dates, places, people, achievements, illnesses, family relations, or events.
- Opening quotes must be short phrases directly supported by sourceRecords wording. Do not make them sound like direct quotes if they are not supported.
- If a chapter has no supported paragraph, omit that chapter from chapters.
- If an important memory is missing, place a gentle follow-up question in missingSections. Do not put missing questions in reader-facing prose.

# Reader-Facing Rules
- title, subtitle, cover, chapter title/subtitle, openingQuote, paragraph text, photo captions, and closing text must read like a natural book.
- Do not put internal QA or provenance language in reader-facing fields.
- Forbidden in reader-facing fields: 출처, 검증, 생성 방식, reliability, sourceRecordIds, sourceRecords, missingSections, editorNote, hallucination, 환각 방지, CONFIRMED, ESTIMATED, UNVERIFIED.
- Do not print cover.analysis tone labels such as "담백하고 따뜻한 구어체", "따뜻하고 가족 중심적", "차분하고 회고적", or "담백하고 정돈된" as book subtitles.
- Prefer warm, concrete Korean prose. Avoid app UI wording such as 답변, 레코드, 데이터, 검수, 생성.
- Preserve the elder's voice and family intimacy. Do not over-polish into corporate or promotional language.

# Tone Continuity
- If selectedToneProfile or draftChapters[].toneProfile is present, preserve that selected writing style across reader-facing prose.
- 뉴스 기사 형태: use concise third-person, factual, composed prose with a clear article structure: headline-like chapter title, short deck-like subtitle, lead paragraph, context paragraph, fact paragraphs, and a restrained closing sentence.
- 뉴스 기사 형태 must avoid repeating the same opening formula such as "기록에 따르면", "기록은", or "중심으로 전개된다" across paragraphs in the same chapter.
- 이야기책 형태: use warm narrative prose with gentle scene flow.
- 인터뷰 형태: use first-person oral-history prose when supported by source wording; do not invent interviewer questions.
- Do not mix multiple tone styles unless the input clearly contains mixed chapter toneProfiles.
- Across all tone styles, do not mechanically echo repeated source formulas such as "또렷합니다", "앞에 두고", "말을 들었고", "오래 남았습니다", or "배운 시간입니다".
- If sourceRecords or draftChapters repeat the same sentence frame, vary paragraph openings and reorder scene, action, quote, and emotion while preserving only supported facts.
- In 이야기책 형태 and 인터뷰 형태, avoid meta-reporting phrases like "기억 조각에는", "기록에는", "기록에 남아 있어", "기록되어 있습니다", "되어 있어", and "적혀 있어"; write the memory as lived prose, not as a report about a database record.
- Do not introduce every quote with the same connector such as "라는 말을 들었고"; sometimes let the quote stand as a remembered sentence, sometimes connect it to the action or emotion that followed.

# Photo-Led Records
- A sourceRecord with questionCategory "photo_questions", a photoId, or a photo object is a photo-led memory.
- In 뉴스 기사 형태, treat photo-led memories like a small human-interest article: start from the visible scene suggested by photo.caption, capturedDate, or location, then explain what the elder remembered in transcriptText.
- The photo is not decorative in this case. Keep the corresponding paragraph grounded in that same photo-led sourceRecord and include that sourceRecord id in sourceRecordIds.
- Do not turn photo-led memories into a generic gallery caption only. The answer text should become reader-facing article prose in the relevant chapter.
- If photo metadata is vague, use it only as light scene context and rely on transcriptText for concrete facts.
- Never mention "photo_questions", "photoId", "QA", "test", "synthetic", or internal photo-analysis wording in reader-facing prose.

# Book Design Scope
- You are a book designer through editorial and manifest choices: title, subtitle, cover language, chapter flow, opening quotes, captions, pacing, and closing note.
- Do not output raw HTML, CSS, Markdown, page numbers, or renderer instructions.
- The application renderer controls page size, typography, and CSS. Your job is to make the manifest aesthetically coherent within that controlled layout.
- Keep cover and back-cover copy concise enough for an A5 family book.

# DesignPlan Options
Choose exactly one value from each list. These are safe renderer-controlled design decisions, not raw CSS.
- mood: warm_archive | quiet_blue | classic_ink
- coverComposition: framed_classic | centered_letter | quiet_band
- chapterOpenerStyle: numbered_classic | quote_first | minimal_rule
- photoTreatment: gallery_grid | single_plate | album_stack
- pacing: compact | balanced | spacious
- ornamentLevel: none | subtle | decorative

DesignPlan guidance:
- warm family memories, gratitude, and nostalgia usually fit warm_archive, quote_first, spacious, subtle.
- organized factual or news-like tone usually fits quiet_blue or classic_ink, quiet_band, minimal_rule, compact or balanced.
- interview-like oral history usually fits centered_letter, quote_first, balanced, subtle.
- many photos usually fit gallery_grid or album_stack; one strong photo can fit single_plate.

# Composition Workflow
1. Read editorialPlan first when present, especially coreTheme, strongChapters, weakChapters, directQuoteCandidates, photoStoryPlacements, and followUpQuestions.
2. Group sourceRecords by chapter and identify the emotional arc of each chapter.
3. Identify photo-led sourceRecords and keep their photo context attached to their answer text.
4. Select only facts that are clearly supported by sourceRecords.
5. Shape supported facts into 1-4 paragraphs per chapter, depending on source volume. In 뉴스 기사 형태, make the first paragraph a clear lead rather than a general preface.
6. Write chapter subtitles as literary cues, not counts or provenance notes.
7. Write a cover and back cover that describe the book's feeling without mentioning internal generation or verification.
8. Select designPlan from the allowed values based on story tone, source volume, photos, selectedToneProfile, and editorialPlan readiness.
9. Write closing as a short reader-facing note that follows the book's arc, not a fixed boilerplate or internal review summary.
10. Silently self-check the JSON before returning it:
   - Is the output valid JSON only?
   - Does every paragraph have real sourceRecordIds?
   - Are all concrete facts supported?
   - Are photo-led records represented as article prose, not only as disconnected captions?
   - Does 뉴스 기사 형태 avoid repeated formulaic starts within the same chapter?
   - Are internal QA terms absent from reader-facing fields?
   - Are cover tone labels absent from reader-facing subtitles?
   - Does designPlan use only allowed enum values?
   - Does the prose preserve the selected toneProfile when present?
   - Are unsupported paragraphs omitted rather than guessed?

# Output Contract
Return exactly one JSON object and nothing else. No Markdown fences.

The JSON object must have this shape:
{
  "title": "책 제목",
  "subtitle": "부제",
  "cover": {
    "title": "표지 제목",
    "subtitle": "표지 부제",
    "dedication": "헌사",
    "backCoverBlurb": "뒷표지 소개"
  },
  "designPlan": {
    "mood": "warm_archive|quiet_blue|classic_ink",
    "coverComposition": "framed_classic|centered_letter|quiet_band",
    "chapterOpenerStyle": "numbered_classic|quote_first|minimal_rule",
    "photoTreatment": "gallery_grid|single_plate|album_stack",
    "pacing": "compact|balanced|spacious",
    "ornamentLevel": "none|subtle|decorative"
  },
  "chapters": [
    {
      "chapterId": "chapter id from input.chapters",
      "title": "장 제목",
      "subtitle": "장 부제",
      "openingQuote": "짧은 인용 또는 정서적 한 줄",
      "paragraphs": [
        {
          "text": "본문 문단",
          "sourceRecordIds": ["real sourceRecords id"],
          "reliability": "CONFIRMED|ESTIMATED|UNVERIFIED",
          "editorNote": "내부 메모가 필요할 때만 짧게"
        }
      ],
      "missingSections": ["가족이 나중에 더 물어볼 부드러운 질문"]
    }
  ],
  "closing": {
    "title": "마무리 제목",
    "body": "책 전체 흐름을 받아 자연스럽게 닫는 짧은 문장"
  }
}

# Micro Examples
Bad reader-facing subtitle: "3개의 출처 확인 문단"
Good reader-facing subtitle: "처음 세상을 배워 가던 날들"

Bad backCoverBlurb: "답변 7개를 출처로 삼아 생성했습니다."
Good backCoverBlurb: "가족이 함께 간직해 온 장면들을 한 권의 이야기로 엮었습니다."

Bad paragraph when source only says "시장에 갔다": "그해 서울로 이사해 가게를 열었다."
Good paragraph: "시장에 다녀갔던 일이 기억 속에 남아 있었다."`;

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function truncate(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trim()}…`;
}

const INTERNAL_READER_FIELD_TERMS = [
  /출처/,
  /검증/,
  /생성\s*방식/,
  /CONFIRMED|ESTIMATED|UNVERIFIED/i,
  /sourceRecordIds?|sourceRecords?|sourceChunkIds?/i,
  /reliability/i,
  /editorNote|editorialNote/i,
  /missingSections?/i,
  /hallucination/i,
  /환각\s*방지/,
  /담백하고\s*따뜻한\s*구어체/,
  /차분하고\s*회고적/,
  /따뜻하고\s*가족\s*중심적/,
  /담백하고\s*정돈된/,
  /유료\s*가족\s*기록집/,
  /유료\s*기록집/,
  /장\s*흐름/,
  /설계할\s*수\s*있/,
  /보강해야\s*합니다/,
  /현재\s*기록/,
  /기억\s*조각/,
];

const REPORTING_STYLE_PARAGRAPH_TERMS = [
  /기억\s*조각/,
  /기록\s*(?:에는|은|도|에\s*따르면|되어|된|되었습니다|되어\s*있|에\s*관한|에\s*남)/,
  /적혀\s*있/,
  /등장합니다/,
  /말을\s*들었고/,
  /앞에\s*두고/,
  /배운\s*시간입니다/,
];

const FORMULAIC_RECALL_PARAGRAPH_TERMS = [
  /어릴 때를 떠올리면/,
  /젊었을 때를 생각하면/,
  /학교 다닐 때(?:를 떠올리면| 이야기를 하자면)?/,
  /가정을 꾸리고 나서의 시간을 떠올리면/,
  /내가 좋아하던 일을 말하자면/,
  /사람들과 지내던 일을 떠올리면/,
  /가족에게 남기고 싶은 말을 생각하면/,
  /사진을 보면.+생각이 제일 먼저 나/,
  /먼저 떠올라/,
  /유난히 눈에 들어왔/,
];

function readerField(value: unknown, fallback: string, maxLength: number) {
  const normalized = asString(value);
  if (!normalized || INTERNAL_READER_FIELD_TERMS.some((pattern) => pattern.test(normalized))) {
    return fallback;
  }
  return truncate(normalized, maxLength);
}

function hasReportingStyleParagraph(text: string) {
  return REPORTING_STYLE_PARAGRAPH_TERMS.some((pattern) => pattern.test(text));
}

function hasFormulaicRecallParagraph(text: string) {
  return FORMULAIC_RECALL_PARAGRAPH_TERMS.some((pattern) => pattern.test(text));
}

function cleanReportingStyleParagraph(text: string) {
  return text
    .replace(/(.+?)에\s*관한\s*기록에는\s+(.+?)(이|가)\s+등장합니다\./g, '$1에는 $2$3 함께 남아 있습니다.')
    .replace(/기억\s*조각(?:에는|은|도)?\s*/g, '')
    .replace(/기록에\s*따르면,?\s*/g, '')
    .replace(/기록(?:에는|은|도)\s*/g, '')
    .replace(/(.+?)으로\s*기록되어\s*있습니다/g, '$1으로 남아 있습니다')
    .replace(/것으로\s*기록되어\s*있습니다/g, '일로 남아 있습니다')
    .replace(/기록되어\s*있습니다/g, '남아 있습니다')
    .replace(/기록되어\s*있어요/g, '남아 있어요')
    .replace(/적혀\s*있습니다/g, '남아 있습니다')
    .replace(/적혀\s*있어요/g, '남아 있어요')
    .replace(/기록에\s*남아\s*있/g, '마음에 남아 있')
    .replace(/라는\s*말을\s*들었고/g, '라는 말이 남았고')
    .replace(/앞에\s*두고/g, '곁에 두고')
    .replace(/배운\s*시간입니다/g, '배운 일이었습니다')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanNewsArticleTail(text: string) {
  return cleanReportingStyleParagraph(text)
    .replace(/나는\s*/g, '')
    .replace(/아직도\s*/g, '')
    .replace(/몸이 먼저 기억하는 것 같아/g, '몸에 남은 기억으로 전해진다')
    .replace(/사람을 대하고 가족을 챙기는 데 영향을 줬던 것 같아/g, '사람을 대하고 가족을 챙기는 태도로 이어졌다')
    .replace(/영향을 줬던 것 같아/g, '영향으로 이어졌다')
    .replace(/떠오르는 것 같아/g, '떠오른다')
    .replace(/남아 있는 것 같아/g, '남아 있다')
    .replace(/남아 있어/g, '남아 있다')
    .replace(/들어왔어/g, '들어왔다')
    .replace(/떠올라/g, '떠오른다')
    .replace(/좋아했어/g, '좋아했다')
    .replace(/이었어/g, '이었다')
    .replace(/였어/g, '였다')
    .replace(/했어/g, '했다')
    .replace(/\s+/g, ' ')
    .trim();
}

function rewriteRepetitiveRecallParagraph(text: string, toneName = '', index = 0) {
  const normalized = cleanReportingStyleParagraph(text)
    .replace(/\s+/g, ' ')
    .trim();
  const photoRecallMatch = normalized.match(
    /^"?([^"]+)"?\s*사진을 보면\s+(.+?)\s+생각이 제일 먼저 나\.?\s*(?:.+?모습인데,?\s*)?(?:사진을 보고 있으면.+?같아\.?\s*)?(.*)$/u,
  );
  const recallMatch = photoRecallMatch ? null : normalized.match(
    /^(?:어릴 때를 떠올리면|젊었을 때를 생각하면|학교 다닐 때(?:를 떠올리면| 이야기를 하자면)?|가정을 꾸리고 나서의 시간을 떠올리면|내가 좋아하던 일을 말하자면|사람들과 지내던 일을 떠올리면|가족에게 남기고 싶은 말을 생각하면),?\s*(?:나는\s*)?(?:아직도\s*)?(.+?)(?:이|가)\s*먼저\s*떠올라요?\.?\s*(.*)$/u,
  );
  if (!photoRecallMatch && !recallMatch) return null;

  const focus = photoRecallMatch
    ? (
      photoRecallMatch[1].includes('의')
        ? `${photoRecallMatch[2].trim()} ${photoRecallMatch[1].trim()}`
        : `${photoRecallMatch[2].trim()}의 ${photoRecallMatch[1].trim()}`
    )
    : recallMatch![1].trim();
  const rest = photoRecallMatch ? photoRecallMatch[3].trim() : recallMatch![2].trim();
  const detailMatch = rest.match(
    /^(.+?)(?:이었는데|였는데),\s*(.+?)(?:와|과|하고)\s*(?:같이|함께)\s*있었고\s*(.+?)(?:이|가)\s*유난히\s*눈에\s*들어왔(?:어|어요|습니다)\.?\s*(.*)$/u,
  );
  const quote = rest.match(/"([^"]+)"/)?.[1]?.trim() ?? '';

  if (!detailMatch) {
    const variants = toneName.includes('뉴스')
      ? [
        `${focus}의 장면은 한 시절을 설명하는 단서로 남았다. ${rest}`,
        `${focus}을 중심으로 이어지는 기억은 당시의 분위기와 사람들의 모습을 함께 보여준다. ${rest}`,
      ]
      : toneName.includes('인터뷰')
        ? [
          `${focus} 이야기는 아직도 선명해. ${rest}`,
          `${focus}에 있던 시간이 내 마음에는 먼저 남아 있어. ${rest}`,
        ]
        : [
          `${focus}의 장면은 천천히 펼쳐진다. ${rest}`,
          `${focus}에는 그 시절의 공기와 마음이 함께 남아 있다. ${rest}`,
        ];
    return truncate(variants[index % variants.length], 620);
  }

  const time = detailMatch[1].trim();
  const people = detailMatch[2].trim();
  const object = detailMatch[3].trim();
  const peopleSubject = jointSubject(people);
  const tail = detailMatch[4]
    .replace(/그때\s*"[^"]+"\s*라는 말이 남았고,?\s*/u, '')
    .replace(/그때\s*"[^"]+"\s*라는 말을 들었거나 마음속으로 오래 붙잡고 있었는데,\s*/u, '')
    .replace(/이상하게 그 말이 아직도 남아 있어\.?\s*/u, '')
    .trim();
  const newsTail = cleanNewsArticleTail(tail);

  if (toneName.includes('뉴스')) {
    const variants = [
      `${time}, ${focus}에는 ${peopleSubject} 함께한 기억과 ${object}${subjectParticle(object)} 남아 있다. ${quote ? `"${quote}"라는 말은 그 시절의 분위기를 보여주는 문장으로 이어진다.` : ''} ${newsTail}`,
      `${focus}의 기억은 ${time}의 장면에서 시작된다. ${peopleSubject} 함께 있었고, ${object}${subjectParticle(object)} 그 시간을 설명한다. ${quote ? `"${quote}"라는 말도 함께 남았다.` : ''} ${newsTail}`,
    ];
    return truncate(variants[index % variants.length].replace(/\s+/g, ' ').trim(), 620);
  }

  if (toneName.includes('인터뷰')) {
    const variants = [
      `${focus} 이야기는 아직도 선명해. ${time}였고, ${peopleSubject} 같이 있었지. ${object}${subjectParticle(object)} 눈에 들어왔고${quote ? `, "${quote}"라는 말도 마음에 남았어` : ''}. ${tail}`,
      `${time}, ${focus}에 있던 시간이 먼저 생각나. ${peopleSubject} 함께였고 ${object}${subjectParticle(object)} 이상하게 또렷했어. ${quote ? `"${quote}"라는 말도 그 장면에 같이 남아 있어.` : ''} ${tail}`,
    ];
    return truncate(variants[index % variants.length].replace(/\s+/g, ' ').trim(), 620);
  }

  const variants = [
    `${time}, ${focus}에는 ${object}${subjectParticle(object)} 먼저 놓여 있었다. ${peopleSubject} 함께한 그 자리에는${quote ? ` "${quote}"라는 말이 조용히 남았고,` : ''} ${tail || '그 시절의 공기가 오래 머물렀다.'}`,
    `${focus}의 장면은 ${time}의 빛으로 남아 있다. ${peopleSubject} 함께 있었고, ${object}${subjectParticle(object)} 유난히 또렷했다. ${quote ? `"${quote}"라는 말은 그날의 마음을 붙잡아 주었다.` : ''} ${tail}`,
    `${peopleSubject} 함께한 ${focus}의 시간은 ${object}의 모습과 겹쳐 떠오른다. ${time}의 그 장면에는${quote ? ` "${quote}"라는 한마디와` : ''} ${tail || '작은 해방감이 남아 있었다.'}`,
  ];
  return truncate(variants[index % variants.length].replace(/\s+/g, ' ').trim(), 620);
}

type PublicationSceneMemory = {
  setting: string;
  people: string;
  object: string;
  quote: string;
  action: string;
  emotion: string;
};

function extractPublicationSceneMemory(value: string): PublicationSceneMemory | null {
  const source = value
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[^.!?。]{0,90}(?:을|를)\s*보면,\s*/, '');
  const match = source.match(
    /^(.+?)에서\s+(.+?)(?:와|과|하고)\s+함께했던 일이 또렷합니다\.\s+(.+?)(?:을|를)\s+앞에 두고\s+"([^"]+)"라는 말을 들었고,\s+그때\s+(.+?)(?:이|가)\s+오래 남았습니다\.\s+지금 돌아보면 그 장면은 제 삶에서\s+(.+?)(?:을|를)\s+배운 시간입니다\.?/,
  );
  if (!match) return null;

  return {
    setting: match[1],
    people: match[2],
    object: match[3],
    quote: match[4],
    action: match[5],
    emotion: match[6],
  };
}

function readerParagraphFromRecord(record: PublicationSourceRecord, index: number, toneName = '') {
  const scene = extractPublicationSceneMemory(record.transcriptText);
  const repetitiveRecall = rewriteRepetitiveRecallParagraph(truncate(record.transcriptText, 520), toneName, index);
  if (repetitiveRecall) return repetitiveRecall;
  if (!scene) return cleanReportingStyleParagraph(recordExcerpt(record));

  if (toneName.includes('뉴스')) {
    const variants = [
      `${scene.setting}에서 ${scene.people}${jointParticle(scene.people)} 함께한 일은 ${scene.object}${objectParticle(scene.object)} 매개로 남았다. "${scene.quote}"라는 말과 ${scene.action}은 ${scene.emotion}의 장면으로 정리된다.`,
      `${scene.action}은 ${scene.setting}의 하루를 설명하는 핵심 장면이다. ${scene.people}${jointParticle(scene.people)} 함께한 자리에서 "${scene.quote}"라는 말이 남았고, ${scene.object}${subjectParticle(scene.object)} 그 시간을 보여준다.`,
      `${scene.setting}의 사건은 ${scene.object}${objectParticle(scene.object)} 중심으로 이어졌다. ${scene.people}${jointParticle(scene.people)} 나눈 "${scene.quote}"라는 말은 ${scene.action}과 함께 오래 기억될 만한 대목이다.`,
    ];
    return variants[index % variants.length];
  }

  if (toneName.includes('인터뷰')) {
    const variants = [
      `그때를 떠올리면 ${scene.setting}${subjectParticle(scene.setting)} 먼저 생각나. ${scene.object}${subjectParticle(scene.object)} 있었고, ${scene.people}${jointParticle(scene.people)} 함께였지. "${scene.quote}"라는 말 뒤에 ${scene.action}도 아직 선명해.`,
      `${scene.setting}의 공기는 지금도 기억나. ${scene.people}${jointParticle(scene.people)} 있었고, ${scene.object} 곁에서 "${scene.quote}"라는 말을 마음에 두게 됐어. ${scene.action}을 지나며 ${scene.emotion}도 조금 알게 됐지.`,
      `나는 ${scene.setting}의 그 시간을 자주 떠올려. ${scene.object}, ${scene.people}, 그리고 "${scene.quote}"라는 한마디가 같이 남아 있어. 그 뒤의 ${scene.action}이 내게는 잊기 어려운 장면이야.`,
    ];
    return variants[index % variants.length];
  }

  const variants = [
    `${scene.setting}에는 ${scene.object}${subjectParticle(scene.object)} 먼저 떠오른다. ${scene.people}${jointParticle(scene.people)} 함께한 자리였고, "${scene.quote}"라는 말 뒤로 ${scene.action}이 조용히 남았다. 그 장면의 끝에는 ${scene.emotion}이 있었다.`,
    `${scene.people}${jointParticle(scene.people)} 함께한 ${scene.setting}의 시간은 ${scene.object}의 모습과 겹쳐 남았다. "${scene.quote}"라는 말은 ${scene.action}으로 이어졌고, 그날의 ${scene.emotion}은 오래도록 마음 한쪽에 머물렀다.`,
    `${scene.setting}의 장면은 천천히 펼쳐진다. ${scene.object} 곁에서 들은 "${scene.quote}"라는 말, 그리고 ${scene.action}. 그 모든 것이 한 페이지의 기억이 되었다.`,
  ];
  return variants[index % variants.length];
}

function readerParagraphFromRecords(records: PublicationSourceRecord[], toneName = '') {
  return truncate(records.map((record, index) => readerParagraphFromRecord(record, index, toneName)).join(' '), 620);
}

function readerParagraphText(
  value: unknown,
  sourceRecords: PublicationSourceRecord[],
  maxLength = 620,
  toneName = '',
) {
  const raw = truncate(asString(value), maxLength);
  if (!raw) return '';

  if ((hasReportingStyleParagraph(raw) || hasFormulaicRecallParagraph(raw)) && sourceRecords.length > 0) {
    const rewrittenFromSources = readerParagraphFromRecords(sourceRecords, toneName);
    if (
      rewrittenFromSources &&
      !hasReportingStyleParagraph(rewrittenFromSources) &&
      !hasFormulaicRecallParagraph(rewrittenFromSources)
    ) {
      return rewrittenFromSources;
    }
  }

  const cleaned = toneName.includes('뉴스') ? cleanNewsArticleTail(raw) : cleanReportingStyleParagraph(raw);
  if ((hasReportingStyleParagraph(cleaned) || hasFormulaicRecallParagraph(cleaned)) && sourceRecords.length > 0) {
    return readerParagraphFromRecords(sourceRecords, toneName);
  }
  return truncate(cleaned, maxLength);
}

function hasKoreanFinalConsonant(value: string) {
  for (let index = value.length - 1; index >= 0; index -= 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xac00 && code <= 0xd7a3) {
      return ((code - 0xac00) % 28) !== 0;
    }
  }
  return false;
}

function topicParticle(value: string) {
  return hasKoreanFinalConsonant(value) ? '은' : '는';
}

function jointParticle(value: string) {
  return hasKoreanFinalConsonant(value) ? '과' : '와';
}

function subjectParticle(value: string) {
  return hasKoreanFinalConsonant(value) ? '이' : '가';
}

function objectParticle(value: string) {
  return hasKoreanFinalConsonant(value) ? '을' : '를';
}

function jointSubject(value: string) {
  const trimmed = value.trim();
  const listed = trimmed.replace(/\s*(?:와|과)\s+/gu, ', ');
  return /(?:와|과|하고)$/.test(listed) ? listed : `${listed}${jointParticle(listed)}`;
}

function closingSubjectFromChapterTitle(value: unknown) {
  const title = readerField(value, '', 60);
  if (!title) return '';
  if (title === '유년기') return '유년기의 기억';
  if (title === '일과 가족') return '일과 가족의 시간';
  if (/(?:의 기억|의 시간|의 장면)$/.test(title)) return title;
  return `${title}의 시간`;
}

function normalizeEnumValue<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && allowed.includes(value as T) ? value as T : fallback;
}

function normalizeReliability(value: unknown): PublicationReliability {
  if (value === 'CONFIRMED' || value === 'ESTIMATED' || value === 'UNVERIFIED') return value;
  return 'UNVERIFIED';
}

function extractToneProfiles(draftChapters: PublicationDraftChapter[]) {
  return draftChapters
    .map((chapter) => {
      const profile = chapter.toneProfile;
      const name = asString(profile?.name);
      const patterns = Array.isArray(profile?.patterns)
        ? profile.patterns.map((pattern) => asString(pattern)).filter(Boolean)
        : [];
      return name ? { name, patterns } : null;
    })
    .filter((profile): profile is { name: string; patterns: string[] } => Boolean(profile));
}

function resolveSelectedToneProfile(draftChapters: PublicationDraftChapter[]) {
  const profiles = extractToneProfiles(draftChapters);
  if (profiles.length === 0) return null;

  const counts = new Map<string, { count: number; patterns: string[] }>();
  for (const profile of profiles) {
    const current = counts.get(profile.name) ?? { count: 0, patterns: [] };
    counts.set(profile.name, {
      count: current.count + 1,
      patterns: Array.from(new Set([...current.patterns, ...profile.patterns])),
    });
  }

  const [name, value] = Array.from(counts.entries())
    .sort((a, b) => b[1].count - a[1].count)[0];
  return { name, patterns: value.patterns };
}

function coverCompositionFromTemplate(template?: string | null): PublicationCoverComposition | null {
  if (template === 'chapter_band') return 'quiet_band';
  if (template === 'letterpress') return 'centered_letter';
  if (template === 'framed_portrait' || template === 'photo_plate') return 'framed_classic';
  return null;
}

function buildFallbackDesignPlan(input: BuildPublicationManifestInput, palette: string, template?: string | null): PublicationDesignPlan {
  const toneName = resolveSelectedToneProfile(input.draftChapters)?.name ?? '';
  const photoTreatment: PublicationPhotoTreatment = input.photos.length > 3
    ? 'album_stack'
    : input.photos.length === 1
      ? 'single_plate'
      : 'gallery_grid';
  const coverComposition = coverCompositionFromTemplate(template);

  if (toneName.includes('뉴스')) {
    return {
      mood: palette === 'classic_ink' || palette === 'quiet_blue' ? palette : 'quiet_blue',
      coverComposition: coverComposition ?? 'quiet_band',
      chapterOpenerStyle: 'minimal_rule',
      photoTreatment,
      pacing: 'compact',
      ornamentLevel: 'none',
    };
  }

  if (toneName.includes('인터뷰')) {
    return {
      mood: palette === 'quiet_blue' || palette === 'classic_ink' ? palette : 'warm_archive',
      coverComposition: coverComposition ?? 'centered_letter',
      chapterOpenerStyle: 'quote_first',
      photoTreatment,
      pacing: 'balanced',
      ornamentLevel: 'subtle',
    };
  }

  return {
    ...DEFAULT_DESIGN_PLAN,
    mood: palette === 'warm_archive' || palette === 'quiet_blue' || palette === 'classic_ink'
      ? palette
      : DEFAULT_DESIGN_PLAN.mood,
    coverComposition: coverComposition ?? DEFAULT_DESIGN_PLAN.coverComposition,
    photoTreatment,
    pacing: input.records.length >= 8 ? 'spacious' : 'balanced',
  };
}

function normalizeDesignPlan(value: unknown, fallback: PublicationDesignPlan): PublicationDesignPlan {
  const parsed = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    mood: normalizeEnumValue(parsed.mood, ['warm_archive', 'quiet_blue', 'classic_ink'] as const, fallback.mood),
    coverComposition: normalizeEnumValue(
      parsed.coverComposition,
      ['framed_classic', 'centered_letter', 'quiet_band'] as const,
      fallback.coverComposition,
    ),
    chapterOpenerStyle: normalizeEnumValue(
      parsed.chapterOpenerStyle,
      ['numbered_classic', 'quote_first', 'minimal_rule'] as const,
      fallback.chapterOpenerStyle,
    ),
    photoTreatment: normalizeEnumValue(
      parsed.photoTreatment,
      ['gallery_grid', 'single_plate', 'album_stack'] as const,
      fallback.photoTreatment,
    ),
    pacing: normalizeEnumValue(parsed.pacing, ['compact', 'balanced', 'spacious'] as const, fallback.pacing),
    ornamentLevel: normalizeEnumValue(
      parsed.ornamentLevel,
      ['none', 'subtle', 'decorative'] as const,
      fallback.ornamentLevel,
    ),
  };
}

function tokenizeForSupport(text: string) {
  const matches = text
    .replace(/[“”"'.!?()[\]{}]/g, ' ')
    .match(/[가-힣A-Za-z0-9]{2,}/g) ?? [];
  return matches
    .map((token) => token.toLowerCase())
    .filter((token) => !STOPWORDS.has(token) && token.length >= 2);
}

function sourceSupportsParagraph(text: string, sourceTexts: string[]) {
  const paragraphTokens = Array.from(new Set(tokenizeForSupport(text)));
  const sourceTokenSet = new Set(tokenizeForSupport(sourceTexts.join(' ')));
  const supportedCount = paragraphTokens.filter((token) => sourceTokenSet.has(token)).length;
  if (paragraphTokens.length === 0) return true;
  if (paragraphTokens.length <= 4) {
    return supportedCount >= Math.max(1, Math.ceil(paragraphTokens.length * 0.5));
  }

  const supportRatio = supportedCount / paragraphTokens.length;

  return supportRatio >= 0.34 || supportedCount >= 8;
}

function recordExcerpt(record: PublicationSourceRecord) {
  return truncate(record.transcriptText, 220);
}

function fallbackParagraphFromRecords(records: PublicationSourceRecord[]): PublicationParagraph {
  const text = readerParagraphFromRecords(records);
  return {
    id: uuidv4(),
    text: truncate(text, 520),
    sourceRecordIds: records.map((record) => record.id),
    reliability: 'UNVERIFIED',
    editorNote: '원문 답변을 바탕으로 구성했습니다.',
  };
}

function normalizeMissingSections(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asString(item))
    .filter(Boolean)
    .slice(0, 4);
}

function uniqueStrings(values: string[], limit: number) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).slice(0, limit);
}

function summarizeEditorialPlanForPrompt(plan: PublicationEditorialPlan | null | undefined) {
  if (!plan) return null;

  return {
    readiness: plan.readiness,
    coreTheme: plan.coreTheme,
    editorialThesis: plan.editorialThesis,
    selectedToneProfile: plan.selectedToneProfile,
    sourceSummary: plan.sourceSummary,
    strongChapters: plan.strongChapters,
    weakChapters: plan.weakChapters,
    directQuoteCandidates: plan.directQuoteCandidates.slice(0, 8),
    photoStoryPlacements: plan.photoStoryPlacements.slice(0, 8),
    checklistFindings: plan.checklistFindings
      .filter((finding) => finding.status === 'needs_work')
      .slice(0, 8),
    followUpQuestions: plan.followUpQuestions.slice(0, 8),
    chapterPlans: plan.chapterPlans.map((chapter) => ({
      chapterId: chapter.chapterId,
      strength: chapter.strength,
      recommendedRole: chapter.recommendedRole,
      editorialFocus: chapter.editorialFocus,
      sourceRecordIds: chapter.sourceRecordIds,
      quoteCandidates: chapter.quoteCandidates.slice(0, 3),
      photoPlacements: chapter.photoPlacements.slice(0, 3),
      followUpQuestions: chapter.followUpQuestions.slice(0, 4),
      checklistRisks: chapter.checklistRisks,
    })),
  };
}

function summarizeWritingDraftForPrompt(draft: PublicationWritingDraft | null | undefined) {
  if (!draft) return null;

  return {
    styleSummary: draft.styleSummary,
    selectedToneProfile: draft.selectedToneProfile,
    generatedBy: draft.generatedBy,
    chapters: draft.chapters.map((chapter) => ({
      chapterId: chapter.chapterId,
      chapterTitle: chapter.chapterTitle,
      paragraphs: chapter.paragraphs.map((paragraph) => ({
        text: paragraph.text,
        sourceRecordIds: paragraph.sourceRecordIds,
        role: paragraph.role,
      })),
    })),
  };
}

function summarizeSourceRecordsForPrompt(records: PublicationSourceRecord[], transcriptLength = 650) {
  return records.map((record, index) => ({
    displayId: `R${index + 1}`,
    id: record.id,
    chapterId: record.chapterId,
    chapterTitle: record.chapterTitle,
    questionText: record.questionText,
    questionCategory: record.questionCategory,
    photoId: record.photoId,
    photo: record.photo
      ? {
        id: record.photo.id,
        caption: record.photo.caption,
        capturedDate: record.photo.capturedDate,
        location: record.photo.location,
      }
      : null,
    recordedAt: record.recordedAt,
    transcriptText: truncate(record.transcriptText, transcriptLength),
  }));
}

function summarizeDraftChaptersForPrompt(draftChapters: PublicationDraftChapter[]) {
  return draftChapters.map((chapter) => ({
    chapterId: chapter.chapterId,
    chapterTitle: chapter.chapterTitle,
    toneProfile: chapter.toneProfile ?? null,
    paragraphCount: chapter.paragraphs.length,
    sampleParagraphs: chapter.paragraphs.slice(0, 2).map((paragraph) => ({
      text: truncate(asString(paragraph.text), 220),
      sourceChunkIds: paragraph.sourceChunkIds,
      reliability: paragraph.reliability,
    })),
  }));
}

function summarizeQualityChecklistForPrompt() {
  return PUBLICATION_QUALITY_CHECKLIST.map((item) => ({
    id: item.id,
    category: item.category,
    label: item.label,
    requirement: item.requirement,
  }));
}

function isPhotoLedRecord(record: PublicationSourceRecord) {
  return record.questionCategory === 'photo_questions' || Boolean(record.photoId || record.photo);
}

function recordSpecificityScore(record: PublicationSourceRecord) {
  const text = record.transcriptText;
  let score = 0;
  if (text.length >= 50) score += 1;
  if (record.photo?.location || /(고향|동네|집|학교|시장|골목|식탁|회사|군대|병원|서울|부산|대구|광주|인천|마을)/.test(text)) score += 1;
  if (/(어머니|아버지|엄마|아빠|부모|가족|친구|선생님|남편|아내|자녀|딸|아들|손주|이웃)/.test(text)) score += 1;
  if (/(고마|감사|행복|기뻤|슬펐|힘들|무서|따뜻|후회|그립|외로|미안|자랑)/.test(text)) score += 1;
  if (record.photo?.capturedDate || /([0-9]{4}|어릴|시절|그때|날|밤|아침|봄|여름|가을|겨울)/.test(text)) score += 1;
  return score;
}

function estimateEpisodeCount(records: PublicationSourceRecord[]) {
  const episodeLikeRecords = records.filter((record) => recordSpecificityScore(record) >= 3 || isPhotoLedRecord(record));
  if (episodeLikeRecords.length > 0) return episodeLikeRecords.length;
  return records.length > 0 ? 1 : 0;
}

function resolveChapterStrength(records: PublicationSourceRecord[]): PublicationEditorialChapterStrength {
  const episodeCount = estimateEpisodeCount(records);
  const photoLedCount = records.filter(isPhotoLedRecord).length;
  if (records.length >= 3 && episodeCount >= 2) return 'strong';
  if (records.length >= 2 && episodeCount >= 2 && photoLedCount > 0) return 'strong';
  if (records.length >= 1) return 'developing';
  return 'thin';
}

function quoteCandidateFromRecord(record: PublicationSourceRecord): PublicationEditorialQuoteCandidate {
  const firstSentence = record.transcriptText
    .split(/[.!?。！？\n]/)
    .map((sentence) => sentence.trim())
    .find((sentence) => sentence.length >= 12);
  return {
    text: truncate(firstSentence || record.transcriptText, 90),
    sourceRecordId: record.id,
    chapterId: record.chapterId,
  };
}

function topKeywords(records: PublicationSourceRecord[], limit: number) {
  const counts = new Map<string, number>();
  for (const record of records) {
    for (const token of tokenizeForSupport(record.transcriptText)) {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([token]) => token);
}

function photoPlacementFromRecord(
  record: PublicationSourceRecord,
  photosById: Map<string, PublicationPhotoInput>,
): PublicationEditorialPhotoPlacement | null {
  const photoId = record.photo?.id || record.photoId;
  if (!photoId) return null;

  const inputPhoto = photosById.get(photoId);
  return {
    photoId,
    sourceRecordId: record.id,
    chapterId: record.chapterId,
    caption: truncate(record.photo?.caption || inputPhoto?.caption || '가족 사진', 90),
    capturedDate: record.photo?.capturedDate ?? inputPhoto?.capturedDate ?? null,
    location: record.photo?.location ?? inputPhoto?.location ?? null,
    placementNote: `${record.chapterTitle}의 기억을 여는 사진 기반 기록으로 배치합니다.`,
  };
}

function buildChapterFollowUpQuestions(
  chapter: { id: string; title: string },
  records: PublicationSourceRecord[],
  strength: PublicationEditorialChapterStrength,
) {
  const questions: string[] = [];
  const sceneSpecificCount = records.filter((record) => recordSpecificityScore(record) >= 3).length;
  const photoLedCount = records.filter(isPhotoLedRecord).length;

  if (strength === 'thin') {
    questions.push(`${chapter.title}에서 꼭 남기고 싶은 사건 한 가지를 장소, 함께 있던 사람, 그때 마음과 함께 들려주세요.`);
  }
  if (records.length > 0 && sceneSpecificCount < records.length) {
    questions.push(`${chapter.title}의 기억 중 장면이 더 선명해지도록 계절, 장소, 주변 사람을 조금 더 물어보세요.`);
  }
  if (photoLedCount === 0) {
    questions.push(`${chapter.title}와 연결되는 사진이 있다면, 그 사진을 보며 떠오르는 하루를 질문하세요.`);
  }

  return uniqueStrings(questions, 3);
}

function buildChecklistFindings(input: BuildPublicationManifestInput, metrics: {
  chapterPlans: PublicationEditorialChapterPlan[];
  directQuoteCandidates: PublicationEditorialQuoteCandidate[];
  photoStoryPlacements: PublicationEditorialPhotoPlacement[];
  sceneSpecificRecordCount: number;
}) {
  const sourceRecordCount = input.records.length;
  const photoLedRecordCount = input.records.filter(isPhotoLedRecord).length;
  const strongChapterCount = metrics.chapterPlans.filter((chapter) => chapter.strength === 'strong').length;
  const weakChapterCount = metrics.chapterPlans.filter((chapter) => chapter.strength === 'thin').length;
  const sceneSpecificRatio = sourceRecordCount === 0 ? 0 : metrics.sceneSpecificRecordCount / sourceRecordCount;

  const findingById: Record<string, PublicationEditorialChecklistFinding> = {
    'minimum-source-volume': {
      checklistItemId: 'minimum-source-volume',
      status: sourceRecordCount >= 20 && photoLedRecordCount >= 5 ? 'pass' : 'needs_work',
      note: `현재 답변 ${sourceRecordCount}개, 사진 기반 답변 ${photoLedRecordCount}개입니다.`,
    },
    'chapter-episode-density': {
      checklistItemId: 'chapter-episode-density',
      status: strongChapterCount >= 3 && weakChapterCount === 0 ? 'pass' : 'needs_work',
      note: `강한 장 ${strongChapterCount}개, 보강이 필요한 장 ${weakChapterCount}개입니다.`,
    },
    'scene-specificity': {
      checklistItemId: 'scene-specificity',
      status: sceneSpecificRatio >= 0.6 ? 'pass' : 'needs_work',
      note: `장소, 사람, 감정, 시점 단서가 충분한 답변은 ${metrics.sceneSpecificRecordCount}개입니다.`,
    },
    'elder-voice': {
      checklistItemId: 'elder-voice',
      status: metrics.directQuoteCandidates.length >= 5 ? 'pass' : 'needs_work',
      note: `직접 인용 후보 ${metrics.directQuoteCandidates.length}개를 찾았습니다.`,
    },
    'photo-memory-link': {
      checklistItemId: 'photo-memory-link',
      status: metrics.photoStoryPlacements.length >= 5 ? 'pass' : 'needs_work',
      note: `사진과 답변이 연결된 기록 ${metrics.photoStoryPlacements.length}개를 찾았습니다.`,
    },
    'narrative-arc': {
      checklistItemId: 'narrative-arc',
      status: strongChapterCount >= 3 && input.records.length >= 12 ? 'pass' : 'needs_work',
      note: '표지부터 마무리까지 이어질 만큼 강한 장 구성이 충분한지 판단했습니다.',
    },
    'repetition-control': {
      checklistItemId: 'repetition-control',
      status: sourceRecordCount >= 12 ? 'pass' : 'needs_work',
      note: '반복을 줄이려면 여러 장면과 말투 샘플이 더 필요합니다.',
    },
    'family-review-readiness': {
      checklistItemId: 'family-review-readiness',
      status: sourceRecordCount >= 10 && metrics.directQuoteCandidates.length > 0 ? 'pass' : 'needs_work',
      note: '가족 검수에서 확인할 사실, 인용, 추가 질문 지점을 만들 수 있는지 판단했습니다.',
    },
  };

  return PUBLICATION_QUALITY_CHECKLIST.map((item) => findingById[item.id]);
}

function deriveEditorialReadiness(input: BuildPublicationManifestInput, findings: PublicationEditorialChecklistFinding[]) {
  const failedCount = findings.filter((finding) => finding.status === 'needs_work').length;
  const sourceRecordCount = input.records.length;
  const photoLedRecordCount = input.records.filter(isPhotoLedRecord).length;

  if (failedCount <= 1 && sourceRecordCount >= 20 && photoLedRecordCount >= 5) return 'ready_for_paid_book';
  if (sourceRecordCount >= 10 && failedCount <= 4) return 'needs_family_review';
  return 'needs_more_records';
}

function buildFallbackEditorialPlan(
  input: BuildPublicationManifestInput,
  generatedBy: 'agent' | 'fallback',
): PublicationEditorialPlan {
  const recordsByChapter = new Map<string, PublicationSourceRecord[]>();
  const photosById = new Map(input.photos.map((photo) => [photo.id, photo]));

  for (const record of input.records) {
    const list = recordsByChapter.get(record.chapterId) ?? [];
    list.push(record);
    recordsByChapter.set(record.chapterId, list);
  }

  const chapterPlans: PublicationEditorialChapterPlan[] = input.chapters
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((chapter) => {
      const records = recordsByChapter.get(chapter.id) ?? [];
      const strength = resolveChapterStrength(records);
      const quoteCandidates = records
        .filter((record) => recordSpecificityScore(record) >= 2)
        .slice(0, 3)
        .map(quoteCandidateFromRecord);
      const photoPlacements = records
        .map((record) => photoPlacementFromRecord(record, photosById))
        .filter((placement): placement is PublicationEditorialPhotoPlacement => Boolean(placement))
        .slice(0, 3);
      const keywords = topKeywords(records, 3);

      return {
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        strength,
        recordCount: records.length,
        photoLedRecordCount: records.filter(isPhotoLedRecord).length,
        episodeCountEstimate: estimateEpisodeCount(records),
        recommendedRole: strength === 'strong'
          ? 'anchor_chapter'
          : strength === 'developing'
            ? 'supporting_chapter'
            : 'needs_more_questions',
        editorialFocus: keywords.length > 0
          ? `${chapter.title}에서는 ${keywords.join(', ')}의 구체적 장면을 중심으로 엮습니다.`
          : `${chapter.title}는 아직 기록을 더 모은 뒤 장의 초점을 정합니다.`,
        sourceRecordIds: records.map((record) => record.id),
        quoteCandidates,
        photoPlacements,
        followUpQuestions: buildChapterFollowUpQuestions(chapter, records, strength),
        checklistRisks: strength === 'strong'
          ? []
          : ['chapter-episode-density', 'scene-specificity'],
      };
    });

  const directQuoteCandidates = chapterPlans.flatMap((chapter) => chapter.quoteCandidates).slice(0, 10);
  const photoStoryPlacements = chapterPlans.flatMap((chapter) => chapter.photoPlacements).slice(0, 10);
  const sceneSpecificRecordCount = input.records.filter((record) => recordSpecificityScore(record) >= 3).length;
  const checklistFindings = buildChecklistFindings(input, {
    chapterPlans,
    directQuoteCandidates,
    photoStoryPlacements,
    sceneSpecificRecordCount,
  });
  const readiness = deriveEditorialReadiness(input, checklistFindings);
  const keywords = topKeywords(input.records, 4);
  const weakChapters = chapterPlans
    .filter((chapter) => chapter.strength === 'thin')
    .map((chapter) => chapter.chapterId);
  const strongChapters = chapterPlans
    .filter((chapter) => chapter.strength === 'strong')
    .map((chapter) => chapter.chapterId);
  const followUpQuestions = uniqueStrings([
    ...chapterPlans.flatMap((chapter) => chapter.followUpQuestions),
    ...(input.records.length < 20 ? ['유료 기록집 분량을 위해 생애 핵심 질문 답변을 20개 이상까지 보강하세요.'] : []),
    ...(photoStoryPlacements.length < 5 ? ['사진을 보며 떠오르는 기억을 5개 이상 더 수집하세요.'] : []),
  ], 10);

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    seniorName: input.seniorName,
    targetProduct: 'paid_family_book',
    readiness,
    coreTheme: keywords.length > 0
      ? `${input.seniorName}님의 삶을 이루는 ${keywords.join(', ')}의 장면`
      : `${input.seniorName}님의 삶을 가족의 기억으로 엮는 기록`,
    editorialThesis: readiness === 'ready_for_paid_book'
      ? '현재 기록을 바탕으로 유료 가족 기록집의 장 흐름을 설계할 수 있습니다.'
      : '현재 기록은 좋은 씨앗이 있지만, 유료 기록집으로 팔기 전 장면과 사진 기반 답변을 더 보강해야 합니다.',
    selectedToneProfile: resolveSelectedToneProfile(input.draftChapters),
    sourceSummary: {
      sourceRecordCount: input.records.length,
      chapterCount: input.chapters.length,
      photoCount: input.photos.length,
      photoLedRecordCount: input.records.filter(isPhotoLedRecord).length,
      strongChapterCount: strongChapters.length,
      weakChapterCount: weakChapters.length,
      sceneSpecificRecordCount,
    },
    chapterPlans,
    strongChapters,
    weakChapters,
    directQuoteCandidates,
    photoStoryPlacements,
    checklistFindings,
    followUpQuestions,
    nextActions: uniqueStrings([
      readiness === 'needs_more_records'
        ? '약한 장부터 추가 질문을 수집한 뒤 다시 편집 기획안을 생성합니다.'
        : '가족 검수에서 사실, 민감 표현, 사진 캡션을 확인합니다.',
      '사진 기반 답변은 PDF 본문에서 사진과 회상 본문이 함께 보이도록 유지합니다.',
      '기획안이 통과되면 manifest 생성 단계에 편집 초점과 추가 질문 판단을 전달합니다.',
    ], 4),
    generatedBy,
  };
}

function normalizeEditorialStrength(value: unknown, fallback: PublicationEditorialChapterStrength) {
  return normalizeEnumValue(value, ['strong', 'developing', 'thin'] as const, fallback);
}

function normalizeEditorialRole(value: unknown, fallback: PublicationEditorialChapterPlan['recommendedRole']) {
  return normalizeEnumValue(value, ['anchor_chapter', 'supporting_chapter', 'needs_more_questions'] as const, fallback);
}

function requiredSourceChapterIds(input: BuildPublicationManifestInput) {
  return new Set(input.records.map((record) => record.chapterId));
}

function isStrictAgentStage(input: BuildPublicationManifestInput, stage: 'editorial' | 'writing' | 'manifest') {
  if (input.requireAgentStages) return true;
  if (stage === 'editorial') return Boolean(input.requireEditorialAgent);
  if (stage === 'writing') return Boolean(input.requireWritingAgent);
  return Boolean(input.requireManifestAgent);
}

function sanitizeAgentEditorialPlan(
  candidate: unknown,
  input: BuildPublicationManifestInput,
): PublicationEditorialPlan | null {
  if (!candidate || typeof candidate !== 'object') return null;
  const parsed = candidate as Record<string, unknown>;
  const requireAgent = isStrictAgentStage(input, 'editorial');
  const fallback = buildFallbackEditorialPlan(input, 'agent');
  const fallbackByChapter = new Map(fallback.chapterPlans.map((chapter) => [chapter.chapterId, chapter]));
  const recordById = new Map(input.records.map((record) => [record.id, record]));
  const chapterIds = new Set(input.chapters.map((chapter) => chapter.id));
  const requiredChapterIds = requiredSourceChapterIds(input);

  const rawChapterPlans = Array.isArray(parsed.chapterPlans) ? parsed.chapterPlans : [];
  const chapterPlans = rawChapterPlans
    .map((rawChapter) => {
      if (!rawChapter || typeof rawChapter !== 'object') return null;
      const chapterObj = rawChapter as Record<string, unknown>;
      const chapterId = asString(chapterObj.chapterId);
      if (!chapterIds.has(chapterId)) return null;
      const fallbackChapter = fallbackByChapter.get(chapterId);
      if (!fallbackChapter) return null;
      const allowedRecordIds = new Set(fallbackChapter.sourceRecordIds);
      const rawSourceRecordIds = Array.isArray(chapterObj.sourceRecordIds)
        ? chapterObj.sourceRecordIds
        : (requireAgent ? [] : fallbackChapter.sourceRecordIds);
      const sourceRecordIds = rawSourceRecordIds
        .map((id) => asString(id))
        .filter((id) => allowedRecordIds.has(id));
      if (requireAgent && requiredChapterIds.has(chapterId) && sourceRecordIds.length === 0) return null;
      const quoteCandidates = (Array.isArray(chapterObj.quoteCandidates) ? chapterObj.quoteCandidates : [])
        .map((rawQuote) => {
          if (!rawQuote || typeof rawQuote !== 'object') return null;
          const quoteObj = rawQuote as Record<string, unknown>;
          const sourceRecordId = asString(quoteObj.sourceRecordId);
          const sourceRecord = recordById.get(sourceRecordId);
          const text = truncate(asString(quoteObj.text), 90);
          if (!sourceRecord || sourceRecord.chapterId !== chapterId || !text || !sourceRecord.transcriptText.includes(text)) return null;
          return { text, sourceRecordId, chapterId };
        })
        .filter((quote): quote is PublicationEditorialQuoteCandidate => Boolean(quote))
        .slice(0, 3);
      const photoPlacements = fallbackChapter.photoPlacements.filter((placement) => sourceRecordIds.includes(placement.sourceRecordId));

      return {
        ...fallbackChapter,
        strength: normalizeEditorialStrength(chapterObj.strength, fallbackChapter.strength),
        recommendedRole: normalizeEditorialRole(chapterObj.recommendedRole, fallbackChapter.recommendedRole),
        editorialFocus: truncate(asString(chapterObj.editorialFocus) || fallbackChapter.editorialFocus, 160),
        sourceRecordIds: sourceRecordIds.length > 0 ? sourceRecordIds : fallbackChapter.sourceRecordIds,
        quoteCandidates: quoteCandidates.length > 0 ? quoteCandidates : fallbackChapter.quoteCandidates,
        photoPlacements,
        followUpQuestions: uniqueStrings([
          ...(Array.isArray(chapterObj.followUpQuestions) ? chapterObj.followUpQuestions.map((item) => asString(item)) : []),
          ...fallbackChapter.followUpQuestions,
        ], 4),
        checklistRisks: uniqueStrings([
          ...(Array.isArray(chapterObj.checklistRisks) ? chapterObj.checklistRisks.map((item) => asString(item)) : []),
          ...fallbackChapter.checklistRisks,
        ], 4),
      };
    })
    .filter((chapter): chapter is PublicationEditorialChapterPlan => Boolean(chapter));

  if (chapterPlans.length === 0) return null;
  if (
    requireAgent
    && [...requiredChapterIds].some((chapterId) => !chapterPlans.some((plan) => plan.chapterId === chapterId))
  ) {
    return null;
  }

  const completeChapterPlans = input.chapters
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((chapter) => chapterPlans.find((plan) => plan.chapterId === chapter.id) ?? (requireAgent ? null : fallbackByChapter.get(chapter.id)))
    .filter((chapter): chapter is PublicationEditorialChapterPlan => Boolean(chapter));
  const strongChapters = completeChapterPlans
    .filter((chapter) => chapter.strength === 'strong')
    .map((chapter) => chapter.chapterId);
  const weakChapters = completeChapterPlans
    .filter((chapter) => chapter.strength === 'thin')
    .map((chapter) => chapter.chapterId);
  const directQuoteCandidates = completeChapterPlans.flatMap((chapter) => chapter.quoteCandidates).slice(0, 10);
  const photoStoryPlacements = completeChapterPlans.flatMap((chapter) => chapter.photoPlacements).slice(0, 10);
  const checklistFindings = buildChecklistFindings(input, {
    chapterPlans: completeChapterPlans,
    directQuoteCandidates,
    photoStoryPlacements,
    sceneSpecificRecordCount: fallback.sourceSummary.sceneSpecificRecordCount,
  });
  const readiness = normalizeEnumValue(
    parsed.readiness,
    ['ready_for_paid_book', 'needs_family_review', 'needs_more_records'] as const,
    deriveEditorialReadiness(input, checklistFindings),
  );

  return {
    ...fallback,
    readiness,
    coreTheme: truncate(asString(parsed.coreTheme) || fallback.coreTheme, 120),
    editorialThesis: truncate(asString(parsed.editorialThesis) || fallback.editorialThesis, 220),
    chapterPlans: completeChapterPlans,
    strongChapters,
    weakChapters,
    directQuoteCandidates,
    photoStoryPlacements,
    checklistFindings,
    followUpQuestions: uniqueStrings([
      ...(Array.isArray(parsed.followUpQuestions) ? parsed.followUpQuestions.map((item) => asString(item)) : []),
      ...fallback.followUpQuestions,
    ], 10),
    nextActions: uniqueStrings([
      ...(Array.isArray(parsed.nextActions) ? parsed.nextActions.map((item) => asString(item)) : []),
      ...fallback.nextActions,
    ], 5),
    generatedBy: 'agent',
  };
}

async function buildAgentEditorialPlan(input: BuildPublicationManifestInput) {
  if (!hasFactChatApiKey()) {
    throw Object.assign(new Error('Publication editorial plan agent is not configured.'), {
      statusCode: 503,
      providerCode: 'config_missing',
    });
  }
  if (input.records.length === 0) {
    throw Object.assign(new Error('Publication editorial plan agent has no source records.'), {
      statusCode: 422,
      providerCode: 'source_records_missing',
    });
  }

  const client = getFactChatClient();
  const providerInput = normalizeFactChatChatCompletionInput({
    model: 'dearlog-writing',
    response_format: { type: 'json_object' },
    temperature: 0.1,
    max_completion_tokens: PUBLICATION_EDITORIAL_PLAN_MAX_COMPLETION_TOKENS,
    messages: [
      {
        role: 'system',
        content: PUBLICATION_EDITORIAL_PLAN_SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: `<publication_input_json>
${JSON.stringify({
  seniorName: input.seniorName,
  selectedToneProfile: resolveSelectedToneProfile(input.draftChapters),
  qualityChecklist: summarizeQualityChecklistForPrompt(),
  sourceRecords: summarizeSourceRecordsForPrompt(input.records, 520),
  draftChapters: summarizeDraftChaptersForPrompt(input.draftChapters),
  chapters: input.chapters,
  photos: input.photos.map((photo) => ({
    id: photo.id,
    caption: photo.caption,
    capturedDate: photo.capturedDate,
    location: photo.location,
  })),
})}
</publication_input_json>`,
      },
    ],
  }, 'writing') as Record<string, unknown>;
  const response = await createChatCompletionWithUsage<any>({
    client,
    endpoint: 'publication_editorial_plan',
    providerInput,
    context: input.usageContext,
    timeoutMs: input.agentTimeoutMs ?? 12_000,
  });

  const content = extractAgentTextContent(response);
  if (!content) {
    throw Object.assign(new Error('Publication editorial plan agent returned empty content.'), {
      statusCode: 502,
      providerCode: 'empty_content',
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw Object.assign(new Error(`Publication editorial plan agent returned invalid JSON: ${compactAgentError(error)}`), {
      statusCode: 502,
      providerCode: 'invalid_json',
    });
  }

  const sanitized = sanitizeAgentEditorialPlan(parsed, input);
  if (!sanitized) {
    throw Object.assign(new Error('Publication editorial plan agent response did not pass source grounding checks.'), {
      statusCode: 422,
      providerCode: 'sanitize_rejected',
    });
  }
  return sanitized;
}

export async function buildPublicationEditorialPlan(input: BuildPublicationManifestInput): Promise<PublicationEditorialPlan> {
  const requireAgent = input.requireAgentStages || input.requireEditorialAgent;
  if (input.useAgent === false) {
    if (requireAgent) {
      throw Object.assign(new Error('기록집 편집 기획 에이전트를 사용할 수 없어 기록집을 만들지 못했습니다.'), {
        statusCode: 503,
      });
    }
    return buildFallbackEditorialPlan(input, 'fallback');
  }

  try {
    const agentPlan = await buildAgentEditorialPlan(input);
    if (agentPlan) return agentPlan;
  } catch (error) {
    if (requireAgent) throw error;
    // The fallback plan keeps paid-book planning available even without an AI response.
  }

  if (requireAgent) {
    throw Object.assign(new Error('기록집 편집 기획 에이전트가 기획안을 완성하지 못했습니다. 잠시 후 다시 시도해주세요.'), {
      statusCode: 503,
    });
  }

  await recordInternalAiUsage({
    context: input.usageContext,
    endpoint: 'publication_editorial_plan',
    outcome: 'fallback',
    statusCode: 200,
    errorMessage: 'Publication editorial plan used fallback.',
  });
  return buildFallbackEditorialPlan(input, 'fallback');
}

function normalizeWritingParagraphRole(value: unknown, fallback: PublicationWritingParagraphRole): PublicationWritingParagraphRole {
  return normalizeEnumValue(value, ['lead', 'scene', 'reflection', 'photo_story'] as const, fallback);
}

function writingParagraphRole(record: PublicationSourceRecord, index: number): PublicationWritingParagraphRole {
  if (isPhotoLedRecord(record)) return 'photo_story';
  if (index === 0) return 'lead';
  return index % 3 === 2 ? 'reflection' : 'scene';
}

function buildFallbackWritingDraft(
  input: BuildPublicationManifestInput,
  generatedBy: 'agent' | 'fallback',
): PublicationWritingDraft {
  const selectedToneProfile = input.editorialPlan?.selectedToneProfile ?? resolveSelectedToneProfile(input.draftChapters);
  const toneName = selectedToneProfile?.name ?? '';
  const recordsByChapter = new Map<string, PublicationSourceRecord[]>();
  for (const record of input.records) {
    const list = recordsByChapter.get(record.chapterId) ?? [];
    list.push(record);
    recordsByChapter.set(record.chapterId, list);
  }

  const chapters = input.chapters
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((chapter): PublicationWritingChapter | null => {
      const records = recordsByChapter.get(chapter.id) ?? [];
      if (records.length === 0) return null;
      const paragraphs = records.slice(0, 4).map((record, index) => ({
        text: readerParagraphFromRecord(record, index, toneName),
        sourceRecordIds: [record.id],
        role: writingParagraphRole(record, index),
      }));
      return {
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        paragraphs,
      };
    })
    .filter((chapter): chapter is PublicationWritingChapter => Boolean(chapter));

  const reportingStyleCount = [
    ...input.records.map((record) => record.transcriptText),
    ...input.draftChapters.flatMap((chapter) => chapter.paragraphs.map((paragraph) => asString(paragraph.text))),
  ].filter((text) => text && hasReportingStyleParagraph(text)).length;

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    seniorName: input.seniorName,
    selectedToneProfile,
    styleSummary: toneName
      ? `${toneName} 기준으로 반복적인 기록 요약 문장을 장면 중심 산문으로 다시 엮었습니다.`
      : '반복적인 기록 요약 문장을 장면 중심 산문으로 다시 엮었습니다.',
    chapters,
    revisionFindings: [
      reportingStyleCount > 0
        ? {
          category: 'repetition',
          severity: 'needs_work',
          note: `자료 요약식 반복 표현 ${reportingStyleCount}건을 산문형 문장으로 재구성했습니다.`,
        }
        : {
          category: 'tone',
          severity: 'info',
          note: '원천 기록의 사실 범위를 유지하며 독자용 문단으로 정리했습니다.',
        },
    ],
    generatedBy,
  };
}

function compactAgentError(error: unknown) {
  if (error instanceof Error) return error.message.slice(0, 500);
  if (typeof error === 'string') return error.slice(0, 500);
  try {
    return JSON.stringify(error).slice(0, 500);
  } catch {
    return 'unknown error';
  }
}

function textFromContentPart(part: unknown) {
  if (typeof part === 'string') return part;
  if (!part || typeof part !== 'object') return '';
  const record = part as Record<string, unknown>;
  if (typeof record.text === 'string') return record.text;
  if (typeof record.content === 'string') return record.content;
  if (typeof record.value === 'string') return record.value;
  return '';
}

function extractAgentTextContent(response: unknown) {
  if (!response || typeof response !== 'object') return '';
  const record = response as Record<string, unknown>;
  const choices = Array.isArray(record.choices) ? record.choices : [];
  const choice = choices[0] && typeof choices[0] === 'object' ? choices[0] as Record<string, unknown> : {};
  const message = choice.message && typeof choice.message === 'object'
    ? choice.message as Record<string, unknown>
    : {};
  const content = message.content;
  if (typeof content === 'string' && content.trim()) return content.trim();
  if (Array.isArray(content)) {
    const text = content.map(textFromContentPart).join('').trim();
    if (text) return text;
  }
  if (typeof choice.text === 'string' && choice.text.trim()) return choice.text.trim();
  if (typeof record.output_text === 'string' && record.output_text.trim()) return record.output_text.trim();
  if (message.parsed && typeof message.parsed === 'object') {
    try {
      return JSON.stringify(message.parsed);
    } catch {
      return '';
    }
  }
  return '';
}

function sanitizeWritingRevisionFindings(value: unknown, fallback: PublicationWritingRevisionFinding[]) {
  if (!Array.isArray(value)) return fallback;
  const findings = value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const obj = item as Record<string, unknown>;
      const category = normalizeEnumValue(
        obj.category,
        ['repetition', 'grounding', 'tone', 'structure'] as const,
        'tone',
      );
      const severity = normalizeEnumValue(obj.severity, ['info', 'needs_work'] as const, 'info');
      const note = truncate(asString(obj.note), 180);
      if (!note) return null;
      return { category, severity, note };
    })
    .filter((finding): finding is PublicationWritingRevisionFinding => Boolean(finding))
    .slice(0, 8);
  return findings.length > 0 ? findings : fallback;
}

function sanitizeAgentWritingDraft(
  candidate: unknown,
  input: BuildPublicationManifestInput,
): PublicationWritingDraft | null {
  if (!candidate || typeof candidate !== 'object') return null;
  const parsed = candidate as Record<string, unknown>;
  const requireAgent = isStrictAgentStage(input, 'writing');
  const fallback = buildFallbackWritingDraft(input, 'fallback');
  const selectedToneProfile = input.editorialPlan?.selectedToneProfile ?? resolveSelectedToneProfile(input.draftChapters);
  const toneName = selectedToneProfile?.name ?? '';
  const fallbackByChapter = new Map(fallback.chapters.map((chapter) => [chapter.chapterId, chapter]));
  const chapterIds = new Set(input.chapters.map((chapter) => chapter.id));
  const requiredChapterIds = requiredSourceChapterIds(input);
  const recordsById = new Map(input.records.map((record) => [record.id, record]));
  const recordsByChapter = new Map<string, PublicationSourceRecord[]>();
  for (const record of input.records) {
    const list = recordsByChapter.get(record.chapterId) ?? [];
    list.push(record);
    recordsByChapter.set(record.chapterId, list);
  }

  const sanitizedByChapter = new Map<string, PublicationWritingChapter>();
  const rawChapters = Array.isArray(parsed.chapters) ? parsed.chapters : [];
  let acceptedAgentParagraphCount = 0;
  for (const rawChapter of rawChapters) {
    if (!rawChapter || typeof rawChapter !== 'object') continue;
    const chapterObj = rawChapter as Record<string, unknown>;
    const chapterId = asString(chapterObj.chapterId);
    if (!chapterIds.has(chapterId)) continue;
    const chapterRecords = recordsByChapter.get(chapterId) ?? [];
    const chapterRecordIds = new Set(chapterRecords.map((record) => record.id));
    const paragraphs: PublicationWritingParagraph[] = [];
    const rawParagraphs = Array.isArray(chapterObj.paragraphs) ? chapterObj.paragraphs : [];

    for (const rawParagraph of rawParagraphs) {
      if (!rawParagraph || typeof rawParagraph !== 'object') continue;
      const paragraphObj = rawParagraph as Record<string, unknown>;
      const sourceRecordIds = (Array.isArray(paragraphObj.sourceRecordIds) ? paragraphObj.sourceRecordIds : [])
        .map((id) => asString(id))
        .filter((id) => chapterRecordIds.has(id));
      const sourceRecords = sourceRecordIds
        .map((id) => recordsById.get(id))
        .filter((record): record is PublicationSourceRecord => Boolean(record));
      const text = readerParagraphText(paragraphObj.text, sourceRecords, 620, toneName);
      const sourceTexts = sourceRecords.map((record) => record.transcriptText);
      if (!text || sourceRecordIds.length === 0 || !sourceSupportsParagraph(text, sourceTexts)) continue;
      acceptedAgentParagraphCount += 1;
      paragraphs.push({
        text,
        sourceRecordIds,
        role: normalizeWritingParagraphRole(paragraphObj.role, paragraphs.length === 0 ? 'lead' : 'scene'),
      });
    }

    if (paragraphs.length === 0) continue;
    const fallbackChapter = fallbackByChapter.get(chapterId);
    sanitizedByChapter.set(chapterId, {
      chapterId,
      chapterTitle: truncate(asString(chapterObj.chapterTitle) || fallbackChapter?.chapterTitle || chapterRecords[0]?.chapterTitle || '기록', 60),
      paragraphs,
    });
  }

  if (acceptedAgentParagraphCount === 0) return null;
  if (
    requireAgent
    && [...requiredChapterIds].some((chapterId) => !sanitizedByChapter.has(chapterId))
  ) {
    return null;
  }

  const chapters = input.chapters
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((chapter) => sanitizedByChapter.get(chapter.id) ?? (requireAgent ? null : fallbackByChapter.get(chapter.id) ?? null))
    .filter((chapter): chapter is PublicationWritingChapter => Boolean(chapter));

  if (chapters.length === 0) return null;

  return {
    ...fallback,
    generatedAt: new Date().toISOString(),
    styleSummary: truncate(asString(parsed.styleSummary) || fallback.styleSummary, 240),
    chapters,
    revisionFindings: sanitizeWritingRevisionFindings(parsed.revisionFindings, fallback.revisionFindings),
    generatedBy: 'agent',
  };
}

async function buildAgentWritingDraft(input: BuildPublicationManifestInput) {
  if (!hasFactChatApiKey()) {
    throw Object.assign(new Error('Publication writing draft agent is not configured.'), {
      statusCode: 503,
      providerCode: 'config_missing',
    });
  }
  if (input.records.length === 0) {
    throw Object.assign(new Error('Publication writing draft agent has no source records.'), {
      statusCode: 422,
      providerCode: 'source_records_missing',
    });
  }

  const client = getFactChatClient();
  const providerInput = normalizeFactChatChatCompletionInput({
    model: 'dearlog-writing',
    response_format: { type: 'json_object' },
    temperature: 0.35,
    max_completion_tokens: PUBLICATION_WRITING_DRAFT_MAX_COMPLETION_TOKENS,
    messages: [
      {
        role: 'system',
        content: PUBLICATION_WRITING_DRAFT_SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: `<publication_input_json>
${JSON.stringify({
  seniorName: input.seniorName,
  selectedToneProfile: input.editorialPlan?.selectedToneProfile ?? resolveSelectedToneProfile(input.draftChapters),
  editorialPlan: summarizeEditorialPlanForPrompt(input.editorialPlan),
  sourceRecords: summarizeSourceRecordsForPrompt(input.records, 760),
  draftChapters: summarizeDraftChaptersForPrompt(input.draftChapters),
  chapters: input.chapters,
  photos: input.photos.map((photo) => ({
    id: photo.id,
    caption: photo.caption,
    capturedDate: photo.capturedDate,
    location: photo.location,
  })),
})}
</publication_input_json>`,
      },
    ],
  }, 'writing') as Record<string, unknown>;
  const response = await createChatCompletionWithUsage<any>({
    client,
    endpoint: 'publication_writing_draft',
    providerInput,
    context: input.usageContext,
    timeoutMs: input.agentTimeoutMs ?? 8_000,
  });

  const content = extractAgentTextContent(response);
  if (!content) {
    throw Object.assign(new Error('Publication writing draft agent returned empty content.'), {
      statusCode: 502,
      providerCode: 'empty_content',
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw Object.assign(new Error(`Publication writing draft agent returned invalid JSON: ${compactAgentError(error)}`), {
      statusCode: 502,
      providerCode: 'invalid_json',
    });
  }

  const sanitized = sanitizeAgentWritingDraft(parsed, input);
  if (!sanitized) {
    throw Object.assign(new Error('Publication writing draft agent response did not pass source grounding checks.'), {
      statusCode: 422,
      providerCode: 'sanitize_rejected',
    });
  }
  return sanitized;
}

export async function buildPublicationWritingDraft(input: BuildPublicationManifestInput): Promise<PublicationWritingDraft> {
  const requireAgent = input.requireAgentStages || input.requireWritingAgent;
  let plannedInput = input;
  try {
    const editorialPlan = input.editorialPlan ?? await buildPublicationEditorialPlan({
      ...input,
      useAgent: input.useAgent,
    });
    plannedInput = { ...input, editorialPlan };
  } catch (error) {
    if (requireAgent) throw error;
    // Writing can continue from source records and fallback planning.
  }

  if (plannedInput.useAgent === false) {
    if (requireAgent) {
      throw Object.assign(new Error('기록집 작성 에이전트를 사용할 수 없어 기록집을 만들지 못했습니다.'), {
        statusCode: 503,
      });
    }
    return buildFallbackWritingDraft(plannedInput, 'fallback');
  }

  try {
    const agentDraft = await buildAgentWritingDraft(plannedInput);
    if (agentDraft) return agentDraft;
  } catch (error) {
    if (requireAgent) throw error;
  }

  if (requireAgent) {
    throw Object.assign(new Error('기록집 작성 에이전트가 초안을 완성하지 못했습니다. 잠시 후 다시 시도해주세요.'), {
      statusCode: 503,
    });
  }

  await recordInternalAiUsage({
    context: plannedInput.usageContext,
    endpoint: 'publication_writing_draft',
    outcome: 'fallback',
    statusCode: 200,
    errorMessage: 'Publication writing draft used fallback.',
  });
  return buildFallbackWritingDraft(plannedInput, 'fallback');
}

function publicationParagraphsFromWritingDraft(
  input: BuildPublicationManifestInput,
  chapterId: string,
  validRecordIds: Set<string>,
  recordById: Map<string, PublicationSourceRecord>,
): PublicationParagraph[] {
  const writingChapter = input.writingDraft?.chapters.find((chapter) => chapter.chapterId === chapterId);
  if (!writingChapter) return [];

  return writingChapter.paragraphs
    .map((paragraph): PublicationParagraph | null => {
      const sourceRecordIds = paragraph.sourceRecordIds
        .map((id) => asString(id))
        .filter((id) => validRecordIds.has(id));
      const sourceRecords = sourceRecordIds
        .map((id) => recordById.get(id))
        .filter((record): record is PublicationSourceRecord => Boolean(record));
      const text = readerParagraphText(paragraph.text, sourceRecords);
      const sourceTexts = sourceRecords.map((record) => record.transcriptText);
      if (!text || sourceRecordIds.length === 0 || !sourceSupportsParagraph(text, sourceTexts)) return null;
      return {
        id: uuidv4(),
        text,
        sourceRecordIds,
        reliability: 'UNVERIFIED' as const,
      };
    })
    .filter((paragraph): paragraph is PublicationParagraph => Boolean(paragraph));
}

function buildFallbackChapters(input: BuildPublicationManifestInput) {
  const recordsByChapter = new Map<string, PublicationSourceRecord[]>();
  for (const record of input.records) {
    const list = recordsByChapter.get(record.chapterId) ?? [];
    list.push(record);
    recordsByChapter.set(record.chapterId, list);
  }

  const draftByChapter = new Map(input.draftChapters.map((chapter) => [chapter.chapterId, chapter]));
  const editorialPlanByChapter = new Map(
    (input.editorialPlan?.chapterPlans ?? []).map((chapterPlan) => [chapterPlan.chapterId, chapterPlan]),
  );
  const chapters: PublicationChapter[] = [];

  for (const chapter of input.chapters) {
    const chapterRecords = recordsByChapter.get(chapter.id) ?? [];
    const draft = draftByChapter.get(chapter.id);
    const editorialPlan = editorialPlanByChapter.get(chapter.id);
    const validRecordIds = new Set(chapterRecords.map((record) => record.id));
    const recordById = new Map(chapterRecords.map((record) => [record.id, record]));
    let paragraphs: PublicationParagraph[] = publicationParagraphsFromWritingDraft(input, chapter.id, validRecordIds, recordById);

    if (paragraphs.length === 0) {
      paragraphs = [];
      for (const paragraph of draft?.paragraphs ?? []) {
        const requestedIds = Array.isArray(paragraph.sourceChunkIds) ? paragraph.sourceChunkIds : [];
        const sourceRecordIds = requestedIds
          .map((id) => asString(id))
          .filter((id) => validRecordIds.has(id));
        const paragraphSourceRecords = sourceRecordIds
          .map((id) => recordById.get(id))
          .filter((record): record is PublicationSourceRecord => Boolean(record));
        const text = readerParagraphText(paragraph.text, paragraphSourceRecords);
        const sourceTexts = sourceRecordIds
          .map((id) => recordById.get(id)?.transcriptText ?? '')
          .filter(Boolean);

        if (!text || sourceRecordIds.length === 0 || !sourceSupportsParagraph(text, sourceTexts)) continue;

        paragraphs.push({
          id: uuidv4(),
          text,
          sourceRecordIds,
          reliability: normalizeReliability(paragraph.reliability),
          editorNote: asString(paragraph.uncertaintyNote) || undefined,
        });
      }
    }

    if (paragraphs.length === 0 && chapterRecords.length > 0) {
      for (const record of chapterRecords.slice(0, 4)) {
        paragraphs.push(fallbackParagraphFromRecords([record]));
      }
    }

    if (paragraphs.length === 0) continue;

    chapters.push({
      chapterId: chapter.id,
      title: draft?.chapterTitle || chapter.title,
      subtitle: DEFAULT_CHAPTER_SUBTITLE,
      openingQuote: editorialPlan?.quoteCandidates[0]?.text
        || truncate(chapterRecords[0]?.transcriptText ?? paragraphs[0].text, 86),
      paragraphs,
      missingSections: uniqueStrings([
        ...normalizeMissingSections(draft?.missingSections),
        ...(editorialPlan?.followUpQuestions ?? []),
      ], 4),
      sourceRecords: chapterRecords,
    });
  }

  return chapters;
}

function buildFallbackClosing(input: BuildPublicationManifestInput): PublicationManifest['closing'] {
  const keywords = topKeywords(input.records, 2);
  const strongChapterTitle = input.editorialPlan?.chapterPlans
    .find((chapter) => chapter.strength === 'strong' || chapter.strength === 'developing')
    ?.chapterTitle;
  const keywordSubject = readerField(
    keywords.length > 0 ? `${keywords.join(', ')}의 장면` : '함께 나눈 기억',
    '함께 나눈 기억',
    60,
  );
  const subject = closingSubjectFromChapterTitle(strongChapterTitle) || keywordSubject;
  return {
    title: input.records.length > 0 ? '기억을 건네며' : DEFAULT_CLOSING_TITLE,
    body: `${subject}${topicParticle(subject)} 한 권의 이야기로 잠시 매듭지어졌습니다. 이 책이 가족 곁에서 오래 머물며 다음 대화를 여는 작은 안부가 되기를 바랍니다.`,
  };
}

function buildBaseManifest(input: BuildPublicationManifestInput, generatedBy: 'agent' | 'fallback'): PublicationManifest {
  const palette = input.cover?.palette || 'warm_archive';
  const design = PALETTE_PRESETS[palette] ?? PALETTE_PRESETS.warm_archive;
  const title = `${input.seniorName}의 이야기`;
  const chapters = buildFallbackChapters(input);
  const designPlan = buildFallbackDesignPlan(input, palette, input.cover?.template);
  const closing = buildFallbackClosing(input);

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    title,
    subtitle: DEFAULT_BOOK_SUBTITLE,
    authorName: input.seniorName,
    seasonLabel: 'Dearlog 가족 기록집',
    design: {
      palette,
      template: input.cover?.template || 'letterpress',
      font: input.cover?.font || 'NotoSansKR',
      ...design,
    },
    designPlan,
    cover: {
      kicker: 'DEARLOG FAMILY BOOK',
      title,
      subtitle: DEFAULT_COVER_SUBTITLE,
      dedication: '가족이 함께 남긴 기억을 바탕으로 구성했습니다.',
      backCoverBlurb: `${input.seniorName}님의 이야기를 가족의 마음으로 엮었습니다. 오래 간직하고 싶은 장면과 말들을 한 권의 기록으로 남깁니다.`,
    },
    editorialNote: input.editorialPlan?.editorialThesis || '가족이 들려준 기억을 한 권의 흐름으로 다듬었습니다.',
    chapters,
    photoPlates: input.photos.slice(0, 6).map((photo) => ({
      id: photo.id,
      fileKey: photo.fileKey,
      mimeType: photo.mimeType,
      caption: photo.caption || '가족 사진',
      capturedDate: photo.capturedDate,
      location: photo.location,
    })),
    closing,
    provenance: {
      sourceRecordCount: input.records.length,
      sourceRecordIds: input.records.map((record) => record.id),
      hallucinationGuard: [
        '본문 문단은 실제 InterviewRecord ID를 1개 이상 가져야 합니다.',
        '문단 출처 ID가 현재 시니어의 DB 기록과 매칭되지 않으면 제외합니다.',
        '출처 텍스트와 핵심 단어가 충분히 겹치지 않는 AI 문단은 fallback 원문 기반 문단으로 대체합니다.',
      ],
      generatedBy,
    },
  };
}

function sanitizeAgentManifest(candidate: unknown, input: BuildPublicationManifestInput): PublicationManifest | null {
  if (!candidate || typeof candidate !== 'object') return null;
  const parsed = candidate as Record<string, unknown>;
  const requireAgent = isStrictAgentStage(input, 'manifest');
  const fallback = buildBaseManifest(input, 'agent');
  const recordById = new Map(input.records.map((record) => [record.id, record]));
  const chapterIds = new Set(input.chapters.map((chapter) => chapter.id));
  const requiredChapterIds = requiredSourceChapterIds(input);
  const sanitizedChapters: PublicationChapter[] = [];

  const rawChapters = Array.isArray(parsed.chapters) ? parsed.chapters : [];
  for (const rawChapter of rawChapters) {
    if (!rawChapter || typeof rawChapter !== 'object') continue;
    const chapterObj = rawChapter as Record<string, unknown>;
    const chapterId = asString(chapterObj.chapterId);
    if (!chapterIds.has(chapterId)) continue;

    const sourceRecords = input.records.filter((record) => record.chapterId === chapterId);
    const chapterRecordIds = new Set(sourceRecords.map((record) => record.id));
    let paragraphs: PublicationParagraph[] = publicationParagraphsFromWritingDraft(input, chapterId, chapterRecordIds, recordById);

    if (paragraphs.length === 0) {
      paragraphs = [];
      const rawParagraphs = Array.isArray(chapterObj.paragraphs) ? chapterObj.paragraphs : [];
      for (const rawParagraph of rawParagraphs) {
        if (!rawParagraph || typeof rawParagraph !== 'object') continue;
        const paragraphObj = rawParagraph as Record<string, unknown>;
        const sourceRecordIds = (Array.isArray(paragraphObj.sourceRecordIds) ? paragraphObj.sourceRecordIds : [])
          .map((id) => asString(id))
          .filter((id) => chapterRecordIds.has(id));
        const paragraphSourceRecords = sourceRecordIds
          .map((id) => recordById.get(id))
          .filter((record): record is PublicationSourceRecord => Boolean(record));
        const text = readerParagraphText(paragraphObj.text, paragraphSourceRecords);
        const sourceTexts = sourceRecordIds
          .map((id) => recordById.get(id)?.transcriptText ?? '')
          .filter(Boolean);

        if (!text || sourceRecordIds.length === 0 || !sourceSupportsParagraph(text, sourceTexts)) continue;

        paragraphs.push({
          id: uuidv4(),
          text,
          sourceRecordIds,
          reliability: normalizeReliability(paragraphObj.reliability),
          editorNote: asString(paragraphObj.editorNote) || undefined,
        });
      }
    }

    if (paragraphs.length === 0) continue;

    sanitizedChapters.push({
      chapterId,
      title: truncate(asString(chapterObj.title) || input.chapters.find((chapter) => chapter.id === chapterId)?.title || '기록', 60),
      subtitle: truncate(asString(chapterObj.subtitle) || DEFAULT_CHAPTER_SUBTITLE, 80),
      openingQuote: truncate(asString(chapterObj.openingQuote), 90) || undefined,
      paragraphs,
      missingSections: normalizeMissingSections(chapterObj.missingSections),
      sourceRecords,
    });
  }

  if (sanitizedChapters.length === 0) return null;
  if (
    requireAgent
    && [...requiredChapterIds].some((chapterId) => !sanitizedChapters.some((chapter) => chapter.chapterId === chapterId))
  ) {
    return null;
  }
  const designPlan = normalizeDesignPlan(parsed.designPlan, fallback.designPlan);
  const parsedCover = parsed.cover && typeof parsed.cover === 'object'
    ? parsed.cover as Record<string, unknown>
    : {};
  const parsedClosing = parsed.closing && typeof parsed.closing === 'object'
    ? parsed.closing as Record<string, unknown>
    : {};

  return {
    ...fallback,
    designPlan,
    title: readerField(parsed.title, fallback.title, 42),
    subtitle: readerField(parsed.subtitle, fallback.subtitle, 80),
    cover: {
      ...fallback.cover,
      title: readerField(parsedCover.title, fallback.cover.title, 42),
      subtitle: readerField(parsedCover.subtitle, fallback.cover.subtitle, 80),
      dedication: readerField(parsedCover.dedication, fallback.cover.dedication, 120),
      backCoverBlurb: readerField(parsedCover.backCoverBlurb, fallback.cover.backCoverBlurb, 260),
      kicker: fallback.cover.kicker,
    },
    closing: {
      title: readerField(parsedClosing.title, fallback.closing.title, 42),
      body: readerField(parsedClosing.body, fallback.closing.body, 260),
    },
    chapters: sanitizedChapters,
  };
}

async function buildAgentManifest(input: BuildPublicationManifestInput) {
  if (!hasFactChatApiKey()) {
    throw Object.assign(new Error('Publication manifest agent is not configured.'), {
      statusCode: 503,
      providerCode: 'config_missing',
    });
  }
  if (input.records.length === 0) {
    throw Object.assign(new Error('Publication manifest agent has no source records.'), {
      statusCode: 422,
      providerCode: 'source_records_missing',
    });
  }

  const client = getFactChatClient();
  const providerInput = normalizeFactChatChatCompletionInput({
    model: 'dearlog-writing',
    response_format: { type: 'json_object' },
    temperature: 0.2,
    max_completion_tokens: PUBLICATION_MANIFEST_MAX_COMPLETION_TOKENS,
    messages: [
      {
        role: 'system',
        content: PUBLICATION_MANIFEST_SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: `<publication_input_json>
${JSON.stringify({
  seniorName: input.seniorName,
  selectedToneProfile: resolveSelectedToneProfile(input.draftChapters),
  editorialPlan: summarizeEditorialPlanForPrompt(input.editorialPlan),
  writingDraft: summarizeWritingDraftForPrompt(input.writingDraft),
  cover: input.cover,
  sourceRecords: summarizeSourceRecordsForPrompt(input.records, 620),
  draftChapters: summarizeDraftChaptersForPrompt(input.draftChapters),
  chapters: input.chapters,
  photos: input.photos.map((photo) => ({
    id: photo.id,
    caption: photo.caption,
    capturedDate: photo.capturedDate,
    location: photo.location,
  })),
})}
</publication_input_json>`,
      },
    ],
  }, 'writing') as Record<string, unknown>;
  const response = await createChatCompletionWithUsage<any>({
    client,
    endpoint: 'publication_manifest',
    providerInput,
    context: input.usageContext,
    timeoutMs: input.agentTimeoutMs ?? 12_000,
  });

  const content = extractAgentTextContent(response);
  if (!content) {
    throw Object.assign(new Error('Publication manifest agent returned empty content.'), {
      statusCode: 502,
      providerCode: 'empty_content',
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw Object.assign(new Error(`Publication manifest agent returned invalid JSON: ${compactAgentError(error)}`), {
      statusCode: 502,
      providerCode: 'invalid_json',
    });
  }

  const sanitized = sanitizeAgentManifest(parsed, input);
  if (!sanitized) {
    throw Object.assign(new Error('Publication manifest agent response did not pass source grounding checks.'), {
      statusCode: 422,
      providerCode: 'sanitize_rejected',
    });
  }
  return sanitized;
}

export async function buildPublicationManifest(input: BuildPublicationManifestInput): Promise<PublicationManifest> {
  const requireAgent = input.requireAgentStages || input.requireManifestAgent;
  let plannedInput = input;
  try {
    const editorialPlan = input.editorialPlan ?? await buildPublicationEditorialPlan({
      ...input,
      useAgent: input.useAgent,
    });
    plannedInput = { ...input, editorialPlan };
    const writingDraft = input.writingDraft ?? await buildPublicationWritingDraft({
      ...plannedInput,
      useAgent: input.useAgent,
    });
    plannedInput = { ...plannedInput, writingDraft };
  } catch (error) {
    if (requireAgent) throw error;
    // Manifest generation can continue with source-grounded fallback behavior.
  }

  if (plannedInput.useAgent === false) {
    if (requireAgent) {
      throw Object.assign(new Error('기록집 구성 에이전트를 사용할 수 없어 기록집을 만들지 못했습니다.'), {
        statusCode: 503,
      });
    }
    return buildBaseManifest(plannedInput, 'fallback');
  }

  try {
    const agentManifest = await buildAgentManifest(plannedInput);
    if (agentManifest) return agentManifest;
  } catch (error) {
    if (requireAgent) throw error;
    // The fallback path keeps publication generation available and still enforces source IDs.
  }

  if (requireAgent) {
    throw Object.assign(new Error('기록집 구성 에이전트가 최종 구성을 완성하지 못했습니다. 잠시 후 다시 시도해주세요.'), {
      statusCode: 503,
    });
  }

  await recordInternalAiUsage({
    context: plannedInput.usageContext,
    endpoint: 'publication_manifest',
    outcome: 'fallback',
    statusCode: 200,
    errorMessage: 'Publication manifest used fallback.',
  });
  return buildBaseManifest(plannedInput, 'fallback');
}
