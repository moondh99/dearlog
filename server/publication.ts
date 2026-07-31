import {
  buildPublicationEditorialPlan,
  buildPublicationManifest,
  buildPublicationWritingDraft,
  type BuildPublicationManifestInput,
  type PublicationDraftChapter,
  type PublicationEditorialPlan,
  type PublicationManifest,
  type PublicationPhotoInput,
  type PublicationSourceRecord,
  type PublicationWritingDraft,
} from './domain/publication-agent';
import crypto from 'node:crypto';
import { prisma } from './db';
import type { InternalAiUsageContext } from './ai-usage';
import { renderHtmlToPdf, renderPublicationHtml } from './publication-html';
import { writeLocalFile } from './storage';

function parseJson(value: string | null | undefined, fallback: unknown) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function photoCaption(photo: {
  fileName: string;
  metadataJson: string;
  analysisJson: string;
}) {
  const metadata = parseJson(photo.metadataJson, {}) as Record<string, unknown>;
  const analysis = parseJson(photo.analysisJson, {}) as Record<string, unknown>;
  const caption = typeof metadata.caption === 'string' ? metadata.caption.trim() : '';
  const memo = typeof metadata.memo === 'string' ? metadata.memo.trim() : '';
  const description = typeof analysis.description === 'string' ? analysis.description.trim() : '';
  const title = typeof metadata.title === 'string' ? metadata.title.trim() : '';
  return caption || memo || description || title || '가족 사진';
}

function photoDate(photo: { metadataJson: string }) {
  const metadata = parseJson(photo.metadataJson, {}) as Record<string, unknown>;
  const capturedDate = typeof metadata.capturedDate === 'string' ? metadata.capturedDate.trim() : '';
  const yearLabel = typeof metadata.yearLabel === 'string' ? metadata.yearLabel.trim() : '';
  return capturedDate || yearLabel || null;
}

function photoLocation(photo: { metadataJson: string }) {
  const metadata = parseJson(photo.metadataJson, {}) as Record<string, unknown>;
  const location = typeof metadata.location === 'string' ? metadata.location.trim() : '';
  const place = typeof metadata.place === 'string' ? metadata.place.trim() : '';
  return location || place || null;
}

type PublicationRecordWithRelations = {
  id: string;
  chapterId: string;
  transcriptText: string;
  recordedAt: Date;
  chapter: { title: string };
  question?: {
    text?: string | null;
    category?: string | null;
    photoId?: string | null;
    photo?: {
      id: string;
      fileName: string;
      metadataJson: string;
      analysisJson: string;
    } | null;
  } | null;
};

export function buildPublicationSourceRecords(records: PublicationRecordWithRelations[]): PublicationSourceRecord[] {
  return records.map((record) => {
    const linkedPhoto = record.question?.photo ?? null;

    return {
      id: record.id,
      chapterId: record.chapterId,
      chapterTitle: record.chapter.title,
      transcriptText: record.transcriptText,
      questionText: record.question?.text ?? null,
      questionCategory: record.question?.category ?? null,
      photoId: linkedPhoto?.id ?? record.question?.photoId ?? null,
      photo: linkedPhoto
        ? {
          id: linkedPhoto.id,
          caption: photoCaption(linkedPhoto),
          capturedDate: photoDate(linkedPhoto),
          location: photoLocation(linkedPhoto),
        }
        : null,
      recordedAt: record.recordedAt.toISOString(),
    };
  });
}

type LocalPublicationInput = {
  seniorId: string;
  coverDesignId?: string | null;
  agentTimeoutMs?: number;
  toneProfileOverride?: { name: string; patterns: string[] } | null;
  usageContext?: InternalAiUsageContext;
  requireAgentStages?: boolean;
};

type LocalPublicationRenderInput = LocalPublicationInput & {
  format: 'A5' | 'B5';
  generationMode?: 'preview' | 'final';
  onStage?: (stage: PublicationPreviewJobStage) => void | Promise<void>;
};

export type PublicationPreviewJobStatus = 'queued' | 'running' | 'ready' | 'failed';
export type PublicationPreviewJobStage = 'cache_check' | 'editorial_plan' | 'writing_draft' | 'manifest' | 'render' | 'done';

