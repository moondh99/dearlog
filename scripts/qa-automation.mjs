import puppeteer from 'puppeteer-core';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = '/Users/moondh/.gemini/antigravity-ide/brain/46f57840-9e70-4a17-90bd-0b264e58d04e/screenshots';
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

let screenshotCounter = 1;
async function capture(page, name) {
  const filename = `${String(screenshotCounter++).padStart(2, '0')}_${name}.png`;
  const filePath = path.join(SCREENSHOT_DIR, filename);
  await page.screenshot({ path: filePath });
  console.log(`[Screenshot] Saved: ${filePath}`);
}

function getMotherInvitationToken() {
  try {
    const stdout = execSync(`sqlite3 server/data/dearlog.db "SELECT token FROM Invitation WHERE seniorId IN (SELECT id FROM User WHERE name = 'QA어머니') ORDER BY createdAt DESC LIMIT 1;"`);
    return stdout.toString().trim();
  } catch (error) {
    console.error("Failed to query SQLite DB for mother invitation token:", error);
    return null;
  }
}

// 헬퍼: 텍스트로 버튼을 찾아 클릭
async function clickButtonByText(page, text) {
  const buttons = await page.$$('button');
  for (const button of buttons) {
    const val = await page.evaluate(el => el.textContent, button);
    if (val && val.includes(text)) {
      await page.evaluate(el => el.click(), button);
      return true;
    }
  }
  return false;
}

