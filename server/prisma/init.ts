import { prisma } from '../db';
import { ensureLocalStorage } from '../storage';

const statements = [
  `CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "role" TEXT NOT NULL,
    "birthDecade" TEXT,
    "preferredName" TEXT,
    "seniorName" TEXT,
    "seniorBirthDecade" TEXT,
    "seniorPreferredName" TEXT,
    "guardianName" TEXT,
    "guardianRelationship" TEXT,
    "guardianPreferredName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "User_phoneNumber_key" ON "User"("phoneNumber")`,
  `CREATE TABLE IF NOT EXISTS "GuardianSeniorLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guardianId" TEXT NOT NULL,
    "seniorId" TEXT NOT NULL,
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
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Photo_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "Question" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "category" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "chapterId" TEXT,
    "photoId" TEXT,
    "createdById" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" DATETIME,
    "answerRecordId" TEXT,
    CONSTRAINT "Question_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Question_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Question_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  )`,
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
    "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'app',
    "mode" TEXT NOT NULL DEFAULT 'photo',
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
  `CREATE TABLE IF NOT EXISTS "PublicationRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "coverDesignId" TEXT,
    "format" TEXT NOT NULL DEFAULT 'A5',
    "status" TEXT NOT NULL DEFAULT 'requested',
    "pdfFileKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PublicationRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PublicationRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PublicationRequest_coverDesignId_fkey" FOREIGN KEY ("coverDesignId") REFERENCES "CoverDesign" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  )`,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LegacyVault_seniorId_fkey" FOREIGN KEY ("seniorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
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

  const notificationColumns = await prisma.$queryRawUnsafe<Array<{ name: string }>>('PRAGMA table_info("Notification")');
  const notificationColumnNames = new Set(notificationColumns.map((column) => column.name));
  if (!notificationColumnNames.has('metadataJson')) {
    await prisma.$executeRawUnsafe('ALTER TABLE "Notification" ADD COLUMN "metadataJson" TEXT');
  }
}

if (process.argv[1]?.endsWith('init.ts')) {
  initLocalDatabase()
    .then(() => console.log('Dearlog local SQLite schema is ready.'))
    .finally(async () => prisma.$disconnect());
}
