// 운영자용: 이메일이 없는 기존 계정에 로그인 인증번호를 받을 이메일을 넣는다.
// 로그인 인증번호는 계정에 등록된 이메일로만 가므로, 이메일 칸이 생기기 전에 가입한 계정은
// 이 스크립트로 채우기 전까지 로그인할 수 없다.
//
// 사용: npm run user:set-email -- 010-1234-5678 someone@gmail.com
// 서버와 같은 .env(DATABASE_URL)를 읽는다. 본인에게 받은 주소만 넣는다.
import { prisma } from '../server/db';
import { normalizeEmail } from '../server/email-address';

async function main() {
  const [phoneArg, emailArg] = process.argv.slice(2);
  const phoneNumber = String(phoneArg ?? '').replace(/[^\d]/g, '');
  const email = normalizeEmail(emailArg);
  if (!/^01[016789]\d{7,8}$/.test(phoneNumber) || !email) {
    console.error('사용법: npm run user:set-email -- <휴대폰 번호> <이메일>');
    process.exitCode = 1;
    return;
  }

  const user = await prisma.user.findUnique({ where: { phoneNumber }, select: { id: true, name: true, role: true, email: true } });
  if (!user) {
    console.error(`${phoneNumber} 로 가입한 계정이 없습니다.`);
    process.exitCode = 1;
    return;
  }

  await prisma.user.update({ where: { id: user.id }, data: { email } });
  console.log(`${user.name}(${user.role}) ${phoneNumber}: ${user.email ?? '(없음)'} -> ${email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