const PUBLICATION_PREVIEW_STAGE_TIMEOUT_MS = 600_000;
const PUBLICATION_PREVIEW_MAX_ATTEMPTS = 2;
const runningPreviewJobs = new Set<string>();
const scheduledPreviewJobRetries = new Map<string, ReturnType<typeof setTimeout>>();

export interface LocalPublicationDraft {
  editorialPlan: PublicationEditorialPlan;
  writingDraft: PublicationWritingDraft;
  manifest: PublicationManifest;
  html: string;
  cacheStatus: 'hit' | 'generated';
  draftCacheId?: string | null;
  sourceHash: string;
}

export interface LocalPublicationPreviewJobView {
  id: string;
  status: PublicationPreviewJobStatus;
  stage: PublicationPreviewJobStage;
  attemptCount: number;
  errorCode?: string | null;
  errorMessage?: string | null;
  draftCacheId?: string | null;
  draftSourceHash?: string | null;
  isStale?: boolean;
  sourceHash: string;
  cacheStatus?: 'hit' | 'generated' | null;
  draft?: LocalPublicationDraft | null;
}

export async function prepareLocalPublicationInput(input: LocalPublicationInput): Promise<BuildPublicationManifestInput> {
  const [senior, records, cover, chapters, draft, photos] = await Promise.all([
    prisma.user.findUnique({ where: { id: input.seniorId } }),
    prisma.interviewRecord.findMany({
      // 책은 AI가 쓰므로 민감정보 미동의 기록은 출판 대상에서도 빠진다.
      // 여기를 통과시키면 그 내용이 집필 에이전트를 거쳐 외부 제공자로 나간다.
      where: { userId: input.seniorId, publish: true, sensitive: true },
      orderBy: { recordedAt: 'asc' },
      include: {
        chapter: true,
        question: {
          include: {
            photo: true,
          },
        },
      },
    }),
    input.coverDesignId ? prisma.coverDesign.findUnique({ where: { id: input.coverDesignId } }) : null,
    prisma.chapter.findMany({ orderBy: { order: 'asc' } }),
    prisma.autobiographyDraft.findUnique({ where: { userId: input.seniorId } }),
    prisma.photo.findMany({ where: { userId: input.seniorId }, orderBy: { uploadedAt: 'asc' } }),
  ]);

  const sourceRecords = buildPublicationSourceRecords(records);

  const draftChapters = parseJson(draft?.narrativesJson, []) as PublicationDraftChapter[];
  const normalizedDraftChapters = Array.isArray(draftChapters) ? draftChapters : [];
  const publicationDraftChapters = input.toneProfileOverride
    ? (
      normalizedDraftChapters.length > 0
        ? normalizedDraftChapters.map((chapter) => ({
          ...chapter,
          toneProfile: input.toneProfileOverride,
        }))
        : chapters.map((chapter) => ({
          chapterId: chapter.id,
          chapterTitle: chapter.title,
          paragraphs: [],
          toneProfile: input.toneProfileOverride,
        }))
    )
    : normalizedDraftChapters;
  const publicationPhotos: PublicationPhotoInput[] = photos.map((photo) => ({
    id: photo.id,
    fileKey: photo.fileKey,
    mimeType: photo.mimeType,
    caption: photoCaption(photo),
    capturedDate: photoDate(photo),
    location: photoLocation(photo),
    uploadedAt: photo.uploadedAt.toISOString(),
  }));

  return {
    seniorName: senior?.name ?? '시니어',
    records: sourceRecords,
    chapters: chapters.map((chapter) => ({ id: chapter.id, title: chapter.title, order: chapter.order })),
    draftChapters: publicationDraftChapters,
    cover,
    photos: publicationPhotos,
    agentTimeoutMs: input.agentTimeoutMs,
    usageContext: input.usageContext,
  };
}

function sha256(value: unknown) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(value))
    .digest('hex');
}

const PUBLICATION_DRAFT_CACHE_VERSION = 'agent-preview-strict-v2';

