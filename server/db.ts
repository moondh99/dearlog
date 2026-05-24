import { PrismaClient } from '@prisma/client';
import './config';

export const prisma = new PrismaClient();

export async function migrateLegacyRoles() {
  // 기존 프로토타입에서 쓰던 family 역할을 새 명세의 guardian으로 정규화합니다.
  await prisma.user.updateMany({
    where: { role: 'family' },
    data: { role: 'guardian' },
  });
}

export async function closeDb() {
  await prisma.$disconnect();
}
