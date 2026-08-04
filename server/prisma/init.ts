import { prisma } from '../db';
import { ensureLocalStorage } from '../storage';

const statements = [
  `CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "role" TEXT NOT NULL,
    "birthDate" TEXT,
    "birthDecade" TEXT,
    "preferredName" TEXT,
    "seniorName" TEXT,
    "seniorBirthDecade" TEXT,
    "seniorPreferredName" TEXT,
    "guardianName" TEXT,
    "guardianRelationship" TEXT,
    "guardianPreferredName" TEXT,
    "profileImageUrl" TEXT,
    "recordSpaceName" TEXT,
    "recordSpaceCoverUrl" TEXT,
    "hasCurrentJob" BOOLEAN,
    "occupation" TEXT,
    "hometown" TEXT,
    "schoolHistory" TEXT,
    "publicationContentDeletedAt" DATETIME,
    "chatbotConsentUpdatedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "User_phoneNumber_key" ON "User"("phoneNumber")`,
  `CREATE TABLE IF NOT EXISTS "GuardianSeniorLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guardianId" TEXT NOT NULL,
    "seniorId" TEXT NOT NULL,
    "relationship" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GuardianSeniorLink_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GuardianSeniorLink_seniorId_fkey" FOREIGN KEY ("seniorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "GuardianSeniorLink_guardianId_seniorId_key" ON "GuardianSeniorLink"("guardianId", "seniorId")`,
  `CREATE TABLE IF NOT EXISTS "Chapter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "minAnswerCount" INTEGER NOT NULL DEFAULT 15
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Chapter_order_key" ON "Chapter"("order")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Chapter_slug_key" ON "Chapter"("slug")`,
  `CREATE TABLE IF NOT EXISTS "Photo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "metadataJson" TEXT NOT NULL DEFAULT '{}',
    "analysisJson" TEXT NOT NULL DEFAULT '{}',
    "linkedMemoryIds" TEXT NOT NULL DEFAULT '[]',
    "publish" BOOLEAN NOT NULL DEFAULT 1,
    "familyRead" BOOLEAN NOT NULL DEFAULT 1,
    "posthumous" BOOLEAN NOT NULL DEFAULT 1,
    "sensitive" BOOLEAN NOT NULL DEFAULT 1,
    "consentUpdatedAt" DATETIME,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Photo_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "Question" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "category" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "chapterId" TEXT,
    "seniorId" TEXT,
    "photoId" TEXT,
    "createdById" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" DATETIME,
    "answerRecordId" TEXT,
    "anonymous" BOOLEAN NOT NULL DEFAULT 0,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "answerMemoryId" TEXT,
    CONSTRAINT "Question_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Question_seniorId_fkey" FOREIGN KEY ("seniorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Question_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Question_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS "Question_seniorId_category_createdAt_idx" ON "Question"("seniorId", "category", "createdAt")`,
  `CREATE TABLE IF NOT EXISTS "InterviewSchedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seniorId" TEXT NOT NULL,
    "guardianId" TEXT NOT NULL,
    "scheduledAt" DATETIME NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Seoul',
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "callSid" TEXT,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InterviewSchedule_seniorId_fkey" FOREIGN KEY ("seniorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InterviewSchedule_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "InterviewSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seniorId" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "currentQuestionId" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME,
    "pausedAt" DATETIME,
    CONSTRAINT "InterviewSession_seniorId_fkey" FOREIGN KEY ("seniorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InterviewSession_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InterviewSession_currentQuestionId_fkey" FOREIGN KEY ("currentQuestionId") REFERENCES "Question" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "InterviewRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "questionId" TEXT,
    "sessionId" TEXT,
    "audioFileKey" TEXT NOT NULL,
    "transcriptText" TEXT NOT NULL,
    "aiSummary" TEXT,
    "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'app',
    "mode" TEXT NOT NULL DEFAULT 'photo',
    "publish" BOOLEAN NOT NULL DEFAULT 1,
    "chatbot" BOOLEAN NOT NULL DEFAULT 1,
    "familyRead" BOOLEAN NOT NULL DEFAULT 1,
    "posthumous" BOOLEAN NOT NULL DEFAULT 1,
    "sensitive" BOOLEAN NOT NULL DEFAULT 1,
    "consentUpdatedAt" DATETIME,
    "reviewStatus" TEXT NOT NULL DEFAULT 'pending',
    "reviewedAt" DATETIME,
    "reviewRequestText" TEXT,
    CONSTRAINT "InterviewRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InterviewRecord_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InterviewRecord_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InterviewRecord_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "InterviewSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "free_speech_db" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "sessionId" TEXT,
    "audioFileKey" TEXT NOT NULL,
    "transcriptText" TEXT NOT NULL,
    "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "interviewRecordId" TEXT,
    CONSTRAINT "free_speech_db_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "free_speech_db_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "free_speech_db_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "InterviewSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "PushSubscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint")`,
  `CREATE TABLE IF NOT EXISTS "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "relatedUserId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "metadataJson" TEXT,
    "status" TEXT NOT NULL DEFAULT 'unread',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" DATETIME,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Notification_relatedUserId_fkey" FOREIGN KEY ("relatedUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "AiProxyAuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "model" TEXT,
    "outcome" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "estimatedUnits" INTEGER NOT NULL DEFAULT 0,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "providerStatus" INTEGER,
    "providerCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS "AiProxyAuditLog_userId_createdAt_idx" ON "AiProxyAuditLog"("userId", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "AiProxyAuditLog_endpoint_outcome_createdAt_idx" ON "AiProxyAuditLog"("endpoint", "outcome", "createdAt")`,
  `CREATE TABLE IF NOT EXISTS "CoverDesign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "palette" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "font" TEXT NOT NULL,
    "analysisJson" TEXT NOT NULL DEFAULT '{}',
    "confirmedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CoverDesign_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "PublicationDraftCache" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "coverDesignId" TEXT,
    "format" TEXT NOT NULL DEFAULT 'A5',
    "sourceHash" TEXT NOT NULL,
    "editorialPlanJson" TEXT NOT NULL,
    "writingDraftJson" TEXT NOT NULL,
    "manifestJson" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "generatedBy" TEXT NOT NULL DEFAULT 'fallback',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PublicationDraftCache_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PublicationDraftCache_coverDesignId_fkey" FOREIGN KEY ("coverDesignId") REFERENCES "CoverDesign" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "PublicationDraftCache_userId_format_sourceHash_generatedBy_key" ON "PublicationDraftCache"("userId", "format", "sourceHash", "generatedBy")`,
  `CREATE INDEX IF NOT EXISTS "PublicationDraftCache_userId_format_sourceHash_generatedBy_idx" ON "PublicationDraftCache"("userId", "format", "sourceHash", "generatedBy")`,
  `CREATE TABLE IF NOT EXISTS "PublicationRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "coverDesignId" TEXT,
    "draftCacheId" TEXT,
    "format" TEXT NOT NULL DEFAULT 'A5',
    "status" TEXT NOT NULL DEFAULT 'requested',
    "pdfFileKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PublicationRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PublicationRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PublicationRequest_coverDesignId_fkey" FOREIGN KEY ("coverDesignId") REFERENCES "CoverDesign" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PublicationRequest_draftCacheId_fkey" FOREIGN KEY ("draftCacheId") REFERENCES "PublicationDraftCache" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "PublicationPreviewJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "coverDesignId" TEXT,
    "draftCacheId" TEXT,
    "format" TEXT NOT NULL DEFAULT 'A5',
    "sourceHash" TEXT NOT NULL,
    "toneProfileJson" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "stage" TEXT NOT NULL DEFAULT 'cache_check',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PublicationPreviewJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PublicationPreviewJob_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PublicationPreviewJob_coverDesignId_fkey" FOREIGN KEY ("coverDesignId") REFERENCES "CoverDesign" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PublicationPreviewJob_draftCacheId_fkey" FOREIGN KEY ("draftCacheId") REFERENCES "PublicationDraftCache" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS "PublicationPreviewJob_userId_format_sourceHash_status_idx" ON "PublicationPreviewJob"("userId", "format", "sourceHash", "status")`,
  `CREATE INDEX IF NOT EXISTS "PublicationPreviewJob_status_updatedAt_idx" ON "PublicationPreviewJob"("status", "updatedAt")`,
  `CREATE TABLE IF NOT EXISTS "LegacyVault" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seniorId" TEXT NOT NULL UNIQUE,
    "isVaultSetup" BOOLEAN NOT NULL DEFAULT 0,
    "encryptedMemories" TEXT,
    "encryptedAutobiography" TEXT,
    "serverShare" TEXT,
    "institutionShare" TEXT,
    "isDeceased" BOOLEAN NOT NULL DEFAULT 0,
    "deathVerificationStatus" TEXT NOT NULL DEFAULT 'alive',
    "serverShareReleased" BOOLEAN NOT NULL DEFAULT 0,
    "institutionShareReleased" BOOLEAN NOT NULL DEFAULT 0,
    "deathTriggeredById" TEXT,
    "deathTriggeredAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LegacyVault_seniorId_fkey" FOREIGN KEY ("seniorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "Memory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "topic" TEXT NOT NULL,
    "originalTranscript" TEXT NOT NULL,
    "cleanedTranscript" TEXT NOT NULL,
    "publishVersion" TEXT NOT NULL,
    "privacy" TEXT NOT NULL DEFAULT 'private',
    "confidenceLabel" TEXT NOT NULL DEFAULT '확인됨',
    "contradictions" TEXT NOT NULL DEFAULT '[]',
    CONSTRAINT "Memory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "MemoryTag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memoryId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    CONSTRAINT "MemoryTag_memoryId_fkey" FOREIGN KEY ("memoryId") REFERENCES "Memory" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "MemoryConsentSettings" (
    "memoryId" TEXT NOT NULL PRIMARY KEY,
    "publish" TEXT NOT NULL DEFAULT 'granted',
    "familyRead" TEXT NOT NULL DEFAULT 'granted',
    "chatbot" TEXT NOT NULL DEFAULT 'granted',
    "posthumous" TEXT NOT NULL DEFAULT 'granted',
    "sensitive" TEXT NOT NULL DEFAULT 'granted',
    CONSTRAINT "MemoryConsentSettings_memoryId_fkey" FOREIGN KEY ("memoryId") REFERENCES "Memory" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "MemoryVectorEntry" (
    "memoryId" TEXT NOT NULL PRIMARY KEY,
    "embeddingJson" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    CONSTRAINT "MemoryVectorEntry_memoryId_fkey" FOREIGN KEY ("memoryId") REFERENCES "Memory" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "AutobiographyDraft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL UNIQUE,
    "structureJson" TEXT NOT NULL DEFAULT '{}',
    "narrativesJson" TEXT NOT NULL DEFAULT '[]',
    "lastGenerated" DATETIME,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AutobiographyDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "CalendarEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventDate" TEXT NOT NULL,
    "relatedPersons" TEXT NOT NULL DEFAULT '[]',
    "recipientId" TEXT NOT NULL DEFAULT 'family-group',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CalendarEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "Invitation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "guardianId" TEXT NOT NULL,
    "seniorId" TEXT NOT NULL,
    "expiresAt" DATETIME,
    "revokedAt" DATETIME,
    "usedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Invitation_token_key" ON "Invitation"("token")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Invitation_seniorId_key" ON "Invitation"("seniorId")`,
];

