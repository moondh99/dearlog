import http from 'node:http';
import { createApp } from './app';
import { config } from './config';
import { migrateLegacyRoles } from './db';
import { attachTwilioMediaBridge } from './realtime-bridge';
import { ensureLocalStorage } from './storage';

await ensureLocalStorage();
await migrateLegacyRoles();

const app = createApp();
const server = http.createServer(app);
attachTwilioMediaBridge(server);

server.listen(config.port, () => {
  console.log(`Dearlog local server listening on http://localhost:${config.port}`);
});