function buildPublicationSourceHash(input: {
  seniorId: string;
  coverDesignId?: string | null;
  format: 'A5' | 'B5';
  publicationInput: BuildPublicationManifestInput;
}) {
  return sha256({
    cacheVersion: PUBLICATION_DRAFT_CACHE_VERSION,
    seniorId: input.seniorId,
    coverDesignId: input.coverDesignId ?? null,
    format: input.format,
    records: input.publicationInput.records.map((record) => ({
      id: record.id,
      chapterId: record.chapterId,
      questionText: record.questionText ?? null,
      questionCategory: record.questionCategory ?? null,
      photoId: record.photoId ?? null,
      recordedAt: record.recordedAt,
      transcriptLength: record.transcriptText.length,
      transcriptHash: sha256(record.transcriptText),
    })),
    draftChaptersHash: sha256(input.publicationInput.draftChapters),
    cover: input.publicationInput.cover
      ? {
        id: input.coverDesignId ?? null,
        palette: input.publicationInput.cover.palette ?? null,
        template: input.publicationInput.cover.template ?? null,
        font: input.publicationInput.cover.font ?? null,
        analysisHash: sha256(input.publicationInput.cover.analysisJson ?? ''),
      }
      : null,
    photos: input.publicationInput.photos.map((photo) => ({
      id: photo.id,
      fileKey: photo.fileKey,
      mimeType: photo.mimeType,
      caption: photo.caption ?? null,
      capturedDate: photo.capturedDate ?? null,
      location: photo.location ?? null,
      uploadedAt: photo.uploadedAt ?? null,
    })),
  });
}

function draftFromCache(cache: {
  id: string;
  sourceHash: string;
  editorialPlanJson: string;
  writingDraftJson: string;
  manifestJson: string;
  html: string;
}): LocalPublicationDraft {
  return {
    editorialPlan: JSON.parse(cache.editorialPlanJson) as PublicationEditorialPlan,
    writingDraft: JSON.parse(cache.writingDraftJson) as PublicationWritingDraft,
    manifest: JSON.parse(cache.manifestJson) as PublicationManifest,
    html: cache.html,
    cacheStatus: 'hit',
    draftCacheId: cache.id,
    sourceHash: cache.sourceHash,
  };
}

export async function findPublicationDraftCache(input: {
  seniorId: string;
  format: 'A5' | 'B5';
  sourceHash: string;
}) {
  return prisma.publicationDraftCache.findUnique({
    where: {
      userId_format_sourceHash_generatedBy: {
        userId: input.seniorId,
        format: input.format,
        sourceHash: input.sourceHash,
        generatedBy: 'agent',
      },
    },
  });
}

async function findLatestPublicationDraftCache(input: {
  seniorId: string;
  format: 'A5' | 'B5';
  toneProfileOverride?: { name: string; patterns: string[] } | null;
}) {
  const caches = await prisma.publicationDraftCache.findMany({
    where: {
      userId: input.seniorId,
      format: input.format,
      generatedBy: 'agent',
    },
    orderBy: { updatedAt: 'desc' },
    take: 20,
  });
  if (!input.toneProfileOverride?.name) return caches[0] ?? null;
  return caches.find((cache) => {
    const writingDraft = parseJson(cache.writingDraftJson, null) as { selectedToneProfile?: { name?: unknown } } | null;
    return writingDraft?.selectedToneProfile?.name === input.toneProfileOverride?.name;
  }) ?? caches[0] ?? null;
}

// 캐시된 초안이 인용한 InterviewRecord id를 모읍니다.
function collectDraftSourceRecordIds(cache: { writingDraftJson: string }) {
  const draft = parseJson(cache.writingDraftJson, null) as {
    chapters?: Array<{ paragraphs?: Array<{ sourceRecordIds?: unknown }> }>;
  } | null;
  const ids = new Set<string>();
  for (const chapter of draft?.chapters ?? []) {
    for (const paragraph of chapter.paragraphs ?? []) {
      if (!Array.isArray(paragraph.sourceRecordIds)) continue;
      for (const id of paragraph.sourceRecordIds) {
        if (typeof id === 'string') ids.add(id);
      }
    }
  }
  return ids;
}

