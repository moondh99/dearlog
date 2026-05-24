import { PrismaClient } from '@prisma/client';
import '../config';
import { COMMON_QUESTIONS, FIXED_CHAPTERS, MIN_ANSWERS_PER_CHAPTER } from '../domain/constants';

const prisma = new PrismaClient();

async function main() {
  for (const chapter of FIXED_CHAPTERS) {
    await prisma.chapter.upsert({
      where: { id: chapter.id },
      update: {
        order: chapter.order,
        slug: chapter.slug,
        title: chapter.title,
        minAnswerCount: MIN_ANSWERS_PER_CHAPTER,
      },
      create: {
        ...chapter,
        minAnswerCount: MIN_ANSWERS_PER_CHAPTER,
      },
    });
  }

  for (const [index, [chapterId, text]] of COMMON_QUESTIONS.entries()) {
    await prisma.question.upsert({
      where: { id: `common_${String(index + 1).padStart(2, '0')}` },
      update: { text, chapterId, category: 'common_questions' },
      create: {
        id: `common_${String(index + 1).padStart(2, '0')}`,
        category: 'common_questions',
        text,
        chapterId,
        status: 'active',
      },
    });
  }

  await prisma.user.upsert({
    where: { id: 'local_senior' },
    update: { role: 'senior', birthDecade: '1950년대', preferredName: '어르신', seniorName: '김영자', seniorBirthDecade: '1950년대', seniorPreferredName: '어르신' },
    create: {
      id: 'local_senior',
      name: '김영자',
      phoneNumber: '+8201012345678',
      role: 'senior',
      birthDecade: '1950년대',
      preferredName: '어르신',
      seniorName: '김영자',
      seniorBirthDecade: '1950년대',
      seniorPreferredName: '어르신',
    },
  });

  await prisma.user.upsert({
    where: { id: 'local_guardian' },
    update: { role: 'guardian', preferredName: '보호자', guardianName: '보호자', guardianRelationship: '자녀', guardianPreferredName: '보호자' },
    create: {
      id: 'local_guardian',
      name: '보호자',
      phoneNumber: '+8201098765432',
      role: 'guardian',
      preferredName: '보호자',
      guardianName: '보호자',
      guardianRelationship: '자녀',
      guardianPreferredName: '보호자',
    },
  });

  await prisma.guardianSeniorLink.upsert({
    where: { guardianId_seniorId: { guardianId: 'local_guardian', seniorId: 'local_senior' } },
    update: {},
    create: { guardianId: 'local_guardian', seniorId: 'local_senior' },
  });
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
