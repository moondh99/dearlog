import fs from 'node:fs/promises';
import path from 'node:path';
import multer from 'multer';
import { config } from './config';

export type StorageKind = 'audio' | 'photos' | 'pdfs';

const MEBIBYTE = 1024 * 1024;

// Busboy emits partsLimit when it reaches the terminating multipart boundary,
// so reserve one part beyond the maximum accepted fields + file.
export const PHOTO_UPLOAD_LIMITS = {
  fileSize: 20 * MEBIBYTE,
  files: 1,
  fields: 8,
  parts: 10,
  fieldNestingDepth: 0,
} as const;

export const AUDIO_UPLOAD_LIMITS = {
  fileSize: 25 * MEBIBYTE,
  files: 1,
  fields: 1,
  parts: 3,
  fieldNestingDepth: 0,
} as const;

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

type LocalUploadOptions = {
  destinationDir?: string;
};

function createLocalDiskStorage(
  kind: 'photos' | 'audio',
  fallbackExtension: string,
  destinationDir?: string,
) {
  const targetDir = destinationDir ?? storageDir(kind);
  return multer.diskStorage({
    destination: async (_req, _file, callback) => {
      try {
        if (destinationDir) {
          await fs.mkdir(targetDir, { recursive: true });
        } else {
          await ensureLocalStorage();
        }
        callback(null, targetDir);
      } catch (error) {
        callback(error as Error, targetDir);
      }
    },
    filename: (_req, file, callback) => {
      const ext = path.extname(file.originalname) || fallbackExtension;
      callback(null, `${Date.now()}_${Math.random().toString(36).slice(2, 10)}${ext}`);
    },
  });
}

export function createPhotoUpload(options: LocalUploadOptions = {}) {
  return multer({
    storage: createLocalDiskStorage('photos', '.jpg', options.destinationDir),
    limits: PHOTO_UPLOAD_LIMITS,
  });
}

export function createAudioUpload(options: LocalUploadOptions = {}) {
  return multer({
    // 앱 내 음성 인터뷰 원본 파일은 브라우저가 만든 webm/wav 등의 확장자를 유지해 로컬에 저장합니다.
    storage: createLocalDiskStorage('audio', '.webm', options.destinationDir),
    limits: AUDIO_UPLOAD_LIMITS,
  });
}

export const photoUpload = createPhotoUpload();
export const audioUpload = createAudioUpload();