// 초안이 인용한 기록이 지금도 전부 출판 가능한 원본에 남아 있는지 확인합니다.
// 하나라도 빠졌다면 그 사이 동의가 철회됐거나 기록이 지워진 것이므로 캐시를 다시 쓰지 않습니다.
function draftUsesOnlyAvailableRecords(
  cache: { writingDraftJson: string },
  availableRecords: Array<{ id: string }>,
) {
  const availableIds = new Set(availableRecords.map((record) => record.id));
  for (const id of collectDraftSourceRecordIds(cache)) {
    if (!availableIds.has(id)) return false;
  }
  return true;
}

async function upsertPublicationDraftCache(input: {
  seniorId: string;
  coverDesignId?: string | null;
  format: 'A5' | 'B5';
  sourceHash: string;
  generatedBy: 'agent' | 'fallback';
  editorialPlan: PublicationEditorialPlan;
  writingDraft: PublicationWritingDraft;
  manifest: PublicationManifest;
  html: string;
}) {
  return prisma.publicationDraftCache.upsert({
    where: {
      userId_format_sourceHash_generatedBy: {
        userId: input.seniorId,
        format: input.format,
        sourceHash: input.sourceHash,
        generatedBy: input.generatedBy,
      },
    },
    update: {
      coverDesignId: input.coverDesignId ?? null,
      editorialPlanJson: JSON.stringify(input.editorialPlan),
      writingDraftJson: JSON.stringify(input.writingDraft),
      manifestJson: JSON.stringify(input.manifest),
      html: input.html,
    },
    create: {
      userId: input.seniorId,
      coverDesignId: input.coverDesignId ?? null,
      format: input.format,
      sourceHash: input.sourceHash,
      editorialPlanJson: JSON.stringify(input.editorialPlan),
      writingDraftJson: JSON.stringify(input.writingDraft),
      manifestJson: JSON.stringify(input.manifest),
      html: input.html,
      generatedBy: input.generatedBy,
    },
  });
}

function parseToneProfileJson(value: string | null | undefined) {
  const parsed = parseJson(value, null);
  if (!parsed || typeof parsed !== 'object') return null;
  const record = parsed as Record<string, unknown>;
  const name = typeof record.name === 'string' ? record.name : '';
  const patterns = Array.isArray(record.patterns)
    ? record.patterns.filter((pattern): pattern is string => typeof pattern === 'string')
    : [];
  return name ? { name, patterns } : null;
}

function previewJobView(job: {
  id: string;
  status: string;
  stage: string;
  attemptCount: number;
  errorCode: string | null;
  errorMessage: string | null;
  draftCacheId: string | null;
  sourceHash: string;
}, draft?: LocalPublicationDraft | null): LocalPublicationPreviewJobView {
  const draftSourceHash = draft?.sourceHash ?? null;
  return {
    id: job.id,
    status: job.status as PublicationPreviewJobStatus,
    stage: job.stage as PublicationPreviewJobStage,
    attemptCount: job.attemptCount,
    errorCode: job.errorCode,
    errorMessage: job.errorMessage,
    draftCacheId: job.draftCacheId,
    draftSourceHash,
    isStale: Boolean(draftSourceHash && draftSourceHash !== job.sourceHash),
    sourceHash: job.sourceHash,
    cacheStatus: draft?.cacheStatus ?? null,
    draft: draft ?? null,
  };
}

async function loadDraftForJob(job: {
  draftCacheId: string | null;
  sourceHash: string;
}): Promise<LocalPublicationDraft | null> {
  if (!job.draftCacheId) return null;
  const cache = await prisma.publicationDraftCache.findUnique({ where: { id: job.draftCacheId } });
  return cache ? draftFromCache(cache) : null;
}

export async function generateLocalPublicationEditorialPlan(input: LocalPublicationInput) {
  const publicationInput = await prepareLocalPublicationInput(input);
  return buildPublicationEditorialPlan({ ...publicationInput, useAgent: true });
}

