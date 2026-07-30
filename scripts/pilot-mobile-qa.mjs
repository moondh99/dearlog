import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const APP_URL = process.env.PILOT_QA_APP_URL || 'http://127.0.0.1:3000';
const API_URL = process.env.PILOT_QA_API_URL || 'http://localhost:8788';
const CHROME_PATH = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const FIXTURE_PHOTO = process.env.PILOT_QA_PHOTO || path.resolve('src/assets/figma/parent-record-photo.jpg');
const SCREENSHOT_DIR = process.env.PILOT_QA_SCREENSHOT_DIR || path.resolve('artifacts/pilot-mobile-qa');

const stamp = `${Date.now()}`.slice(-8);
const guardianName = `모바일QA자녀${stamp}`;
const seniorName = `모바일QA부모${stamp}`;
const guardianPhone = `010${stamp}`;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function api(pathname, options = {}) {
  const response = await fetch(`${API_URL}${pathname}`, {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${pathname} failed: ${response.status} ${JSON.stringify(body)}`);
  }
  return body;
}

function sqlite(sql) {
  return execFileSync('sqlite3', ['server/data/dearlog.db', sql], { encoding: 'utf8' }).trim();
}

async function capture(page, name) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const filePath = path.join(SCREENSHOT_DIR, `${String(capture.count++).padStart(2, '0')}_${name}.png`);
  await page.screenshot({ path: filePath, fullPage: false });
  console.log(`[screenshot] ${filePath}`);
}
capture.count = 1;

function authStorage(state) {
  return JSON.stringify({ state, version: 0 });
}

async function setBrowserAuth(page, authState, activeSeniorId) {
  await page.goto(`${APP_URL}/splash`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(
    ({ authState, activeSeniorId }) => {
      window.sessionStorage.clear();
      window.localStorage.removeItem('dearlog-child');
      window.localStorage.removeItem('dearlog-interview');
      window.sessionStorage.setItem('dearlog-auth', JSON.stringify({ state: authState, version: 0 }));
      if (activeSeniorId) {
        window.localStorage.setItem('dearlog-child', JSON.stringify({
          state: { questions: [], photos: [], activeSeniorId },
          version: 0,
        }));
      }
    },
    { authState, activeSeniorId },
  );
}

async function clickText(page, text, selector = 'button') {
  const clicked = await page.evaluate(
    ({ text, selector }) => {
      const candidates = Array.from(document.querySelectorAll(selector));
      const target = candidates.find((element) => element.textContent?.includes(text));
      if (!target) return false;
      target.click();
      return true;
    },
    { text, selector },
  );
  assert(clicked, `Could not click text: ${text}`);
}

async function main() {
  assert(fs.existsSync(CHROME_PATH), `Chrome not found: ${CHROME_PATH}`);
  assert(fs.existsSync(FIXTURE_PHOTO), `Fixture photo not found: ${FIXTURE_PHOTO}`);

  console.log('[setup] creating pilot QA users');
  const signup = await api('/api/auth/phone', {
    method: 'POST',
    body: JSON.stringify({
      phoneNumber: guardianPhone,
      name: guardianName,
      isLogin: false,
      birthDate: '1999-02-04',
    }),
  });
  const invitationResponse = await api('/api/invitations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${signup.authToken}` },
    body: JSON.stringify({
      seniorName,
      relationship: '부모님',
      recordSpaceName: `${seniorName} 기록공간`,
      birthDate: '1952-03-12',
    }),
  });
  const tokenLogin = await api('/api/auth/token-login', {
    method: 'POST',
    body: JSON.stringify({ token: invitationResponse.invitation.token }),
  });

  const guardian = signup.user;
  const senior = tokenLogin.user;
  assert(guardian?.id && senior?.id, 'QA users were not created');

  console.log(`[setup] guardian=${guardian.name} senior=${senior.name}`);

  const browser = await puppeteer.launch({
    headless: false,
    executablePath: CHROME_PATH,
    defaultViewport: {
      width: 390,
      height: 844,
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
    },
    args: [
      '--window-size=430,950',
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--autoplay-policy=no-user-gesture-required',
    ],
  });

  const page = await browser.newPage();
  page.on('console', (msg) => console.log(`[page:${msg.type()}] ${msg.text()}`));
  page.on('pageerror', (error) => console.error(`[pageerror] ${error.message}`));

  try {
    await setBrowserAuth(page, {
      role: 'child',
      userName: guardian.name,
      userId: guardian.id,
      phoneNumber: guardian.phoneNumber,
      authToken: signup.authToken,
    }, senior.id);

    console.log('[child] opening photo screen');
    await page.goto(`${APP_URL}/child/photos`, { waitUntil: 'networkidle2' });
    await page.waitForFunction(() => document.body.textContent?.includes('사진 추가하기'), { timeout: 15000 });
    await capture(page, 'child_photo_empty');

    const photoInput = await page.waitForSelector('input[type="file"]', { timeout: 10000 });
    await photoInput.uploadFile(FIXTURE_PHOTO);
    console.log('[child] uploaded fixture photo, waiting for AI questions');
    await page.waitForFunction(
      () => document.body.textContent?.includes('AI가 생성한 질문') && document.body.textContent?.includes('등록'),
      { timeout: 90000 },
    );
    await capture(page, 'child_photo_questions');

    await clickText(page, '등록');
    await page.waitForFunction(() => document.body.textContent?.includes('등록됨'), { timeout: 30000 });
    await capture(page, 'child_photo_question_registered');

    const questionRows = sqlite(`
      select q.id || '|' || q.text || '|' || ifnull(q.photoId, '') || '|' || ifnull(p.fileKey, '')
      from Question q
      left join Photo p on p.id = q.photoId
      where q.seniorId = '${senior.id}' and q.category = 'photo_questions'
      order by q.createdAt desc
      limit 1;
    `);
    assert(questionRows, 'No registered photo question found in DB');
    const [questionId, questionText, photoId, photoFileKey] = questionRows.split('|');
    assert(questionId && photoId && photoFileKey.startsWith('photos/'), 'Photo question DB linkage is incomplete');
    console.log(`[db] registered photo question=${questionId}`);

    await setBrowserAuth(page, {
      role: 'parent',
      userName: senior.name,
      userId: senior.id,
      phoneNumber: senior.phoneNumber || '',
      authToken: tokenLogin.authToken,
    }, null);

    console.log('[parent] opening interview select screen');
    await page.goto(`${APP_URL}/parent/interview`, { waitUntil: 'networkidle2' });
    await page.waitForFunction(
      () => document.body.textContent?.includes('사진 질문') && document.body.textContent?.includes('이야기하기'),
      { timeout: 30000 },
    );
    await capture(page, 'parent_photo_question_card');

    const visibleImageCount = await page.$$eval('img[src*="/api/files/photos/"]', (images) => images.length);
    assert(visibleImageCount > 0, 'Parent photo question card did not render the uploaded photo');

    await clickText(page, '이야기하기');
    await page.waitForFunction(
      () => document.body.textContent?.includes('직접 입력') && document.body.textContent?.includes('저장하기'),
      { timeout: 15000 },
    );
    await capture(page, 'parent_answer_screen');

    const backBeforeText = await page.evaluate(() => document.body.textContent || '');
    await page.click('button[aria-label="질문 목록으로 돌아가기"]');
    await page.waitForFunction(() => document.body.textContent?.includes('기록할 이야기를 골라주세요'), { timeout: 15000 });
    await capture(page, 'parent_back_button_works');
    assert(backBeforeText.includes('직접 입력'), 'Back button precondition failed');

    await clickText(page, '이야기하기');
    await page.waitForSelector('#parent-text-answer', { timeout: 15000 });
    await page.type('#parent-text-answer', '이 사진을 보니 가족들과 마당에서 웃으며 찍었던 날이 떠오릅니다. 햇살이 좋았고 모두 편안한 표정이었습니다.');
    await capture(page, 'parent_answer_typed');
    await clickText(page, '저장하기');
    await page.waitForFunction(() => document.body.textContent?.includes('이야기가') && document.body.textContent?.includes('저장되었어요'), { timeout: 45000 });
    await delay(3000);
    await capture(page, 'parent_answer_saved');

    const recordRows = sqlite(`
      select r.id || '|' || r.transcriptText || '|' || r.mode || '|' || q.status
      from InterviewRecord r
      join Question q on q.id = r.questionId
      where r.userId = '${senior.id}' and r.questionId = '${questionId}'
      order by r.recordedAt desc
      limit 1;
    `);
    assert(recordRows.includes('마당에서 웃으며'), 'Interview record transcript was not saved');
    assert(recordRows.endsWith('|answered'), 'Question was not marked answered');
    console.log('[db] parent answer saved and question marked answered');

    console.log(JSON.stringify({
      ok: true,
      guardianId: guardian.id,
      seniorId: senior.id,
      questionId,
      questionText,
      photoFileKey,
      screenshotDir: SCREENSHOT_DIR,
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
