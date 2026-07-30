#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dbPath = path.join(rootDir, 'server/data/dearlog.db');
const storageDir = path.join(rootDir, 'server/storage');
const backupsDir = path.join(rootDir, 'backups');
const shouldQuarantine = process.argv.includes('--quarantine');
const timestampArg = process.argv.find((arg) => arg.startsWith('--timestamp='));
const timestamp = timestampArg?.split('=')[1] || new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '');

function sqlite(query) {
  return execFileSync('sqlite3', [dbPath, query], { encoding: 'utf8' })
    .trim()
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(fullPath);
    if (!entry.isFile()) return [];
    return [fullPath];
  });
}

function storageKey(filePath) {
  return path.relative(storageDir, filePath).split(path.sep).join('/');
}

const referencedKeys = new Set(sqlite(`
  select fileKey from Photo
  union
  select audioFileKey from InterviewRecord
  union
  select audioFileKey from free_speech_db
  union
  select pdfFileKey from PublicationRequest where pdfFileKey is not null;
`));

const storageFiles = listFiles(storageDir);
const orphanFiles = storageFiles.filter((filePath) => !referencedKeys.has(storageKey(filePath)));

const tableCounts = sqlite(`
  select 'User|' || count(*) from User
  union all select 'GuardianSeniorLink|' || count(*) from GuardianSeniorLink
  union all select 'Question|' || count(*) from Question
  union all select 'Photo|' || count(*) from Photo
  union all select 'InterviewRecord|' || count(*) from InterviewRecord
  union all select 'free_speech_db|' || count(*) from free_speech_db
  union all select 'InterviewSession|' || count(*) from InterviewSession
  union all select 'AiProxyAuditLog|' || count(*) from AiProxyAuditLog;
`).map((line) => {
  const [table, count] = line.split('|');
  return { table, count: Number(count) };
});

let quarantineDir = null;
if (shouldQuarantine && orphanFiles.length > 0) {
  quarantineDir = path.join(backupsDir, `quarantine-orphan-storage-${timestamp}`);
  for (const filePath of orphanFiles) {
    const relativePath = path.relative(rootDir, filePath);
    const targetPath = path.join(quarantineDir, relativePath);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.renameSync(filePath, targetPath);
  }
}

const report = {
  dbPath,
  storageDir,
  tableCounts,
  referencedStorageKeys: referencedKeys.size,
  storageFileCount: storageFiles.length,
  orphanStorageFileCount: orphanFiles.length,
  orphanStorageKeys: orphanFiles.map(storageKey),
  quarantined: shouldQuarantine,
  quarantineDir,
};

console.log(JSON.stringify(report, null, 2));
