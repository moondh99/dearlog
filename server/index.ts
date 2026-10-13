import { SAMPLE_INQUIRY_ONLY } from '../shared/service-access';
import http from 'node:http';
import { createApp } from './app';
import { config } from './config';
import { migrateLegacyRoles } from './db';
import { ensureLocalStorage } from './storage';

await ensureLocalStorage();
if (!SAMPLE_INQUIRY_ONLY) await migrateLegacyRoles();

const app = createApp({ sampleInquiryOnly: SAMPLE_INQUIRY_ONLY });
const server = http.createServer(app);

server.listen(config.port, () => {
  console.log(`Dearlog local server listening on http://localhost:${config.port}`);
});
