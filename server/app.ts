import fs from 'node:fs/promises';
import path from 'node:path';
import express from 'express';
import twilio from 'twilio';
import { attachLocalUser, assertGuardianCanAccessSenior, requireRole } from './auth';
import { sendAppInterviewCall } from './app-call';
import { config } from './config';
import { prisma } from './db';
import { decideCoverDesign } from './domain/cover-agent';
import { isFreeSpeech } from './domain/free-speech';
import { analyzePhotoAndCreateQuestions } from './domain/photo-agent';
import { generateLocalPrintPdf } from './publication';
import { sendWebPush } from './push';
import { audioUpload, photoUpload, resolveLocalFileKey } from './storage';

function normalizePhoneNumber(value: unknown) {
  return String(value ?? '').replace(/[^\d]/g, '');
}

function serializeUser(user: {
  id: string;
  name: string;
  phoneNumber: string | null;
  role: string;
  birthDecade?: string | null;
  preferredName?: string | null;
  seniorName?: string | null;
  seniorBirthDecade?: string | null;
  seniorPreferredName?: string | null;
  guardianName?: string | null;
  guardianRelationship?: string | null;
  guardianPreferredName?: string | null;
}) {
  return {
    id: user.id,
    name: user.name,
    phoneNumber: user.phoneNumber,
    role: user.role,
    birthDecade: user.birthDecade ?? null,
    preferredName: user.preferredName ?? null,
    seniorName: user.seniorName ?? user.name ?? null,
    seniorBirthDecade: user.seniorBirthDecade ?? user.birthDecade ?? null,
    seniorPreferredName: user.seniorPreferredName ?? user.preferredName ?? null,
    guardianName: user.guardianName ?? null,
    guardianRelationship: user.guardianRelationship ?? null,
    guardianPreferredName: user.guardianPreferredName ?? null,
  };
}

function serializeNotification(notification: {
  id: string;
  type: string;
  title: string;
  body: string;
  status: string;
  createdAt: Date;
  readAt: Date | null;
  metadataJson?: string | null;
}) {
  let metadata: Record<string, unknown> = {};
  try {
    metadata = notification.metadataJson ? JSON.parse(notification.metadataJson) : {};
  } catch {
    metadata = {};
  }
  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    status: notification.status,
    createdAt: notification.createdAt,
    readAt: notification.readAt,
    metadata,
  };
}

function mapMemoryToResponse(m: any) {
  const people = (m.tags || []).filter((t: any) => t.category === 'people').map((t: any) => t.value);
  const places = (m.tags || []).filter((t: any) => t.category === 'places').map((t: any) => t.value);
  const emotions = (m.tags || []).filter((t: any) => t.category === 'emotions').map((t: any) => t.value);
  const timePeriodTag = (m.tags || []).find((t: any) => t.category === 'timePeriod');
  const timePeriod = timePeriodTag ? timePeriodTag.value : '';

  let contradictions: string[] = [];
  try {
    if (m.contradictions) {
      contradictions = JSON.parse(m.contradictions);
    }
  } catch (e) {
    // ignore
  }

  const consentSettings = m.consentSettings ? {
    출판: m.consentSettings.publish,
    가족열람: m.consentSettings.familyRead,
    챗봇: m.consentSettings.chatbot,
    사후공개: m.consentSettings.posthumous,
    민감정보: m.consentSettings.sensitive
  } : {
    출판: 'granted',
    가족열람: 'granted',
    챗봇: 'granted',
    사후공개: 'granted',
    민감정보: 'granted'
  };

  const consent = {
    status: (consentSettings.가족열람 === 'granted' && m.privacy !== 'private') ? 'granted' : 'revoked',
    accessTier: m.privacy === 'public' ? '전체 가족' : (m.privacy === 'family' ? '지정 가족' : '본인만'),
    designatedFamilyIds: [],
    lastModified: m.date ? new Date(m.date).toISOString() : new Date().toISOString()
  };

  let embedding: number[] | null = null;
  if (m.vectorEntry && m.vectorEntry.embeddingJson) {
    try {
      embedding = JSON.parse(m.vectorEntry.embeddingJson);
    } catch (e) {
      // ignore
    }
  }

  return {
    id: m.id,
    date: m.date ? new Date(m.date).toISOString() : new Date().toISOString(),
    topic: m.topic,
    originalTranscript: m.originalTranscript,
    cleanedTranscript: m.cleanedTranscript,
    publishVersion: m.publishVersion,
    privacy: m.privacy,
    confidenceLabel: m.confidenceLabel,
    contradictions,
    tags: {
      people,
      places,
      emotions,
      timePeriod
    },
    consent,
    consentSettings,
    embedding
  };
}

function mapPhotoToResponse(p: any) {
  let analysis = null;
  if (p.analysisJson) {
    try {
      analysis = JSON.parse(p.analysisJson);
    } catch (e) {
      // ignore
    }
  }
  let metadata = {};
  if (p.metadataJson) {
    try {
      metadata = JSON.parse(p.metadataJson);
    } catch (e) {
      // ignore
    }
  }
  let linkedMemoryIds: string[] = [];
  if (p.linkedMemoryIds) {
    try {
      linkedMemoryIds = JSON.parse(p.linkedMemoryIds);
    } catch (e) {
      // ignore
    }
  }

  return {
    id: p.id,
    url: `/api/files/${p.fileKey}`,
    uploadedAt: p.uploadedAt ? p.uploadedAt.toISOString() : new Date().toISOString(),
    analysis,
    metadata,
    linkedMemoryIds,
    fileKey: p.fileKey,
    fileName: p.fileName,
    mimeType: p.mimeType,
    metadataJson: p.metadataJson,
    analysisJson: p.analysisJson
  };
}

function mapQuestionToResponse(q: any) {
  return {
    id: q.id,
    questionText: q.text,
    submittedBy: q.createdById || '',
    anonymous: q.anonymous,
    priority: q.priority,
    status: q.status,
    createdAt: q.createdAt ? q.createdAt.toISOString() : new Date().toISOString(),
    answeredAt: q.answeredAt ? q.answeredAt.toISOString() : null,
    answerMemoryId: q.answerMemoryId
  };
}

