// @vitest-environment node
import { afterAll, describe, expect, it } from 'vitest';
import { closeRenderBrowser, crashRenderBrowserForTests, renderHtmlToPdf } from './publication-html';

// renderHtmlToPdf는 Chrome을 프로세스당 한 번만 띄우고 재사용한다.
// 재사용과 크래시 복구가 깨지면 PDF 생성이 통째로 멈추므로 여기서 확인한다.

const HTML = '<html><head><meta charset="utf-8"></head><body><h1>디어로그</h1></body></html>';

afterAll(async () => {
  await closeRenderBrowser();
});

describe('PDF 렌더링 브라우저 재사용', () => {
  it('연속 호출이 모두 PDF를 만든다', async () => {
    const first = await renderHtmlToPdf(HTML);
    const second = await renderHtmlToPdf(HTML);

    // %PDF 매직 넘버 확인
    expect(Buffer.from(first).subarray(0, 4).toString()).toBe('%PDF');
    expect(Buffer.from(second).subarray(0, 4).toString()).toBe('%PDF');
  }, 60_000);

  it('동시 호출도 서로 방해하지 않는다', async () => {
    const results = await Promise.all([
      renderHtmlToPdf(HTML),
      renderHtmlToPdf(HTML),
      renderHtmlToPdf(HTML),
    ]);

    for (const bytes of results) {
      expect(Buffer.from(bytes).subarray(0, 4).toString()).toBe('%PDF');
    }
  }, 60_000);

  it('브라우저가 죽어도 다음 호출에서 다시 띄운다', async () => {
    await renderHtmlToPdf(HTML);

    // 캐시는 그대로 둔 채 브라우저만 죽인다. 이래야 connected === false 분기를 실제로 지난다.
    // closeRenderBrowser를 쓰면 캐시가 비워져 그냥 최초 기동 경로가 된다.
    await crashRenderBrowserForTests();

    const afterCrash = await renderHtmlToPdf(HTML);
    expect(Buffer.from(afterCrash).subarray(0, 4).toString()).toBe('%PDF');
  }, 60_000);
});