export async function initLocalDatabase() {
  await ensureLocalStorage();
  await prisma.$executeRawUnsafe('PRAGMA foreign_keys = ON');
  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement);
  }

  // 기존 로컬 DB에도 실사용자 가입 프로필 컬럼을 부드럽게 추가합니다.
  const userColumns = await prisma.$queryRawUnsafe<Array<{ name: string }>>('PRAGMA table_info("User")');
  const columnNames = new Set(userColumns.map((column) => column.name));
  if (!columnNames.has('birthDate')) {
    await prisma.$executeRawUnsafe('ALTER TABLE "User" ADD COLUMN "birthDate" TEXT');
  }
  if (!columnNames.has('birthDecade')) {
    await prisma.$executeRawUnsafe('ALTER TABLE "User" ADD COLUMN "birthDecade" TEXT');
  }
  if (!columnNames.has('preferredName')) {
    await prisma.$executeRawUnsafe('ALTER TABLE "User" ADD COLUMN "preferredName" TEXT');
  }
  if (!columnNames.has('seniorName')) {
    await prisma.$executeRawUnsafe('ALTER TABLE "User" ADD COLUMN "seniorName" TEXT');
  }
  if (!columnNames.has('seniorBirthDecade')) {
    await prisma.$executeRawUnsafe('ALTER TABLE "User" ADD COLUMN "seniorBirthDecade" TEXT');
  }
  if (!columnNames.has('seniorPreferredName')) {
    await prisma.$executeRawUnsafe('ALTER TABLE "User" ADD COLUMN "seniorPreferredName" TEXT');
  }
  if (!columnNames.has('guardianName')) {
    await prisma.$executeRawUnsafe('ALTER TABLE "User" ADD COLUMN "guardianName" TEXT');
  }
  if (!columnNames.has('guardianRelationship')) {
    await prisma.$executeRawUnsafe('ALTER TABLE "User" ADD COLUMN "guardianRelationship" TEXT');
  }
  if (!columnNames.has('guardianPreferredName')) {
    await prisma.$executeRawUnsafe('ALTER TABLE "User" ADD COLUMN "guardianPreferredName" TEXT');
  }
  if (!columnNames.has('profileImageUrl')) {
    await prisma.$executeRawUnsafe('ALTER TABLE "User" ADD COLUMN "profileImageUrl" TEXT');
  }
  if (!columnNames.has('recordSpaceName')) {
    await prisma.$executeRawUnsafe('ALTER TABLE "User" ADD COLUMN "recordSpaceName" TEXT');
  }
  if (!columnNames.has('recordSpaceCoverUrl')) {
    await prisma.$executeRawUnsafe('ALTER TABLE "User" ADD COLUMN "recordSpaceCoverUrl" TEXT');
  }
  if (!columnNames.has('hasCurrentJob')) {
    await prisma.$executeRawUnsafe('ALTER TABLE "User" ADD COLUMN "hasCurrentJob" BOOLEAN');
  }
  if (!columnNames.has('occupation')) {
    await prisma.$executeRawUnsafe('ALTER TABLE "User" ADD COLUMN "occupation" TEXT');
  }
  if (!columnNames.has('hometown')) {
    await prisma.$executeRawUnsafe('ALTER TABLE "User" ADD COLUMN "hometown" TEXT');
  }
  if (!columnNames.has('schoolHistory')) {
    await prisma.$executeRawUnsafe('ALTER TABLE "User" ADD COLUMN "schoolHistory" TEXT');
  }
  // 삭제·챗봇 동의 변경 시각. 기존 행은 NULL(= 지운 적도 바꾼 적도 없음)로 두어
  // 이미 만들어진 산출물과 이미 저장된 대화를 소급해서 막지 않는다.
  if (!columnNames.has('publicationContentDeletedAt')) {
    await prisma.$executeRawUnsafe('ALTER TABLE "User" ADD COLUMN "publicationContentDeletedAt" DATETIME');
  }
  if (!columnNames.has('chatbotConsentUpdatedAt')) {
    await prisma.$executeRawUnsafe('ALTER TABLE "User" ADD COLUMN "chatbotConsentUpdatedAt" DATETIME');
  }

  const linkColumns = await prisma.$queryRawUnsafe<Array<{ name: string }>>('PRAGMA table_info("GuardianSeniorLink")');
  const linkColumnNames = new Set(linkColumns.map((column) => column.name));
  if (!linkColumnNames.has('relationship')) {
    await prisma.$executeRawUnsafe('ALTER TABLE "GuardianSeniorLink" ADD COLUMN "relationship" TEXT');
  }

  const notificationColumns = await prisma.$queryRawUnsafe<Array<{ name: string }>>('PRAGMA table_info("Notification")');
  const notificationColumnNames = new Set(notificationColumns.map((column) => column.name));
  if (!notificationColumnNames.has('metadataJson')) {
    await prisma.$executeRawUnsafe('ALTER TABLE "Notification" ADD COLUMN "metadataJson" TEXT');
  }

  const invitationColumns = await prisma.$queryRawUnsafe<Array<{ name: string }>>('PRAGMA table_info("Invitation")');
  const invitationColumnNames = new Set(invitationColumns.map((column) => column.name));
  if (!invitationColumnNames.has('expiresAt')) {
    await prisma.$executeRawUnsafe('ALTER TABLE "Invitation" ADD COLUMN "expiresAt" DATETIME');
  }
  if (!invitationColumnNames.has('revokedAt')) {
    await prisma.$executeRawUnsafe('ALTER TABLE "Invitation" ADD COLUMN "revokedAt" DATETIME');
  }
  if (!invitationColumnNames.has('usedAt')) {
    await prisma.$executeRawUnsafe('ALTER TABLE "Invitation" ADD COLUMN "usedAt" DATETIME');
  }
  if (!invitationColumnNames.has('updatedAt')) {
    await prisma.$executeRawUnsafe('ALTER TABLE "Invitation" ADD COLUMN "updatedAt" DATETIME');
  }
  await prisma.$executeRawUnsafe(`
    UPDATE "Invitation"
    SET "updatedAt" = COALESCE("updatedAt", "createdAt", CURRENT_TIMESTAMP)
    WHERE "updatedAt" IS NULL
  `);
  await prisma.$executeRawUnsafe(`
    UPDATE "Invitation"
    SET "expiresAt" = datetime("createdAt", '+14 days')
    WHERE "expiresAt" IS NULL
  `);

  // Photo linkedMemoryIds 컬럼 추가
  const photoColumns = await prisma.$queryRawUnsafe<Array<{ name: string }>>('PRAGMA table_info("Photo")');
  const photoColumnNames = new Set(photoColumns.map((column) => column.name));
  if (!photoColumnNames.has('linkedMemoryIds')) {
    await prisma.$executeRawUnsafe('ALTER TABLE "Photo" ADD COLUMN "linkedMemoryIds" TEXT NOT NULL DEFAULT \'[]\'');
  }
  // 사진 목적별 동의. 기존 사진은 모두 허용 상태로 둔다.
  for (const column of ['publish', 'familyRead', 'posthumous', 'sensitive']) {
    if (!photoColumnNames.has(column)) {
      await prisma.$executeRawUnsafe(`ALTER TABLE "Photo" ADD COLUMN "${column}" BOOLEAN NOT NULL DEFAULT 1`);
    }
  }
  // 동의 변경 시각. 기존 행은 NULL(= 철회한 적 없음)로 두어 이미 만들어진 산출물을 막지 않는다.
  if (!photoColumnNames.has('consentUpdatedAt')) {
    await prisma.$executeRawUnsafe('ALTER TABLE "Photo" ADD COLUMN "consentUpdatedAt" DATETIME');
  }

  // Question 속성 컬럼 추가
  const questionColumns = await prisma.$queryRawUnsafe<Array<{ name: string }>>('PRAGMA table_info("Question")');
  const questionColumnNames = new Set(questionColumns.map((column) => column.name));
  if (!questionColumnNames.has('anonymous')) {
    await prisma.$executeRawUnsafe('ALTER TABLE "Question" ADD COLUMN "anonymous" BOOLEAN NOT NULL DEFAULT 0');
  }
  if (!questionColumnNames.has('priority')) {
    await prisma.$executeRawUnsafe('ALTER TABLE "Question" ADD COLUMN "priority" TEXT NOT NULL DEFAULT \'normal\'');
  }
  if (!questionColumnNames.has('answerMemoryId')) {
    await prisma.$executeRawUnsafe('ALTER TABLE "Question" ADD COLUMN "answerMemoryId" TEXT');
  }
  if (!questionColumnNames.has('seniorId')) {
    await prisma.$executeRawUnsafe('ALTER TABLE "Question" ADD COLUMN "seniorId" TEXT');
  }
  await prisma.$executeRawUnsafe(`
    UPDATE "Question"
    SET "seniorId" = (
      SELECT "userId" FROM "Photo" WHERE "Photo"."id" = "Question"."photoId"
    )
    WHERE "seniorId" IS NULL
      AND "photoId" IS NOT NULL
  `);
  await prisma.$executeRawUnsafe(`
    UPDATE "Question"
    SET "seniorId" = (
      SELECT "seniorId"
      FROM "GuardianSeniorLink"
      WHERE "GuardianSeniorLink"."guardianId" = "Question"."createdById"
      LIMIT 1
    )
    WHERE "seniorId" IS NULL
      AND "createdById" IS NOT NULL
      AND "category" IN ('guardian_questions', 'family_question')
      AND (
        SELECT COUNT(*)
        FROM "GuardianSeniorLink"
        WHERE "GuardianSeniorLink"."guardianId" = "Question"."createdById"
      ) = 1
  `);
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "Question_seniorId_category_createdAt_idx" ON "Question"("seniorId", "category", "createdAt")');

  // InterviewRecord 추가 컬럼 마이그레이션
  const recordColumns = await prisma.$queryRawUnsafe<Array<{ name: string }>>('PRAGMA table_info("InterviewRecord")');
  const recordColumnNames = new Set(recordColumns.map((column) => column.name));
  if (!recordColumnNames.has('publish')) {
    await prisma.$executeRawUnsafe('ALTER TABLE "InterviewRecord" ADD COLUMN "publish" BOOLEAN NOT NULL DEFAULT 1');
  }
  if (!recordColumnNames.has('chatbot')) {
    await prisma.$executeRawUnsafe('ALTER TABLE "InterviewRecord" ADD COLUMN "chatbot" BOOLEAN NOT NULL DEFAULT 1');
  }
  if (!recordColumnNames.has('aiSummary')) {
    await prisma.$executeRawUnsafe('ALTER TABLE "InterviewRecord" ADD COLUMN "aiSummary" TEXT');
  }
  if (!recordColumnNames.has('reviewStatus')) {
    await prisma.$executeRawUnsafe('ALTER TABLE "InterviewRecord" ADD COLUMN "reviewStatus" TEXT NOT NULL DEFAULT \'pending\'');
  }
  if (!recordColumnNames.has('reviewedAt')) {
    await prisma.$executeRawUnsafe('ALTER TABLE "InterviewRecord" ADD COLUMN "reviewedAt" DATETIME');
  }
  if (!recordColumnNames.has('reviewRequestText')) {
    await prisma.$executeRawUnsafe('ALTER TABLE "InterviewRecord" ADD COLUMN "reviewRequestText" TEXT');
  }
  // 목적별 동의를 실제 답변이 쌓이는 테이블로 옮긴다. 기존 행은 모두 동의한 상태로 둔다.
  // 철회는 사용자가 명시적으로 하는 행위이므로, 마이그레이션이 임의로 철회하지 않는다.
  if (!recordColumnNames.has('familyRead')) {
    await prisma.$executeRawUnsafe('ALTER TABLE "InterviewRecord" ADD COLUMN "familyRead" BOOLEAN NOT NULL DEFAULT 1');
  }
  if (!recordColumnNames.has('posthumous')) {
    await prisma.$executeRawUnsafe('ALTER TABLE "InterviewRecord" ADD COLUMN "posthumous" BOOLEAN NOT NULL DEFAULT 1');
  }
  if (!recordColumnNames.has('sensitive')) {
    await prisma.$executeRawUnsafe('ALTER TABLE "InterviewRecord" ADD COLUMN "sensitive" BOOLEAN NOT NULL DEFAULT 1');
  }
  // 동의 변경 시각. 기존 행은 NULL(= 철회한 적 없음)로 두어 이미 만들어진 산출물을 막지 않는다.
  if (!recordColumnNames.has('consentUpdatedAt')) {
    await prisma.$executeRawUnsafe('ALTER TABLE "InterviewRecord" ADD COLUMN "consentUpdatedAt" DATETIME');
  }

  // 자유 발화 기록은 InterviewRecord의 사본이다. 원본을 가리키게 해서 동의를 원본에서 읽는다.
  const freeSpeechColumns = await prisma.$queryRawUnsafe<Array<{ name: string }>>('PRAGMA table_info("free_speech_db")');
  const freeSpeechColumnNames = new Set(freeSpeechColumns.map((column) => column.name));
  if (!freeSpeechColumnNames.has('interviewRecordId')) {
    await prisma.$executeRawUnsafe('ALTER TABLE "free_speech_db" ADD COLUMN "interviewRecordId" TEXT');
    // 기존 행은 같은 사용자/오디오키/시각으로 원본을 되찾는다.
    await prisma.$executeRawUnsafe(`
      UPDATE "free_speech_db" SET "interviewRecordId" = (
        SELECT "id" FROM "InterviewRecord" r
        WHERE r."userId" = "free_speech_db"."userId"
          AND r."audioFileKey" = "free_speech_db"."audioFileKey"
          AND r."transcriptText" = "free_speech_db"."transcriptText"
        LIMIT 1
      ) WHERE "interviewRecordId" IS NULL
    `);
  }
  await prisma.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS "free_speech_db_interviewRecordId_key" ON "free_speech_db"("interviewRecordId")');

  // 사망 신고자와 신고 시각. 신고자 본인이 그대로 승인하는 길을 막는 데 쓴다.
  const legacyVaultColumns = await prisma.$queryRawUnsafe<Array<{ name: string }>>('PRAGMA table_info("LegacyVault")');
  const legacyVaultColumnNames = new Set(legacyVaultColumns.map((column) => column.name));
  if (!legacyVaultColumnNames.has('deathTriggeredById')) {
    await prisma.$executeRawUnsafe('ALTER TABLE "LegacyVault" ADD COLUMN "deathTriggeredById" TEXT');
  }
  if (!legacyVaultColumnNames.has('deathTriggeredAt')) {
    await prisma.$executeRawUnsafe('ALTER TABLE "LegacyVault" ADD COLUMN "deathTriggeredAt" DATETIME');
  }

  const publicationRequestColumns = await prisma.$queryRawUnsafe<Array<{ name: string }>>('PRAGMA table_info("PublicationRequest")');
  const publicationRequestColumnNames = new Set(publicationRequestColumns.map((column) => column.name));
  if (!publicationRequestColumnNames.has('draftCacheId')) {
    await prisma.$executeRawUnsafe('ALTER TABLE "PublicationRequest" ADD COLUMN "draftCacheId" TEXT');
  }
}

if (process.argv[1]?.endsWith('init.ts')) {
  initLocalDatabase()
    .then(() => console.log('Dearlog local SQLite schema is ready.'))
    .finally(async () => prisma.$disconnect());
}
