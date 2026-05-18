/**
 * PDF Generator for Dearlog.
 *
 * Converts an Autobiography data structure into a downloadable PDF document
 * with Korean font support, title page, table of contents, chapter headings,
 * body text, and page numbers.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */

import { jsPDF } from 'jspdf';
import type { Autobiography, ChapterNarrative, StoredPhoto } from '../types';
import { registerKoreanFont, KOREAN_FONT_FAMILY } from './fonts';

/**
 * Configuration for PDF layout and typography.
 */
export interface PDFConfig {
  fontFamily: string;
  bodyFontSize: number;
  headingFontSize: number;
  pageMargin: number;
  lineHeight: number;
}

export interface PrintReadyOptions {
  authorName: string;
  subtitle?: string;
  familyReviewed?: boolean;
  photos?: StoredPhoto[];
  closingMessage?: string;
}

/** Default PDF configuration */
const DEFAULT_CONFIG: PDFConfig = {
  fontFamily: KOREAN_FONT_FAMILY,
  bodyFontSize: 12,
  headingFontSize: 18,
  pageMargin: 40,
  lineHeight: 1.6,
};

/** A4 page dimensions in points (jsPDF default unit) */
const PAGE_WIDTH = 210; // mm
const PAGE_HEIGHT = 297; // mm

/**
 * Generates a PDF Blob from an Autobiography data structure.
 *
 * The PDF includes:
 * - Title page with autobiography title and generation date
 * - Table of contents with chapter titles and page numbers
 * - Chapter content with headings and body text
 * - Page numbers on every page (except title page)
 *
 * @param autobiography - The autobiography data to render
 * @param config - Optional PDF configuration overrides
 * @returns A Blob containing the generated PDF
 * @throws Error with Korean-language message if generation fails
 */
export async function generate(
  autobiography: Autobiography,
  config: PDFConfig = DEFAULT_CONFIG
): Promise<Blob> {
  try {
    if (!autobiography || !autobiography.chapters || autobiography.chapters.length === 0) {
      throw new Error('자서전 데이터가 비어있습니다. 챕터가 하나 이상 필요합니다.');
    }

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    // Register Korean font
    const fontRegistered = await registerKoreanFont(doc);
    if (fontRegistered) {
      doc.setFont(config.fontFamily, 'normal');
    }

    // Render title page
    renderTitlePage(doc, autobiography, config);

    // Calculate chapter page numbers (estimate for TOC)
    const chapterPages = estimateChapterPages(doc, autobiography.chapters, config);

    // Render table of contents
    doc.addPage();
    renderTableOfContents(doc, autobiography.chapters, chapterPages, config);

    // Render chapters
    for (const chapter of autobiography.chapters) {
      doc.addPage();
      renderChapter(doc, chapter, config);
    }

    // Add page numbers (skip title page)
    addPageNumbers(doc, config);

    // Return as Blob
    const pdfBlob = doc.output('blob');
    return pdfBlob;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`PDF 생성 중 오류가 발생했습니다: ${error.message}`);
    }
    throw new Error('PDF 생성 중 알 수 없는 오류가 발생했습니다.');
  }
}

/**
 * Generates a PDF and triggers a browser download.
 *
 * @param autobiography - The autobiography data to render
 * @param filename - The download filename (defaults to "자서전.pdf")
 * @throws Error with Korean-language message if generation or download fails
 */
export async function download(
  autobiography: Autobiography,
  filename: string = '자서전.pdf'
): Promise<void> {
  try {
    const blob = await generate(autobiography);

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';

    document.body.appendChild(link);
    link.click();

    // Cleanup
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`PDF 다운로드 중 오류가 발생했습니다: ${error.message}`);
    }
    throw new Error('PDF 다운로드 중 알 수 없는 오류가 발생했습니다.');
  }
}

