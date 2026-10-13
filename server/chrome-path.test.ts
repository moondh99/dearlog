// @vitest-environment node
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { playwrightChromiumCandidates } from './publication-html';

// 시스템 Chrome이 없는 환경에서는 Playwright가 받아 둔 Chromium으로 PDF를 만든다.
// 폴더 이름의 리비전 번호로 최신 것을 먼저 고르는지, 다른 브라우저 폴더를 섞지 않는지 확인한다.

let root: string | null = null;

afterEach(async () => {
  if (root) await fs.rm(root, { recursive: true, force: true });
  root = null;
});

describe('Playwright Chromium 경로 찾기', () => {
  it('리비전 번호가 큰 Chromium을 먼저 시도하고 다른 브라우저 폴더는 건너뛴다', async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'dearlog-pw-'));
    // 문자열로 정렬하면 900이 1200보다 앞선다. 숫자로 비교해야 한다.
    for (const dir of ['chromium-900', 'chromium-1200', 'chromium_headless_shell-1300', 'ffmpeg-1011']) {
      await fs.mkdir(path.join(root, dir));
    }

    const candidates = await playwrightChromiumCandidates([root]);

    expect(candidates[0]).toBe(path.join(root, 'chromium-1200', 'chrome-linux', 'chrome'));
    expect(candidates.findIndex((c) => c.includes('chromium-900'))).toBeGreaterThan(
      candidates.findIndex((c) => c.includes('chromium-1200')),
    );
    expect(candidates.some((c) => c.includes('headless_shell') || c.includes('ffmpeg'))).toBe(false);
  });

  it('없는 폴더는 오류 없이 건너뛴다', async () => {
    const missing = path.join(os.tmpdir(), 'dearlog-pw-missing-does-not-exist');

    await expect(playwrightChromiumCandidates([missing])).resolves.toEqual([]);
  });
});
