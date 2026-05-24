import fs from 'node:fs/promises';
import path from 'node:path';
import multer from 'multer';
import { config } from './config';

export type StorageKind = 'audio' | 'photos' | 'pdfs';

export function storageDir(kind: StorageKind) {
  return path.join(config.storageDir, kind);
}

export async function ensureLocalStorage() {
  await fs.mkdir(config.dataDir, { recursive: true });
  await Promise.all([
    fs.mkdir(storageDir('audio'), { recursive: true }),
    fs.mkdir(storageDir('photos'), { recursive: true }),
    fs.mkdir(storageDir('pdfs'), { recursive: true }),
  ]);
}

export function buildLocalFileKey(kind: StorageKind, fileName: string) {
  return `${kind}/${fileName}`;
}

export function resolveLocalFileKey(fileKey: string) {
  const [kind, ...parts] = fileKey.split('/');
  if (!['audio', 'photos', 'pdfs'].includes(kind) || parts.length === 0) {
    throw new Error('지원하지 않는 로컬 파일 경로입니다.');
  }
  const fileName = path.basename(parts.join('/'));
  return path.join(storageDir(kind as StorageKind), fileName);
}

export async function writeLocalFile(kind: StorageKind, bytes: Uint8Array | Buffer, extension: string) {
  await ensureLocalStorage();
  const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${extension.replace(/^\./, '')}`;
  const fullPath = path.join(storageDir(kind), fileName);
  await fs.writeFile(fullPath, bytes);
  return buildLocalFileKey(kind, fileName);
}

export const photoUpload = multer({
  storage: multer.diskStorage({
    destination: async (_req, _file, callback) => {
      try {
        await ensureLocalStorage();
        callback(null, storageDir('photos'));
      } catch (error) {
        callback(error as Error, storageDir('photos'));
      }
    },
    filename: (_req, file, callback) => {
      const ext = path.extname(file.originalname) || '.jpg';
      callback(null, `${Date.now()}_${Math.random().toString(36).slice(2, 10)}${ext}`);
    },
  }),
});

export const audioUpload = multer({
  storage: multer.diskStorage({
    destination: async (_req, _file, callback) => {
      try {
        await ensureLocalStorage();
        callback(null, storageDir('audio'));
      } catch (error) {
        callback(error as Error, storageDir('audio'));
      }
    },
    filename: (_req, file, callback) => {
      // 앱 내 음성 인터뷰 원본 파일은 브라우저가 만든 webm/wav 등의 확장자를 유지해 로컬에 저장합니다.
      const ext = path.extname(file.originalname) || '.webm';
      callback(null, `${Date.now()}_${Math.random().toString(36).slice(2, 10)}${ext}`);
    },
  }),
});
