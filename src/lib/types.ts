/**
 * Shared type definitions for Dearlog.
 * All interfaces and types used across agents, modules, and UI components.
 */

// ─── Chat & Session ─────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

// ─── Verification & Confidence ───────────────────────────────────────────────

export type ConfidenceLabel = '확인됨' | '추정' | '추가 확인 필요';

export interface ContradictionReport {
  memoryIdA: string;
  memoryIdB: string;
  conflictingFields: string[];
  severity: 'soft' | 'hard';
  explanation: string; // Korean natural-language explanation
}

// ─── RAG ─────────────────────────────────────────────────────────────────────

export interface VectorEntry {
  memoryId: string;
  embedding: number[];
  text: string;
}

// ─── Tone Calibrator ─────────────────────────────────────────────────────────

export interface SpeechProfile {
  sentenceEndings: string[]; // e.g., ["~했지", "~란다"]
  vocabularyPreferences: Record<string, string>; // standard -> preferred
  fillerWords: string[]; // e.g., ["그래가지고", "인자"]
  characteristicExpressions: string[];
  dialect: string | null;
  sessionCount: number;
  lastUpdated: string;
}

// ─── Consent & Access Control ────────────────────────────────────────────────

export type ConsentStatus = 'granted' | 'revoked' | 'needs_review';

export type AccessTier = '본인만' | '지정 가족' | '전체 가족';

export type UserRole = 'senior' | 'guardian';

export interface ConsentSettingsV2 {
  출판: ConsentStatus;
  가족열람: ConsentStatus;
  챗봇: ConsentStatus;
  사후공개: ConsentStatus;
  민감정보: ConsentStatus;
}

export interface MemoryConsent {
  status: ConsentStatus;
  accessTier: AccessTier;
  designatedFamilyIds: string[];
  lastModified: string;
}

// ─── Autobiography & Chapters ────────────────────────────────────────────────

export interface Chapter {
  id: string;
  title: string;
  summary: string;
  memoryIds: string[];
  timePeriod: string;
}

export interface ChapterStructure {
  chapters: Chapter[];
}

export interface ChapterNarrative {
  chapterId: string;
  title: string;
  body: string; // Narrative text with inline citations
  citations: Citation[];
}

export interface Citation {
  sentenceIndex: number;
  memoryId: string;
}

export interface Autobiography {
  title: string;
  chapters: ChapterNarrative[];
  generatedAt: string;
}

// ─── Verification v2: Conflict Types & JSON ──────────────────────────────────

export type ConflictType = 'TIME' | 'PERSON' | 'FACT' | 'DUPLICATE';

export interface ConflictDetail {
  type: ConflictType;
  relatedMemoryIds: string[];
  explanation: string;
  severity: 'soft' | 'hard';
}

export interface VerificationJSON {
  memoryId: string;
  status: 'PASS' | 'FLAG';
  conflicts: ConflictDetail[];
  confidenceLabel: 'CONFIRMED' | 'ESTIMATED' | 'UNVERIFIED';
}

// ─── Ghostwriter v2: Chapter Categories & Annotations ────────────────────────

export type ChapterCategory = '어린시절' | '가족' | '직업' | '전환점' | '전하고싶은말';

export interface SourceChunkAnnotation {
  sentenceRange: [number, number];
  memoryId: string;
}

export interface GhostwriterChapter {
  id: string;
  category: ChapterCategory;
  title: string;
  narrative: string;
  sourceChunks: SourceChunkAnnotation[];
  styleRatio: { conversational: number; literary: number };
}

// ─── Digital Twin v2: Question Classification & Evidence ─────────────────────

export type QuestionCategory = '사실확인형' | '시기회상형' | '가치관탐색형' | '인물관련형';

export interface EvidenceBadge {
  memoryId: string;
  relevanceScore: number;
  excerpt: string;
}

export interface DigitalTwinResponse {
  text: string;
  evidenceBadges: EvidenceBadge[];
  linkedMemoryCards: string[];
  questionCategory: QuestionCategory;
}

// ─── Family Question Queue (Agent ⑧) ────────────────────────────────────────

export type PriorityTag = 'high' | 'normal' | 'low';

export interface FamilyQuestion {
  id: string;
  questionText: string;
  category?: string | null;
  chapterId?: string | null;
  photoId?: string | null;
  photoUrl?: string | null;
  submittedBy: string;
  anonymous: boolean;
  priority: PriorityTag;
  status: 'pending' | 'delivered' | 'answered' | 'archived';
  createdAt: string;
  answeredAt: string | null;
  answerMemoryId: string | null;
}

// ─── Calendar Trigger Agent (Agent ⑨) ───────────────────────────────────────

export type CalendarEventType = '결혼식' | '졸업' | '생일' | '기념일' | '기일';

export interface CalendarEvent {
  id: string;
  title: string;
  eventType: CalendarEventType;
  date: string;
  relatedPeople: string[];
  description: string;
}

export interface EditedMemoryDelivery {
  memoryId: string;
  editedNarrative: string;
  targetFamilyIds: string[];
}

export interface InterviewSession {
  sessionId: string;
  questions: string[];
  eventContext: CalendarEvent;
}

export interface CalendarTriggerResult {
  event: CalendarEvent;
  action: 'auto_edit' | 'new_interview';
  relatedMemoryIds: string[];
  output: EditedMemoryDelivery | InterviewSession;
}

// ─── Photo Recall Agent (Agent ⑩) ───────────────────────────────────────────

export interface PhotoAnalysisResult {
  photoId: string;
  people: string[];
  places: string[];
  objects: string[];
  estimatedEra: string;
  description: string;
}

export interface PhotoMetadata {
  fileName: string | null;
  fileType: string | null;
  fileSize: number | null;
  lastModified: string | null;
  capturedAt: string | null;
  inferredPlace: string | null;
  capturedAtSource?: 'exif' | 'fileName' | null;
  cameraMake?: string | null;
  cameraModel?: string | null;
  gpsLatitude?: number | null;
  gpsLongitude?: number | null;
}

export interface StoredPhoto {
  id: string;
  url: string;
  uploadedAt: string;
  analysis: PhotoAnalysisResult | null;
  metadata?: PhotoMetadata;
  linkedMemoryIds: string[];
}

// ─── Interviewer v2: Session & Summary ───────────────────────────────────────

export interface MemorySummaryCard {
  topic: string;
  keyPeople: string[];
  keyPlaces: string[];
  keyEmotions: string[];
  timePeriod: string;
  briefSummary: string;
}

export interface SessionJSON {
  sessionId: string;
  startedAt: string;
  endedAt: string;
  messages: ChatMessage[];
  memorySummaryCard: MemorySummaryCard;
  triggeredBy: 'user' | 'calendar' | 'photo' | 'family_question';
}

// ─── Memory (Extended) ───────────────────────────────────────────────────────

export type PrivacyLevel = 'public' | 'family' | 'private';

export interface Memory {
  // Existing fields
  id: string;
  date: string;
  topic: string;
  originalTranscript: string;
  cleanedTranscript: string;
  publishVersion: string;
  tags: {
    people: string[];
    places: string[];
    emotions: string[];
    timePeriod: string;
  };
  privacy: PrivacyLevel;

  // New fields
  confidenceLabel: ConfidenceLabel;
  contradictions: string[]; // IDs of contradicting memories
  consent: MemoryConsent;
  consentSettings?: ConsentSettingsV2;
  embedding: number[] | null; // stored for incremental updates
}