export async function generatePrintReady(
  autobiography: Autobiography,
  options: PrintReadyOptions,
): Promise<Blob> {
  try {
    if (!autobiography || !autobiography.chapters || autobiography.chapters.length === 0) {
      throw new Error('인쇄용 자서전 데이터가 비어있습니다.');
    }

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a5',
    });

    const fontRegistered = await registerKoreanFont(doc);
    if (fontRegistered) {
      doc.setFont(KOREAN_FONT_FAMILY, 'normal');
    }

    renderPrintCover(doc, autobiography, options);
    doc.addPage();
    renderPrintIntro(doc, options);
    doc.addPage();
    renderPrintTableOfContents(doc, autobiography.chapters);

    for (const [index, chapter] of autobiography.chapters.entries()) {
      doc.addPage();
      renderPrintChapter(doc, chapter, index);
    }

    if (options.photos && options.photos.length > 0) {
      doc.addPage();
      renderPrintPhotoPages(doc, options.photos);
    }

    doc.addPage();
    renderPrintClosing(doc, options);
    addPrintPageNumbers(doc);

    return doc.output('blob');
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`인쇄용 PDF 생성 중 오류가 발생했습니다: ${error.message}`);
    }
    throw new Error('인쇄용 PDF 생성 중 알 수 없는 오류가 발생했습니다.');
  }
}

export async function downloadPrintReady(
  autobiography: Autobiography,
  options: PrintReadyOptions,
  filename: string = `Dearlog_${options.authorName || '나의'}_이야기_A5.pdf`,
): Promise<void> {
  try {
    const blob = await generatePrintReady(autobiography, options);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`인쇄용 PDF 다운로드 중 오류가 발생했습니다: ${error.message}`);
    }
    throw new Error('인쇄용 PDF 다운로드 중 알 수 없는 오류가 발생했습니다.');
  }
}

// ─── Internal Rendering Functions ────────────────────────────────────────────

/**
 * Renders the title page with autobiography title and generation date.
 */
function renderTitlePage(doc: jsPDF, autobiography: Autobiography, config: PDFConfig): void {
  const centerX = PAGE_WIDTH / 2;

  // Title
  doc.setFontSize(28);
  const titleY = PAGE_HEIGHT / 3;
  doc.text(autobiography.title, centerX, titleY, { align: 'center' });

  // Subtitle / decorative line
  doc.setFontSize(config.bodyFontSize);
  doc.text('─────────────────', centerX, titleY + 15, { align: 'center' });

  // Generation date
  const dateStr = formatDate(autobiography.generatedAt);
  doc.setFontSize(config.bodyFontSize);
  doc.text(dateStr, centerX, PAGE_HEIGHT - 60, { align: 'center' });

  // Platform credit
  doc.setFontSize(10);
  doc.text('Dearlog', centerX, PAGE_HEIGHT - 45, { align: 'center' });
}

const A5_WIDTH = 148;
const A5_HEIGHT = 210;
const PRINT_MARGIN = 18;
const PRINT_COLORS = {
  ink: [43, 36, 31] as const,
  muted: [111, 97, 86] as const,
  paper: [250, 247, 242] as const,
  paperDeep: [241, 232, 219] as const,
  accent: [147, 84, 44] as const,
  accentDark: [92, 52, 32] as const,
  line: [218, 204, 187] as const,
  plate: [233, 224, 211] as const,
};

function setColor(doc: jsPDF, color: readonly [number, number, number]): void {
  doc.setTextColor(color[0], color[1], color[2]);
}

function setFill(doc: jsPDF, color: readonly [number, number, number]): void {
  doc.setFillColor(color[0], color[1], color[2]);
}

function setStroke(doc: jsPDF, color: readonly [number, number, number]): void {
  doc.setDrawColor(color[0], color[1], color[2]);
}

function renderPrintPageBackground(doc: jsPDF): void {
  setFill(doc, PRINT_COLORS.paper);
  doc.rect(0, 0, A5_WIDTH, A5_HEIGHT, 'F');
}

