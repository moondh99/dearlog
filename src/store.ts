import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Memory,
  PrivacyLevel,
  ConfidenceLabel,
  MemoryConsent,
  ConsentSettingsV2,
  VectorEntry,
  SpeechProfile,
  ChapterStructure,
  ChapterNarrative,
  PosthumousPolicy,
  FamilyQuestion,
  CalendarEvent,
  StoredPhoto,
  UserRole,
} from './lib/types';
import { buildCapstoneDemoState, isDemoId } from './lib/demo/capstone-demo-data';

// Re-export types that consumers of the store may need
export type { Memory, PrivacyLevel };

const DEARLOG_STORAGE_KEY = 'dearlog-storage';
const LEGACY_STORAGE_KEY = 'warm-memoir-storage';

function migrateLegacyStorageKey(): void {
  if (typeof window === 'undefined') return;
  try {
    const storage = window.localStorage;
    if (!storage.getItem(DEARLOG_STORAGE_KEY) && storage.getItem(LEGACY_STORAGE_KEY)) {
      storage.setItem(DEARLOG_STORAGE_KEY, storage.getItem(LEGACY_STORAGE_KEY) ?? '');
    }
  } catch {
    // Ignore storage access errors, e.g. privacy mode or SSR-like environments.
  }
}

migrateLegacyStorageKey();

// ─── State Slice Interfaces ──────────────────────────────────────────────────

export interface RAGIndexState {
  entries: VectorEntry[];
  lastUpdated: string;
}

export interface SpeechProfileState {
  profile: SpeechProfile | null;
  sessionCount: number;
}

export interface AutobiographyState {
  currentStructure: ChapterStructure | null;
  narratives: ChapterNarrative[];
  lastGenerated: string | null;
}

export interface PosthumousPolicyState {
  policy: PosthumousPolicy;
  confirmedAt: string | null;
}

export interface FamilyQuestionState {
  questions: FamilyQuestion[];
  lastUpdated: string;
}

export interface CalendarState {
  events: CalendarEvent[];
  processedEventIds: string[];
  lastSynced: string;
}

export interface PhotoState {
  photos: StoredPhoto[];
  lastUpdated: string;
}

export interface SeniorProfile {
  name: string;
  birthDecade: string;
  preferredName: string;
}

export interface AuthState {
  phoneNumber: string;
  isAuthenticated: boolean;
  role: UserRole | null;
  profile: SeniorProfile | null;
  onboardingCompleted: boolean;
  familyInviteSkipped: boolean;
  lastSignedInAt: string | null;
}

export interface DemoState {
  enabled: boolean;
  offlineMode: boolean;
  seededAt: string | null;
}

// ─── App State Interface ─────────────────────────────────────────────────────

interface AppState {
  // Existing
  memories: Memory[];

  // New slices
  ragIndex: RAGIndexState;
  speechProfile: SpeechProfileState;
  autobiography: AutobiographyState;
  posthumousPolicy: PosthumousPolicyState;
  familyQuestions: FamilyQuestionState;
  calendar: CalendarState;
  photos: PhotoState;
  auth: AuthState;
  demo: DemoState;

  // Memory actions (existing)
  addMemory: (memory: Memory) => void;
  updateMemoryPrivacy: (id: string, privacy: PrivacyLevel) => void;
  updateMemoryPublishVersion: (id: string, publishVersion: string) => void;

  // Memory actions (new)
  updateMemoryConfidence: (id: string, label: ConfidenceLabel, contradictions: string[]) => void;
  updateMemoryConsent: (id: string, consent: MemoryConsent) => void;
  updateMemoryConsentSettings: (id: string, settings: ConsentSettingsV2) => void;
  updateMemoryEmbedding: (id: string, embedding: number[]) => void;

  // RAG actions
  addRAGEntry: (entry: VectorEntry) => void;
  updateRAGEntry: (memoryId: string, entry: VectorEntry) => void;
  removeRAGEntry: (memoryId: string) => void;

  // Speech profile actions
  setSpeechProfile: (profile: SpeechProfile) => void;
  incrementSessionCount: () => void;

