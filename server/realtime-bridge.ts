import type { Server as HttpServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { config } from './config';
import { prisma } from './db';
import { writeLocalFile } from './storage';

export function attachTwilioMediaBridge(server: HttpServer) {
  const wss = new WebSocketServer({ server, path: '/twilio/media' });

  wss.on('connection', async (twilioSocket, request) => {
    const url = new URL(request.url ?? '/twilio/media', config.publicUrl);
    const scheduleId = url.searchParams.get('scheduleId') ?? undefined;
    let realtime: WebSocket | null = null;
    let sessionId: string | null = null;
    const audioChunks: Buffer[] = [];

    if (config.openaiApiKey) {
      realtime = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview', {
        headers: {
          Authorization: `Bearer ${config.openaiApiKey}`,
          'OpenAI-Beta': 'realtime=v1',
        },
      });
      realtime.on('message', async (raw) => {
        const event = safeJson(raw.toString());
        const transcript = event?.transcript ?? event?.delta?.transcript ?? event?.response?.output_text;
        if (typeof transcript === 'string' && transcript.trim() && sessionId) {
          const session = await prisma.interviewSession.findUnique({ where: { id: sessionId } });
          if (session) {
            await prisma.interviewRecord.create({
              data: {
                userId: session.seniorId,
                chapterId: session.chapterId,
                sessionId,
                audioFileKey: 'audio/live-stream-placeholder.raw',
                transcriptText: transcript.trim(),
                source: 'twilio',
                mode: 'phone',
              },
            });
          }
        }
      });
    }

    twilioSocket.on('message', async (raw) => {
      const event = safeJson(raw.toString());
      if (event?.event === 'start') {
        const schedule = scheduleId
          ? await prisma.interviewSchedule.findUnique({ where: { id: scheduleId } })
          : null;
        if (schedule) {
          const chapter = await prisma.chapter.findFirst({ orderBy: { order: 'asc' } });
          if (chapter) {
            const created = await prisma.interviewSession.create({
              data: {
                seniorId: schedule.seniorId,
                chapterId: chapter.id,
                mode: 'phone',
                status: 'active',
              },
            });
            sessionId = created.id;
          }
        }
      }

      if (event?.event === 'media' && typeof event.media?.payload === 'string') {
        const chunk = Buffer.from(event.media.payload, 'base64');
        audioChunks.push(chunk);
        if (realtime?.readyState === WebSocket.OPEN) {
          realtime.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: event.media.payload }));
        }
      }

      if (event?.event === 'stop') {
        const audioFileKey = audioChunks.length > 0
          ? await writeLocalFile('audio', Buffer.concat(audioChunks), 'mulaw')
          : 'audio/live-stream-placeholder.raw';
        if (sessionId) {
          await prisma.interviewSession.update({
            where: { id: sessionId },
            data: { status: 'completed', endedAt: new Date() },
          });
          await prisma.interviewRecord.updateMany({
            where: { sessionId, audioFileKey: 'audio/live-stream-placeholder.raw' },
            data: { audioFileKey },
          });
        }
        realtime?.close();
      }
    });
  });
}

function safeJson(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
