import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCapstoneDemoState, buildDemoAutobiography } from '../src/lib/demo/capstone-demo-data';
import { DEMO_PERSONA_QUESTIONS, DEMO_SCENARIO_STEPS, PRINT_READY_CHECKLIST } from '../src/lib/demo/capstone-presentation';
import { generatePrintReady } from '../src/lib/pdf/generator';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const outputDir = join(rootDir, 'artifacts', 'capstone-demo');
const screenshotsDir = join(outputDir, 'screenshots');
const originalFetch = globalThis.fetch;

globalThis.fetch = async (input: RequestInfo | URL) => {
  const url = String(input);
  if (url === '/fonts/NotoSansKR-Regular.ttf') {
    const font = await readFile(join(rootDir, 'public', 'fonts', 'NotoSansKR-Regular.ttf'));
    return new Response(font, {
      status: 200,
      headers: { 'content-type': 'font/ttf' },
    });
  }
  if (url.startsWith('/demo-photos/')) {
    const image = await readFile(join(rootDir, 'public', url));
    return new Response(image, {
      status: 200,
      headers: { 'content-type': 'image/png' },
    });
  }
  return originalFetch(input);
};

if (typeof globalThis.btoa === 'undefined') {
  globalThis.btoa = (value: string) => Buffer.from(value, 'binary').toString('base64');
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function textLines(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
      return;
    }
    current = next;
  });
  if (current) lines.push(current);
  return lines.slice(0, 4);
}

function svgTextBlock(lines: string[], x: number, y: number, size = 22, fill = '#6C625E'): string {
  return lines.map((line, index) => (
    `<text x="${x}" y="${y + index * (size + 9)}" font-size="${size}" font-weight="600" fill="${fill}">${escapeXml(line)}</text>`
  )).join('\n');
}

function metricCard(label: string, value: string | number, x: number, y: number): string {
  return `
    <rect x="${x}" y="${y}" width="160" height="96" rx="18" fill="#FFFFFF" stroke="#E1D8CD"/>
    <text x="${x + 18}" y="${y + 32}" font-size="17" font-weight="700" fill="#6C625E">${escapeXml(label)}</text>
    <text x="${x + 18}" y="${y + 72}" font-size="34" font-weight="900" fill="#292321">${value}</text>
  `;
}