  // Autobiography actions
  setChapterStructure: (structure: ChapterStructure) => void;
  setChapterNarrative: (narrative: ChapterNarrative) => void;
  clearAutobiography: () => void;

  // Posthumous policy actions
  setPosthumousPolicy: (policy: PosthumousPolicy) => void;

  // Family Question actions
  addFamilyQuestion: (question: FamilyQuestion) => void;
  updateFamilyQuestion: (id: string, updates: Partial<FamilyQuestion>) => void;
  removeFamilyQuestion: (id: string) => void;

  // Calendar actions
  setCalendarEvents: (events: CalendarEvent[]) => void;
  addCalendarEvent: (event: CalendarEvent) => void;
  markEventProcessed: (eventId: string) => void;
  updateCalendarLastSynced: (timestamp: string) => void;

  // Photo actions
  addPhoto: (photo: StoredPhoto) => void;
  updatePhoto: (id: string, updates: Partial<StoredPhoto>) => void;
  removePhoto: (id: string) => void;

  // Auth actions
  startPhoneAuth: (phoneNumber: string) => void;
  verifyPhoneCode: (code: string) => boolean;
  selectRole: (role: UserRole) => void;
  saveSeniorProfile: (profile: SeniorProfile) => void;
  skipFamilyInvite: () => void;
  signOut: () => void;

  // Demo actions
  seedDemoData: () => void;
  clearDemoData: () => void;
  setDemoOfflineMode: (enabled: boolean) => void;
}

// ─── Default Values for Backward Compatibility ───────────────────────────────

const DEFAULT_CONSENT: MemoryConsent = {
  status: 'granted',
  accessTier: '본인만',
  designatedFamilyIds: [],
  lastModified: '',
};

const DEFAULT_CONFIDENCE_LABEL: ConfidenceLabel = '확인됨';

const DEFAULT_CONSENT_SETTINGS: ConsentSettingsV2 = {
  출판: 'granted',
  가족열람: 'granted',
  챗봇: 'granted',
  사후공개: 'granted',
  민감정보: 'granted',
};

const DEFAULT_AUTH_STATE: AuthState = {
  phoneNumber: '',
  isAuthenticated: false,
  role: null,
  profile: null,
  onboardingCompleted: false,
  familyInviteSkipped: false,
  lastSignedInAt: null,
};

const DEFAULT_DEMO_STATE: DemoState = {
  enabled: false,
  offlineMode: false,
  seededAt: null,
};