function renderPrintCover(doc: jsPDF, autobiography: Autobiography, options: PrintReadyOptions): void {
  const centerX = A5_WIDTH / 2;
  setFill(doc, [245, 238, 226]);
  doc.rect(0, 0, A5_WIDTH, A5_HEIGHT, 'F');
  setFill(doc, PRINT_COLORS.accentDark);
  doc.rect(0, 0, 18, A5_HEIGHT, 'F');
  setStroke(doc, PRINT_COLORS.accent);
  doc.setLineWidth(0.6);
  doc.rect(26, 18, A5_WIDTH - 44, A5_HEIGHT - 36);
  doc.setLineWidth(0.2);
  doc.line(34, 28, A5_WIDTH - 26, 28);
  doc.line(34, A5_HEIGHT - 28, A5_WIDTH - 26, A5_HEIGHT - 28);

  setColor(doc, PRINT_COLORS.accentDark);
  doc.setFontSize(8);
  doc.text('DEARLOG ARCHIVE EDITION', centerX + 4, 42, { align: 'center' });
  doc.setFontSize(25);
  const titleLines = doc.splitTextToSize(autobiography.title, 82);
  doc.text(titleLines, centerX + 4, 74, { align: 'center' });
  setColor(doc, PRINT_COLORS.muted);
  doc.setFontSize(10.5);
  doc.text(options.subtitle ?? '가족이 함께 검수한 기억의 책', centerX + 4, 98, { align: 'center' });

  setStroke(doc, PRINT_COLORS.line);
  doc.roundedRect(49, 116, 54, 30, 3, 3);
  setColor(doc, PRINT_COLORS.ink);
  doc.setFontSize(15);
  doc.text(options.authorName, centerX + 4, 134, { align: 'center' });
  setColor(doc, PRINT_COLORS.muted);
  doc.setFontSize(8.5);
  doc.text('A5 PRINT PROOF', centerX + 4, A5_HEIGHT - 46, { align: 'center' });
  doc.text(formatDate(autobiography.generatedAt), centerX + 4, A5_HEIGHT - 36, { align: 'center' });
  setColor(doc, [255, 255, 255]);
  doc.setFontSize(9);
  doc.text('Dearlog', 9, A5_HEIGHT - 18, { align: 'center', angle: 90 });
}

function renderPrintIntro(doc: jsPDF, options: PrintReadyOptions): void {
  renderPrintPageBackground(doc);
  setColor(doc, PRINT_COLORS.accentDark);
  doc.setFontSize(8);
  doc.text('EDITORIAL NOTE', PRINT_MARGIN, 26);
  setColor(doc, PRINT_COLORS.ink);
  doc.setFontSize(19);
  doc.text('이 책을 펼치며', PRINT_MARGIN, 42);
  setStroke(doc, PRINT_COLORS.accent);
  doc.setLineWidth(0.4);
  doc.line(PRINT_MARGIN, 48, PRINT_MARGIN + 38, 48);
  const body = [
    `${options.authorName}님의 기억을 가족과 함께 검수해 엮은 A5 인쇄용 자서전입니다.`,
    options.familyReviewed
      ? '가족 질문과 공개 범위 확인을 거친 발표용 결과물입니다.'
      : '인쇄 전 가족 검수를 권장합니다.',
    '시장 골목, 서울역, 봉제공장, 사진관, 저녁밥, 바다의 기억을 한 권의 흐름으로 묶었습니다.',
  ].join('\n\n');
  renderParagraph(doc, body, PRINT_MARGIN, 66, A5_WIDTH - PRINT_MARGIN * 2, 10.5, 1.85, A5_HEIGHT, PRINT_MARGIN);
  setFill(doc, PRINT_COLORS.paperDeep);
  doc.roundedRect(PRINT_MARGIN, 150, A5_WIDTH - PRINT_MARGIN * 2, 24, 3, 3, 'F');
  setColor(doc, PRINT_COLORS.accentDark);
  doc.setFontSize(8.5);
  doc.text('DESIGN PROOF', PRINT_MARGIN + 6, 160);
  setColor(doc, PRINT_COLORS.muted);
  doc.text('인쇄 전 가족 검수와 개인정보 확인을 전제로 한 샘플 편집본', PRINT_MARGIN + 6, 169);
}