function mapAutobiographyDraftToResponse(d: any) {
  let currentStructure = null;
  if (d.structureJson) {
    try {
      currentStructure = JSON.parse(d.structureJson);
    } catch (e) {
      // ignore
    }
  }
  let narratives = [];
  if (d.narrativesJson) {
    try {
      narratives = JSON.parse(d.narrativesJson);
    } catch (e) {
      // ignore
    }
  }

  return {
    currentStructure,
    narratives,
    lastGenerated: d.lastGenerated ? d.lastGenerated.toISOString() : null
  };
}

async function resolveGuardianSeniorId(guardianId: string, requestedSeniorId?: string) {
  if (requestedSeniorId) {
    await assertGuardianCanAccessSenior(guardianId, requestedSeniorId);
    return requestedSeniorId;
  }

  const existingLink = await prisma.guardianSeniorLink.findFirst({
    where: { guardianId },
    orderBy: { createdAt: 'desc' },
  });
  if (existingLink) return existingLink.seniorId;

  const senior = await prisma.user.findFirst({
    where: { role: 'senior' },
    orderBy: { createdAt: 'desc' },
  });
  if (!senior) {
    // 한 휴대폰 번호 계정이 보호자/시니어를 번갈아 쓰는 테스트 흐름에서는 자기 계정을 관리 대상으로 연결합니다.
    const selfUser = await prisma.user.findUnique({ where: { id: guardianId } });
    if (selfUser) {
      await prisma.guardianSeniorLink.upsert({
        where: { guardianId_seniorId: { guardianId, seniorId: selfUser.id } },
        update: {},
        create: { guardianId, seniorId: selfUser.id },
      });
      return selfUser.id;
    }
    return 'local_senior';
  }

  // 사용자 테스트에서는 별도 초대 플로우 없이 보호자가 가장 최근 시니어를 관리할 수 있도록 자동 연결합니다.
  await prisma.guardianSeniorLink.upsert({
    where: { guardianId_seniorId: { guardianId, seniorId: senior.id } },
    update: {},
    create: { guardianId, seniorId: senior.id },
  });
  return senior.id;
}

async function ensureSelfGuardianSeniorLink(userId: string) {
  // 넷플릭스 프로필처럼 하나의 번호 계정으로 보호자/시니어를 모두 쓸 수 있게 자기 자신을 연결해 둡니다.
  await prisma.guardianSeniorLink.upsert({
    where: { guardianId_seniorId: { guardianId: userId, seniorId: userId } },
    update: {},
    create: { guardianId: userId, seniorId: userId },
  });
}

