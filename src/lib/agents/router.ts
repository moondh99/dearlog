/**
 * Agent Router - Pipeline Orchestrator (v2)
 *
 * Central orchestrator that dispatches work to specialized agents and chains
 * their outputs. Handles error resilience by catching individual agent failures,
 * logging them, and continuing the pipeline.
 *
 * v2 additions:
 * - Family Question Queue injection into interview
 * - Calendar Trigger event processing
 * - Photo Recall upload processing
 * - Pipeline branching based on verification result (기억 없음/있음)
 * - Parallel execution of independent branches
 * - Data preservation across all agents (no fields dropped/mutated)
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6
 */

import type {
  ChatMessage,
  SessionContext,
  EmotionClassification,
  Memory,
  ProcessingResult,
  AgentError,
  ContradictionReport,
  ConfidenceLabel,
  Autobiography,
  FamilyQuestion,
  CalendarEvent,
  CalendarTriggerResult,
  PhotoRecallResult,
  VerificationJSON,
  MemoryV2,
} from '../types';
import { classify } from './emotion-analyzer';
import { generateInterviewResponse } from './interviewer';
import { processTranscriptV2 } from './archivist';
import { checkContradictions } from './verification';
import { analyzeSpeechPatterns, updateProfile } from './tone-calibrator';
import { restructureForInterview } from './family-question-queue';
import { processEvent as processCalendarTriggerEvent } from './calendar-trigger';
import { storePhoto, analyzePhoto, generateQuestions } from './photo-recall';
import { ragIndex } from '../rag/index';
import { useStore } from '../../store';

// ─── Exported Interfaces ─────────────────────────────────────────────────────

export interface InterviewResponse {
  text: string;
  emotionState: EmotionClassification;
}

export interface AutobiographyResult {
  autobiography: Autobiography;
}

// ─── Interview Message Handling ──────────────────────────────────────────────

/**
 * Handles an interview message by chaining Emotion Analyzer → Interviewer Agent.
 *
 * 1. Calls emotion analyzer to classify the message's emotional tone
 * 2. Updates sessionContext with the new emotion state
 * 3. Calls interviewer agent to generate a response with the updated context
 * 4. Returns the response text and updated emotion state
 *
 * On emotion analyzer error: defaults to current emotion state, continues pipeline.
 * On interviewer error: returns fallback message.
 */
export async function handleInterviewMessage(
  message: string,
  history: ChatMessage[],
  sessionContext: SessionContext
): Promise<InterviewResponse> {
  let emotionState: EmotionClassification = sessionContext.emotionState;

  // Step 1: Emotion Analyzer
  try {
    emotionState = await classify(message, history);
  } catch (error) {
    console.error('Agent Router: Emotion Analyzer failed, using current state:', error);
    // Continue with existing emotion state
  }

  // Step 2: Update session context with new emotion state (no mutation of original)
  const updatedSessionContext: SessionContext = {
    ...sessionContext,
    emotionState,
  };

  // Step 3: Interviewer Agent
  const text = await generateInterviewResponse(history, updatedSessionContext);

  return {
    text,
    emotionState,
  };
}

// ─── Family Question Injection (v2) ─────────────────────────────────────────

/**
 * Injects a family question into the interview session by restructuring it
 * into a natural conversational form suitable for the current context.
 *
 * Data preservation: The original FamilyQuestion object is not mutated.
 * Error resilience: On failure, returns the original question text as fallback.
 *
 * Requirements: 11.1 (pipeline integration), 11.4 (data preservation), 11.5 (error resilience)
 *
 * @param question - The FamilyQuestion to inject
 * @param sessionContext - Current session context for contextual restructuring
 * @returns The restructured question text suitable for the interview
 */
export async function injectFamilyQuestion(
  question: FamilyQuestion,
  sessionContext: SessionContext
): Promise<string> {
  // Create a copy to ensure no mutation of the original question
  const questionCopy: FamilyQuestion = { ...question };

  try {
    // Build interview context from session state
    const interviewContext = `현재 감정 상태: ${sessionContext.emotionState.current}, 침묵 상태: ${sessionContext.silenceState.phase}`;

    const restructuredText = await restructureForInterview(questionCopy, interviewContext);
    return restructuredText;
  } catch (error) {
    console.error('Agent Router: Family Question injection failed:', error);
    // Fallback: return original question text (error resilience)
    return question.questionText;
  }
}

// ─── Calendar Event Processing (v2) ─────────────────────────────────────────