function renderPrintTableOfContents(doc: jsPDF, chapters: ChapterNarrative[]): void {
  renderPrintPageBackground(doc);
  setColor(doc, PRINT_COLORS.accentDark);
  doc.setFontSize(8);
  doc.text('CONTENTS', PRINT_MARGIN, 28);
  setColor(doc, PRINT_COLORS.ink);
  doc.setFontSize(19);
  doc.text('목차', PRINT_MARGIN, 44);
  let y = 66;
  chapters.forEach((chapter, index) => {
    setColor(doc, PRINT_COLORS.accent);
    doc.setFontSize(9);
    doc.text(String(index + 1).padStart(2, '0'), PRINT_MARGIN, y);
    setColor(doc, PRINT_COLORS.ink);
    doc.setFontSize(11.2);
    doc.text(chapter.title.replace(/^\d+장\.\s*/, ''), PRINT_MARGIN + 16, y);
    setStroke(doc, PRINT_COLORS.line);
    doc.line(PRINT_MARGIN + 16, y + 4, A5_WIDTH - PRINT_MARGIN, y + 4);
    y += 16;
  });
}

function renderPrintChapter(doc: jsPDF, chapter: ChapterNarrative, index = 0): void {
  renderPrintPageBackground(doc);
  const chapterNo = String(index + 1).padStart(2, '0');
  setColor(doc, PRINT_COLORS.accent);
  doc.setFontSize(36);
  doc.text(chapterNo, PRINT_MARGIN, 32);
  setColor(doc, PRINT_COLORS.accentDark);
  doc.setFontSize(8);
  doc.text('MEMORY CHAPTER', PRINT_MARGIN + 34, 24);
  setColor(doc, PRINT_COLORS.ink);
  doc.setFontSize(15.5);
  const title = chapter.title.replace(/^\d+장\.\s*/, '');
  doc.text(doc.splitTextToSize(title, 78), PRINT_MARGIN + 34, 34);
  setStroke(doc, PRINT_COLORS.accent);
  doc.setLineWidth(0.35);
  doc.line(PRINT_MARGIN, 54, A5_WIDTH - PRINT_MARGIN, 54);
  setColor(doc, PRINT_COLORS.ink);
  renderParagraph(doc, chapter.body, PRINT_MARGIN, 70, A5_WIDTH - PRINT_MARGIN * 2, 9.8, 1.9, A5_HEIGHT, PRINT_MARGIN + 4);
  setFill(doc, PRINT_COLORS.paperDeep);
  doc.roundedRect(PRINT_MARGIN, A5_HEIGHT - 30, A5_WIDTH - PRINT_MARGIN * 2, 11, 2, 2, 'F');
  setColor(doc, PRINT_COLORS.muted);
  doc.setFontSize(7.5);
  doc.text(`출처 기억 ${chapter.citations.map((citation) => citation.memoryId.replace('demo_memory_', '')).join(', ')}`, PRINT_MARGIN + 5, A5_HEIGHT - 23);
}

function renderPrintPhotoPages(doc: jsPDF, photos: StoredPhoto[]): void {
  renderPrintPageBackground(doc);
  setColor(doc, PRINT_COLORS.accentDark);
  doc.setFontSize(8);
  doc.text('PHOTO PLATES', PRINT_MARGIN, 26);
  setColor(doc, PRINT_COLORS.ink);
  doc.setFontSize(18);
  doc.text('사진으로 남은 기억', PRINT_MARGIN, 42);
  setColor(doc, PRINT_COLORS.muted);
  doc.setFontSize(8.5);
  doc.text('원본 사진의 GPS 좌표는 가족 공개 전 확인 상태로 처리합니다.', PRINT_MARGIN, 52);
  let y = 66;
  photos.slice(0, 4).forEach((photo, index) => {
    if (index > 0 && index % 2 === 0) {
      doc.addPage();
      renderPrintPageBackground(doc);
      y = 28;
    }
    const palette = index % 2 === 0 ? PRINT_COLORS.plate : [225, 234, 232] as const;
    setStroke(doc, PRINT_COLORS.line);
    setFill(doc, [255, 255, 255]);
    doc.roundedRect(PRINT_MARGIN, y, A5_WIDTH - PRINT_MARGIN * 2, 55, 3, 3, 'FD');
    setFill(doc, palette);
    doc.roundedRect(PRINT_MARGIN + 6, y + 7, 35, 35, 2, 2, 'F');
    setColor(doc, PRINT_COLORS.accentDark);
    doc.setFontSize(7);
    doc.text(`PHOTO ${String(index + 1).padStart(2, '0')}`, PRINT_MARGIN + 10, y + 24);
    doc.setFontSize(6.5);
    doc.text(photo.metadata?.cameraModel ?? 'ARCHIVE', PRINT_MARGIN + 10, y + 32);

    setColor(doc, PRINT_COLORS.ink);
    doc.setFontSize(9.5);
    const description = photo.analysis?.description ?? '사진 기록';
    doc.text(doc.splitTextToSize(description, 62), PRINT_MARGIN + 48, y + 15);
    setColor(doc, PRINT_COLORS.muted);
    doc.setFontSize(7.5);
    const meta = photo.metadata?.capturedAt?.slice(0, 10) ?? '촬영일 미상';
    doc.text(meta, PRINT_MARGIN + 48, y + 38);
    doc.text(`${photo.metadata?.inferredPlace ?? '장소 미상'} · GPS 공개 전 확인 필요`, PRINT_MARGIN + 48, y + 47);
    y += 66;
  });
}

