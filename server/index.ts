import http from 'node:http';
import { createApp } from './app';
import { config } from './config';
import { migrateLegacyRoles } from './db';
import { ensureLocalStorage } from './storage';

await ensureLocalStorage();
await migrateLegacyRoles();

const app = createApp();
const server = http.createServer(app);

server.listen(config.port, () => {
  console.log(`Dearlog local server listening on http://localhost:${config.port}`);
});
