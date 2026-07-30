import { cp, mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const stamp = new Date()
  .toISOString()
  .replace(/[-:]/g, '')
  .replace(/\..+/, '')
  .replace('T', '-');

const backupDir = path.join(rootDir, 'backups', `dearlog-backup-${stamp}`);

const sources = [
  { label: 'database', from: path.join(rootDir, 'server', 'data'), to: path.join(backupDir, 'server', 'data') },
  { label: 'storage', from: path.join(rootDir, 'server', 'storage'), to: path.join(backupDir, 'server', 'storage') },
];

async function pathExists(target) {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

const copied = [];
const skipped = [];

await mkdir(backupDir, { recursive: true });

for (const source of sources) {
  if (await pathExists(source.from)) {
    await cp(source.from, source.to, { recursive: true });
    copied.push(source.label);
  } else {
    skipped.push({ label: source.label, reason: 'missing source directory' });
  }
}

const manifest = {
  createdAt: new Date().toISOString(),
  backupDir,
  copied,
  skipped,
};

await writeFile(path.join(backupDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Dearlog backup created: ${backupDir}`);
console.log(`Copied: ${copied.length ? copied.join(', ') : 'none'}`);
if (skipped.length) {
  console.log(`Skipped: ${skipped.map((item) => item.label).join(', ')}`);
}