export function createAuthenticatedAuthState(overrides: Partial<AuthState> = {}): AuthState {
  return {
    ...DEFAULT_AUTH_STATE,
    phoneNumber: '01012345678',
    isAuthenticated: true,
    role: 'senior',
    profile: {
      name: '김영자',
      birthDecade: '1950년대',
      preferredName: '어르신',
    },
    onboardingCompleted: true,
    lastSignedInAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/**
 * Ensures a memory loaded from persisted storage has all required fields.
 * Handles backward compatibility when new fields are missing from old data.
 * Supports both Memory and MemoryV2 fields.
 */
function migrateMemory(raw: Partial<Memory> & { id: string }): Memory {
  return {
    ...raw,
    id: raw.id,
    date: raw.date ?? '',
    topic: raw.topic ?? '',
    originalTranscript: raw.originalTranscript ?? '',
    cleanedTranscript: raw.cleanedTranscript ?? '',
    publishVersion: raw.publishVersion ?? '',
    tags: raw.tags ?? { people: [], places: [], emotions: [], timePeriod: '' },
    privacy: raw.privacy ?? 'private',
    confidenceLabel: raw.confidenceLabel ?? DEFAULT_CONFIDENCE_LABEL,
    contradictions: raw.contradictions ?? [],
    consent: raw.consent ?? { ...DEFAULT_CONSENT },
    consentSettings: (raw as any).consentSettings ?? deriveConsentSettings(raw.consent),
    embedding: raw.embedding ?? null,
    // MemoryV2 fields (backward compatible defaults)
    nerTags: (raw as any).nerTags ?? [],
    emotionTags: (raw as any).emotionTags ?? [],
    diffRecord: (raw as any).diffRecord ?? null,
    linkedPhotoIds: (raw as any).linkedPhotoIds ?? [],
    sourceSessionId: (raw as any).sourceSessionId ?? '',
  } as Memory;
}

function deriveConsentSettings(consent?: MemoryConsent): ConsentSettingsV2 {
  if (!consent || consent.status === 'granted') {
    return { ...DEFAULT_CONSENT_SETTINGS };
  }

  return {
    출판: 'revoked',
    가족열람: 'revoked',
    챗봇: 'revoked',
    사후공개: 'revoked',
    민감정보: 'revoked',
  };
}

// ─── Store Creation ──────────────────────────────────────────────────────────

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      // ── Initial State ────────────────────────────────────────────────────
      memories: [],

      ragIndex: {
        entries: [],
        lastUpdated: '',
      },

      speechProfile: {
        profile: null,
        sessionCount: 0,
      },

      autobiography: {
        currentStructure: null,
        narratives: [],
        lastGenerated: null,
      },

      posthumousPolicy: {
        policy: 'maintain_current',
        confirmedAt: null,
      },

      familyQuestions: {
        questions: [],
        lastUpdated: '',
      },

      calendar: {
        events: [],
        processedEventIds: [],
        lastSynced: '',
      },

      photos: {
        photos: [],
        lastUpdated: '',
      },

      auth: { ...DEFAULT_AUTH_STATE },
      demo: { ...DEFAULT_DEMO_STATE },

      // ── Memory Actions (existing) ────────────────────────────────────────
      addMemory: (memory) =>
        set((state) => ({ memories: [memory, ...state.memories] })),

      updateMemoryPrivacy: (id, privacy) =>
        set((state) => ({
          memories: state.memories.map((m) =>
            m.id === id ? { ...m, privacy } : m
          ),
        })),

      updateMemoryPublishVersion: (id, publishVersion) =>
        set((state) => ({
          memories: state.memories.map((m) =>
            m.id === id ? { ...m, publishVersion } : m
          ),
        })),

      // ── Memory Actions (new) ─────────────────────────────────────────────
      updateMemoryConfidence: (id, label, contradictions) =>
        set((state) => ({
          memories: state.memories.map((m) =>
            m.id === id
              ? { ...m, confidenceLabel: label, contradictions }
              : m
          ),
        })),

      updateMemoryConsent: (id, consent) =>
        set((state) => ({
          memories: state.memories.map((m) =>
            m.id === id ? { ...m, consent } : m
          ),
        })),

      updateMemoryConsentSettings: (id, consentSettings) =>
        set((state) => ({
          memories: state.memories.map((m) =>
            m.id === id ? { ...m, consentSettings } : m
          ),
        })),

      updateMemoryEmbedding: (id, embedding) =>
        set((state) => ({
          memories: state.memories.map((m) =>
            m.id === id ? { ...m, embedding } : m
          ),
        })),

      // ── RAG Actions ──────────────────────────────────────────────────────
      addRAGEntry: (entry) =>
        set((state) => ({
          ragIndex: {
            entries: [...state.ragIndex.entries, entry],
            lastUpdated: new Date().toISOString(),
          },
        })),

      updateRAGEntry: (memoryId, entry) =>
        set((state) => ({
          ragIndex: {
            entries: state.ragIndex.entries.map((e) =>
              e.memoryId === memoryId ? entry : e
            ),
            lastUpdated: new Date().toISOString(),
          },
        })),

      removeRAGEntry: (memoryId) =>
        set((state) => ({
          ragIndex: {
            entries: state.ragIndex.entries.filter(
              (e) => e.memoryId !== memoryId
            ),
            lastUpdated: new Date().toISOString(),
          },
        })),

      // ── Speech Profile Actions ───────────────────────────────────────────
      setSpeechProfile: (profile) =>
        set((state) => ({
          speechProfile: {
            ...state.speechProfile,
            profile,
          },
        })),

      incrementSessionCount: () =>
        set((state) => ({
          speechProfile: {
            ...state.speechProfile,
            sessionCount: state.speechProfile.sessionCount + 1,
          },
        })),

      // ── Autobiography Actions ────────────────────────────────────────────
      setChapterStructure: (structure) =>
        set((state) => ({
          autobiography: {
            ...state.autobiography,
            currentStructure: structure,
          },
        })),

      setChapterNarrative: (narrative) =>
        set((state) => ({
          autobiography: {
            ...state.autobiography,
            narratives: [
              ...state.autobiography.narratives.filter(
                (n) => n.chapterId !== narrative.chapterId
              ),
              narrative,
            ],
            lastGenerated: new Date().toISOString(),
          },
        })),

      clearAutobiography: () =>
        set(() => ({
          autobiography: {
            currentStructure: null,
            narratives: [],
            lastGenerated: null,
          },
        })),

      // ── Posthumous Policy Actions ────────────────────────────────────────
      setPosthumousPolicy: (policy) =>
        set(() => ({
          posthumousPolicy: {
            policy,
            confirmedAt: new Date().toISOString(),
          },
        })),

      // ── Family Question Actions ──────────────────────────────────────────
      addFamilyQuestion: (question) =>
        set((state) => ({
          familyQuestions: {
            questions: [...state.familyQuestions.questions, question],
            lastUpdated: new Date().toISOString(),
          },
        })),

      updateFamilyQuestion: (id, updates) =>
        set((state) => ({
          familyQuestions: {
            questions: state.familyQuestions.questions.map((q) =>
              q.id === id ? { ...q, ...updates } : q
            ),
            lastUpdated: new Date().toISOString(),
          },
        })),

      removeFamilyQuestion: (id) =>
        set((state) => ({
          familyQuestions: {
            questions: state.familyQuestions.questions.filter((q) => q.id !== id),
            lastUpdated: new Date().toISOString(),
          },
        })),

      // ── Calendar Actions ─────────────────────────────────────────────────
      setCalendarEvents: (events) =>
        set((state) => ({
          calendar: {
            ...state.calendar,
            events,
            lastSynced: new Date().toISOString(),
          },
        })),

      addCalendarEvent: (event) =>
        set((state) => ({
          calendar: {
            ...state.calendar,
            events: [...state.calendar.events, event],
          },
        })),

      markEventProcessed: (eventId) =>
        set((state) => ({
          calendar: {
            ...state.calendar,
            processedEventIds: [...state.calendar.processedEventIds, eventId],
          },
        })),

      updateCalendarLastSynced: (timestamp) =>
        set((state) => ({
          calendar: {
            ...state.calendar,
            lastSynced: timestamp,
          },
        })),

      // ── Photo Actions ────────────────────────────────────────────────────
      addPhoto: (photo) =>
        set((state) => ({
          photos: {
            photos: [...state.photos.photos, photo],
            lastUpdated: new Date().toISOString(),
          },
        })),

      updatePhoto: (id, updates) =>
        set((state) => ({
          photos: {
            photos: state.photos.photos.map((p) =>
              p.id === id ? { ...p, ...updates } : p
            ),
            lastUpdated: new Date().toISOString(),
          },
        })),

      removePhoto: (id) =>
        set((state) => ({
          photos: {
            photos: state.photos.photos.filter((p) => p.id !== id),
            lastUpdated: new Date().toISOString(),
          },
        })),

      // ── Auth Actions ─────────────────────────────────────────────────────
      startPhoneAuth: (phoneNumber) =>
        set((state) => ({
          auth: {
            ...state.auth,
            phoneNumber,
          },
        })),

      verifyPhoneCode: (code) => {
        const verified = /^\d{6}$/.test(code.trim());
        if (verified) {
          set((state) => ({
            auth: {
              ...state.auth,
              isAuthenticated: true,
              lastSignedInAt: new Date().toISOString(),
            },
          }));
        }
        return verified;
      },

      selectRole: (role) =>
        set((state) => ({
          auth: {
            ...state.auth,
            role,
            onboardingCompleted: role === 'family',
          },
        })),

      saveSeniorProfile: (profile) =>
        set((state) => ({
          auth: {
            ...state.auth,
            role: state.auth.role ?? 'senior',
            profile,
            onboardingCompleted: true,
          },
        })),

      skipFamilyInvite: () =>
        set((state) => ({
          auth: {
            ...state.auth,
            familyInviteSkipped: true,
          },
        })),

      signOut: () =>
        set(() => ({
          auth: { ...DEFAULT_AUTH_STATE },
        })),

      // ── Demo Actions ─────────────────────────────────────────────────────
      seedDemoData: () =>
        set((state) => {
          const demo = buildCapstoneDemoState();
          const seededAt = new Date().toISOString();

          return {
            memories: [
              ...demo.memories,
              ...state.memories.filter((memory) => !isDemoId(memory.id)),
            ],
            photos: {
              photos: [
                ...demo.photos,
                ...state.photos.photos.filter((photo) => !isDemoId(photo.id)),
              ],
              lastUpdated: seededAt,
            },
            familyQuestions: {
              questions: [
                ...demo.familyQuestions,
                ...state.familyQuestions.questions.filter((question) => !isDemoId(question.id)),
              ],
              lastUpdated: seededAt,
            },
            ragIndex: {
              entries: [
                ...demo.ragEntries,
                ...state.ragIndex.entries.filter((entry) => !isDemoId(entry.memoryId)),
              ],
              lastUpdated: seededAt,
            },
            speechProfile: {
              profile: demo.speechProfile,
              sessionCount: demo.speechProfile.sessionCount,
            },
            autobiography: {
              ...state.autobiography,
              narratives: [
                ...demo.autobiographyNararatives,
                ...state.autobiography.narratives.filter((chapter) => !isDemoId(chapter.chapterId)),
              ],
              lastGenerated: seededAt,
            },
            auth: demo.auth,
            demo: {
              enabled: true,
              offlineMode: true,
              seededAt,
            },
          };
        }),

      clearDemoData: () =>
        set((state) => ({
          memories: state.memories.filter((memory) => !isDemoId(memory.id)),
          photos: {
            photos: state.photos.photos.filter((photo) => !isDemoId(photo.id)),
            lastUpdated: new Date().toISOString(),
          },
          familyQuestions: {
            questions: state.familyQuestions.questions.filter((question) => !isDemoId(question.id)),
            lastUpdated: new Date().toISOString(),
          },
          ragIndex: {
            entries: state.ragIndex.entries.filter((entry) => !isDemoId(entry.memoryId)),
            lastUpdated: new Date().toISOString(),
          },
          autobiography: {
            ...state.autobiography,
            narratives: state.autobiography.narratives.filter((chapter) => !isDemoId(chapter.chapterId)),
            lastGenerated: state.autobiography.narratives.some((chapter) => isDemoId(chapter.chapterId))
              ? new Date().toISOString()
              : state.autobiography.lastGenerated,
          },
          speechProfile: state.demo.enabled
            ? { profile: null, sessionCount: 0 }
            : state.speechProfile,
          demo: { ...DEFAULT_DEMO_STATE },
        })),

      setDemoOfflineMode: (enabled) =>
        set((state) => ({
          demo: {
            ...state.demo,
            enabled: state.demo.enabled || enabled,
            offlineMode: enabled,
          },
        })),
    }),
    {
      name: DEARLOG_STORAGE_KEY,
      // Migrate persisted data to handle missing new fields
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<AppState> | undefined;
        if (!persisted) return currentState;

        return {
          ...currentState,
          ...persisted,
          // Migrate memories to ensure new fields exist
          memories: (persisted.memories ?? []).map((m: any) => migrateMemory(m)),
          // Ensure new slices have defaults if missing from persisted data
          ragIndex: persisted.ragIndex ?? currentState.ragIndex,
          speechProfile: persisted.speechProfile ?? currentState.speechProfile,
          autobiography: persisted.autobiography ?? currentState.autobiography,
          posthumousPolicy: persisted.posthumousPolicy ?? currentState.posthumousPolicy,
          familyQuestions: persisted.familyQuestions ?? currentState.familyQuestions,
          calendar: persisted.calendar ?? currentState.calendar,
          photos: persisted.photos ?? currentState.photos,
          auth: {
            ...DEFAULT_AUTH_STATE,
            ...(persisted.auth ?? {}),
          },
          demo: {
            ...DEFAULT_DEMO_STATE,
            ...(persisted.demo ?? {}),
          },
        };
      },
    }
  )
);