export async function generateLocalPublicationDraft(input: LocalPublicationRenderInput): Promise<LocalPublicationDraft> {
  const publicationInput = await prepareLocalPublicationInput(input);
  const sourceHash = buildPublicationSourceHash({
    seniorId: input.seniorId,
    coverDesignId: input.coverDesignId ?? null,
    format: input.format,
    publicationInput,
  });
  const cachedDraft = await findPublicationDraftCache({
    seniorId: input.seniorId,
    format: input.format,
    sourceHash,
  });

  if (cachedDraft) {
    return draftFromCache(cachedDraft);
  }

  const useAgent = true;
  const requireAgentStages = input.requireAgentStages ?? true;
  const agentTimeoutMs = publicationInput.agentTimeoutMs
    ?? (requireAgentStages ? PUBLICATION_PREVIEW_STAGE_TIMEOUT_MS : undefined);
  const draftInput = {
    ...publicationInput,
    agentTimeoutMs,
    useAgent,
    requireAgentStages,
    requireEditorialAgent: requireAgentStages,
    requireWritingAgent: true,
    requireManifestAgent: requireAgentStages,
    usageContext: useAgent ? input.usageContext : undefined,
  };
  await input.onStage?.('editorial_plan');
  const editorialPlan = await buildPublicationEditorialPlan(draftInput);
  await input.onStage?.('writing_draft');
  const writingDraft = await buildPublicationWritingDraft({
    ...draftInput,
    editorialPlan,
  });
  await input.onStage?.('manifest');
  const manifest = await buildPublicationManifest({
    ...draftInput,
    editorialPlan,
    writingDraft,
  });
  if (
    requireAgentStages
    && (editorialPlan.generatedBy !== 'agent'
      || writingDraft.generatedBy !== 'agent'
      || manifest.provenance.generatedBy !== 'agent')
  ) {
    throw Object.assign(new Error('기록집 작성 에이전트가 모든 단계를 완성하지 못했습니다. 잠시 후 다시 시도해주세요.'), {
      statusCode: 503,
      providerCode: 'agent_stage_incomplete',
    });
  }
  await input.onStage?.('render');
  const html = await renderPublicationHtml(manifest, input.format);

  const generatedBy = writingDraft.generatedBy === 'agent' ? 'agent' : 'fallback';
  if (generatedBy !== 'agent') {
    throw Object.assign(new Error('기록집 작성 에이전트가 초안을 완성하지 못했습니다. 잠시 후 다시 시도해주세요.'), {
      statusCode: 503,
    });
  }
  const cache = await upsertPublicationDraftCache({
    seniorId: input.seniorId,
    coverDesignId: input.coverDesignId ?? null,
    format: input.format,
    sourceHash,
    generatedBy,
    editorialPlan,
    writingDraft,
    manifest,
    html,
  });

  return {
    editorialPlan,
    writingDraft,
    manifest,
    html,
    cacheStatus: 'generated',
    draftCacheId: cache.id,
    sourceHash,
  };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error ?? 'unknown error');
}

function errorCode(error: unknown) {
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    if (typeof record.providerCode === 'string') return record.providerCode;
    if (typeof record.code === 'string') return record.code;
    if (typeof record.statusCode === 'number') return `status_${record.statusCode}`;
  }
  return 'agent_generation_failed';
}

type PreviewJobRetryState = {
  id: string;
  status: string;
  errorCode: string | null;
  errorMessage: string | null;
  attemptCount: number;
  updatedAt: Date;
};

function publicationPreviewRetryDelayMs() {
  const override = Number(process.env.PUBLICATION_PREVIEW_RETRY_DELAY_MS);
  if (Number.isFinite(override) && override >= 0) return override;
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) return 0;
  return 30_000;
}

function isRecoverablePreviewJobError(code?: string | null, message?: string | null) {
  const normalizedCode = (code ?? '').toLowerCase();
  const normalizedMessage = (message ?? '').toLowerCase();
  if (normalizedCode === 'config_missing' || normalizedCode === 'source_records_missing') return false;
  if (normalizedCode === 'status_401' || normalizedCode === 'status_403') return false;
  if (normalizedMessage.includes('not configured') || normalizedMessage.includes('no source records')) return false;
  return true;
}

