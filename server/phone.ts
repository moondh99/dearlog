import twilio from 'twilio';
import { config } from './config';
import { prisma } from './db';

export function canPlaceRealCalls() {
  return Boolean(config.twilio.accountSid && config.twilio.authToken && config.twilio.fromNumber);
}

export async function placeScheduledCall(scheduleId: string) {
  const schedule = await prisma.interviewSchedule.findUnique({
    where: { id: scheduleId },
    include: { senior: true },
  });
  if (!schedule) throw new Error('인터뷰 스케줄을 찾을 수 없습니다.');
  if (!schedule.senior.phoneNumber) throw new Error('시니어 전화번호가 없습니다.');

  if (!canPlaceRealCalls()) {
    return prisma.interviewSchedule.update({
      where: { id: scheduleId },
      data: {
        status: 'ready_for_call',
        lastError: 'Twilio 키가 없어 실제 발신은 건너뛰고 로컬 상태만 갱신했습니다.',
      },
    });
  }

  const client = twilio(config.twilio.accountSid, config.twilio.authToken);
  const call = await client.calls.create({
    to: schedule.senior.phoneNumber,
    from: config.twilio.fromNumber,
    url: `${config.publicUrl}/twilio/voice?scheduleId=${encodeURIComponent(schedule.id)}`,
    statusCallback: `${config.publicUrl}/twilio/status?scheduleId=${encodeURIComponent(schedule.id)}`,
    statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
    record: true,
    recordingStatusCallback: `${config.publicUrl}/twilio/recording?scheduleId=${encodeURIComponent(schedule.id)}`,
  });

  return prisma.interviewSchedule.update({
    where: { id: scheduleId },
    data: { status: 'calling', callSid: call.sid, lastError: null },
  });
}