function renderPrintClosing(doc: jsPDF, options: PrintReadyOptions): void {
  renderPrintPageBackground(doc);
  setFill(doc, PRINT_COLORS.accentDark);
  doc.rect(0, 0, A5_WIDTH, 28, 'F');
  setColor(doc, [255, 255, 255]);
  doc.setFontSize(8);
  doc.text('CLOSING LETTER', PRINT_MARGIN, 18);
  setColor(doc, PRINT_COLORS.ink);
  doc.setFontSize(19);
  doc.text('가족에게 전하는 말', PRINT_MARGIN, 54);
  const message = options.closingMessage ?? '서로의 안부를 자주 묻고, 힘든 날에는 먼저 손을 내밀어 주세요.';
  renderParagraph(doc, message, PRINT_MARGIN, 78, A5_WIDTH - PRINT_MARGIN * 2, 12.5, 2.0, A5_HEIGHT, PRINT_MARGIN);
  setStroke(doc, PRINT_COLORS.line);
  doc.line(PRINT_MARGIN, A5_HEIGHT - 42, A5_WIDTH - PRINT_MARGIN, A5_HEIGHT - 42);
  setColor(doc, PRINT_COLORS.muted);
  doc.setFontSize(8.5);
  doc.text(options.authorName, A5_WIDTH / 2, A5_HEIGHT - 31, { align: 'center' });
  doc.setFontSize(8);
  doc.text('Created with Dearlog', A5_WIDTH / 2, A5_HEIGHT - 24, { align: 'center' });
}