function recoverableRetryDelayRemainingMs(job: PreviewJobRetryState) {
  if (
    job.status !== 'queued'
    || job.attemptCount <= 0
    || !job.errorCode
    || !isRecoverablePreviewJobError(job.errorCode, job.errorMessage)
  ) {
    return 0;
  }
  const elapsedMs = Date.now() - job.updatedAt.getTime();
  return Math.max(0, publicationPreviewRetryDelayMs() - elapsedMs);
}

function schedulePreviewJobRetry(jobId: string, delayMs: number) {
  if (scheduledPreviewJobRetries.has(jobId)) return;
  const timer = setTimeout(() => {
    scheduledPreviewJobRetries.delete(jobId);
    void runPublicationPreviewJob(jobId);
  }, Math.max(0, delayMs));
  scheduledPreviewJobRetries.set(jobId, timer);
}

function clearScheduledPreviewJobRetry(jobId: string) {
  const timer = scheduledPreviewJobRetries.get(jobId);
  if (!timer) return;
  clearTimeout(timer);
  scheduledPreviewJobRetries.delete(jobId);
}

async function markPreviewJobStage(jobId: string, stage: PublicationPreviewJobStage) {
  await prisma.publicationPreviewJob.update({
    where: { id: jobId },
    data: { stage },
  });
}

export async function resetRunningPublicationPreviewJobs() {
  await prisma.publicationPreviewJob.updateMany({
    where: { status: 'running' },
    data: {
      status: 'queued',
      stage: 'cache_check',
      errorCode: 'server_restarted',
      errorMessage: '서버가 재시작되어 기록집 작성 작업을 다시 대기 상태로 전환했습니다.',
      startedAt: null,
      finishedAt: null,
    },
  });
}

export async function runPublicationPreviewJob(jobId: string) {
  if (runningPreviewJobs.has(jobId)) return;
  runningPreviewJobs.add(jobId);

  try {
    while (true) {
      const job = await prisma.publicationPreviewJob.findUnique({ where: { id: jobId } });
      if (!job || job.status === 'ready' || job.status === 'failed') {
        clearScheduledPreviewJobRetry(jobId);
        return;
      }
      if (job.status !== 'queued' && job.status !== 'running') return;

      const retryDelayRemainingMs = recoverableRetryDelayRemainingMs(job);
      if (retryDelayRemainingMs > 0) {
        schedulePreviewJobRetry(job.id, retryDelayRemainingMs);
        return;
      }
      clearScheduledPreviewJobRetry(job.id);

      const format = job.format === 'B5' ? 'B5' : 'A5';
      const attempt = job.attemptCount + 1;
      if (
        attempt > PUBLICATION_PREVIEW_MAX_ATTEMPTS
        && !isRecoverablePreviewJobError(job.errorCode, job.errorMessage)
      ) {
        await prisma.publicationPreviewJob.update({
          where: { id: job.id },
          data: {
            status: 'failed',
            stage: 'done',
            errorCode: job.errorCode ?? 'max_attempts_exceeded',
            errorMessage: job.errorMessage ?? '기록집 작성 에이전트가 제한된 재시도 안에 완료하지 못했습니다.',
            finishedAt: new Date(),
          },
        });
        return;
      }

      await prisma.publicationPreviewJob.update({
        where: { id: job.id },
        data: {
          status: 'running',
          stage: 'cache_check',
          attemptCount: attempt,
          errorCode: null,
          errorMessage: null,
          startedAt: new Date(),
          finishedAt: null,
        },
      });

      const cachedDraft = await findPublicationDraftCache({
        seniorId: job.userId,
        format,
        sourceHash: job.sourceHash,
      });
      if (cachedDraft) {
        await prisma.publicationPreviewJob.update({
          where: { id: job.id },
          data: {
            status: 'ready',
            stage: 'done',
            draftCacheId: cachedDraft.id,
            finishedAt: new Date(),
          },
        });
        return;
      }

      try {
        const requestedBy = await prisma.user.findUnique({ where: { id: job.requestedById } });
        const draft = await generateLocalPublicationDraft({
          seniorId: job.userId,
          coverDesignId: job.coverDesignId,
          format,
          generationMode: 'preview',
          toneProfileOverride: parseToneProfileJson(job.toneProfileJson),
          agentTimeoutMs: PUBLICATION_PREVIEW_STAGE_TIMEOUT_MS,
          requireAgentStages: true,
          usageContext: {
            userId: job.requestedById,
            role: requestedBy?.role ?? 'guardian',
          },
          onStage: (stage) => markPreviewJobStage(job.id, stage),
        });
        await prisma.publicationPreviewJob.update({
          where: { id: job.id },
          data: {
            status: 'ready',
            stage: 'done',
            draftCacheId: draft.draftCacheId ?? null,
            errorCode: null,
            errorMessage: null,
            finishedAt: new Date(),
          },
        });
        return;
      } catch (error) {
        const cachedAfterFailure = await findPublicationDraftCache({
          seniorId: job.userId,
          format,
          sourceHash: job.sourceHash,
        });
        if (cachedAfterFailure) {
          await prisma.publicationPreviewJob.update({
            where: { id: job.id },
            data: {
              status: 'ready',
              stage: 'done',
              draftCacheId: cachedAfterFailure.id,
              errorCode: null,
              errorMessage: null,
              finishedAt: new Date(),
            },
          });
          return;
        }

        const message = errorMessage(error).slice(0, 500);
        const code = errorCode(error).slice(0, 80);
        const recoverable = isRecoverablePreviewJobError(code, message);
        if (!recoverable && attempt >= PUBLICATION_PREVIEW_MAX_ATTEMPTS) {
          await prisma.publicationPreviewJob.update({
            where: { id: job.id },
            data: {
              status: 'failed',
              stage: 'done',
              errorCode: code,
              errorMessage: message,
              finishedAt: new Date(),
            },
          });
          return;
        }

        await prisma.publicationPreviewJob.update({
          where: { id: job.id },
          data: {
            status: 'queued',
            errorCode: code,
            errorMessage: message,
          },
        });
        if (recoverable) {
          const retryDelayMs = publicationPreviewRetryDelayMs();
          if (retryDelayMs > 0) {
            schedulePreviewJobRetry(job.id, retryDelayMs);
            return;
          }
        }
      }
    }
  } finally {
    runningPreviewJobs.delete(jobId);
  }
}

