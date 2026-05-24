import { prisma } from './db';
import { sendWebPush } from './push';

export async function sendAppInterviewCall(input: {
  seniorId: string;
  guardianId?: string;
  scheduleId?: string;
  chapterId?: string;
}) {
  const firstChapter = await prisma.chapter.findFirst({ orderBy: { order: 'asc' } });
  const session = await prisma.interviewSession.create({
    data: {
      seniorId: input.seniorId,
      chapterId: input.chapterId ?? firstChapter?.id ?? 'childhood',
      mode: 'app_call',
      status: 'ringing',
    },
  });

  // 실제 전화망 대신 Web Push로 앱 안에 "인터뷰 전화" 수신 알림을 띄웁니다.
  const pushResult = await sendWebPush(input.seniorId, {
    type: 'app_interview_call',
    title: 'Dearlog 인터뷰 전화가 왔어요',
    body: '알림을 누르면 앱 안에서 음성 인터뷰를 바로 시작합니다.',
    url: `/?callSessionId=${encodeURIComponent(session.id)}`,
    sessionId: session.id,
    scheduleId: input.scheduleId,
  });

  if (input.scheduleId) {
    await prisma.interviewSchedule.update({
      where: { id: input.scheduleId },
      data: {
        status: pushResult.sent > 0 ? 'app_call_sent' : 'app_call_ready',
        callSid: `app:${session.id}`,
        lastError: 'Twilio 대신 Web Push 앱 내 음성 인터뷰로 전환되었습니다.',
      },
    });
  }

  return { session, pushResult };
}

export async function markMissedRingingSessions(now = new Date()) {
  const threshold = new Date(now.getTime() - 5 * 60_000);
  const result = await prisma.interviewSession.updateMany({
    where: {
      status: 'ringing',
      startedAt: { lt: threshold },
    },
    data: {
      status: 'missed',
      endedAt: now,
    },
  });
  return result.count;
}