export function createApp() {
  const app = express();
  const distDir = path.join(config.serverDir, '..', 'dist');
  app.use((req, res, next) => {
    // 로컬 앱은 Vite(:3000)와 API(:8787)가 다른 origin이라 Web Push/업로드 API 호출에 CORS 허용이 필요합니다.
    const origin = req.header('origin');
    if (origin && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Vary', 'Origin');
    }
    res.header('Access-Control-Allow-Headers', 'Content-Type, x-user-id, x-user-role');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });
  app.use('/twilio', express.urlencoded({ extended: false }));
  app.use(express.json({ limit: '10mb' }));
  app.use(attachLocalUser);

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, storage: config.storageDir });
  });

  app.get('/api/me', (req, res) => {
    res.json({ user: req.user ?? null });
  });

  app.post('/api/auth/phone', async (req, res, next) => {
    try {
      const phoneNumber = normalizePhoneNumber(req.body.phoneNumber);
      if (!/^01[016789]\d{7,8}$/.test(phoneNumber)) {
        res.status(400).json({ error: '휴대폰 번호를 다시 확인해 주세요.' });
        return;
      }

      const existing = await prisma.user.findUnique({ where: { phoneNumber } });
      if (existing) {
        res.json({ user: serializeUser(existing), isNew: false });
        return;
      }

      // SMS 인증 없이 휴대폰 번호 자체를 계정 키로 저장합니다.
      const user = await prisma.user.create({
        data: {
          phoneNumber,
          role: 'pending',
          name: `사용자 ${phoneNumber.slice(-4)}`,
        },
      });
      res.status(201).json({ user: serializeUser(user), isNew: true });
    } catch (error) {
      next(error);
    }
  });

  app.patch('/api/auth/users/:id/role', async (req, res, next) => {
    try {
      const role = req.body.role === 'guardian' ? 'guardian' : req.body.role === 'senior' ? 'senior' : null;
      if (!role) {
        res.status(400).json({ error: '역할을 다시 선택해 주세요.' });
        return;
      }
      const current = await prisma.user.findUnique({ where: { id: req.params.id } });
      if (!current) {
        res.status(404).json({ error: '계정을 찾을 수 없습니다.' });
        return;
      }
      const defaultName = role === 'guardian' ? '보호자' : '어르신';
      const user = await prisma.user.update({
        where: { id: req.params.id },
        data: {
          role,
          name: current.name.startsWith('사용자 ') ? defaultName : current.name,
          preferredName: current.preferredName ?? defaultName,
          ...(role === 'guardian'
            ? { guardianName: current.guardianName ?? '', guardianPreferredName: current.guardianPreferredName ?? '보호자' }
            : { seniorName: current.seniorName ?? current.name, seniorPreferredName: current.seniorPreferredName ?? '어르신' }),
        },
      });
      await ensureSelfGuardianSeniorLink(user.id);
      res.json({ user: serializeUser(user) });
    } catch (error) {
      next(error);
    }
  });

  app.patch('/api/auth/users/:id/profile', async (req, res, next) => {
    try {
      const name = String(req.body.name ?? '').trim();
      const preferredName = String(req.body.preferredName ?? '').trim();
      if (!name || !preferredName) {
        res.status(400).json({ error: '이름과 선호 호칭을 입력해 주세요.' });
        return;
      }
      const role = req.body.role === 'guardian' ? 'guardian' : 'senior';
      const relationship = String(req.body.relationship ?? '').trim();
      if (role === 'guardian' && !relationship) {
        res.status(400).json({ error: '어르신과의 관계를 입력해 주세요.' });
        return;
      }
      const user = await prisma.user.update({
        where: { id: req.params.id },
        data: role === 'guardian'
          ? {
              role,
              name,
              preferredName,
              guardianName: name,
              guardianRelationship: relationship,
              guardianPreferredName: preferredName,
            }
          : {
              role,
              name,
              preferredName,
              birthDecade: String(req.body.birthDecade ?? '1950년대'),
              seniorName: name,
              seniorBirthDecade: String(req.body.birthDecade ?? '1950년대'),
              seniorPreferredName: preferredName,
            },
      });
      await ensureSelfGuardianSeniorLink(user.id);
      res.json({ user: serializeUser(user) });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/push-public-key', (_req, res) => {
    res.json({ publicKey: config.vapid.publicKey });
  });

  app.get('/api/chapters', async (_req, res, next) => {
    try {
      res.json({ chapters: await prisma.chapter.findMany({ orderBy: { order: 'asc' } }) });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/questions', async (req, res, next) => {
    try {
      const category = req.query.category?.toString();
      const chapterId = req.query.chapterId?.toString();
      const questions = await prisma.question.findMany({
        where: {
          ...(category ? { category } : {}),
          ...(chapterId ? { chapterId } : {}),
        },
        orderBy: { createdAt: 'asc' },
      });
      res.json({ questions });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/questions', requireRole('guardian'), async (req, res, next) => {
    try {
      const { text, chapterId } = req.body;
      await resolveGuardianSeniorId(req.user!.id, req.body.seniorId ? String(req.body.seniorId) : undefined);
      const question = await prisma.question.create({
        data: {
          text: String(text ?? '').trim(),
          chapterId,
          category: 'guardian_questions',
          createdById: req.user!.id,
        },
      });
      res.status(201).json({ question });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/uploads/photos', requireRole('guardian'), photoUpload.single('photo'), async (req, res, next) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: '사진 파일이 필요합니다.' });
        return;
      }
      const seniorId = await resolveGuardianSeniorId(req.user!.id, req.body.seniorId ? String(req.body.seniorId) : undefined);
      const fileKey = `photos/${path.basename(req.file.filename)}`;
      const result = await analyzePhotoAndCreateQuestions({
        filePath: req.file.path,
        mimeType: req.file.mimetype,
        chapterId: req.body.chapterId,
      });
      const photo = await prisma.photo.create({
        data: {
          userId: seniorId,
          fileKey,
          fileName: req.file.originalname,
          mimeType: req.file.mimetype,
          metadataJson: JSON.stringify({ size: req.file.size }),
          analysisJson: JSON.stringify(result.analysis),
        },
      });
      const questions = await Promise.all(result.questions.map((text) =>
        prisma.question.create({
          data: {
            text,
            category: 'photo_questions',
            chapterId: req.body.chapterId || undefined,
            photoId: photo.id,
            createdById: req.user!.id,
            status: 'active',
          },
        })
      ));
      res.status(201).json({ photo: mapPhotoToResponse(photo), questions: questions.map(mapQuestionToResponse) });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/uploads/audio', requireRole('senior', 'guardian'), audioUpload.single('audio'), async (req, res, next) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: '음성 파일이 필요합니다.' });
        return;
      }
      const fileKey = `audio/${path.basename(req.file.filename)}`;
      res.status(201).json({ fileKey, fileName: req.file.originalname, mimeType: req.file.mimetype, size: req.file.size });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/interview-schedules', requireRole('guardian'), async (req, res, next) => {
    try {
      const seniorId = await resolveGuardianSeniorId(req.user!.id, req.body.seniorId ? String(req.body.seniorId) : undefined);
      const schedule = await prisma.interviewSchedule.create({
        data: {
          seniorId,
          guardianId: req.user!.id,
          scheduledAt: new Date(req.body.scheduledAt),
          timezone: req.body.timezone ?? 'Asia/Seoul',
        },
      });
      res.status(201).json({ schedule });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/interview-schedules', requireRole('guardian'), async (req, res, next) => {
    try {
      const schedules = await prisma.interviewSchedule.findMany({
        where: { guardianId: req.user!.id },
        orderBy: { scheduledAt: 'asc' },
      });
      res.json({ schedules });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/interview-schedules/:id/call-now', requireRole('guardian'), async (req, res, next) => {
    try {
      const schedule = await prisma.interviewSchedule.findUnique({ where: { id: req.params.id } });
      if (!schedule || schedule.guardianId !== req.user!.id) {
        res.status(404).json({ error: '스케줄을 찾을 수 없습니다.' });
        return;
      }
      const result = await sendAppInterviewCall({
        seniorId: schedule.seniorId,
        guardianId: req.user!.id,
        scheduleId: schedule.id,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/app-calls', requireRole('guardian'), async (req, res, next) => {
    try {
      const seniorId = await resolveGuardianSeniorId(req.user!.id, req.body.seniorId ? String(req.body.seniorId) : undefined);
      const result = await sendAppInterviewCall({
        seniorId,
        guardianId: req.user!.id,
        chapterId: req.body.chapterId,
      });
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/interview-sessions', requireRole('senior', 'guardian'), async (req, res, next) => {
    try {
      const seniorId = req.user!.role === 'senior'
        ? req.user!.id
        : await resolveGuardianSeniorId(req.user!.id, req.body.seniorId ? String(req.body.seniorId) : undefined);
      const firstChapter = await prisma.chapter.findFirst({ orderBy: { order: 'asc' } });
      const session = await prisma.interviewSession.create({
        data: {
          seniorId,
          chapterId: req.body.chapterId ?? firstChapter?.id ?? 'childhood',
          mode: req.body.mode ?? 'photo',
          currentQuestionId: req.body.currentQuestionId,
        },
      });
      res.status(201).json({ session });
    } catch (error) {
      next(error);
    }
  });

  app.patch('/api/interview-sessions/:id/pause', requireRole('senior', 'guardian'), async (req, res, next) => {
    try {
      const session = await prisma.interviewSession.update({
        where: { id: req.params.id },
        data: { status: 'paused', pausedAt: new Date() },
      });
      res.json({ session });
    } catch (error) {
      next(error);
    }
  });

  app.patch('/api/interview-sessions/:id/accept', requireRole('senior'), async (req, res, next) => {
    try {
      const session = await prisma.interviewSession.update({
        where: { id: req.params.id },
        data: { status: 'active' },
      });
      res.json({ session });
    } catch (error) {
      next(error);
    }
  });

  app.patch('/api/interview-sessions/:id/end', requireRole('senior', 'guardian'), async (req, res, next) => {
    try {
      const session = await prisma.interviewSession.update({
        where: { id: req.params.id },
        data: { status: req.body.status === 'missed' ? 'missed' : 'ended', endedAt: new Date() },
      });
      res.json({ session });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/interview-records', requireRole('senior', 'guardian'), async (req, res, next) => {
    try {
      const userId = req.user!.role === 'senior'
        ? req.user!.id
        : await resolveGuardianSeniorId(req.user!.id, req.body.userId ? String(req.body.userId) : undefined);
      const question = req.body.questionId
        ? await prisma.question.findUnique({ where: { id: req.body.questionId } })
        : null;
      const record = await prisma.interviewRecord.create({
        data: {
          userId,
          chapterId: req.body.chapterId,
          questionId: req.body.questionId,
          sessionId: req.body.sessionId,
          audioFileKey: req.body.audioFileKey ?? 'audio/manual-entry.txt',
          transcriptText: String(req.body.transcriptText ?? ''),
          mode: req.body.mode ?? 'photo',
          source: req.body.source ?? 'app',
        },
      });

      if (isFreeSpeech({ questionText: question?.text, transcriptText: record.transcriptText })) {
        await prisma.freeSpeechRecord.create({
          data: {
            userId: record.userId,
            chapterId: record.chapterId,
            sessionId: record.sessionId,
            audioFileKey: record.audioFileKey,
            transcriptText: record.transcriptText,
            recordedAt: record.recordedAt,
          },
        });
      }

      res.status(201).json({ record });
    } catch (error) {
      next(error);
    }
  });

  app.patch('/api/interview-records/:id', requireRole('senior', 'guardian'), async (req, res, next) => {
    try {
      const record = await prisma.interviewRecord.update({
        where: { id: req.params.id },
        data: { transcriptText: String(req.body.transcriptText ?? '') },
      });
      res.json({ record });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/progress', requireRole('senior', 'guardian'), async (req, res, next) => {
    try {
      const seniorId = req.user!.role === 'senior'
        ? req.user!.id
        : await resolveGuardianSeniorId(req.user!.id, req.query.seniorId?.toString());
      const chapters = await prisma.chapter.findMany({ orderBy: { order: 'asc' } });
      const rows = await Promise.all(chapters.map(async (chapter) => {
        const count = await prisma.interviewRecord.count({ where: { userId: seniorId, chapterId: chapter.id } });
        return { chapter, count, complete: count >= chapter.minAnswerCount };
      }));
      const total = rows.reduce((sum, row) => sum + row.count, 0);
      const emoji = total >= 90 ? '🌳' : total >= 45 ? '🌿' : total >= 15 ? '🌱' : '🌰';
      res.json({ progress: rows, totalRecords: total, character: emoji, seniorId });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/progress/:seniorId', requireRole('senior', 'guardian'), async (req, res, next) => {
    try {
      const chapters = await prisma.chapter.findMany({ orderBy: { order: 'asc' } });
      const rows = await Promise.all(chapters.map(async (chapter) => {
        const count = await prisma.interviewRecord.count({ where: { userId: req.params.seniorId, chapterId: chapter.id } });
        return { chapter, count, complete: count >= chapter.minAnswerCount };
      }));
      const total = rows.reduce((sum, row) => sum + row.count, 0);
      const emoji = total >= 90 ? '🌳' : total >= 45 ? '🌿' : total >= 15 ? '🌱' : '🌰';
      res.json({ progress: rows, totalRecords: total, character: emoji });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/free-speech', requireRole('guardian'), async (req, res, next) => {
    try {
      const seniorId = await resolveGuardianSeniorId(req.user!.id, req.query.seniorId?.toString());
      const records = await prisma.freeSpeechRecord.findMany({
        where: { userId: seniorId },
        orderBy: { recordedAt: 'desc' },
        include: { chapter: true },
      });
      
      const vault = await prisma.legacyVault.findUnique({
        where: { seniorId }
      });
      
      const isMasked = vault && vault.isVaultSetup && vault.deathVerificationStatus !== 'released';
      
      const filteredRecords = records.map(record => {
        if (isMasked) {
          return {
            ...record,
            transcriptText: "[유산 암호화 설정으로 잠겨 있습니다. 사후 전수 시에만 해독할 수 있습니다.]"
          };
        }
        return record;
      });
      
      res.json({ records: filteredRecords });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/push-subscriptions', async (req, res, next) => {
    try {
      const keys = req.body.keys ?? {};
      const subscription = await prisma.pushSubscription.upsert({
        where: { endpoint: req.body.endpoint },
        update: {
          p256dh: keys.p256dh,
          auth: keys.auth,
          userAgent: req.header('user-agent') ?? '',
        },
        create: {
          userId: req.body.userId ?? req.user?.id ?? 'local_guardian',
          endpoint: req.body.endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
          userAgent: req.header('user-agent') ?? '',
        },
      });
      res.status(201).json({ subscription });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/notifications', requireRole('senior', 'guardian'), async (req, res, next) => {
    try {
      const limit = Math.min(Number(req.query.limit ?? 20) || 20, 50);
      const notifications = await prisma.notification.findMany({
        where: { userId: req.user!.id },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
      const unreadCount = await prisma.notification.count({
        where: { userId: req.user!.id, status: 'unread' },
      });
      res.json({ notifications: notifications.map(serializeNotification), unreadCount });
    } catch (error) {
      next(error);
    }
  });

  app.patch('/api/notifications/:id/read', requireRole('senior', 'guardian'), async (req, res, next) => {
    try {
      const notification = await prisma.notification.findFirst({
        where: { id: req.params.id, userId: req.user!.id },
      });
      if (!notification) {
        res.status(404).json({ error: '알림을 찾을 수 없습니다.' });
        return;
      }
      const updated = await prisma.notification.update({
        where: { id: notification.id },
        data: { status: 'read', readAt: notification.readAt ?? new Date() },
      });
      res.json({ notification: serializeNotification(updated) });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/nudges', requireRole('guardian'), async (req, res, next) => {
    try {
      const seniorId = await resolveGuardianSeniorId(req.user!.id, req.body.seniorId ? String(req.body.seniorId) : undefined);
      const result = await sendWebPush(seniorId, {
        type: 'nudge',
        title: 'Dearlog에서 기다리고 있어요',
        body: '가족이 오늘의 이야기를 조금 더 듣고 싶어 합니다.',
      });
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/cover-designs/generate', requireRole('guardian'), async (req, res, next) => {
    try {
      const seniorId = await resolveGuardianSeniorId(req.user!.id, req.body.seniorId ? String(req.body.seniorId) : undefined);
      const records = await prisma.interviewRecord.findMany({ where: { userId: seniorId } });
      const decision = await decideCoverDesign(records.map((record) => record.transcriptText));
      const coverDesign = await prisma.coverDesign.create({
        data: {
          userId: seniorId,
          palette: decision.palette,
          template: decision.template,
          font: decision.font,
          analysisJson: JSON.stringify(decision.analysis),
        },
      });
      res.status(201).json({ coverDesign, analysis: decision.analysis });
    } catch (error) {
      next(error);
    }
  });

  app.patch('/api/cover-designs/:id/confirm', requireRole('guardian'), async (req, res, next) => {
    try {
      const coverDesign = await prisma.coverDesign.update({
        where: { id: req.params.id },
        data: { confirmedAt: new Date() },
      });
      res.json({ coverDesign });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/publication-requests', requireRole('guardian'), async (req, res, next) => {
    try {
      const seniorId = await resolveGuardianSeniorId(req.user!.id, req.body.seniorId ? String(req.body.seniorId) : undefined);
      const cover = await prisma.coverDesign.findFirst({
        where: { userId: seniorId, confirmedAt: { not: null } },
        orderBy: { confirmedAt: 'desc' },
      });
      const request = await prisma.publicationRequest.create({
        data: {
          userId: seniorId,
          requestedById: req.user!.id,
          coverDesignId: cover?.id,
          format: req.body.format === 'B5' ? 'B5' : 'A5',
          status: 'generating',
        },
      });
      const pdfFileKey = await generateLocalPrintPdf({
        seniorId,
        coverDesignId: cover?.id,
        format: request.format as 'A5' | 'B5',
      });
      const updated = await prisma.publicationRequest.update({
        where: { id: request.id },
        data: { status: 'ready', pdfFileKey },
      });
      res.status(201).json({ publicationRequest: updated });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/interview-records', requireRole('senior', 'guardian'), async (req, res, next) => {
    try {
      const seniorId = req.user!.role === 'senior'
        ? req.user!.id
        : await resolveGuardianSeniorId(req.user!.id, req.query.seniorId?.toString());
        
      const records = await prisma.interviewRecord.findMany({
        where: { userId: seniorId },
        orderBy: { recordedAt: 'desc' },
        include: { chapter: true, question: true }
      });
      
      const vault = await prisma.legacyVault.findUnique({
        where: { seniorId }
      });
      
      const isMasked = vault && vault.isVaultSetup && vault.deathVerificationStatus !== 'released';
      
      const filteredRecords = records.map(record => {
        if (isMasked) {
          return {
            ...record,
            transcriptText: "[유산 암호화 설정으로 잠겨 있습니다. 사후 전수 시에만 해독할 수 있습니다.]"
          };
        }
        return record;
      });
      
      res.json({ records: filteredRecords });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/memories', requireRole('senior', 'guardian'), async (req, res, next) => {
    try {
      const seniorId = req.user!.role === 'senior'
        ? req.user!.id
        : await resolveGuardianSeniorId(req.user!.id, req.query.seniorId?.toString());

      const memories = await prisma.memory.findMany({
        where: { userId: seniorId },
        include: { tags: true, consentSettings: true, vectorEntry: true },
        orderBy: { date: 'desc' }
      });

      const vault = await prisma.legacyVault.findUnique({
        where: { seniorId }
      });

      const isMasked = vault && vault.isVaultSetup && vault.deathVerificationStatus !== 'released';

      const mappedMemories = memories.map(m => {
        const baseMemory = mapMemoryToResponse(m);
        if (isMasked) {
          return {
            ...baseMemory,
            topic: "[유산 암호화 설정으로 잠겨 있습니다. 사후 전수 시에만 해독할 수 있습니다.]",
            originalTranscript: "[유산 암호화 설정으로 잠겨 있습니다. 사후 전수 시에만 해독할 수 있습니다.]",
            cleanedTranscript: "[유산 암호화 설정으로 잠겨 있습니다. 사후 전수 시에만 해독할 수 있습니다.]",
            publishVersion: "[유산 암호화 설정으로 잠겨 있습니다. 사후 전수 시에만 해독할 수 있습니다.]",
            embedding: null
          };
        }
        return baseMemory;
      });

      res.json({ memories: mappedMemories });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/memories', requireRole('senior', 'guardian'), async (req, res, next) => {
    try {
      const {
        id,
        date,
        topic,
        originalTranscript,
        cleanedTranscript,
        publishVersion,
        tags,
        privacy,
        confidenceLabel,
        contradictions,
        consentSettings,
        embedding
      } = req.body;

      const seniorId = req.user!.role === 'senior'
        ? req.user!.id
        : await resolveGuardianSeniorId(req.user!.id, req.body.seniorId);

      const parsedContradictions = contradictions ? JSON.stringify(contradictions) : "[]";

      const memory = await prisma.$transaction(async (tx) => {
        const created = await tx.memory.create({
          data: {
            id: id || undefined,
            userId: seniorId,
            date: date ? new Date(date) : undefined,
            topic,
            originalTranscript,
            cleanedTranscript,
            publishVersion,
            privacy: privacy || 'private',
            confidenceLabel: confidenceLabel || '확인됨',
            contradictions: parsedContradictions,
            tags: tags ? {
              create: [
                ...(tags.people || []).map((v: string) => ({ category: 'people', value: v })),
                ...(tags.places || []).map((v: string) => ({ category: 'places', value: v })),
                ...(tags.emotions || []).map((v: string) => ({ category: 'emotions', value: v })),
                ...(tags.timePeriod ? [{ category: 'timePeriod', value: tags.timePeriod }] : [])
              ]
            } : undefined,
            consentSettings: consentSettings ? {
              create: {
                publish: consentSettings.출판 || 'granted',
                familyRead: consentSettings.가족열람 || 'granted',
                chatbot: consentSettings.챗봇 || 'granted',
                posthumous: consentSettings.사후공개 || 'granted',
                sensitive: consentSettings.민감정보 || 'granted'
              }
            } : {
              create: {
                publish: 'granted',
                familyRead: 'granted',
                chatbot: 'granted',
                posthumous: 'granted',
                sensitive: 'granted'
              }
            }
          },
          include: {
            tags: true,
            consentSettings: true,
            vectorEntry: true
          }
        });

        if (embedding) {
          await tx.memoryVectorEntry.create({
            data: {
              memoryId: created.id,
              embeddingJson: JSON.stringify(embedding),
              text: `${topic}\n${cleanedTranscript}`
            }
          });
        }

        return created;
      });

      const finalMemory = await prisma.memory.findUnique({
        where: { id: memory.id },
        include: { tags: true, consentSettings: true, vectorEntry: true }
      });

      res.status(201).json({ memory: finalMemory ? mapMemoryToResponse(finalMemory) : null });
    } catch (error) {
      next(error);
    }
  });

  app.patch('/api/memories/:id', requireRole('senior', 'guardian'), async (req, res, next) => {
    try {
      const {
        privacy,
        publishVersion,
        confidenceLabel,
        contradictions,
        consentSettings,
        embedding
      } = req.body;

      const parsedContradictions = contradictions ? JSON.stringify(contradictions) : undefined;

      await prisma.$transaction(async (tx) => {
        const memory = await tx.memory.update({
          where: { id: req.params.id },
          data: {
            privacy: privacy || undefined,
            publishVersion: publishVersion || undefined,
            confidenceLabel: confidenceLabel || undefined,
            contradictions: parsedContradictions,
            consentSettings: consentSettings ? {
              upsert: {
                create: {
                  publish: consentSettings.출판 || 'granted',
                  familyRead: consentSettings.가족열람 || 'granted',
                  chatbot: consentSettings.챗봇 || 'granted',
                  posthumous: consentSettings.사후공개 || 'granted',
                  sensitive: consentSettings.민감정보 || 'granted'
                },
                update: {
                  publish: consentSettings.출판 || undefined,
                  familyRead: consentSettings.가족열람 || undefined,
                  chatbot: consentSettings.챗봇 || undefined,
                  posthumous: consentSettings.사후공개 || undefined,
                  sensitive: consentSettings.민감정보 || undefined
                }
              }
            } : undefined
          }
        });

        if (embedding !== undefined) {
          if (embedding === null) {
            await tx.memoryVectorEntry.deleteMany({
              where: { memoryId: req.params.id }
            });
          } else {
            await tx.memoryVectorEntry.upsert({
              where: { memoryId: req.params.id },
              create: {
                memoryId: req.params.id,
                embeddingJson: JSON.stringify(embedding),
                text: `${memory.topic}\n${memory.cleanedTranscript}`
              },
              update: {
                embeddingJson: JSON.stringify(embedding),
                text: `${memory.topic}\n${memory.cleanedTranscript}`
              }
            });
          }
        }
      });

      const finalMemory = await prisma.memory.findUnique({
        where: { id: req.params.id },
        include: { tags: true, consentSettings: true, vectorEntry: true }
      });

      res.json({ memory: finalMemory ? mapMemoryToResponse(finalMemory) : null });
    } catch (error) {
      next(error);
    }
  });

  app.delete('/api/memories/:id', requireRole('senior', 'guardian'), async (req, res, next) => {
    try {
      await prisma.memory.delete({
        where: { id: req.params.id }
      });
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  // --- Photo Endpoints ---
  app.get('/api/photos', requireRole('senior', 'guardian'), async (req, res, next) => {
    try {
      const seniorId = req.user!.role === 'senior'
        ? req.user!.id
        : await resolveGuardianSeniorId(req.user!.id, req.query.seniorId?.toString());

      const photos = await prisma.photo.findMany({
        where: { userId: seniorId },
        orderBy: { uploadedAt: 'desc' }
      });

      res.json({ photos: photos.map(mapPhotoToResponse) });
    } catch (error) {
      next(error);
    }
  });

  app.patch('/api/photos/:id', requireRole('senior', 'guardian'), async (req, res, next) => {
    try {
      const { linkedMemoryIds } = req.body;
      const parsedLinkedMemoryIds = linkedMemoryIds ? JSON.stringify(linkedMemoryIds) : undefined;

      const photo = await prisma.photo.update({
        where: { id: req.params.id },
        data: {
          linkedMemoryIds: parsedLinkedMemoryIds
        }
      });

      res.json({ photo: mapPhotoToResponse(photo) });
    } catch (error) {
      next(error);
    }
  });

  app.delete('/api/photos/:id', requireRole('senior', 'guardian'), async (req, res, next) => {
    try {
      await prisma.photo.delete({
        where: { id: req.params.id }
      });
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  // --- Family Question Endpoints ---
  app.get('/api/family-questions', requireRole('senior', 'guardian'), async (req, res, next) => {
    try {
      const seniorId = req.user!.role === 'senior'
        ? req.user!.id
        : await resolveGuardianSeniorId(req.user!.id, req.query.seniorId?.toString());

      const questions = await prisma.question.findMany({
        where: {
          category: { in: ['guardian_questions', 'family_question'] }
        },
        orderBy: { createdAt: 'desc' }
      });

      res.json({ questions: questions.map(mapQuestionToResponse) });
    } catch (error) {
      next(error);
    }
  });

  app.patch('/api/questions/:id', requireRole('senior', 'guardian'), async (req, res, next) => {
    try {
      const { text, priority, status, anonymous, answerMemoryId } = req.body;

      const question = await prisma.question.update({
        where: { id: req.params.id },
        data: {
          text: text !== undefined ? String(text).trim() : undefined,
          priority: priority || undefined,
          status: status || undefined,
          anonymous: anonymous !== undefined ? Boolean(anonymous) : undefined,
          answerMemoryId: answerMemoryId !== undefined ? answerMemoryId : undefined,
          answeredAt: status === 'answered' ? new Date() : undefined
        }
      });

      res.json({ question: mapQuestionToResponse(question) });
    } catch (error) {
      next(error);
    }
  });

  app.delete('/api/questions/:id', requireRole('senior', 'guardian'), async (req, res, next) => {
    try {
      await prisma.question.delete({
        where: { id: req.params.id }
      });
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  // --- Autobiography Draft Endpoints ---
  app.get('/api/autobiography/draft', requireRole('senior', 'guardian'), async (req, res, next) => {
    try {
      const seniorId = req.user!.role === 'senior'
        ? req.user!.id
        : await resolveGuardianSeniorId(req.user!.id, req.query.seniorId?.toString());

      const draft = await prisma.autobiographyDraft.findUnique({
        where: { userId: seniorId }
      });

      res.json({ draft: draft ? mapAutobiographyDraftToResponse(draft) : null });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/autobiography/draft', requireRole('senior', 'guardian'), async (req, res, next) => {
    try {
      const { structure, narratives } = req.body;
      const seniorId = req.user!.role === 'senior'
        ? req.user!.id
        : await resolveGuardianSeniorId(req.user!.id, req.body.seniorId);

      const draft = await prisma.autobiographyDraft.upsert({
        where: { userId: seniorId },
        create: {
          userId: seniorId,
          structureJson: structure ? JSON.stringify(structure) : '{}',
          narrativesJson: narratives ? JSON.stringify(narratives) : '[]',
          lastGenerated: new Date()
        },
        update: {
          structureJson: structure ? JSON.stringify(structure) : undefined,
          narrativesJson: narratives ? JSON.stringify(narratives) : undefined,
          lastGenerated: new Date()
        }
      });

      res.status(201).json({ draft: mapAutobiographyDraftToResponse(draft) });
    } catch (error) {
      next(error);
    }
  });

  app.delete('/api/autobiography/draft', requireRole('senior', 'guardian'), async (req, res, next) => {
    try {
      const seniorId = req.user!.role === 'senior'
        ? req.user!.id
        : await resolveGuardianSeniorId(req.user!.id, req.body.seniorId);

      await prisma.autobiographyDraft.deleteMany({
        where: { userId: seniorId }
      });

      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/legacy/vault', requireRole('senior', 'guardian'), async (req, res, next) => {
    try {
      const seniorId = req.user!.role === 'senior'
        ? req.user!.id
        : await resolveGuardianSeniorId(req.user!.id, req.body.seniorId ? String(req.body.seniorId) : undefined);
        
      const {
        encryptedMemories,
        encryptedAutobiography,
        serverShare,
        institutionShare
      } = req.body;
      
      const vault = await prisma.legacyVault.upsert({
        where: { seniorId },
        update: {
          isVaultSetup: true,
          encryptedMemories,
          encryptedAutobiography,
          serverShare,
          institutionShare,
          isDeceased: false,
          deathVerificationStatus: 'alive',
          serverShareReleased: false,
          institutionShareReleased: false,
          updatedAt: new Date()
        },
        create: {
          seniorId,
          isVaultSetup: true,
          encryptedMemories,
          encryptedAutobiography,
          serverShare,
          institutionShare,
          isDeceased: false,
          deathVerificationStatus: 'alive',
          serverShareReleased: false,
          institutionShareReleased: false,
        }
      });
      
      res.status(201).json({
        vault: {
          id: vault.id,
          seniorId: vault.seniorId,
          isVaultSetup: vault.isVaultSetup,
          deathVerificationStatus: vault.deathVerificationStatus,
          isDeceased: vault.isDeceased,
          serverShareReleased: vault.serverShareReleased,
          institutionShareReleased: vault.institutionShareReleased,
          createdAt: vault.createdAt,
          updatedAt: vault.updatedAt
        }
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/legacy/vault', requireRole('senior', 'guardian'), async (req, res, next) => {
    try {
      const seniorId = req.user!.role === 'senior'
        ? req.user!.id
        : await resolveGuardianSeniorId(req.user!.id, req.query.seniorId?.toString());
        
      const vault = await prisma.legacyVault.findUnique({
        where: { seniorId }
      });
      
      if (!vault) {
        res.json({ vault: { isVaultSetup: false } });
        return;
      }
      
      res.json({
        vault: {
          id: vault.id,
          seniorId: vault.seniorId,
          isVaultSetup: vault.isVaultSetup,
          deathVerificationStatus: vault.deathVerificationStatus,
          isDeceased: vault.isDeceased,
          serverShareReleased: vault.serverShareReleased,
          institutionShareReleased: vault.institutionShareReleased,
          encryptedMemories: vault.encryptedMemories,
          encryptedAutobiography: vault.encryptedAutobiography,
          createdAt: vault.createdAt,
          updatedAt: vault.updatedAt
        }
      });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/legacy/trigger-death', requireRole('guardian'), async (req, res, next) => {
    try {
      const seniorId = await resolveGuardianSeniorId(req.user!.id, req.body.seniorId ? String(req.body.seniorId) : undefined);
      
      const vault = await prisma.legacyVault.findUnique({
        where: { seniorId }
      });
      
      if (!vault || !vault.isVaultSetup) {
        res.status(400).json({ error: '유산 금고가 아직 개설되지 않았습니다.' });
        return;
      }
      
      const updatedVault = await prisma.legacyVault.update({
        where: { seniorId },
        data: {
          isDeceased: true,
          deathVerificationStatus: 'pending_verification',
          updatedAt: new Date()
        }
      });
      
      const notification = await prisma.notification.create({
        data: {
          userId: req.user!.id,
          relatedUserId: seniorId,
          type: 'legacy_death_triggered',
          title: '디지털 유산 전수 심사 개시',
          body: '어르신의 디지털 유산 전수를 위한 사망 심사가 시작되었습니다. 승인 후 데이터를 복원할 수 있습니다.',
          metadataJson: JSON.stringify({ seniorId })
        }
      });
      
      res.json({
        vault: {
          id: updatedVault.id,
          seniorId: updatedVault.seniorId,
          isVaultSetup: updatedVault.isVaultSetup,
          deathVerificationStatus: updatedVault.deathVerificationStatus,
          isDeceased: updatedVault.isDeceased,
          serverShareReleased: updatedVault.serverShareReleased,
          institutionShareReleased: updatedVault.institutionShareReleased
        },
        notification
      });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/legacy/approve-death', requireRole('guardian'), async (req, res, next) => {
    try {
      const seniorId = await resolveGuardianSeniorId(req.user!.id, req.body.seniorId ? String(req.body.seniorId) : undefined);
      
      const vault = await prisma.legacyVault.findUnique({
        where: { seniorId }
      });
      
      if (!vault || !vault.isVaultSetup) {
        res.status(400).json({ error: '유산 금고가 아직 개설되지 않았습니다.' });
        return;
      }
      
      const updatedVault = await prisma.legacyVault.update({
        where: { seniorId },
        data: {
          deathVerificationStatus: 'released',
          serverShareReleased: true,
          institutionShareReleased: true,
          updatedAt: new Date()
        }
      });
      
      const notification = await prisma.notification.create({
        data: {
          userId: req.user!.id,
          relatedUserId: seniorId,
          type: 'legacy_released',
          title: '디지털 유산 상속 준비 완료',
          body: '사망 심사가 최종 승인되었습니다. 가족 보관 키 조각과 승인된 기관 키 조각을 결합하여 유산을 복원하세요.',
          metadataJson: JSON.stringify({ seniorId })
        }
      });
      
      res.json({
        vault: {
          id: updatedVault.id,
          seniorId: updatedVault.seniorId,
          isVaultSetup: updatedVault.isVaultSetup,
          deathVerificationStatus: updatedVault.deathVerificationStatus,
          isDeceased: updatedVault.isDeceased,
          serverShareReleased: updatedVault.serverShareReleased,
          institutionShareReleased: updatedVault.institutionShareReleased
        },
        notification
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/legacy/shares', requireRole('guardian'), async (req, res, next) => {
    try {
      const seniorId = await resolveGuardianSeniorId(req.user!.id, req.query.seniorId?.toString());
      
      const vault = await prisma.legacyVault.findUnique({
        where: { seniorId }
      });
      
      if (!vault) {
        res.status(404).json({ error: '유산 금고를 찾을 수 없습니다.' });
        return;
      }
      
      if (vault.deathVerificationStatus !== 'released') {
        res.status(403).json({ error: '사망 심사가 완료되지 않아 키 조각을 릴리즈할 수 없습니다.' });
        return;
      }
      
      res.json({
        serverShare: vault.serverShare,
        institutionShare: vault.institutionShare
      });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/legacy/reset', requireRole('senior', 'guardian'), async (req, res, next) => {
    try {
      const seniorId = req.user!.role === 'senior'
        ? req.user!.id
        : await resolveGuardianSeniorId(req.user!.id, req.body.seniorId ? String(req.body.seniorId) : undefined);
        
      await prisma.legacyVault.deleteMany({
        where: { seniorId }
      });
      
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/files/*', requireRole('senior', 'guardian'), async (req, res, next) => {
    try {
      const fileKey = req.params[0];
      const filePath = resolveLocalFileKey(fileKey);
      await fs.access(filePath);
      res.sendFile(filePath);
    } catch (error) {
      next(error);
    }
  });

  app.post('/twilio/voice', async (req, res) => {
    if (config.twilio.authToken && !twilio.validateRequest(config.twilio.authToken, req.header('x-twilio-signature') ?? '', `${config.publicUrl}${req.originalUrl}`, req.body)) {
      res.status(403).send('invalid signature');
      return;
    }
    const response = new twilio.twiml.VoiceResponse();
    const connect = response.connect();
    connect.stream({ url: `${config.publicUrl.replace(/^http/, 'ws')}/twilio/media?scheduleId=${encodeURIComponent(req.query.scheduleId?.toString() ?? '')}` });
    res.type('text/xml').send(response.toString());
  });

  app.post('/twilio/status', async (req, res, next) => {
    try {
      const scheduleId = req.query.scheduleId?.toString();
      if (scheduleId) {
        await prisma.interviewSchedule.update({
          where: { id: scheduleId },
          data: { status: String(req.body.CallStatus ?? 'updated') },
        });
      }
      res.sendStatus(204);
    } catch (error) {
      next(error);
    }
  });

  app.post('/twilio/recording', async (_req, res) => {
    // Twilio recording callback은 실제 배포에서 녹음 URL 다운로드 worker로 확장합니다.
    res.sendStatus(204);
  });

  app.use(express.static(distDir));
  app.get('*', async (_req, res, next) => {
    try {
      // 사용자 테스트 배포에서는 Express가 빌드된 SPA와 API를 같은 HTTPS origin에서 제공합니다.
      await fs.access(path.join(distDir, 'index.html'));
      res.sendFile(path.join(distDir, 'index.html'));
    } catch (error) {
      next(error);
    }
  });

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const statusCode = typeof error === 'object' && error && 'statusCode' in error
      ? Number((error as { statusCode?: number }).statusCode)
      : 500;
    res.status(Number.isFinite(statusCode) ? statusCode : 500).json({
      error: error instanceof Error ? error.message : '서버 오류가 발생했습니다.',
    });
  });

  return app;
}