async function reviveRecoverablePreviewJob<T extends PreviewJobRetryState>(job: T): Promise<T> {
  if (job.status !== 'failed' || !isRecoverablePreviewJobError(job.errorCode, job.errorMessage)) return job;
  const revived = await prisma.publicationPreviewJob.update({
    where: { id: job.id },
    data: {
      status: 'queued',
      stage: 'cache_check',
      finishedAt: null,
    },
  });
  void runPublicationPreviewJob(revived.id);
  return revived as unknown as T;
}

export async function startLocalPublicationPreviewJob(input: {
  seniorId: string;
  requestedById: string;
  coverDesignId?: string | null;
  forceRefresh?: boolean;
  format: 'A5' | 'B5';
  toneProfileOverride?: { name: string; patterns: string[] } | null;
  usageContext?: InternalAiUsageContext;
}): Promise<LocalPublicationPreviewJobView> {
  const publicationInput = await prepareLocalPublicationInput({
    seniorId: input.seniorId,
    coverDesignId: input.coverDesignId,
    toneProfileOverride: input.toneProfileOverride,
    usageContext: input.usageContext,
  });
  const sourceHash = buildPublicationSourceHash({
    seniorId: input.seniorId,
    coverDesignId: input.coverDesignId ?? null,
    format: input.format,
    publicationInput,
  });

  const cachedDraft = await findPublicationDraftCache({
    seniorId: input.seniorId,
    format: input.format,
    sourceHash,
  });
  if (cachedDraft) {
    const job = await prisma.publicationPreviewJob.create({
      data: {
        userId: input.seniorId,
        requestedById: input.requestedById,
        coverDesignId: input.coverDesignId ?? null,
        draftCacheId: cachedDraft.id,
        format: input.format,
        sourceHash,
        toneProfileJson: input.toneProfileOverride ? JSON.stringify(input.toneProfileOverride) : null,
        status: 'ready',
        stage: 'done',
        finishedAt: new Date(),
      },
    });
    return previewJobView(job, draftFromCache(cachedDraft));
  }

  if (!input.forceRefresh) {
    const latestDraft = await findLatestPublicationDraftCache({
      seniorId: input.seniorId,
      format: input.format,
      toneProfileOverride: input.toneProfileOverride,
    });
    // 기록이 추가돼 초안이 오래된 경우에는 예전처럼 즉시 보여 주고 isStale로 표시합니다.
    // 다만 출판 동의 철회나 삭제로 원본에서 빠진 기록이 초안에 들어 있으면 재사용하지 않습니다.
    // 그대로 두면 철회 직후 미리보기에 철회한 이야기가 계속 보입니다.
    if (latestDraft && draftUsesOnlyAvailableRecords(latestDraft, publicationInput.records)) {
      const job = await prisma.publicationPreviewJob.create({
        data: {
          userId: input.seniorId,
          requestedById: input.requestedById,
          coverDesignId: input.coverDesignId ?? null,
          draftCacheId: latestDraft.id,
          format: input.format,
          sourceHash,
          toneProfileJson: input.toneProfileOverride ? JSON.stringify(input.toneProfileOverride) : null,
          status: 'ready',
          stage: 'done',
          finishedAt: new Date(),
        },
      });
      return previewJobView(job, draftFromCache(latestDraft));
    }
  }

  const activeJob = await prisma.publicationPreviewJob.findFirst({
    where: {
      userId: input.seniorId,
      format: input.format,
      sourceHash,
      status: { in: ['queued', 'running'] },
    },
    orderBy: { updatedAt: 'desc' },
  });
  if (activeJob) {
    void runPublicationPreviewJob(activeJob.id);
    return previewJobView(activeJob);
  }

  const recoverableFailedJob = await prisma.publicationPreviewJob.findFirst({
    where: {
      userId: input.seniorId,
      format: input.format,
      sourceHash,
      status: 'failed',
    },
    orderBy: { updatedAt: 'desc' },
  });
  if (recoverableFailedJob && isRecoverablePreviewJobError(recoverableFailedJob.errorCode, recoverableFailedJob.errorMessage)) {
    const revived = await reviveRecoverablePreviewJob(recoverableFailedJob);
    return previewJobView(revived);
  }

  const job = await prisma.publicationPreviewJob.create({
    data: {
      userId: input.seniorId,
      requestedById: input.requestedById,
      coverDesignId: input.coverDesignId ?? null,
      format: input.format,
      sourceHash,
      toneProfileJson: input.toneProfileOverride ? JSON.stringify(input.toneProfileOverride) : null,
      status: 'queued',
      stage: 'cache_check',
    },
  });
  void runPublicationPreviewJob(job.id);
  return previewJobView(job);
}