function phoneFrame(title: string, body: string): string {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="390" height="844" viewBox="0 0 390 844">
      <rect width="390" height="844" fill="#EFE9E1"/>
      <rect x="18" y="18" width="354" height="808" rx="34" fill="#FFFFFF" stroke="#E1D8CD"/>
      <text x="42" y="76" font-size="28" font-weight="900" fill="#292321">${escapeXml(title)}</text>
      ${body}
    </svg>
  `;
}

function demoSettingsSvg(): string {
  const demo = buildCapstoneDemoState();
  const body = `
    <rect x="42" y="104" width="306" height="68" rx="18" fill="#F6E3E8" stroke="#D9BBC3"/>
    <text x="62" y="146" font-size="19" font-weight="900" fill="#7A3143">발표 준비가 완료되었습니다</text>
    ${metricCard('기억 카드', demo.memories.length, 42, 200)}
    ${metricCard('사진', demo.photos.length, 210, 200)}
    ${metricCard('가족 질문', demo.familyQuestions.length, 42, 314)}
    ${metricCard('자서전 챕터', demo.autobiographyNararatives.length, 210, 314)}
    <text x="42" y="468" font-size="19" font-weight="900" fill="#292321">3~5분 시연 순서</text>
    ${DEMO_SCENARIO_STEPS.slice(0, 3).map((step, index) => `
      <rect x="42" y="${496 + index * 82}" width="306" height="64" rx="16" fill="#EFE9E1" stroke="#E1D8CD"/>
      <circle cx="68" cy="${528 + index * 82}" r="15" fill="#7A3143"/>
      <text x="64" y="${534 + index * 82}" font-size="16" font-weight="900" fill="#FFFFFF">${step.step}</text>
      <text x="94" y="${522 + index * 82}" font-size="15" font-weight="900" fill="#292321">${escapeXml(step.title)}</text>
      <text x="94" y="${546 + index * 82}" font-size="12" font-weight="700" fill="#6C625E">${escapeXml(step.routeLabel)}</text>
    `).join('\n')}
  `;
  return phoneFrame('발표 데모', body);
}

function archiveSvg(): string {
  const demo = buildCapstoneDemoState();
  const memory = demo.memories[1];
  const body = `
    <rect x="42" y="112" width="306" height="132" rx="22" fill="#EFE9E1" stroke="#E1D8CD"/>
    <text x="62" y="150" font-size="20" font-weight="900" fill="#292321">${escapeXml(memory.topic)}</text>
    ${svgTextBlock(textLines(memory.publishVersion, 20), 62, 184, 15, '#6C625E')}
    <text x="42" y="292" font-size="19" font-weight="900" fill="#292321">원본 메타데이터</text>
    <rect x="42" y="316" width="306" height="112" rx="18" fill="#FFFFFF" stroke="#E1D8CD"/>
    <text x="62" y="354" font-size="16" font-weight="800" fill="#292321">Canon FTb · 1972-03-12</text>
    <text x="62" y="388" font-size="16" font-weight="800" fill="#7A3143">GPS 공개 전 확인 필요</text>
    <text x="42" y="480" font-size="19" font-weight="900" fill="#292321">가족 질문 대기</text>
    <rect x="42" y="506" width="306" height="96" rx="18" fill="#F6E3E8" stroke="#D9BBC3"/>
    <text x="62" y="544" font-size="15" font-weight="900" fill="#292321">처음 서울에 올라오셨을 때</text>
    <text x="62" y="570" font-size="15" font-weight="900" fill="#292321">가장 무서웠던 순간은?</text>
  `;
  return phoneFrame('추억 보관함', body);
}

function personaSvg(): string {
  const body = `
    <rect x="42" y="112" width="306" height="92" rx="24" fill="#EFE9E1" stroke="#E1D8CD"/>
    ${svgTextBlock(textLines(DEMO_PERSONA_QUESTIONS[0], 18), 62, 152, 16, '#292321')}
    <rect x="42" y="238" width="306" height="256" rx="24" fill="#FFFFFF" stroke="#E1D8CD"/>
    <text x="62" y="278" font-size="18" font-weight="900" fill="#7A3143">김영자의 분신</text>
    ${svgTextBlock(textLines('1970년대의 처음 서울에 올라온 날 이야기가 떠오르는구나. 넓은 길과 낯선 말소리 사이에서도 손수건을 쥐고 용기를 냈단다.', 19), 62, 318, 15, '#6C625E')}
    <rect x="62" y="438" width="246" height="36" rx="18" fill="#F6E3E8"/>
    <text x="82" y="461" font-size="14" font-weight="900" fill="#7A3143">출처: demo_memory_seoul</text>
  `;
  return phoneFrame('나의 분신', body);
}

function autobiographySvg(): string {
  const autobiography = buildDemoAutobiography();
  const body = `
    <rect x="42" y="112" width="306" height="84" rx="22" fill="#F6E3E8" stroke="#D9BBC3"/>
    <text x="62" y="150" font-size="20" font-weight="900" fill="#292321">${escapeXml(autobiography.title)}</text>
    <text x="62" y="176" font-size="15" font-weight="800" fill="#7A3143">A5 인쇄용 PDF 준비 완료</text>
    <text x="42" y="246" font-size="19" font-weight="900" fill="#292321">목차</text>
    ${autobiography.chapters.slice(0, 5).map((chapter, index) => `
      <rect x="42" y="${270 + index * 58}" width="306" height="44" rx="14" fill="#FFFFFF" stroke="#E1D8CD"/>
      <text x="62" y="${298 + index * 58}" font-size="14" font-weight="900" fill="#292321">${escapeXml(chapter.title)}</text>
    `).join('\n')}
    <rect x="42" y="594" width="306" height="56" rx="18" fill="#7A3143"/>
    <text x="122" y="630" font-size="18" font-weight="900" fill="#FFFFFF">인쇄용 PDF</text>
  `;
  return phoneFrame('자서전', body);
}

function loginSvg(): string {
  const body = `
    <text x="42" y="136" font-size="25" font-weight="900" fill="#292321">Dearlog</text>
    <text x="42" y="174" font-size="17" font-weight="700" fill="#6C625E">기억을 기록하고 가족에게 전하는</text>
    <text x="42" y="200" font-size="17" font-weight="700" fill="#6C625E">모바일 자서전 서비스</text>
    <rect x="42" y="260" width="306" height="62" rx="18" fill="#EFE9E1" stroke="#E1D8CD"/>
    <text x="64" y="299" font-size="18" font-weight="800" fill="#6C625E">010-1234-5678</text>
    <rect x="42" y="350" width="306" height="58" rx="18" fill="#7A3143"/>
    <text x="132" y="387" font-size="18" font-weight="900" fill="#FFFFFF">인증번호 받기</text>
    <rect x="42" y="486" width="144" height="88" rx="20" fill="#F6E3E8" stroke="#D9BBC3"/>
    <text x="82" y="536" font-size="20" font-weight="900" fill="#7A3143">어르신</text>
    <rect x="204" y="486" width="144" height="88" rx="20" fill="#FFFFFF" stroke="#E1D8CD"/>
    <text x="250" y="536" font-size="20" font-weight="900" fill="#6C625E">가족</text>
  `;
  return phoneFrame('로그인', body);
}

async function writeTextFile(path: string, content: string): Promise<void> {
  await writeFile(path, content.trimStart(), 'utf8');
}

async function generateAssets() {
  const demo = buildCapstoneDemoState();
  const autobiography = buildDemoAutobiography();
  await mkdir(screenshotsDir, { recursive: true });

  const pdf = await generatePrintReady(autobiography, {
    authorName: demo.auth.profile?.name ?? '김영자',
    subtitle: 'Dearlog 캡스톤 발표용 인쇄 자서전',
    familyReviewed: true,
    photos: demo.photos,
    closingMessage: '서로의 안부를 자주 묻고, 힘든 날에는 먼저 손을 내밀어 주세요.',
  });
  await writeFile(join(outputDir, 'Dearlog_김영자_이야기_A5.pdf'), Buffer.from(await pdf.arrayBuffer()));

  const screens = [
    ['01-auth-login.svg', loginSvg(), '로그인/역할 선택'],
    ['02-demo-settings.svg', demoSettingsSvg(), '발표 데모 준비'],
    ['03-archive-review.svg', archiveSvg(), '추억 보관함/가족 검수'],
    ['04-persona-chat.svg', personaSvg(), '나의 분신 대화'],
    ['05-autobiography-print.svg', autobiographySvg(), '자서전 인쇄물'],
  ] as const;

  for (const [fileName, svg] of screens) {
    await writeTextFile(join(screenshotsDir, fileName), svg);
  }

  const index = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Dearlog 캡스톤 발표 화면 패키지</title>
  <style>
    body { margin: 0; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f7f4ef; color: #292321; }
    main { max-width: 1160px; margin: 0 auto; padding: 44px 24px; }
    h1 { font-size: 34px; margin: 0 0 10px; }
    p { color: #6c625e; font-weight: 650; line-height: 1.6; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 24px; align-items: start; }
    figure { margin: 0; border: 1px solid #e1d8cd; background: #fff; border-radius: 22px; padding: 16px; box-shadow: 0 12px 30px rgba(41, 35, 33, 0.08); }
    img { width: 100%; display: block; border-radius: 18px; }
    figcaption { margin-top: 12px; font-weight: 900; }
    a { color: #7a3143; font-weight: 900; }
  </style>
</head>
<body>
  <main>
    <h1>Dearlog 캡스톤 발표 화면 패키지</h1>
    <p>아래 SVG는 PPT/보고서에 바로 삽입할 수 있는 발표용 모바일 화면 스냅샷입니다. 인쇄용 PDF는 <a href="./Dearlog_김영자_이야기_A5.pdf">Dearlog_김영자_이야기_A5.pdf</a>에서 확인합니다.</p>
    <div class="grid">
      ${screens.map(([fileName, , label]) => `<figure><img src="./screenshots/${fileName}" alt="${label}" /><figcaption>${label}</figcaption></figure>`).join('\n')}
    </div>
  </main>
</body>
</html>`;
  await writeTextFile(join(outputDir, 'index.html'), index);

  const manifest = {
    generatedAt: new Date().toISOString(),
    pdf: 'Dearlog_김영자_이야기_A5.pdf',
    screenshots: screens.map(([fileName, , label]) => ({ fileName: `screenshots/${fileName}`, label })),
    printChecklist: PRINT_READY_CHECKLIST,
  };
  await writeTextFile(join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(`Generated capstone assets in ${outputDir}`);
}

generateAssets().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
