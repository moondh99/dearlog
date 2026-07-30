import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from './config';
import { resolveLocalFileKey } from './storage';
import type { PublicationDesignPlan, PublicationManifest, PublicationPhotoPlate } from './domain/publication-agent';

const KOREAN_FONT_FILE = 'NotoSansKR-Regular.ttf';
let koreanFontDataUrl: string | null = null;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function cssVar(value: string) {
  return value.replace(/[^#(),.%\w\s-]/g, '');
}

async function loadKoreanFontDataUrl() {
  if (koreanFontDataUrl) return koreanFontDataUrl;

  const fontPaths = [
    process.env.KOREAN_PDF_FONT_PATH,
    path.join(config.serverDir, '..', 'public', 'fonts', KOREAN_FONT_FILE),
    path.join(config.serverDir, '..', 'dist', 'fonts', KOREAN_FONT_FILE),
  ].filter((fontPath): fontPath is string => Boolean(fontPath));

  for (const fontPath of fontPaths) {
    try {
      const fontBytes = await fs.readFile(fontPath);
      koreanFontDataUrl = `data:font/truetype;base64,${fontBytes.toString('base64')}`;
      return koreanFontDataUrl;
    } catch {
      // Try the next candidate path.
    }
  }

  throw new Error(`${KOREAN_FONT_FILE} 파일을 찾을 수 없습니다.`);
}

async function photoToDataUrl(photo: PublicationPhotoPlate) {
  try {
    const bytes = await fs.readFile(resolveLocalFileKey(photo.fileKey));
    return `data:${photo.mimeType};base64,${bytes.toString('base64')}`;
  } catch {
    return null;
  }
}

async function renderPhotoPlates(photoPlates: PublicationPhotoPlate[]) {
  const plates = [];
  for (const photo of photoPlates) {
    const dataUrl = await photoToDataUrl(photo);
    if (!dataUrl) continue;
    plates.push(`
      <article class="photo-plate">
        <img src="${dataUrl}" alt="" />
        <div class="photo-caption">
          <p>${escapeHtml(photo.caption)}</p>
          <span>${escapeHtml([photo.capturedDate, photo.location].filter(Boolean).join(' · '))}</span>
        </div>
      </article>
    `);
  }

  if (plates.length === 0) return '';

  return `
    <section class="book-section photo-section">
      <div class="section-kicker">PHOTO RECORDS</div>
      <h2>사진으로 남은 장면</h2>
      <div class="photo-grid">${plates.join('')}</div>
    </section>
  `;
}

interface ReaderPhotoStory extends PublicationPhotoPlate {
  title: string;
  chapterTitle: string;
  body: string[];
}

async function renderPhotoStories(photoStories: ReaderPhotoStory[]) {
  const stories = [];
  for (const story of photoStories) {
    const dataUrl = await photoToDataUrl(story);
    if (!dataUrl) continue;
    stories.push(`
      <article class="photo-story">
        <figure>
          <img src="${dataUrl}" alt="" />
          <figcaption class="photo-caption">
            <p>${escapeHtml(story.caption)}</p>
            <span>${escapeHtml([story.capturedDate, story.location].filter(Boolean).join(' · '))}</span>
          </figcaption>
        </figure>
        <div class="photo-story-body">
          <div class="photo-story-chapter">${escapeHtml(story.chapterTitle)}</div>
          <h3>${escapeHtml(story.title)}</h3>
          ${story.body.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')}
        </div>
      </article>
    `);
  }

  if (stories.length === 0) return '';

  return `
    <section class="book-section photo-section photo-story-section">
      <div class="section-kicker">PHOTO STORIES</div>
      <h2>사진이 들려준 이야기</h2>
      <div class="photo-stories">${stories.join('')}</div>
    </section>
  `;
}

function pageSize(format: 'A5' | 'B5') {
  return format === 'B5'
    ? { css: 'B5', coverHeight: '250mm' }
    : { css: 'A5', coverHeight: '210mm' };
}

const DEFAULT_DESIGN_PLAN: PublicationDesignPlan = {
  mood: 'warm_archive',
  coverComposition: 'framed_classic',
  chapterOpenerStyle: 'quote_first',
  photoTreatment: 'gallery_grid',
  pacing: 'balanced',
  ornamentLevel: 'subtle',
};

function designClassNames(designPlan: PublicationDesignPlan) {
  return [
    `mood-${designPlan.mood}`,
    `cover-composition-${designPlan.coverComposition}`,
    `chapter-style-${designPlan.chapterOpenerStyle}`,
    `photo-treatment-${designPlan.photoTreatment}`,
    `pacing-${designPlan.pacing}`,
    `ornament-${designPlan.ornamentLevel}`,
  ].join(' ');
}

const INTERNAL_READER_TERMS = [
  /기록\s*출처/,
  /이\s*장의\s*기록\s*출처/,
  /출처\s*답변/,
  /출처\s*확인/,
  /\d+\s*개의?\s*출처/,
  /답변\s*\d+\s*개/,
  /\d+\s*개의?\s*답변/,
  /생성\s*방식/,
  /CONFIRMED|ESTIMATED|UNVERIFIED/i,
  /sourceRecordIds?|sourceRecords?|sourceChunkIds?/i,
  /\bsource\b/i,
  /reliability/i,
  /editorNote|editorialNote/i,
  /불확실성\s*메모/,
  /원문\s*답변을\s*바탕으로\s*구성했습니다/,
  /더\s*채울\s*기억/,
  /missingSections?/i,
  /hallucination/i,
  /환각\s*방지/,
];

const INTERNAL_CAPTION_TERMS = [
  /(^|[\s()[\]{}"'·_-])QA([\s()[\]{}"'·_-]|$)/i,
  /검증\s*용/,
  /레이아웃\s*검증/,
  /합성\s*사진/,
  /테스트/,
  /\btest\b/i,
  /\bsynthetic\b/i,
  /\bfixture\b/i,
  /샘플\s*데이터/,
  /\.(?:png|jpe?g|webp|svg)\b/i,
];

function containsInternalReaderTerm(value: string) {
  return INTERNAL_READER_TERMS.some((pattern) => pattern.test(value));
}

function containsInternalCaptionTerm(value: string) {
  return INTERNAL_CAPTION_TERMS.some((pattern) => pattern.test(value));
}

function readerText(value: string | null | undefined, fallback: string) {
  const normalized = value?.replace(/\s+/g, ' ').trim() ?? '';
  if (!normalized || containsInternalReaderTerm(normalized)) return fallback;
  return normalized;
}

function readerCaption(value: string | null | undefined, fallback = '가족 사진') {
  const normalized = value?.replace(/\s+/g, ' ').trim() ?? '';
  if (!normalized || containsInternalReaderTerm(normalized) || containsInternalCaptionTerm(normalized)) {
    return fallback;
  }
  return normalized;
}

function buildReaderBook(manifest: PublicationManifest) {
  const title = readerText(manifest.title, `${manifest.authorName}의 이야기`);
  const subtitle = readerText(manifest.subtitle, '가족의 기억으로 엮은 생애 기록');
  const photoById = new Map(manifest.photoPlates.map((photo) => [photo.id, photo]));
  const photoStoryParagraphIds = new Set<string>();
  const photoStoryPhotoIds = new Set<string>();
  const photoStories: ReaderPhotoStory[] = [];

  for (const chapter of manifest.chapters) {
    for (const record of chapter.sourceRecords) {
      const photoId = record.photo?.id ?? record.photoId;
      const photoPlate = photoId ? photoById.get(photoId) : null;
      if (!photoPlate) continue;

      const paragraphMatches = chapter.paragraphs.filter((paragraph) => paragraph.sourceRecordIds.includes(record.id));
      const storyBody = paragraphMatches
        .map((paragraph) => readerText(paragraph.text, ''))
        .filter(Boolean);
      const fallbackBody = readerText(record.transcriptText, '');
      const body = Array.from(new Set(storyBody.length > 0 ? storyBody : [fallbackBody])).filter(Boolean);
      if (body.length === 0) continue;

      for (const paragraph of paragraphMatches) {
        photoStoryParagraphIds.add(paragraph.id);
      }
      photoStoryPhotoIds.add(photoPlate.id);

      const caption = readerCaption(record.photo?.caption ?? photoPlate.caption);
      photoStories.push({
        ...photoPlate,
        caption,
        capturedDate: readerText(record.photo?.capturedDate ?? photoPlate.capturedDate, ''),
        location: readerText(record.photo?.location ?? photoPlate.location, ''),
        title: caption,
        chapterTitle: readerText(chapter.title, '기록'),
        body,
      });
    }
  }

  return {
    title,
    subtitle,
    authorName: manifest.authorName,
    seasonLabel: readerText(manifest.seasonLabel, 'Dearlog 가족 기록집'),
    design: manifest.design,
    designPlan: manifest.designPlan ?? DEFAULT_DESIGN_PLAN,
    cover: {
      kicker: readerText(manifest.cover.kicker, 'DEARLOG FAMILY BOOK'),
      title: readerText(manifest.cover.title, title),
      subtitle: readerText(manifest.cover.subtitle, '기억을 따라 엮은 한 권의 기록'),
      dedication: readerText(manifest.cover.dedication, '가족이 함께 남긴 기억을 바탕으로 구성했습니다.'),
      backCoverBlurb: readerText(
        manifest.cover.backCoverBlurb,
        `${manifest.authorName}님의 이야기를 가족의 마음으로 엮었습니다. 오래 간직하고 싶은 장면과 말들을 한 권의 기록으로 남깁니다.`,
      ),
    },
    chapters: manifest.chapters
      .map((chapter) => ({
        title: readerText(chapter.title, '기록'),
        subtitle: readerText(chapter.subtitle, '기억을 따라 이어지는 이야기'),
        openingQuote: readerText(chapter.openingQuote, ''),
        paragraphs: chapter.paragraphs
          .filter((paragraph) => !photoStoryParagraphIds.has(paragraph.id))
          .map((paragraph) => readerText(paragraph.text, ''))
          .filter(Boolean),
      }))
      .filter((chapter) => chapter.paragraphs.length > 0),
    photoStories,
    photoPlates: manifest.photoPlates
      .filter((photo) => !photoStoryPhotoIds.has(photo.id))
      .map((photo) => ({
        ...photo,
        caption: readerCaption(photo.caption),
        capturedDate: readerText(photo.capturedDate, ''),
        location: readerText(photo.location, ''),
      })),
    closing: {
      title: readerText(manifest.closing.title, '마지막으로'),
      body: readerText(
        manifest.closing.body,
        '이야기는 이곳에 잠시 매듭지어집니다. 함께 나눈 기억은 앞으로도 가족 곁에서 오래 머물 것입니다.',
      ),
    },
  };
}

export async function renderPublicationHtml(manifest: PublicationManifest, format: 'A5' | 'B5') {
  const fontDataUrl = await loadKoreanFontDataUrl();
  const { css: cssPageSize, coverHeight } = pageSize(format);
  const book = buildReaderBook(manifest);
  const photoStorySection = await renderPhotoStories(book.photoStories);
  const photoSection = await renderPhotoPlates(book.photoPlates);
  const chapterCount = book.chapters.length;

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <title>${escapeHtml(book.title)}</title>
  <style>
    @font-face {
      font-family: 'NotoSansKR';
      src: url('${fontDataUrl}') format('truetype');
      font-weight: 400;
      font-style: normal;
      font-display: block;
    }

    @page {
      size: ${cssPageSize};
      margin: 15mm 14mm 18mm;
    }

    @page cover {
      size: ${cssPageSize};
      margin: 0;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      color: var(--ink);
      background: var(--paper);
      font-family: 'NotoSansKR', 'Apple SD Gothic Neo', sans-serif;
      line-height: 1.72;
      --accent: ${cssVar(book.design.accentColor)};
      --paper: ${cssVar(book.design.paperColor)};
      --ink: ${cssVar(book.design.inkColor)};
      --muted: #756F69;
      --line: rgba(43, 39, 35, 0.16);
      --chapter-opener-min: 78mm;
      --chapter-opener-bottom: 11mm;
      --chapter-gap: 10mm;
      --paragraph-gap: 7mm;
      --paragraph-leading: 1.9;
      --screen-section-padding: 34px 24px 42px;
    }

    body.pacing-compact {
      --chapter-opener-min: 54mm;
      --chapter-opener-bottom: 8mm;
      --chapter-gap: 7mm;
      --paragraph-gap: 5mm;
      --paragraph-leading: 1.78;
      --screen-section-padding: 28px 22px 34px;
    }

    body.pacing-spacious {
      --chapter-opener-min: 92mm;
      --chapter-opener-bottom: 14mm;
      --chapter-gap: 13mm;
      --paragraph-gap: 9mm;
      --paragraph-leading: 2.02;
      --screen-section-padding: 40px 26px 50px;
    }

    body.mood-warm_archive {
      --muted: #76695B;
      --line: rgba(98, 73, 52, 0.18);
    }

    body.mood-quiet_blue {
      --muted: #526878;
      --line: rgba(58, 82, 105, 0.22);
    }

    body.mood-classic_ink {
      --muted: #55524D;
      --line: rgba(32, 32, 32, 0.28);
    }

    .cover {
      page: cover;
      position: relative;
      height: ${coverHeight};
      overflow: hidden;
      color: var(--ink);
      background:
        linear-gradient(180deg, rgba(255,255,255,0.34), rgba(255,255,255,0.03)),
        var(--paper);
      break-after: page;
      padding: 22mm 18mm;
    }

    .cover > * {
      position: relative;
      z-index: 1;
    }

    .cover::before {
      content: '';
      position: absolute;
      inset: 9mm;
      border: 0.7mm solid color-mix(in srgb, var(--accent) 58%, transparent);
      pointer-events: none;
      z-index: 0;
    }

    .cover::after {
      content: '';
      position: absolute;
      pointer-events: none;
      z-index: 0;
    }

    body.mood-warm_archive .cover {
      background:
        linear-gradient(180deg, rgba(255,255,255,0.42), rgba(255,255,255,0.08)),
        repeating-linear-gradient(90deg, rgba(155,111,78,0.045) 0, rgba(155,111,78,0.045) 1px, transparent 1px, transparent 9mm),
        var(--paper);
    }

    body.mood-quiet_blue .cover {
      background:
        linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0)),
        #F3F6F8;
    }

    body.mood-classic_ink .cover {
      background:
        linear-gradient(180deg, rgba(255,255,255,0.08), rgba(0,0,0,0.035)),
        #F7F5EF;
    }

    body.cover-composition-framed_classic .cover {
      padding: 24mm 20mm;
    }

    body.ornament-none .cover::before {
      display: none;
    }

    body.ornament-decorative .cover::before {
      inset: 7mm;
      border-width: 1mm;
      border-style: double;
    }

    body.cover-composition-centered_letter .cover {
      display: flex;
      flex-direction: column;
      justify-content: center;
      text-align: center;
    }

    body.cover-composition-centered_letter .cover::before {
      inset: 14mm;
      border-width: 0.35mm;
    }

    body.cover-composition-centered_letter .cover-mark {
      margin-left: auto;
      margin-right: auto;
      margin-bottom: 18mm;
    }

    body.cover-composition-centered_letter .cover h1,
    body.cover-composition-centered_letter .cover-subtitle {
      width: 100%;
      margin-left: auto;
      margin-right: auto;
    }

    body.cover-composition-centered_letter .cover h1 {
      font-size: 33pt;
      line-height: 1.22;
    }

    body.cover-composition-centered_letter .cover-dedication {
      position: static;
      margin-top: 24mm;
    }

    body.cover-composition-quiet_band .cover {
      padding-top: 38mm;
    }

    body.cover-composition-quiet_band .cover-mark {
      width: 100%;
      height: 0.8mm;
      margin-bottom: 20mm;
      opacity: 0.72;
    }

    body.cover-composition-quiet_band .cover::after {
      inset: 0 0 auto;
      height: 24mm;
      background: color-mix(in srgb, var(--accent) 82%, #162234);
    }

    body.cover-composition-quiet_band .cover::before {
      inset: 24mm 12mm 12mm;
      border-width: 0.25mm;
      border-top: 0;
    }

    body.cover-composition-quiet_band .cover h1 {
      width: 92%;
      font-size: 27pt;
      line-height: 1.2;
    }

    .cover-mark {
      width: 19mm;
      height: 2mm;
      background: var(--accent);
      margin-bottom: 28mm;
    }

    .kicker,
    .section-kicker {
      color: var(--accent);
      font-size: 7.5pt;
      letter-spacing: 0.22em;
      text-transform: uppercase;
    }

    .cover h1 {
      width: 86%;
      margin: 9mm 0 0;
      font-size: 29pt;
      font-weight: 400;
      line-height: 1.26;
      letter-spacing: 0;
      word-break: keep-all;
      overflow-wrap: normal;
      text-wrap: balance;
    }

    .cover-subtitle {
      width: 78%;
      margin-top: 9mm;
      color: var(--muted);
      font-size: 10.5pt;
    }

    .cover-dedication {
      position: absolute;
      left: 18mm;
      right: 18mm;
      bottom: 26mm;
      padding-top: 7mm;
      border-top: 0.3mm solid var(--line);
      color: var(--muted);
      font-size: 9.5pt;
    }

    .book-section {
      break-after: page;
    }

    .title-page {
      min-height: 168mm;
      display: flex;
      flex-direction: column;
      justify-content: center;
      text-align: center;
      position: relative;
    }

    .title-page h1 {
      margin: 0;
      font-size: 23pt;
      font-weight: 400;
      line-height: 1.35;
    }

    .title-page p {
      margin: 8mm auto 0;
      max-width: 96mm;
      color: var(--muted);
      font-size: 10pt;
    }

    body.mood-quiet_blue .title-page {
      justify-content: flex-start;
      text-align: left;
      padding-top: 36mm;
      border-top: 2.4mm solid color-mix(in srgb, var(--accent) 82%, #162234);
    }

    body.mood-classic_ink .title-page {
      min-height: 176mm;
      justify-content: center;
      border-top: 0.45mm solid var(--ink);
      border-bottom: 0.45mm solid var(--ink);
    }

    body.mood-classic_ink .title-page h1 {
      font-size: 25pt;
      letter-spacing: 0;
    }

    body.ornament-decorative .title-page::before,
    body.ornament-decorative .title-page::after {
      content: '';
      width: 28mm;
      height: 0.45mm;
      background: var(--accent);
      margin: 0 auto;
    }

    body.ornament-decorative .title-page::before {
      margin-bottom: 12mm;
    }

    body.ornament-decorative .title-page::after {
      margin-top: 12mm;
    }

    .toc h2,
    .photo-section h2,
    .closing h2 {
      margin: 3mm 0 9mm;
      font-size: 18pt;
      font-weight: 400;
    }

    .toc-row {
      display: grid;
      grid-template-columns: 12mm 1fr auto;
      gap: 4mm;
      align-items: baseline;
      padding: 4mm 0;
      border-bottom: 0.3mm solid var(--line);
      font-size: 10pt;
    }

    .toc-row span:first-child {
      color: var(--accent);
    }

    body.mood-quiet_blue .toc h2,
    body.mood-quiet_blue .photo-section h2,
    body.mood-quiet_blue .closing h2 {
      font-size: 16pt;
      letter-spacing: 0;
    }

    body.mood-quiet_blue .toc-row {
      grid-template-columns: 10mm 1fr auto;
      padding: 2.8mm 0;
      font-size: 9.2pt;
      border-bottom-color: color-mix(in srgb, var(--accent) 24%, transparent);
    }

    body.mood-classic_ink .toc-row {
      grid-template-columns: 14mm 1fr auto;
      padding: 5mm 0;
      border-bottom-color: rgba(32, 32, 32, 0.32);
    }

    .chapter {
      break-before: page;
    }

    .chapter-opener {
      position: relative;
      min-height: var(--chapter-opener-min);
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      padding-bottom: var(--chapter-opener-bottom);
      border-bottom: 0.5mm solid var(--line);
      margin-bottom: var(--chapter-gap);
    }

    body.chapter-style-minimal_rule .chapter-opener {
      border-bottom-width: 0.25mm;
      border-top: 0.9mm solid color-mix(in srgb, var(--accent) 76%, transparent);
      justify-content: flex-start;
      padding-top: 8mm;
    }

    body.chapter-style-quote_first .opening-quote {
      order: -1;
      margin: 0 0 7mm;
      padding-left: 5mm;
      border-left: 0.8mm solid color-mix(in srgb, var(--accent) 62%, transparent);
    }

    body.chapter-style-numbered_classic .chapter-opener {
      justify-content: center;
      padding-left: 25mm;
      border-bottom: 0;
    }

    body.chapter-style-numbered_classic .chapter-opener::before {
      content: attr(data-chapter-number);
      position: absolute;
      left: 0;
      bottom: var(--chapter-opener-bottom);
      color: color-mix(in srgb, var(--accent) 52%, transparent);
      font-size: 46pt;
      line-height: 1;
    }

    body.chapter-style-numbered_classic .chapter-opener::after {
      content: '';
      position: absolute;
      left: 25mm;
      right: 0;
      bottom: 0;
      border-bottom: 0.45mm solid var(--line);
    }

    .chapter-opener h2 {
      margin: 3mm 0 0;
      font-size: 21pt;
      font-weight: 400;
      line-height: 1.32;
    }

    .chapter-subtitle {
      margin-top: 4mm;
      color: var(--muted);
      font-size: 9.5pt;
    }

    .opening-quote {
      margin: 8mm 0 0;
      color: var(--accent);
      font-size: 10pt;
      line-height: 1.75;
    }

    .paragraph {
      margin: 0 0 var(--paragraph-gap);
      break-inside: avoid;
    }

    .paragraph p {
      margin: 0;
      font-size: 10.2pt;
      line-height: var(--paragraph-leading);
      word-break: keep-all;
      overflow-wrap: anywhere;
    }

    .photo-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 7mm;
    }

    .photo-stories {
      display: grid;
      gap: 9mm;
    }

    .photo-story {
      display: grid;
      grid-template-columns: minmax(0, 42%) minmax(0, 1fr);
      gap: 7mm;
      align-items: start;
      break-inside: avoid;
      padding-bottom: 8mm;
      border-bottom: 0.3mm solid var(--line);
    }

    .photo-story figure {
      margin: 0;
    }

    .photo-story img {
      width: 100%;
      max-height: 72mm;
      object-fit: cover;
      display: block;
      border: 0.3mm solid var(--line);
    }

    .photo-story-chapter {
      color: var(--accent);
      font-size: 7.5pt;
      letter-spacing: 0.08em;
    }

    .photo-story h3 {
      margin: 2mm 0 4mm;
      font-size: 13pt;
      font-weight: 400;
      line-height: 1.45;
    }

    .photo-story-body p {
      margin: 0 0 4mm;
      font-size: 9.5pt;
      line-height: 1.78;
      word-break: keep-all;
      overflow-wrap: anywhere;
    }

    body.mood-quiet_blue .photo-story {
      grid-template-columns: minmax(0, 35%) minmax(0, 1fr);
      gap: 6mm;
      padding: 5mm 0;
      border-top: 0.35mm solid color-mix(in srgb, var(--accent) 32%, transparent);
      border-bottom: 0;
    }

    body.mood-quiet_blue .photo-story h3 {
      margin-top: 1mm;
      font-size: 14pt;
      line-height: 1.34;
    }

    body.mood-quiet_blue .photo-story-chapter {
      letter-spacing: 0.18em;
      text-transform: uppercase;
    }

    body.mood-classic_ink .photo-story {
      grid-template-columns: 1fr;
      gap: 5mm;
      padding: 7mm;
      border: 0.35mm solid var(--line);
    }

    body.mood-classic_ink .photo-story img {
      filter: grayscale(1) contrast(1.05);
    }

    body.photo-treatment-single_plate .photo-grid {
      display: block;
    }

    body.photo-treatment-single_plate .photo-plate + .photo-plate {
      margin-top: 8mm;
    }

    body.photo-treatment-single_plate .photo-plate img {
      max-height: 120mm;
    }

    body.photo-treatment-single_plate .photo-story {
      grid-template-columns: 1fr;
      gap: 5mm;
    }

    body.photo-treatment-single_plate .photo-story img {
      max-height: 108mm;
    }

    body.photo-treatment-album_stack .photo-grid {
      grid-template-columns: 1fr;
      gap: 8mm;
    }

    body.photo-treatment-album_stack .photo-plate {
      padding: 3mm;
      background: rgba(255,255,255,0.46);
      border: 0.3mm solid var(--line);
    }

    body.photo-treatment-album_stack .photo-plate:nth-child(even) {
      transform: rotate(0.35deg);
    }

    body.photo-treatment-album_stack .photo-plate:nth-child(odd) {
      transform: rotate(-0.25deg);
    }

    body.photo-treatment-album_stack .photo-plate img {
      border: 0;
    }

    body.photo-treatment-album_stack .photo-story {
      padding: 4mm;
      background: rgba(255,255,255,0.58);
      border: 0.3mm solid var(--line);
    }

    body.photo-treatment-album_stack .photo-story figure {
      padding: 2mm;
      background: rgba(255,255,255,0.82);
      border: 0.3mm solid var(--line);
    }

    body.photo-treatment-album_stack .photo-story img {
      border: 0;
    }

    .photo-plate {
      break-inside: avoid;
    }

    .photo-plate img {
      width: 100%;
      max-height: 92mm;
      object-fit: cover;
      display: block;
      border: 0.3mm solid var(--line);
    }

    .photo-caption {
      display: flex;
      justify-content: space-between;
      gap: 4mm;
      margin-top: 2.5mm;
      color: var(--muted);
      font-size: 8.5pt;
    }

    .photo-caption p,
    .photo-caption span {
      margin: 0;
    }

    .closing {
      min-height: 168mm;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }

    .closing p {
      color: var(--muted);
      font-size: 10.2pt;
    }

    .back-cover {
      page: cover;
      min-height: ${coverHeight};
      padding: 24mm 18mm;
      background: var(--paper);
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      break-before: page;
    }

    .back-cover p {
      color: var(--muted);
      font-size: 10pt;
    }

    @media screen {
      *,
      *::before,
      *::after {
        max-width: 100%;
        overflow-wrap: anywhere;
      }

      html {
        width: 100%;
        min-height: 100%;
        background: #E6E0D8;
        overflow-x: hidden !important;
      }

      body {
        width: 100%;
        max-width: 100%;
        min-height: 100vh;
        margin: 0;
        overflow-x: hidden !important;
        box-shadow: none;
      }

      html::-webkit-scrollbar:horizontal,
      body::-webkit-scrollbar:horizontal {
        display: none;
      }

      .cover {
        width: 100%;
        min-height: calc(100vh - 1px);
        height: auto;
        padding: 48px 28px 36px;
        break-after: auto;
        overflow: hidden;
      }

      .cover::before {
        inset: 16px;
        border-width: 2px;
      }

      body.cover-composition-quiet_band .cover::after {
        height: 86px;
      }

      body.cover-composition-quiet_band .cover::before {
        inset: 86px 18px 18px;
      }

      .cover-mark {
        width: 54px;
        height: 6px;
        margin-bottom: 72px;
      }

      .cover h1 {
        width: 100%;
        margin-top: 28px;
        font-size: clamp(30px, 8vw, 34px);
      }

      body.cover-composition-centered_letter .cover h1 {
        font-size: clamp(31px, 8.8vw, 38px);
      }

      body.cover-composition-quiet_band .cover h1 {
        width: 100%;
        font-size: clamp(28px, 7.4vw, 31px);
      }

      .cover-subtitle {
        width: 100%;
        margin-top: 28px;
        font-size: 14px;
      }

      .cover-dedication {
        left: 28px;
        right: 28px;
        bottom: 42px;
        padding-top: 22px;
        font-size: 13px;
      }

      .book-section,
      .chapter,
      .back-cover {
        width: 100%;
        max-width: 100%;
        min-height: 0;
        padding: var(--screen-section-padding);
        background: var(--paper);
        border-top: 1px solid rgba(43, 39, 35, 0.08);
        break-before: auto;
        break-after: auto;
        overflow-x: hidden;
      }

      .chapter {
        break-before: auto;
      }

      .toc,
      .photo-section {
        min-height: 0;
      }

      .title-page {
        min-height: calc(100vh - 1px);
      }

      body.mood-quiet_blue .title-page {
        padding-top: 58px;
      }

      body.mood-classic_ink .title-page {
        min-height: calc(100vh - 1px);
      }

      body.ornament-decorative .title-page::before,
      body.ornament-decorative .title-page::after {
        width: 84px;
        height: 2px;
      }

      .title-page h1 {
        font-size: 28px;
      }

      .title-page p,
      .closing p,
      .back-cover p {
        max-width: 100%;
        font-size: 14px;
      }

      .toc h2,
      .photo-section h2,
      .closing h2 {
        margin: 10px 0 28px;
        font-size: 25px;
      }

      .toc-row {
        grid-template-columns: 32px minmax(0, 1fr) auto;
        gap: 12px;
        padding: 14px 0;
        font-size: 13px;
        min-width: 0;
      }

      .toc-row strong,
      .toc-row span {
        min-width: 0;
      }

      .chapter-opener {
        min-height: 0;
        padding-bottom: 28px;
        margin-bottom: 28px;
      }

      body.chapter-style-minimal_rule .chapter-opener {
        padding-top: 24px;
      }

      body.chapter-style-numbered_classic .chapter-opener {
        padding-left: 64px;
      }

      body.chapter-style-numbered_classic .chapter-opener::before {
        bottom: 28px;
        font-size: 58px;
      }

      body.chapter-style-numbered_classic .chapter-opener::after {
        left: 64px;
      }

      .chapter-opener h2 {
        font-size: 28px;
      }

      .chapter-subtitle,
      .opening-quote {
        font-size: 13px;
      }

      .paragraph {
        margin-bottom: 24px;
      }

      .paragraph p {
        font-size: 14px;
      }

      .photo-plate img {
        width: 100%;
        max-height: none;
      }

      .photo-grid {
        grid-template-columns: 1fr;
      }

      .photo-story {
        display: block;
        padding-bottom: 28px;
      }

      body.mood-quiet_blue .photo-story,
      body.mood-classic_ink .photo-story,
      body.photo-treatment-single_plate .photo-story,
      body.photo-treatment-album_stack .photo-story {
        display: block;
      }

      body.mood-classic_ink .photo-story,
      body.photo-treatment-album_stack .photo-story {
        padding: 22px;
      }

      .photo-story img {
        width: 100%;
        max-height: none;
      }

      .photo-story h3 {
        margin: 12px 0 14px;
        font-size: 20px;
      }

      .photo-story-body {
        margin-top: 18px;
      }

      .photo-story-chapter {
        font-size: 11px;
      }

      .photo-story-body p {
        font-size: 14px;
      }

      .photo-caption {
        display: block;
        font-size: 12px;
      }

      .closing {
        min-height: 70vh;
      }

    }
  </style>
</head>
<body class="${designClassNames(book.designPlan)}">
  <section class="cover">
    <div class="cover-mark"></div>
    <div class="kicker">${escapeHtml(book.cover.kicker)}</div>
    <h1>${escapeHtml(book.cover.title)}</h1>
    <p class="cover-subtitle">${escapeHtml(book.cover.subtitle)}</p>
    <p class="cover-dedication">${escapeHtml(book.cover.dedication)}</p>
  </section>

  <section class="book-section title-page">
    <div class="section-kicker">${escapeHtml(book.seasonLabel)}</div>
    <h1>${escapeHtml(book.title)}</h1>
    <p>${escapeHtml(book.subtitle)}</p>
  </section>

  <section class="book-section toc">
    <div class="section-kicker">CONTENTS</div>
    <h2>목차</h2>
    ${book.chapters.map((chapter, index) => `
      <div class="toc-row">
        <span>${String(index + 1).padStart(2, '0')}</span>
        <strong>${escapeHtml(chapter.title)}</strong>
        <span>${escapeHtml(`${chapter.paragraphs.length}편`)}</span>
      </div>
    `).join('')}
    ${chapterCount === 0 ? '<p class="chapter-subtitle">아직 책으로 엮을 기억이 충분하지 않습니다.</p>' : ''}
  </section>

  ${book.chapters.map((chapter, index) => `
    <section class="chapter">
      <div class="chapter-opener" data-chapter-number="${String(index + 1).padStart(2, '0')}">
        <div class="section-kicker">CHAPTER ${String(index + 1).padStart(2, '0')}</div>
        <h2>${escapeHtml(chapter.title)}</h2>
        <p class="chapter-subtitle">${escapeHtml(chapter.subtitle)}</p>
        ${chapter.openingQuote ? `<p class="opening-quote">“${escapeHtml(chapter.openingQuote)}”</p>` : ''}
      </div>

      ${chapter.paragraphs.map((paragraph) => `
        <article class="paragraph">
          <p>${escapeHtml(paragraph)}</p>
        </article>
      `).join('')}
    </section>
  `).join('')}

  ${photoStorySection}

  ${photoSection}

  <section class="book-section closing">
    <div class="section-kicker">CLOSING NOTE</div>
    <h2>${escapeHtml(book.closing.title)}</h2>
    <p>${escapeHtml(book.closing.body)}</p>
  </section>

  <section class="back-cover">
    <div class="section-kicker">DEARLOG</div>
    <p>${escapeHtml(book.cover.backCoverBlurb)}</p>
  </section>
</body>
</html>`;
}

function chromePathCandidates() {
  return [
    process.env.CHROME_PATH,
    process.env.PUPPETEER_EXECUTABLE_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ].filter((candidate): candidate is string => Boolean(candidate));
}

async function resolveChromePath() {
  for (const candidate of chromePathCandidates()) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Try the next candidate.
    }
  }

  throw new Error('HTML/CSS PDF 생성을 위한 Chrome 실행 파일을 찾을 수 없습니다. CHROME_PATH를 설정하세요.');
}

export async function renderHtmlToPdf(html: string) {
  const { default: puppeteer } = await import('puppeteer-core');
  const executablePath = await resolveChromePath();
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--font-render-hinting=medium',
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.emulateMediaType('print');
    return await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
    });
  } finally {
    await browser.close();
  }
}