function renderParagraph(
  doc: jsPDF,
  body: string,
  x: number,
  startY: number,
  width: number,
  fontSize: number,
  lineHeight: number,
  pageHeight: number,
  margin: number,
): void {
  let y = startY;
  doc.setFontSize(fontSize);
  setColor(doc, PRINT_COLORS.ink);
  const lineHeightMm = fontSize * lineHeight * 0.352778;
  const lines = doc.splitTextToSize(body, width);
  for (const line of lines) {
    if (y + lineHeightMm > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
    doc.text(line, x, y);
    y += lineHeightMm;
  }
}

function addPrintPageNumbers(doc: jsPDF): void {
  const totalPages = doc.getNumberOfPages();
  doc.setFontSize(8);
  for (let i = 2; i <= totalPages; i++) {
    doc.setPage(i);
    doc.text(`${i - 1}`, A5_WIDTH / 2, A5_HEIGHT - 10, { align: 'center' });
  }
}

/**
 * Renders the table of contents page.
 */
function renderTableOfContents(
  doc: jsPDF,
  chapters: ChapterNarrative[],
  chapterPages: number[],
  config: PDFConfig
): void {
  const margin = config.pageMargin;
  const contentWidth = PAGE_WIDTH - margin * 2;
  let y = margin;

  // TOC heading
  doc.setFontSize(config.headingFontSize);
  doc.text('목차', PAGE_WIDTH / 2, y, { align: 'center' });
  y += 15;

  // Chapter entries
  doc.setFontSize(config.bodyFontSize);

  for (let i = 0; i < chapters.length; i++) {
    const chapter = chapters[i];
    const pageNum = chapterPages[i];

    // Check if we need a new page for TOC
    if (y > PAGE_HEIGHT - margin) {
      doc.addPage();
      y = margin;
    }

    const titleText = `${i + 1}. ${chapter.title}`;
    const pageText = `${pageNum}`;

    // Render chapter title on left, page number on right
    doc.text(titleText, margin, y);
    doc.text(pageText, PAGE_WIDTH - margin, y, { align: 'right' });

    // Dotted line between title and page number
    const titleWidth = doc.getTextWidth(titleText);
    const pageWidth = doc.getTextWidth(pageText);
    const dotsStart = margin + titleWidth + 2;
    const dotsEnd = PAGE_WIDTH - margin - pageWidth - 2;

    if (dotsEnd > dotsStart) {
      const dots = '.'.repeat(Math.floor((dotsEnd - dotsStart) / doc.getTextWidth('.')));
      doc.text(dots, dotsStart, y);
    }

    y += config.bodyFontSize * config.lineHeight * 0.5;
  }
}

/**
 * Renders a single chapter with heading and body text.
 */
function renderChapter(doc: jsPDF, chapter: ChapterNarrative, config: PDFConfig): void {
  const margin = config.pageMargin;
  const contentWidth = PAGE_WIDTH - margin * 2;
  let y = margin;

  // Chapter heading
  doc.setFontSize(config.headingFontSize);
  doc.text(chapter.title, margin, y);
  y += config.headingFontSize * 0.8;

  // Separator line
  doc.setLineWidth(0.3);
  doc.line(margin, y, PAGE_WIDTH - margin, y);
  y += 10;

  // Body text
  doc.setFontSize(config.bodyFontSize);
  const lineHeightMm = config.bodyFontSize * config.lineHeight * 0.352778; // pt to mm

  // Split body text into lines that fit the content width
  const lines = doc.splitTextToSize(chapter.body, contentWidth);

  for (const line of lines) {
    // Check if we need a new page
    if (y + lineHeightMm > PAGE_HEIGHT - margin) {
      doc.addPage();
      y = margin;
    }

    doc.text(line, margin, y);
    y += lineHeightMm;
  }
}

/**
 * Adds page numbers to all pages except the title page (page 1).
 */
function addPageNumbers(doc: jsPDF, config: PDFConfig): void {
  const totalPages = doc.getNumberOfPages();

  for (let i = 2; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(10);
    doc.text(`${i - 1}`, PAGE_WIDTH / 2, PAGE_HEIGHT - 15, { align: 'center' });
  }
}

/**
 * Estimates which page each chapter will start on.
 * Used for the table of contents. The TOC itself takes 1 page,
 * so chapters start from page 3 (title=1, TOC=2, first chapter=3).
 */
function estimateChapterPages(
  doc: jsPDF,
  chapters: ChapterNarrative[],
  config: PDFConfig
): number[] {
  const margin = config.pageMargin;
  const contentWidth = PAGE_WIDTH - margin * 2;
  const lineHeightMm = config.bodyFontSize * config.lineHeight * 0.352778;
  const usableHeight = PAGE_HEIGHT - margin * 2;

  // Title page = page 1, TOC = page 2, chapters start at page 3
  let currentPage = 3;
  const pages: number[] = [];

  for (const chapter of chapters) {
    pages.push(currentPage);

    // Estimate how many pages this chapter takes
    const headingSpace = config.headingFontSize * 0.8 + 10; // heading + separator
    doc.setFontSize(config.bodyFontSize);
    const lines = doc.splitTextToSize(chapter.body, contentWidth);
    const bodyHeight = lines.length * lineHeightMm;
    const totalHeight = headingSpace + bodyHeight;

    const pagesNeeded = Math.ceil(totalHeight / usableHeight);
    currentPage += Math.max(1, pagesNeeded);
  }

  return pages;
}

/**
 * Formats an ISO date string into a Korean-friendly display format.
 */
function formatDate(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    if (isNaN(date.getTime())) {
      return isoDate;
    }
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${year}년 ${month}월 ${day}일`;
  } catch {
    return isoDate;
  }
}
