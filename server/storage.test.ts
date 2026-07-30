// @vitest-environment node
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express, {
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
} from 'express';
import multer from 'multer';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import {
  AUDIO_UPLOAD_LIMITS,
  PHOTO_UPLOAD_LIMITS,
  createAudioUpload,
  createPhotoUpload,
} from './storage';

const temporaryDirectories: string[] = [];

async function makeTemporaryDirectory(kind: string) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), `dearlog-${kind}-upload-`));
  temporaryDirectories.push(directory);
  return directory;
}

function createUploadApp(middleware: RequestHandler) {
  const app = express();
  app.post('/upload', middleware, (req, res) => {
    res.status(201).json({
      body: req.body,
      file: req.file
        ? {
          fieldname: req.file.fieldname,
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size,
          filename: req.file.filename,
        }
        : null,
      files: Array.isArray(req.files) ? req.files.length : 0,
    });
  });
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const multerError = error instanceof multer.MulterError ? error : null;
    res.status(400).json({
      code: multerError?.code ?? 'UPLOAD_ERROR',
      field: multerError?.field,
      error: error instanceof Error ? error.message : 'upload failed',
    });
  });
  return app;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => (
    fs.rm(directory, { recursive: true, force: true })
  )));
});

describe('local upload limits', () => {
  it('uses bounded limits tailored to photo and audio forms', () => {
    expect(PHOTO_UPLOAD_LIMITS).toEqual({
      fileSize: 20 * 1024 * 1024,
      files: 1,
      fields: 8,
      parts: 10,
      fieldNestingDepth: 0,
    });
    expect(AUDIO_UPLOAD_LIMITS).toEqual({
      fileSize: 25 * 1024 * 1024,
      files: 1,
      fields: 1,
      parts: 3,
      fieldNestingDepth: 0,
    });
  });

  it('persists a normal photo upload with all currently supported flat metadata', async () => {
    const destinationDir = await makeTemporaryDirectory('photo-normal');
    const app = createUploadApp(createPhotoUpload({ destinationDir }).single('photo'));

    const response = await request(app)
      .post('/upload')
      .field('seniorId', 'senior-1')
      .field('chapterId', 'childhood')
      .field('capturedDate', '2026-07-31')
      .field('location', '서울')
      .field('memo', '가족 사진')
      .field('linkedQuestion', '이날의 이야기를 들려주세요')
      .attach('photo', Buffer.from('valid-photo'), {
        filename: 'family.jpg',
        contentType: 'image/jpeg',
      });

    expect(response.status).toBe(201);
    expect(response.body.file).toMatchObject({
      fieldname: 'photo',
      originalname: 'family.jpg',
      mimetype: 'image/jpeg',
      size: Buffer.byteLength('valid-photo'),
    });
    expect(response.body.body).toMatchObject({
      seniorId: 'senior-1',
      chapterId: 'childhood',
      memo: '가족 사진',
    });
    await expect(fs.readFile(path.join(destinationDir, response.body.file.filename), 'utf8'))
      .resolves.toBe('valid-photo');
  });

  it('persists a normal audio upload with its senior field', async () => {
    const destinationDir = await makeTemporaryDirectory('audio-normal');
    const app = createUploadApp(createAudioUpload({ destinationDir }).single('audio'));

    const response = await request(app)
      .post('/upload')
      .field('seniorId', 'senior-1')
      .attach('audio', Buffer.from('valid-audio'), {
        filename: 'interview.webm',
        contentType: 'audio/webm',
      });

    expect(response.status).toBe(201);
    expect(response.body.file).toMatchObject({
      fieldname: 'audio',
      originalname: 'interview.webm',
      mimetype: 'audio/webm',
      size: Buffer.byteLength('valid-audio'),
    });
    expect(response.body.body).toEqual({ seniorId: 'senior-1' });
    await expect(fs.readFile(path.join(destinationDir, response.body.file.filename), 'utf8'))
      .resolves.toBe('valid-audio');
  });

  it.each([
    ['photo', createPhotoUpload, 'photo'],
    ['audio', createAudioUpload, 'audio'],
  ] as const)('rejects nested %s form fields', async (_kind, createUpload, fileField) => {
    const destinationDir = await makeTemporaryDirectory(`${fileField}-nested`);
    const app = createUploadApp(createUpload({ destinationDir }).single(fileField));

    const response = await request(app)
      .post('/upload')
      .field('metadata[nested]', 'blocked')
      .attach(fileField, Buffer.from('file'), `${fileField}.bin`);

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      code: 'LIMIT_FIELD_NESTING',
      field: 'metadata[nested]',
    });
    await expect(fs.readdir(destinationDir)).resolves.toEqual([]);
  });

  it('rejects a photo larger than 20 MiB and removes the partial disk file', async () => {
    const destinationDir = await makeTemporaryDirectory('photo-oversized');
    const app = createUploadApp(createPhotoUpload({ destinationDir }).single('photo'));

    const response = await request(app)
      .post('/upload')
      .attach('photo', Buffer.alloc(PHOTO_UPLOAD_LIMITS.fileSize + 1), 'oversized.jpg');

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('LIMIT_FILE_SIZE');
    await expect(fs.readdir(destinationDir)).resolves.toEqual([]);
  });

  it('rejects more than one audio file and removes all partial disk files', async () => {
    const destinationDir = await makeTemporaryDirectory('audio-files');
    const app = createUploadApp(createAudioUpload({ destinationDir }).any());

    const response = await request(app)
      .post('/upload')
      .attach('audio', Buffer.from('first'), 'first.webm')
      .attach('audio', Buffer.from('second'), 'second.webm');

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('LIMIT_FILE_COUNT');
    await expect(fs.readdir(destinationDir)).resolves.toEqual([]);
  });
});
