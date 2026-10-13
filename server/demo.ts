// 발표용 데모 서버 진입점: npm run demo:server (화면은 npm run demo:build)
// 운영 서버와 포트·DB·저장소가 모두 다르다. server/demo-data 를 지우면 데모가 처음 상태로 돌아간다.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// DEMO_DIR 로 다른 폴더를 쓸 수 있다(예: 영상 녹화용 임시 서버). 이름에 demo 가 들어 있어야 한다.
const demoDir = process.env.DEMO_DIR ? path.resolve(process.env.DEMO_DIR) : path.join(root, 'server', 'demo-data');
if (!/demo/.test(path.basename(demoDir))) throw new Error('DEMO_DIR 폴더 이름에는 demo 가 들어 있어야 합니다.');
const port = Number(process.env.DEMO_PORT ?? 8790);

if (process.argv.includes('--reset')) fs.rmSync(demoDir, { recursive: true, force: true });
fs.mkdirSync(demoDir, { recursive: true });

// config/db 를 읽기 전에 정해야 한다. 운영 .env 의 값보다 우선한다.
process.env.DATABASE_URL = `file:${path.join(demoDir, 'demo.db')}`;
process.env.LOCAL_SERVER_PORT = String(port);
process.env.LOCAL_SERVER_PUBLIC_URL = `http://localhost:${port}`;
// 운영 토큰이 데모에서, 데모 토큰이 운영에서 통하지 않도록 비밀키를 분리한다.
process.env.AUTH_TOKEN_SECRET = 'dearlog-demo-only-secret';
process.env.ALLOW_DEV_AUTH_HEADERS = 'false';

const { config } = await import('./config');
config.dataDir = path.join(demoDir, 'data');
config.storageDir = path.join(demoDir, 'storage');

const { createDemoApp } = await import('./demo-app');
const app = await createDemoApp({ distDir: path.join(root, 'dist-demo') });

http.createServer(app).listen(port, () => {
  console.log(`Dearlog DEMO server: http://localhost:${port}/demo  (운영 DB 와 분리됨: ${demoDir})`);
});
