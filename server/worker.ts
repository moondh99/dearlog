import { prisma } from './db';
import { markMissedRingingSessions, sendAppInterviewCall } from './app-call';
import { sendWebPush } from './push';

export async function processDueInterviewSchedules(now = new Date()) {
  const schedules = await prisma.interviewSchedule.findMany({
    where: {
      status: 'scheduled',
      scheduledAt: { lte: now },
    },
  });

  for (const schedule of schedules) {
    try {
      await sendAppInterviewCall({
        seniorId: schedule.seniorId,
        guardianId: schedule.guardianId,
        scheduleId: schedule.id,
      });
    } catch (error) {
      await prisma.interviewSchedule.update({
        where: { id: schedule.id },
        data: {
          status: 'failed',
          lastError: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  return schedules.length;
}

export async function processInactivityNotifications(now = new Date()) {
  const threshold = new Date(now);
  threshold.setDate(threshold.getDate() - 3);
  const seniors = await prisma.user.findMany({ where: { role: 'senior' } });
  let sent = 0;

  for (const senior of seniors) {
    const latest = await prisma.interviewRecord.findFirst({
      where: { userId: senior.id },
      orderBy: { recordedAt: 'desc' },
    });
    if (latest && latest.recordedAt > threshold) continue;

    const links = await prisma.guardianSeniorLink.findMany({ where: { seniorId: senior.id } });
    for (const link of links) {
      await sendWebPush(link.guardianId, {
        type: 'inactive_senior',
        title: `${senior.name}님의 기록이 잠시 쉬고 있어요`,
        body: '3일 이상 새 기록이 없어 콕 찌르기를 보낼 수 있습니다.',
      });
      sent += 1;
    }
  }

  return sent;
}

if (process.argv[1]?.endsWith('worker.ts')) {
  setInterval(() => {
    processDueInterviewSchedules().catch(console.error);
    markMissedRingingSessions().catch(console.error);
    processInactivityNotifications().catch(console.error);
  }, 60_000);
}
