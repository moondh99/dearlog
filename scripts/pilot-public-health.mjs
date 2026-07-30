#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(rootDir, '.env');

function stripQuotes(value) {
  return value.trim().replace(/^['"]|['"]$/g, '');
}

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};

  return Object.fromEntries(
    fs.readFileSync(filePath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/))
      .filter(Boolean)
      .map((match) => [match[1], stripQuotes(match[2] || '')]),
  );
}

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, '');
}

function splitCsv(value) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

const fileEnv = readEnvFile(envPath);
const env = { ...fileEnv, ...process.env };
const port = env.LOCAL_SERVER_PORT || '8787';
const localBaseUrl = `http://localhost:${port}`;
const publicBaseUrl = trimTrailingSlash(env.LOCAL_SERVER_PUBLIC_URL || env.APP_URL || '');
const appUrl = env.APP_URL ? trimTrailingSlash(env.APP_URL) : '';
const allowedHosts = splitCsv(env.VITE_ALLOWED_HOSTS || '');
const ngrokHost = env.VITE_NGROK_HOST || '';

let failures = 0;

function result(status, label, detail) {
  console.log(`${status} ${label}${detail ? ` - ${detail}` : ''}`);
  if (status === 'FAIL') failures += 1;
}

function validatePublicUrl() {
  if (!publicBaseUrl) {
    result('FAIL', 'LOCAL_SERVER_PUBLIC_URL', 'missing public URL');
    return null;
  }

  try {
    const parsed = new URL(publicBaseUrl);
    result(parsed.protocol === 'https:' ? 'PASS' : 'WARN', 'public URL protocol', parsed.href);
    return parsed;
  } catch {
    result('FAIL', 'LOCAL_SERVER_PUBLIC_URL', `invalid URL: ${publicBaseUrl}`);
    return null;
  }
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      'ngrok-skip-browser-warning': 'dearlog-pilot-health',
    },
    signal: AbortSignal.timeout(8000),
  });
  const text = await response.text();
  return { response, text };
}

async function checkHealth(baseUrl, label) {
  try {
    const { response, text } = await fetchText(`${baseUrl}/api/health`);
    const data = JSON.parse(text);
    result(response.ok && data.ok === true ? 'PASS' : 'FAIL', `${label} /api/health`, `status ${response.status}`);
  } catch (error) {
    result('FAIL', `${label} /api/health`, error instanceof Error ? error.message : String(error));
  }
}

async function checkSpa(baseUrl, label) {
  try {
    const { response, text } = await fetchText(baseUrl);
    const hasRoot = text.includes('id="root"') || text.includes("id='root'");
    result(response.ok && hasRoot ? 'PASS' : 'FAIL', `${label} built frontend`, `status ${response.status}`);
  } catch (error) {
    result('FAIL', `${label} built frontend`, error instanceof Error ? error.message : String(error));
  }
}

const parsedPublicUrl = validatePublicUrl();
if (parsedPublicUrl) {
  result(allowedHosts.includes(parsedPublicUrl.host) ? 'PASS' : 'FAIL', 'VITE_ALLOWED_HOSTS', allowedHosts.join(',') || '<empty>');
  result(ngrokHost === '' ? 'PASS' : 'WARN', 'VITE_NGROK_HOST', ngrokHost || '<empty>');
}

result(env.VITE_USE_NGROK_HMR === 'false' ? 'PASS' : 'WARN', 'VITE_USE_NGROK_HMR', env.VITE_USE_NGROK_HMR || '<empty>');
result((env.VITE_LOCAL_API_URL || '') === '' ? 'PASS' : 'WARN', 'VITE_LOCAL_API_URL', env.VITE_LOCAL_API_URL || '<empty>');
result(env.ALLOW_DEV_AUTH_HEADERS === 'false' ? 'PASS' : 'WARN', 'ALLOW_DEV_AUTH_HEADERS', env.ALLOW_DEV_AUTH_HEADERS || '<empty>');
result(env.AUTH_TOKEN_SECRET ? 'PASS' : 'FAIL', 'AUTH_TOKEN_SECRET', env.AUTH_TOKEN_SECRET ? '<set>' : '<empty>');
if (appUrl) {
  result(appUrl === publicBaseUrl ? 'PASS' : 'WARN', 'APP_URL', appUrl);
}

await checkHealth(localBaseUrl, 'local server');
await checkSpa(localBaseUrl, 'local server');
if (publicBaseUrl) {
  await checkHealth(publicBaseUrl, 'public URL');
  await checkSpa(publicBaseUrl, 'public URL');
}

if (failures > 0) {
  console.log(`\nPilot public health check failed: ${failures} blocking issue(s).`);
  process.exitCode = 1;
} else {
  console.log('\nPilot public health check passed.');
}
