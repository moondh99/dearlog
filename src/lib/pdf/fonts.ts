/**
 * Korean font registration for jsPDF.
 *
 * Noto Sans KR is required for proper Hangul rendering in PDF output.
 * Since embedding the full font as base64 in source code is impractical (~4MB+),
 * this module provides a registration function that loads the font at runtime.
 *
 * In production, the font file should be served as a static asset and fetched
 * when PDF generation is requested. For development/testing, the generator
 * will fall back to jsPDF's default font with a warning.
 */

import type { jsPDF } from 'jspdf';

/** Path to the Noto Sans KR font file (served as a static asset) */
export const KOREAN_FONT_URL = '/fonts/NotoSansKR-Regular.ttf';

/** Font family name used in jsPDF */
export const KOREAN_FONT_FAMILY = 'NotoSansKR';

/** Font style */
export const KOREAN_FONT_STYLE = 'normal';

/**
 * Registers the Korean font (Noto Sans KR) with a jsPDF document instance.
 *
 * Attempts to load the font from the configured URL. If loading fails,
 * the document will use jsPDF's default font (which does not support Hangul).
 *
 * @param doc - The jsPDF document instance to register the font with
 * @returns true if the font was successfully registered, false otherwise
 */
export async function registerKoreanFont(doc: jsPDF): Promise<boolean> {
  try {
    const response = await fetch(KOREAN_FONT_URL);

    if (!response.ok) {
      console.warn(
        `[PDF] 한국어 폰트를 불러올 수 없습니다 (${response.status}). 기본 폰트를 사용합니다.`
      );
      return false;
    }

    const fontBuffer = await response.arrayBuffer();
    const fontBase64 = arrayBufferToBase64(fontBuffer);

    doc.addFileToVFS('NotoSansKR-Regular.ttf', fontBase64);
    doc.addFont('NotoSansKR-Regular.ttf', KOREAN_FONT_FAMILY, KOREAN_FONT_STYLE);
    doc.setFont(KOREAN_FONT_FAMILY, KOREAN_FONT_STYLE);

    return true;
  } catch (error) {
    console.warn('[PDF] 폰트 등록 중 오류가 발생했습니다. 기본 폰트를 사용합니다.', error);
    return false;
  }
}

/**
 * Converts an ArrayBuffer to a base64-encoded string.
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