export async function getLocalPublicationPreviewJob(jobId: string): Promise<LocalPublicationPreviewJobView | null> {
  const foundJob = await prisma.publicationPreviewJob.findUnique({ where: { id: jobId } });
  const job = foundJob ? await reviveRecoverablePreviewJob(foundJob) : null;
  if (!job) return null;
  if (job.status === 'queued') {
    void runPublicationPreviewJob(job.id);
  }
  const draft = job.status === 'ready' ? await loadDraftForJob(job) : null;
  return previewJobView(job, draft);
}

export async function generateLocalPrintHtml(input: LocalPublicationRenderInput) {
  const { html } = await generateLocalPublicationDraft({ ...input, generationMode: 'final' });
  return html;
}

export async function generateLocalPrintPdf(input: {
  seniorId: string;
  coverDesignId?: string | null;
  format: 'A5' | 'B5';
  toneProfileOverride?: { name: string; patterns: string[] } | null;
  usageContext?: InternalAiUsageContext;
}) {
  const draft = await generateLocalPublicationDraft({ ...input, generationMode: 'final' });
  const bytes = await renderHtmlToPdf(draft.html);
  const pdfFileKey = await writeLocalFile('pdfs', bytes, 'pdf');

  return {
    pdfFileKey,
    draftCacheId: draft.draftCacheId ?? null,
    cacheStatus: draft.cacheStatus,
    sourceHash: draft.sourceHash,
  };
}
