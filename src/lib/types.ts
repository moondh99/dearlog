/**
 * Shared type definitions for Dearlog.
 * All interfaces and types used across agents, modules, and UI components.
 */

// ─── Chat & Session ─────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface SessionContext {
  emotionState: EmotionClassification;
  silenceState: SilenceState;
  speechProfile: SpeechProfile | null;
}

// ─── Emotion ─────────────────────────────────────────────────────────────────

export interface EmotionClassification {
  current: EmotionLevel;
  trajectory: EmotionLevel[]; // last 3 messages
  confidence: number;
}

export type EmotionLevel = 'positive' | 'neutral' | 'sensitive' | 'distressed';

// ─── Silence Detection ───────────────────────────────────────────────────────

export interface SilenceState {
  isActive: boolean;
  silenceDuration: number; // seconds
  phase: SilencePhase;
}

export type SilencePhase = 'normal' | 'waiting' | 'encouraging' | 'offering_options';

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

export interface SearchResult {
  memoryId: string;
  score: number; // cosine similarity 0-1
  text: string;
}

export interface VectorEntry {
  memoryId: string;
  embedding: number[];
  text: string;
}

// ─── Tag Database ───────────────────────────────────────────────────────────

export type TagCategory = 'person' | 'place' | 'emotion' | 'time' | 'event' | 'object';

export interface TagRecord {
  id: string;
  label: string;
  category: TagCategory;
  usageCount: number;
  source: 'memory' | 'photo' | 'derived';
}

export interface MemoryTagLink {
  memoryId: string;
  tagId: string;
  confidence: number;
  source: 'memory' | 'photo' | 'derived';
}

export interface TagDatabase {
  tags: TagRecord[];
  memoryTagLinks: MemoryTagLink[];
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

export type ProfileStatus = 'insufficient_data' | 'active';

// ─── Consent & Access Control ────────────────────────────────────────────────

export type ConsentStatus = 'granted' | 'revoked';

export type AccessTier = '본인만' | '지정 가족' | '전체 가족';

export type PosthumousPolicy = 'full_release' | 'maintain_current' | 'delete_all';

export type UserRole = 'senior' | 'family';

export type AccessTierV2 = 'NO_ACCESS' | 'SUMMARY' | 'FULL_READ' | 'FULL_ACCESS';

export type ConsentCategoryV2 = '출판' | '가족열람' | '챗봇' | '사후공개' | '민감정보';

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

export type AutobiographyStyle = 'memoir' | 'news' | 'letter' | 'interview' | 'diary';

// ─── Agent Pipeline ──────────────────────────────────────────────────────────

export interface AgentError {
  agent: AgentName;
  error: string;
  skipped: boolean;
}

export type AgentName =
  | 'interviewer'
  | 'archivist'
  | 'verification'
  | 'ghostwriter'
  | 'tone_calibrator'
  | 'persona'
  | 'emotion_analyzer'
  | 'family_question_queue'
  | 'calendar_trigger'
  | 'photo_recall'
  | 'digital_twin'
  | 'consent_access';

export interface ProcessingResult {
  memory: Memory;
  embedding: number[];
  contradictions: ContradictionReport[];
  confidenceLabel: ConfidenceLabel;
  errors: AgentError[];
}

// ─── Archivist v2: NER, Emotion, Diff, Timeline ─────────────────────────────

export type NERCategory = 'event' | 'person' | 'place' | 'time';

export interface NERTag {
  text: string;
  category: NERCategory;
  startIndex: number;
  endIndex: number;
}

export type EmotionTag = '자부심' | '후회' | '상실' | '감사';

export interface DiffChange {
  type: 'addition' | 'deletion' | 'modification';
  position: number;
  original: string;
  modified: string;
}

export interface DiffRecord {
  original: string;
  refined: string;
  changes: DiffChange[];
}

export interface TimelineEntry {
  memoryId: string;
  timePeriod: string;
  date: string;
  summary: string;
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

export interface PhotoRecallResult {
  analysis: PhotoAnalysisResult;
  interviewQuestions: string[];
  linkedMemoryId: string | null;
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

// ─── Memory v2 (Extended with NER, Emotion, Diff, Photo, Session) ────────────

export interface MemoryV2 extends Memory {
  nerTags: NERTag[];
  emotionTags: EmotionTag[];
  diffRecord: DiffRecord | null;
  linkedPhotoIds: string[];
  sourceSessionId: string;
}