(async () => {
  console.log("Starting Dearlog QA Automation script...");

  // Chrome executable path on macOS
  const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if (!fs.existsSync(CHROME_PATH)) {
    console.error(`Chrome not found at ${CHROME_PATH}`);
    process.exit(1);
  }

  const browser = await puppeteer.launch({
    headless: false, // 실제 크롬창 띄움
    executablePath: CHROME_PATH,
    defaultViewport: {
      width: 390,
      height: 844,
      isMobile: true,
      hasTouch: true
    },
    args: ['--window-size=430,950']
  });

  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.error('PAGE ERROR:', err.toString()));
  
  // 클립보드 권한 부여
  const context = browser.defaultBrowserContext();
  await context.overridePermissions('http://localhost:8787', ['clipboard-read', 'clipboard-write']);

  try {
    // ----------------------------------------------------
    // 1. 자녀 회원가입 및 로그인
    // ----------------------------------------------------
    console.log("Navigating to local site...");
    await page.goto('http://localhost:8787/splash', { waitUntil: 'networkidle2' });
    await page.waitForTimeout?.(1000) || new Promise(r => setTimeout(r, 1000));
    await capture(page, 'splash_screen');

    console.log("Clicking '시작하기' on Splash...");
    const startBtn = await page.waitForSelector('button');
    await startBtn.click();
    await page.waitForTimeout?.(1000) || new Promise(r => setTimeout(r, 1000));
    await capture(page, 'intro_landing');

    console.log("Navigating through intro pages...");
    await clickButtonByText(page, '디어로그 시작하기');
    await page.waitForTimeout?.(500) || new Promise(r => setTimeout(r, 500));
    await capture(page, 'intro_features');

    await clickButtonByText(page, '다음');
    await page.waitForTimeout?.(500) || new Promise(r => setTimeout(r, 500));
    await capture(page, 'intro_archive');

    await clickButtonByText(page, '다음');
    await page.waitForTimeout?.(500) || new Promise(r => setTimeout(r, 500));
    await capture(page, 'intro_process');

    await clickButtonByText(page, '다음');
    await page.waitForTimeout?.(1000) || new Promise(r => setTimeout(r, 1000));
    await capture(page, 'auth_tabs');

    console.log("Starting signup...");
    // 회원가입 버튼 클릭
    const signupBtn = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(b => b.textContent.includes('회원가입'));
    });
    if (signupBtn) await signupBtn.asElement().click();
    await page.waitForTimeout?.(1000) || new Promise(r => setTimeout(r, 1000));
    await capture(page, 'signup_phone_input');

    console.log("Typing phone number...");
    const phoneInput = await page.waitForSelector('input[type="tel"]');
    // 기존에 가입된 번호와 겹치지 않도록 임의의 고유 번호 생성 (매 테스트마다 겹치지 않게)
    const suffix = String(Date.now()).slice(-4);
    const testPhoneNumber = `0100602${suffix}`;
    console.log(`Generated Test Phone Number: ${testPhoneNumber}`);
    await phoneInput.type(testPhoneNumber);
    await capture(page, 'signup_phone_typed');

    await clickButtonByText(page, '인증번호 받기');
    await page.waitForTimeout?.(1000) || new Promise(r => setTimeout(r, 1000));
    await capture(page, 'signup_otp_screen');

    console.log("Typing mock OTP...");
    await page.waitForSelector('input[aria-label="인증번호"]');
    // sr-only input에 value 세팅 후 이벤트 디스패치
    await page.evaluate(() => {
      const input = document.querySelector('input[aria-label="인증번호"]');
      if (input) {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        nativeInputValueSetter.call(input, '123456');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    await page.waitForTimeout?.(1000) || new Promise(r => setTimeout(r, 1000));
    await capture(page, 'signup_otp_typed');

    await clickButtonByText(page, '인증하기');
    await page.waitForTimeout?.(1000) || new Promise(r => setTimeout(r, 1000));
    await capture(page, 'signup_profile_details');

    console.log("Entering profile details...");
    // 이름 입력
    const nameInput = await page.waitForSelector('input[placeholder="예: 민준, 김민준"]');
    await nameInput.type(`QA자녀_${suffix}`);
    // 생년월일 입력
    const birthInput = await page.waitForSelector('input[placeholder="예: 1997-07-04"]');
    await birthInput.type('1990-01-01');
    await capture(page, 'signup_profile_entered');

    await clickButtonByText(page, '다음');
    await page.waitForTimeout?.(1000) || new Promise(r => setTimeout(r, 1000));
    await capture(page, 'signup_consent_screen');

    console.log("Checking consent checkboxes...");
    await page.click('label[for="terms-consent"]');
    await page.click('label[for="privacy-consent"]');
    await capture(page, 'signup_consent_checked');

    await clickButtonByText(page, '기록 시작하기');
    console.log("Waiting for child home...");
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 5000 }).catch(() => {});
    await page.waitForTimeout?.(2000) || new Promise(r => setTimeout(r, 2000));
    await capture(page, 'child_home_empty');

    // ----------------------------------------------------
    // 2. 부모님 기록 공간 2개 생성
    // ----------------------------------------------------
    console.log("Creating first record space (QA어머니)...");
    const addSpaceBtn = await page.waitForSelector('button[aria-label="부모님 기록 공간 추가"]');
    await addSpaceBtn.click();
    await page.waitForTimeout?.(1000) || new Promise(r => setTimeout(r, 1000));
    await capture(page, 'create_space_step1');

    console.log("Step 1: Space Name (Mother)...");
    const spaceNameInput = await page.waitForSelector('input[id="record-space-name"]');
    await spaceNameInput.type('QA어머니 생애일기');
    await capture(page, 'create_space_mother_typed_step1');

    await clickButtonByText(page, '다음');
    await page.waitForTimeout?.(1000) || new Promise(r => setTimeout(r, 1000));
    await capture(page, 'create_space_step2');

    console.log("Step 2: Basic Info (Mother)...");
    const parentNameInput = await page.waitForSelector('input[id="parent-name"]');
    await parentNameInput.type('QA어머니');
    
    // 생년월일 시트 열기
    console.log("Opening birth date sheet...");
    await page.click('button[aria-label="생년월일 선택"]');
    await page.waitForTimeout?.(500) || new Promise(r => setTimeout(r, 500));
    await capture(page, 'create_space_mother_birthdate_sheet');
    
    // 생년월일 시트 완료
    await clickButtonByText(page, '선택 완료');
    await page.waitForTimeout?.(500) || new Promise(r => setTimeout(r, 500));
    
    // 관계 선택
    await clickButtonByText(page, '어머니');
    await capture(page, 'create_space_mother_typed_step2');

    await clickButtonByText(page, '다음');
    await page.waitForTimeout?.(1000) || new Promise(r => setTimeout(r, 1000));
    await capture(page, 'create_space_step3');

    console.log("Step 3: Life Details (Mother)...");
    // 현재 직업 유무 X
    const jobButtons = await page.$$('button');
    for (const btn of jobButtons) {
      const txt = await page.evaluate(el => el.textContent, btn);
      if (txt === 'X') {
        await btn.click();
        break;
      }
    }
    // 직업명
    const jobInput = await page.waitForSelector('input[id="parent-occupation"]');
    await jobInput.type('교사');
    // 고향
    const hometownInput = await page.waitForSelector('input[id="parent-hometown"]');
    await hometownInput.type('강원도 춘천');
    // 출신학교
    const schoolInput = await page.waitForSelector('input[id="parent-school-history"]');
    await schoolInput.type('춘천여자고등학교');
    await capture(page, 'create_space_mother_typed_step3');

    await clickButtonByText(page, '다음');
    await page.waitForTimeout?.(1000) || new Promise(r => setTimeout(r, 1000));
    await capture(page, 'create_space_step4');

    console.log("Step 4: Invitation & Finalize (Mother)...");
    console.log("Waiting for invitation link to be ready...");
    await page.waitForFunction(() => Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('기록 공간 생성하기')), { timeout: 10000 });
    await clickButtonByText(page, '기록 공간 생성하기');
    console.log("Waiting for space creation complete...");
    await page.waitForFunction(() => document.body.textContent.includes('기록 공간이 열렸어요'), { timeout: 10000 });
    await capture(page, 'create_space_complete');

    // ----------------------------------------------------
    // 초대 링크 복사하기 & 토큰 획득
    // ----------------------------------------------------
    console.log("Generating and copying invite link...");
    // '홈으로 이동'하기 전에 초대 링크 확보
    const inviteToken = getMotherInvitationToken();
    console.log(`Retrieved invitation token from SQLite: ${inviteToken}`);

    console.log("Going back to child home...");
    await clickButtonByText(page, '홈으로 이동');
    await page.waitForTimeout?.(2000) || new Promise(r => setTimeout(r, 2000));
    await capture(page, 'child_home_one_space');

    // 두 번째 공간 생성: QA아버지
    console.log("Creating second record space (QA아버지)...");
    const addSecondSpaceBtn = await page.waitForSelector('button[aria-label="부모님 기록 공간 추가"]');
    await addSecondSpaceBtn.click();
    await page.waitForTimeout?.(1000) || new Promise(r => setTimeout(r, 1000));

    console.log("Step 1: Space Name (Father)...");
    const spaceNameInput2 = await page.waitForSelector('input[id="record-space-name"]');
    await spaceNameInput2.type('QA아버지 생애일기');
    await clickButtonByText(page, '다음');
    await page.waitForTimeout?.(1000) || new Promise(r => setTimeout(r, 1000));

    console.log("Step 2: Basic Info (Father)...");
    const parentNameInput2 = await page.waitForSelector('input[id="parent-name"]');
    await parentNameInput2.type('QA아버지');
    
    // 생년월일 시트 열기
    await page.click('button[aria-label="생년월일 선택"]');
    await page.waitForTimeout?.(500) || new Promise(r => setTimeout(r, 500));
    await clickButtonByText(page, '선택 완료');
    await page.waitForTimeout?.(500) || new Promise(r => setTimeout(r, 500));
    await clickButtonByText(page, '아버지');

    await clickButtonByText(page, '다음');
    await page.waitForTimeout?.(1000) || new Promise(r => setTimeout(r, 1000));

    console.log("Step 3: Life Details (Father)...");
    // 직업명
    const jobInput2 = await page.waitForSelector('input[id="parent-occupation"]');
    await jobInput2.type('공무원');
    // 고향
    const hometownInput2 = await page.waitForSelector('input[id="parent-hometown"]');
    await hometownInput2.type('서울');
    // 출신학교
    const schoolInput2 = await page.waitForSelector('input[id="parent-school-history"]');
    await schoolInput2.type('서울대학교');

    await clickButtonByText(page, '다음');
    await page.waitForTimeout?.(1000) || new Promise(r => setTimeout(r, 1000));
    console.log("Waiting for second invitation link to be ready...");
    await page.waitForFunction(() => Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('기록 공간 생성하기')), { timeout: 10000 });
    await clickButtonByText(page, '기록 공간 생성하기');
    console.log("Waiting for space creation complete (second)...");
    await page.waitForFunction(() => document.body.textContent.includes('기록 공간이 열렸어요'), { timeout: 10000 });
    await capture(page, 'create_second_space_complete');

    await clickButtonByText(page, '홈으로 이동');
    await page.waitForTimeout?.(2000) || new Promise(r => setTimeout(r, 2000));
    await capture(page, 'child_home_two_spaces');

    // ----------------------------------------------------
    // 3. 부모님 기록 공간 전환 검증
    // ----------------------------------------------------
    console.log("Verifying space switching...");
    // 2개 공간 중 'QA어머니 생애일기' 카드를 클릭하여 전환 시도
    const spaceButtons = await page.$$('button');
    for (const btn of spaceButtons) {
      const txt = await page.evaluate(el => el.textContent, btn);
      if (txt && txt.includes('QA어머니')) {
        console.log("Switching back to QA어머니...");
        await btn.click();
        break;
      }
    }
    await page.waitForTimeout?.(1000) || new Promise(r => setTimeout(r, 1000));
    await capture(page, 'switched_to_mother');

    // ----------------------------------------------------
    // 4. 질문 준비하기 화면 진입 및 질문 등록
    // ----------------------------------------------------
    console.log("Going to question preparation page...");
    await clickButtonByText(page, '질문 준비하기');
    await page.waitForTimeout?.(2000) || new Promise(r => setTimeout(r, 2000));
    await capture(page, 'child_questions_page');

    console.log("Adding a recommended question...");
    const recommendedText = '가장 행복했던 날의 기억을 떠올려 보세요.';
    const qButtons = await page.$$('button');
    let clickedQ = false;
    for (const btn of qButtons) {
      const txt = await page.evaluate(el => el.textContent, btn);
      if (txt && txt.includes(recommendedText)) {
        await btn.click();
        clickedQ = true;
        break;
      }
    }
    if (!clickedQ) {
      throw new Error("Failed to find recommended question button");
    }
    await page.waitForTimeout?.(2500) || new Promise(r => setTimeout(r, 2500));
    await capture(page, 'child_questions_page_after_adding');

    // ----------------------------------------------------
    // 5. 부모 초대 링크 접속 및 부모 로그인/온보딩
    // ----------------------------------------------------
    if (!inviteToken) {
      throw new Error("Cannot proceed: No invite token found.");
    }
    console.log("Opening new page for parent onboarding...");
    const parentPage = await browser.newPage();
    await parentPage.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    
    const parentLoginUrl = `http://localhost:8787/parent/autologin?token=${encodeURIComponent(inviteToken)}`;
    console.log(`Parent auto-login URL: ${parentLoginUrl}`);
    await parentPage.goto(parentLoginUrl, { waitUntil: 'networkidle2' });
    await parentPage.waitForTimeout?.(2000) || new Promise(r => setTimeout(r, 2000));
    await capture(parentPage, 'parent_onboarding_welcome');

    console.log("Parent Onboarding: preferred name and decade...");
    const prefNameInput = await parentPage.waitForSelector('input[placeholder="예: 엄마, 아버지, 김영자 등"]');
    await prefNameInput.type('엄마');
    
    // 출생연대 1950년대 선택
    const decadeBtn = await parentPage.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(b => b.textContent.includes('1950년대'));
    });
    if (decadeBtn) await decadeBtn.asElement().click();
    await capture(parentPage, 'parent_onboarding_typed');

    await clickButtonByText(parentPage, '소중한 이야기 시작하기');
    await parentPage.waitForTimeout?.(2000) || new Promise(r => setTimeout(r, 2000));
    await capture(parentPage, 'parent_onboarding_landing');

    await clickButtonByText(parentPage, '지금 시작하기');
    await parentPage.waitForTimeout?.(2000) || new Promise(r => setTimeout(r, 2000));
    await capture(parentPage, 'parent_home_dashboard');

    // ----------------------------------------------------
    // 6. 부모 답변 작성 및 저장
    // ----------------------------------------------------
    console.log("Going to parent interview/answering...");
    await clickButtonByText(parentPage, '기록하기');
    await parentPage.waitForTimeout?.(2000) || new Promise(r => setTimeout(r, 2000));
    await capture(parentPage, 'parent_question_select');

    // 첫 번째 질문 선택
    const answerBtn = await parentPage.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(b => b.textContent === '답하기');
    });
    if (answerBtn) {
      await answerBtn.asElement().click();
    } else {
      throw new Error("No answer button found for parent questions");
    }
    await parentPage.waitForTimeout?.(1500) || new Promise(r => setTimeout(r, 1500));
    await capture(parentPage, 'parent_interview_recording_screen');

    console.log("Typing manual text answer...");
    const textarea = await parentPage.waitForSelector('textarea[id="parent-text-answer"]');
    await textarea.type("어렸을 때 시골 마당에서 딱지치기하고 놀았는데 참 그 시절이 그립네요.");
    await capture(parentPage, 'parent_interview_typed');

    await clickButtonByText(parentPage, '저장하기');
    console.log("Saving parent answer... waiting for API response");
    await parentPage.waitForTimeout?.(4000) || new Promise(r => setTimeout(r, 4000)); // AI API 호출 대기
    await capture(parentPage, 'parent_interview_done_view');

    // 홈으로 복귀
    await clickButtonByText(parentPage, '홈으로 돌아가기');
    await parentPage.waitForTimeout?.(2000) || new Promise(r => setTimeout(r, 2000));
    await capture(parentPage, 'parent_dashboard_after_answering');

    // ----------------------------------------------------
    // 7. 자녀 계정 챕터 검수, 자서전 화면 확인
    // ----------------------------------------------------
    console.log("Switching back to child browser page...");
    await page.bringToFront();
    // 홈으로 이동하여 새로고침
    await page.goto('http://localhost:8787/child', { waitUntil: 'networkidle2' });
    await page.waitForTimeout?.(2000) || new Promise(r => setTimeout(r, 2000));
    await capture(page, 'child_home_after_parent_answering');

    console.log("Entering chapter review list...");
    await clickButtonByText(page, '새 기록 확인하기');
    await page.waitForTimeout?.(2000) || new Promise(r => setTimeout(r, 2000));
    await capture(page, 'child_review_pending_list');

    // 상세 검수 진입
    await clickButtonByText(page, '확인하기');
    await page.waitForTimeout?.(2000) || new Promise(r => setTimeout(r, 2000));
    await capture(page, 'child_review_detail');

    // 반영하기 클릭
    await clickButtonByText(page, '챕터에 반영하기');
    await page.waitForTimeout?.(2000) || new Promise(r => setTimeout(r, 2000));
    await capture(page, 'child_review_detail_applied');

    // 자서전/기록집 화면 확인
    console.log("Going to Autobiography/Book view...");
    const navButtons = await page.$$('button');
    for (const btn of navButtons) {
      const txt = await page.evaluate(el => el.textContent, btn);
      if (txt === '기록집') {
        await btn.click();
        break;
      }
    }
    await page.waitForTimeout?.(2000) || new Promise(r => setTimeout(r, 2000));
    await capture(page, 'child_autobiography_book_page');

    // ----------------------------------------------------
    // 8. 역할 가드/권한 직접 이동 차단 검증
    // ----------------------------------------------------
    console.log("Verifying Route Guards...");
    
    // 자녀가 /parent로 접근 시도
    console.log("Child trying to access parent home...");
    await page.goto('http://localhost:8787/parent', { waitUntil: 'networkidle2' });
    await page.waitForTimeout?.(1500) || new Promise(r => setTimeout(r, 1500));
    await capture(page, 'child_redirected_back_to_child');

    // 부모가 /child로 접근 시도
    console.log("Parent trying to access child home...");
    await parentPage.bringToFront();
    await parentPage.goto('http://localhost:8787/child', { waitUntil: 'networkidle2' });
    await parentPage.waitForTimeout?.(1500) || new Promise(r => setTimeout(r, 1500));
    await capture(parentPage, 'parent_redirected_back_to_parent');

    console.log("QA Automation script finished successfully!");
  } catch (error) {
    console.error("Error occurred during QA automation:", error);
    await capture(page, 'error_state_child');
    if (typeof parentPage !== 'undefined') await capture(parentPage, 'error_state_parent');
  } finally {
    await browser.close();
  }
})();