/**
 * Processes a calendar event through the Calendar Trigger Agent.
 *
 * Data preservation: The original CalendarEvent is passed through without mutation.
 * Error resilience: On failure, logs error and re-throws (caller handles).
 *
 * Requirements: 11.1 (pipeline order), 11.4 (data preservation)
 *
 * @param event - The CalendarEvent to process
 * @returns CalendarTriggerResult with action and output
 */
export async function processCalendarEvent(
  event: CalendarEvent
): Promise<CalendarTriggerResult> {
  // Pass a copy to ensure no mutation of the original event
  const eventCopy: CalendarEvent = { ...event, relatedPeople: [...event.relatedPeople] };

  const result = await processCalendarTriggerEvent(eventCopy);
  return result;
}

// ─── Photo Upload Processing (v2) ───────────────────────────────────────────

/**
 * Processes a photo upload through the Photo Recall Agent pipeline:
 * 1. Store and analyze the photo
 * 2. Generate contextual interview questions from analysis
 *
 * Data preservation: Photo data is passed through without mutation.
 * Error resilience: On analysis failure, returns result with available data.
 *
 * Requirements: 11.1 (pipeline integration), 11.4 (data preservation), 11.5 (error resilience)
 *
 * @param photoData - Base64 data URL string or File object
 * @returns PhotoRecallResult with analysis, questions, and linked memory ID
 */
export async function processPhotoUpload(
  photoData: string | File
): Promise<PhotoRecallResult> {
  // Step 1: Store and analyze the photo
  const storedPhoto = await storePhoto(photoData);

  if (!storedPhoto.analysis) {
    // Analysis failed but photo is stored - return minimal result
    return {
      analysis: {
        photoId: storedPhoto.id,
        people: [],
        places: [],
        objects: [],
        estimatedEra: '알 수 없음',
        description: '',
      },
      interviewQuestions: [],
      linkedMemoryId: null,
    };
  }

  // Step 2: Generate interview questions from analysis
  let interviewQuestions: string[] = [];
  try {
    interviewQuestions = await generateQuestions(storedPhoto.analysis);
  } catch (error) {
    console.error('Agent Router: Photo question generation failed:', error);
    // Continue without questions (error resilience)
  }

  return {
    analysis: { ...storedPhoto.analysis },
    interviewQuestions,
    linkedMemoryId: null,
  };
}

// ─── Pipeline Branching (v2) ─────────────────────────────────────────────────

/**
 * Executes pipeline branching based on verification result.
 *
 * Branching logic:
 * - "기억 없음" (FLAG with no related memories): loops back to Archivist for re-indexing
 * - "기억 있음" (related memories exist): continues to parallel branches:
 *   - Branch A: Ghostwriter + Tone Calibrator
 *   - Branch B: Digital Twin + Calendar Trigger
 *
 * Parallel execution: Independent branches (A and B) run concurrently via Promise.allSettled.
 * Data preservation: All data is spread/cloned before passing to agents.
 * Error resilience: Individual agent failures are logged, skipped, and collected.
 *
 * Requirements: 11.2, 11.3, 11.4, 11.5, 11.6
 *
 * @param verificationResult - The VerificationJSON from the Verification Module
 * @returns void (side effects: updates store, logs errors)
 */
