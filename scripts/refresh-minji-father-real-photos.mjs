#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(rootDir, '.env'), quiet: true });
process.env.DATABASE_URL ||= 'file:../data/dearlog.db';

const prisma = new PrismaClient();

const seniorId = 'demo_bulk_20260607_001_senior_choi_jeonghun';
const photos = [
  {
    id: 'demo_bulk_20260607_001_photo_choi_jeonghun_01',
    fileName: 'demo_bulk_20260607_001_choi_jeonghun_photo_01.png',
    title: '영도 골목',
    yearLabel: '1951년',
    place: '부산 영도',
    caption: '항구가 내려다보이는 골목에서 찍은 어린 시절 사진',
    visualStyle: 'vintage_black_and_white_harbor_alley',
  },
  {
    id: 'demo_bulk_20260607_001_photo_choi_jeonghun_02',
    fileName: 'demo_bulk_20260607_001_choi_jeonghun_photo_02.png',
    title: '공업고 실습실',
    yearLabel: '1963년',
    place: '부산공업고등학교',
    caption: '제도판 앞에서 친구들과 선 실습실 사진',
    visualStyle: 'vintage_black_and_white_drafting_classroom',
  },
  {
    id: 'demo_bulk_20260607_001_photo_choi_jeonghun_03',
    fileName: 'demo_bulk_20260607_001_choi_jeonghun_photo_03.png',
    title: '첫 배 도면',
    yearLabel: '1972년',
    place: '울산 조선소',
    caption: '첫 선박 설계 도면을 들고 찍은 사진',
    visualStyle: 'faded_color_shipyard_drafting_office',
  },
  {
    id: 'demo_bulk_20260607_001_photo_choi_jeonghun_04',
    fileName: 'demo_bulk_20260607_001_choi_jeonghun_photo_04.png',
    title: '작업복의 봄',
    yearLabel: '1978년',
    place: '조선소 정문',
    caption: '작업복 차림으로 퇴근하던 봄날',
    visualStyle: 'faded_color_shipyard_gate',
  },
  {
    id: 'demo_bulk_20260607_001_photo_choi_jeonghun_05',
    fileName: 'demo_bulk_20260607_001_choi_jeonghun_photo_05.png',
    title: '새집 입주',
    yearLabel: '1985년',
    place: '부산 사하구',
    caption: '가족이 처음 마련한 집 앞 사진',
    visualStyle: 'faded_color_family_first_home',
  },
  {
    id: 'demo_bulk_20260607_001_photo_choi_jeonghun_06',
    fileName: 'demo_bulk_20260607_001_choi_jeonghun_photo_06.png',
    title: '설계팀 단체사진',
    yearLabel: '1994년',
    place: '조선소 설계실',
    caption: '설계팀 동료들과 함께한 단체사진',
    visualStyle: 'nineties_color_ship_design_team',
  },
  {
    id: 'demo_bulk_20260607_001_photo_choi_jeonghun_07',
    fileName: 'demo_bulk_20260607_001_choi_jeonghun_photo_07.png',
    title: '항구 산책',
    yearLabel: '2023년',
    place: '부산항',
    caption: '딸 민지와 함께 항구를 걷던 사진',
    visualStyle: 'modern_natural_harbor_walk',
  },
];

function parseJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

async function assertAssetsExist() {
  for (const photo of photos) {
    const filePath = path.join(rootDir, 'server', 'storage', 'photos', photo.fileName);
    await fs.access(filePath);
  }
}

async function refreshPhotos() {
  await assertAssetsExist();

  const existing = await prisma.photo.findMany({
    where: { userId: seniorId },
    select: { id: true, metadataJson: true, analysisJson: true },
  });
  const existingIds = new Set(existing.map((photo) => photo.id));
  const missing = photos.filter((photo) => !existingIds.has(photo.id));
  if (missing.length > 0) {
    throw new Error(`Missing Choi Jeonghun photo rows: ${missing.map((photo) => photo.id).join(', ')}`);
  }

  for (const photo of photos) {
    const current = existing.find((row) => row.id === photo.id);
    const metadata = {
      ...parseJson(current?.metadataJson, {}),
      source: 'minji_father_demo_seed',
      demoAsset: 'fictional_photorealistic_record_book_photo',
      title: photo.title,
      yearLabel: photo.yearLabel,
      place: photo.place,
      caption: photo.caption,
      visualStyle: photo.visualStyle,
    };
    const analysis = {
      ...parseJson(current?.analysisJson, {}),
      description: photo.caption,
      places: [photo.place],
      objects: [photo.title, '항구', '도면'],
      visualStyle: photo.visualStyle,
    };

    await prisma.photo.update({
      where: { id: photo.id },
      data: {
        fileKey: `photos/${photo.fileName}`,
        fileName: photo.fileName,
        mimeType: 'image/png',
        metadataJson: JSON.stringify(metadata),
        analysisJson: JSON.stringify(analysis),
      },
    });
  }
}

try {
  await refreshPhotos();
  console.log(`Refreshed ${photos.length} Choi Jeonghun photos as PNG assets.`);
} finally {
  await prisma.$disconnect();
}