export async function executePipelineBranch(
  verificationResult: VerificationJSON
): Promise<{ errors: AgentError[] }> {
  const errors: AgentError[] = [];

  // Create a deep copy to ensure no mutation of the original verification result
  const verificationCopy: VerificationJSON = {
    ...verificationResult,
    conflicts: verificationResult.conflicts.map((c) => ({
      ...c,
      relatedMemoryIds: [...c.relatedMemoryIds],
    })),
  };

  // Determine branching path based on verification status and related memories
  const hasRelatedMemories = verificationCopy.status === 'FLAG'
    ? verificationCopy.conflicts.some((c) => c.relatedMemoryIds.length > 0)
    : true; // PASS means memory is confirmed, related memories exist

  if (verificationCopy.status === 'FLAG' && !hasRelatedMemories) {
    // "기억 없음" path: Loop back to Archivist for re-indexing
    // Requirement 11.2: FLAG with no related memories loops back
    try {
      const memory = useStore.getState().memories.find(
        (m) => m.id === verificationCopy.memoryId
      );
      if (memory) {
        // Re-process through Archivist (re-index in RAG)
        await ragIndex.addMemory(
          memory.id,
          memory.cleanedTranscript,
          memory.tags
        );
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Agent Router: Archivist re-indexing failed:', errorMessage);
      errors.push({ agent: 'archivist', error: errorMessage, skipped: true });
    }

    return { errors };
  }

  // "기억 있음" path: Continue to parallel branches
  // Requirement 11.3: Related memories exist → Ghostwriter/TC AND DT/CT
  // Requirement 11.6: Parallel execution of independent branches

  const memory = useStore.getState().memories.find(
    (m) => m.id === verificationCopy.memoryId
  );

  if (!memory) {
    errors.push({
      agent: 'archivist',
      error: `Memory not found: ${verificationCopy.memoryId}`,
      skipped: true,
    });
    return { errors };
  }

  // Create a deep copy of memory for data preservation (Requirement 11.4)
  const memoryCopy: Memory = {
    ...memory,
    tags: { ...memory.tags, people: [...memory.tags.people], places: [...memory.tags.places], emotions: [...memory.tags.emotions] },
    contradictions: [...memory.contradictions],
    consent: { ...memory.consent, designatedFamilyIds: [...memory.consent.designatedFamilyIds] },
    embedding: memory.embedding ? [...memory.embedding] : null,
  };

  // Branch A: Ghostwriter + Tone Calibrator
  const branchA = async (): Promise<AgentError[]> => {
    const branchErrors: AgentError[] = [];

    // Tone Calibrator
    try {
      const store = useStore.getState();
      const existingProfile = store.speechProfile.profile;

      if (existingProfile) {
        await updateProfile(existingProfile, memoryCopy.cleanedTranscript);
      } else {
        await analyzeSpeechPatterns([memoryCopy.cleanedTranscript]);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Agent Router: Tone Calibrator failed in branch:', errorMessage);
      branchErrors.push({ agent: 'tone_calibrator', error: errorMessage, skipped: true });
    }

    // Ghostwriter (placeholder - actual chapter generation happens at autobiography time)
    // The ghostwriter processes memories in batch, not individually in the pipeline.
    // Here we ensure the memory is available for future ghostwriter processing.

    return branchErrors;
  };

  // Branch B: Digital Twin + Calendar Trigger
  const branchB = async (): Promise<AgentError[]> => {
    const branchErrors: AgentError[] = [];

    // Digital Twin: Memory is already indexed in RAG for future queries
    // No immediate action needed - DT responds to family queries on demand

    // Calendar Trigger: Check if there are upcoming events related to this memory
    try {
      const { events } = useStore.getState().calendar;
      if (events.length > 0) {
        // Find events that might relate to this memory's people/topics
        const relatedEvents = events.filter((event) =>
          event.relatedPeople.some((person) =>
            memoryCopy.tags.people.includes(person)
          )
        );

        // Process related events (if any)
        for (const event of relatedEvents) {
          try {
            await processCalendarTriggerEvent({ ...event, relatedPeople: [...event.relatedPeople] });
          } catch (eventError) {
            const errorMessage = eventError instanceof Error ? eventError.message : String(eventError);
            console.error(`Agent Router: Calendar Trigger failed for event ${event.id}:`, errorMessage);
            branchErrors.push({ agent: 'calendar_trigger', error: errorMessage, skipped: true });
          }
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Agent Router: Calendar Trigger branch failed:', errorMessage);
      branchErrors.push({ agent: 'calendar_trigger', error: errorMessage, skipped: true });
    }

    return branchErrors;
  };

  // Execute branches in parallel (Requirement 11.6)
  const [branchAResult, branchBResult] = await Promise.allSettled([branchA(), branchB()]);

  // Collect errors from both branches
  if (branchAResult.status === 'fulfilled') {
    errors.push(...branchAResult.value);
  } else {
    console.error('Agent Router: Branch A (Ghostwriter/TC) rejected:', branchAResult.reason);
    errors.push({ agent: 'ghostwriter', error: String(branchAResult.reason), skipped: true });
  }

  if (branchBResult.status === 'fulfilled') {
    errors.push(...branchBResult.value);
  } else {
    console.error('Agent Router: Branch B (DT/CT) rejected:', branchBResult.reason);
    errors.push({ agent: 'digital_twin', error: String(branchBResult.reason), skipped: true });
  }

  return { errors };
}

// ─── End-of-Session Processing ───────────────────────────────────────────────

/**
 * Processes the end of an interview session by chaining:
 * Archivist → RAG Index → Verification → Pipeline Branching
 *
 * Each agent's output is passed to the next without mutation.
 * On agent error: logs error, skips agent, continues pipeline, includes in AgentError[].
 *
 * Returns a ProcessingResult with the memory, embedding, contradictions,
 * confidence label, and any errors that occurred.
 */
export async function processEndOfSession(
  transcript: string,
  history: ChatMessage[]
): Promise<ProcessingResult> {
  const errors: AgentError[] = [];
  let memory: Memory;
  let embedding: number[] = [];
  let contradictions: ContradictionReport[] = [];
  let confidenceLabel: ConfidenceLabel = '확인됨';

  // Step 1: Archivist Agent - process transcript into structured memory
  try {
    const memoryId = generateId();
    const archivistResult = await processTranscriptV2(transcript, memoryId);

    // Create a full Memory object
    memory = {
      ...archivistResult,
      id: memoryId,
      date: new Date().toISOString(),
      privacy: 'private',
      linkedPhotoIds: [],
      sourceSessionId: `session_${memoryId}`,
    } as MemoryV2;

    // Add to store
    useStore.getState().addMemory(memory);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Agent Router: Archivist failed:', errorMessage);
    errors.push({ agent: 'archivist', error: errorMessage, skipped: true });

    // Create a minimal fallback memory so the pipeline can continue
    memory = createFallbackMemory(transcript);
    useStore.getState().addMemory(memory);
  }

  // Step 2: RAG Index - add memory embedding
  try {
    await ragIndex.addMemory(memory.id, memory.cleanedTranscript, memory.tags);

    // Retrieve the embedding from the store entry
    const entries = useStore.getState().ragIndex.entries;
    const entry = entries.find((e) => e.memoryId === memory.id);
    if (entry) {
      embedding = entry.embedding;
      // Update memory with embedding
      useStore.getState().updateMemoryEmbedding(memory.id, embedding);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Agent Router: RAG Index failed:', errorMessage);
    errors.push({ agent: 'archivist', error: errorMessage, skipped: true });
    // Continue without embedding
  }

  // Step 3: Verification - check contradictions
  let verificationJSON: VerificationJSON | null = null;
  try {
    const verificationResult = await checkContradictions(memory, ragIndex);
    contradictions = verificationResult.contradictions;
    confidenceLabel = verificationResult.confidenceLabel;
    verificationJSON = verificationResult.verificationJSON;

    // Update memory confidence in store
    const contradictionIds = contradictions.map((c) =>
      c.memoryIdA === memory.id ? c.memoryIdB : c.memoryIdA
    );
    useStore.getState().updateMemoryConfidence(memory.id, confidenceLabel, contradictionIds);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Agent Router: Verification failed:', errorMessage);
    errors.push({ agent: 'verification', error: errorMessage, skipped: true });
    // Default to "확인됨" as per error handling strategy
  }

  // Step 4: Pipeline Branching based on verification result
  if (verificationJSON) {
    try {
      const branchResult = await executePipelineBranch(verificationJSON);
      errors.push(...branchResult.errors);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Agent Router: Pipeline branching failed:', errorMessage);
      errors.push({ agent: 'ghostwriter', error: errorMessage, skipped: true });
    }
  } else {
    // No verification result available - run Tone Calibrator directly as fallback
    try {
      const store = useStore.getState();
      const existingProfile = store.speechProfile.profile;

      let updatedProfile;
      if (existingProfile) {
        updatedProfile = await updateProfile(existingProfile, transcript);
      } else {
        updatedProfile = await analyzeSpeechPatterns([transcript]);
      }

      useStore.getState().setSpeechProfile(updatedProfile);
      useStore.getState().incrementSessionCount();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Agent Router: Tone Calibrator failed:', errorMessage);
      errors.push({ agent: 'tone_calibrator', error: errorMessage, skipped: true });
    }
  }

  return {
    memory,
    embedding,
    contradictions,
    confidenceLabel,
    errors,
  };
}

// ─── Autobiography Generation ────────────────────────────────────────────────

/**
 * Generates an autobiography from the given memories.
 * Currently a placeholder that throws until the Ghostwriter agent is implemented.
 */
export async function generateAutobiography(memories: Memory[]): Promise<AutobiographyResult> {
  throw new Error('Ghostwriter not yet implemented');
}

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Generates a unique ID for a new memory.
 */
function generateId(): string {
  return `mem_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Creates a fallback Memory when the Archivist agent fails.
 * Preserves the raw transcript with minimal metadata.
 */
function createFallbackMemory(transcript: string): Memory {
  return {
    id: generateId(),
    date: new Date().toISOString(),
    topic: '새로운 기억',
    originalTranscript: transcript,
    cleanedTranscript: transcript,
    publishVersion: transcript,
    tags: { people: [], places: [], emotions: [], timePeriod: '' },
    privacy: 'private',
    confidenceLabel: '확인됨',
    contradictions: [],
    consent: {
      status: 'granted',
      accessTier: '본인만',
      designatedFamilyIds: [],
      lastModified: new Date().toISOString(),
    },
    consentSettings: {
      출판: 'granted',
      가족열람: 'granted',
      챗봇: 'granted',
      사후공개: 'granted',
      민감정보: 'granted',
    },
    embedding: null,
  };
}
