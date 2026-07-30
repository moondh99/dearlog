import type { PhotoMetadata } from '../types';

const DATE_PATTERNS = [
  /(?<year>20\d{2}|19\d{2})[-_.]?(?<month>0[1-9]|1[0-2])[-_.]?(?<day>0[1-9]|[12]\d|3[01])/,
  /(?<year>20\d{2}|19\d{2})[-_.](?<month>[1-9]|1[0-2])[-_.](?<day>[1-9]|[12]\d|3[01])/,
];

const PLACE_HINT_PATTERN = /(?:@|place-|장소-)(?<place>[가-힣A-Za-z0-9_-]+)/;

type ExifMetadata = Pick<
  PhotoMetadata,
  'capturedAt' | 'cameraMake' | 'cameraModel' | 'gpsLatitude' | 'gpsLongitude'
>;
type PartialExifMetadata = Partial<ExifMetadata>;

const TIFF_TYPE_SIZE: Record<number, number> = {
  1: 1,
  2: 1,
  3: 2,
  4: 4,
  5: 8,
};

/**
 * 원본 GPS 좌표 대신 화면/태그/PDF에 노출하는 마스킹 문구.
 * (기술설명서 7절 · ArchivePage/tag-db/pdf 에서 쓰는 문구와 동일)
 */
export const GPS_MASK_LABEL = '공개 전 확인 필요';

function toIsoDate(year: string, month: string, day: string): string {
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00.000Z`;
}

function parseExifDate(value: string | null): string | null {
  const match = value?.trim().match(/^(?<year>\d{4}):(?<month>\d{2}):(?<day>\d{2})(?: (?<hour>\d{2}):(?<minute>\d{2}):(?<second>\d{2}))?/);
  if (!match?.groups) return null;
  const { year, month, day, hour = '00', minute = '00', second = '00' } = match.groups;
  return `${year}-${month}-${day}T${hour}:${minute}:${second}.000Z`;
}

export function inferCapturedAtFromFileName(fileName: string): string | null {
  for (const pattern of DATE_PATTERNS) {
    const match = fileName.match(pattern);
    if (match?.groups) {
      return toIsoDate(match.groups.year, match.groups.month, match.groups.day);
    }
  }
  return null;
}

export function inferPlaceFromFileName(fileName: string): string | null {
  const match = fileName.match(PLACE_HINT_PATTERN);
  const place = match?.groups?.place
    ?.replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .trim();
  return place || null;
}

function readAscii(view: DataView, offset: number, count: number): string | null {
  if (offset < 0 || offset + count > view.byteLength) return null;
  const chars: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const code = view.getUint8(offset + index);
    if (code === 0) break;
    chars.push(String.fromCharCode(code));
  }
  const value = chars.join('').trim();
  return value || null;
}

function readUnsigned(view: DataView, offset: number, type: number, littleEndian: boolean): number | null {
  if (type === 3 && offset + 2 <= view.byteLength) return view.getUint16(offset, littleEndian);
  if (type === 4 && offset + 4 <= view.byteLength) return view.getUint32(offset, littleEndian);
  return null;
}

function readRational(view: DataView, offset: number, littleEndian: boolean): number | null {
  if (offset + 8 > view.byteLength) return null;
  const numerator = view.getUint32(offset, littleEndian);
  const denominator = view.getUint32(offset + 4, littleEndian);
  return denominator === 0 ? null : numerator / denominator;
}

function readValueOffset(
  view: DataView,
  tiffStart: number,
  entryOffset: number,
  type: number,
  count: number,
  littleEndian: boolean
): number | null {
  const size = TIFF_TYPE_SIZE[type];
  if (!size) return null;
  const byteLength = size * count;
  const offset = byteLength <= 4
    ? entryOffset + 8
    : tiffStart + view.getUint32(entryOffset + 8, littleEndian);
  return offset >= 0 && offset + byteLength <= view.byteLength ? offset : null;
}

function readExifString(
  view: DataView,
  tiffStart: number,
  entryOffset: number,
  count: number,
  littleEndian: boolean
): string | null {
  const valueOffset = readValueOffset(view, tiffStart, entryOffset, 2, count, littleEndian);
  return valueOffset === null ? null : readAscii(view, valueOffset, count);
}

function readGpsCoordinate(
  view: DataView,
  tiffStart: number,
  entryOffset: number,
  count: number,
  littleEndian: boolean
): number | null {
  const valueOffset = readValueOffset(view, tiffStart, entryOffset, 5, count, littleEndian);
  if (valueOffset === null || count < 3) return null;
  const degrees = readRational(view, valueOffset, littleEndian);
  const minutes = readRational(view, valueOffset + 8, littleEndian);
  const seconds = readRational(view, valueOffset + 16, littleEndian);
  if (degrees === null || minutes === null || seconds === null) return null;
  return degrees + minutes / 60 + seconds / 3600;
}

function readIfd(
  view: DataView,
  tiffStart: number,
  ifdOffset: number,
  littleEndian: boolean
): Map<number, { type: number; count: number; entryOffset: number }> {
  const entries = new Map<number, { type: number; count: number; entryOffset: number }>();
  const absoluteOffset = tiffStart + ifdOffset;
  if (absoluteOffset < 0 || absoluteOffset + 2 > view.byteLength) return entries;

  const entryCount = view.getUint16(absoluteOffset, littleEndian);
  for (let index = 0; index < entryCount; index += 1) {
    const entryOffset = absoluteOffset + 2 + index * 12;
    if (entryOffset + 12 > view.byteLength) break;
    entries.set(view.getUint16(entryOffset, littleEndian), {
      type: view.getUint16(entryOffset + 2, littleEndian),
      count: view.getUint32(entryOffset + 4, littleEndian),
      entryOffset,
    });
  }
  return entries;
}

function readIfdPointer(
  view: DataView,
  entry: { type: number; entryOffset: number } | undefined,
  littleEndian: boolean
): number | null {
  if (!entry) return null;
  return readUnsigned(view, entry.entryOffset + 8, entry.type, littleEndian);
}

export function extractExifMetadata(arrayBuffer: ArrayBuffer): PartialExifMetadata {
  const view = new DataView(arrayBuffer);
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return {};

  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    if (view.getUint8(offset) !== 0xff) break;
    const marker = view.getUint8(offset + 1);
    const segmentLength = view.getUint16(offset + 2);
    const segmentStart = offset + 4;
    const segmentEnd = offset + 2 + segmentLength;

    if (marker === 0xe1 && segmentEnd <= view.byteLength && readAscii(view, segmentStart, 6) === 'Exif') {
      const tiffStart = segmentStart + 6;
      const byteOrder = readAscii(view, tiffStart, 2);
      const littleEndian = byteOrder === 'II';
      if (!littleEndian && byteOrder !== 'MM') return {};
      if (view.getUint16(tiffStart + 2, littleEndian) !== 42) return {};

      const rootIfdOffset = view.getUint32(tiffStart + 4, littleEndian);
      const rootIfd = readIfd(view, tiffStart, rootIfdOffset, littleEndian);
      const exifIfdPointer = readIfdPointer(view, rootIfd.get(0x8769), littleEndian);
      const gpsIfdPointer = readIfdPointer(view, rootIfd.get(0x8825), littleEndian);
      const exifIfd = exifIfdPointer === null ? new Map() : readIfd(view, tiffStart, exifIfdPointer, littleEndian);
      const gpsIfd = gpsIfdPointer === null ? new Map() : readIfd(view, tiffStart, gpsIfdPointer, littleEndian);

      const makeEntry = rootIfd.get(0x010f);
      const modelEntry = rootIfd.get(0x0110);
      const rootDateEntry = rootIfd.get(0x0132);
      const originalDateEntry = exifIfd.get(0x9003) ?? exifIfd.get(0x9004);
      const dateEntry = originalDateEntry ?? rootDateEntry;
      const latRefEntry = gpsIfd.get(0x0001);
      const latEntry = gpsIfd.get(0x0002);
      const lonRefEntry = gpsIfd.get(0x0003);
      const lonEntry = gpsIfd.get(0x0004);

      const latitude = latEntry
        ? readGpsCoordinate(view, tiffStart, latEntry.entryOffset, latEntry.count, littleEndian)
        : null;
      const longitude = lonEntry
        ? readGpsCoordinate(view, tiffStart, lonEntry.entryOffset, lonEntry.count, littleEndian)
        : null;
      const latRef = latRefEntry ? readExifString(view, tiffStart, latRefEntry.entryOffset, latRefEntry.count, littleEndian) : null;
      const lonRef = lonRefEntry ? readExifString(view, tiffStart, lonRefEntry.entryOffset, lonRefEntry.count, littleEndian) : null;

      return {
        capturedAt: dateEntry
          ? parseExifDate(readExifString(view, tiffStart, dateEntry.entryOffset, dateEntry.count, littleEndian))
          : null,
        cameraMake: makeEntry ? readExifString(view, tiffStart, makeEntry.entryOffset, makeEntry.count, littleEndian) : null,
        cameraModel: modelEntry ? readExifString(view, tiffStart, modelEntry.entryOffset, modelEntry.count, littleEndian) : null,
        gpsLatitude: latitude === null ? null : (latRef === 'S' ? -latitude : latitude),
        gpsLongitude: longitude === null ? null : (lonRef === 'W' ? -longitude : longitude),
      };
    }

    offset = segmentEnd;
  }

  return {};
}

function isJpegFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return file.type === 'image/jpeg' || name.endsWith('.jpg') || name.endsWith('.jpeg');
}

export async function extractPhotoMetadata(photoData: string | File, now: Date = new Date()): Promise<PhotoMetadata> {
  if (typeof photoData === 'string') {
    return {
      fileName: null,
      fileType: photoData.startsWith('data:image/') ? photoData.slice(5, photoData.indexOf(';')) : null,
      fileSize: null,
      lastModified: null,
      capturedAt: null,
      inferredPlace: null,
      capturedAtSource: null,
      cameraMake: null,
      cameraModel: null,
      gpsLatitude: null,
      gpsLongitude: null,
    };
  }

  const lastModified = Number.isFinite(photoData.lastModified)
    ? new Date(photoData.lastModified).toISOString()
    : now.toISOString();
  const fileNameCapturedAt = inferCapturedAtFromFileName(photoData.name);
  const exif: PartialExifMetadata = isJpegFile(photoData)
    ? extractExifMetadata(await photoData.arrayBuffer())
    : {};
  const capturedAt = exif.capturedAt ?? fileNameCapturedAt;

  return {
    fileName: photoData.name,
    fileType: photoData.type || null,
    fileSize: photoData.size,
    lastModified,
    capturedAt,
    inferredPlace: inferPlaceFromFileName(photoData.name),
    capturedAtSource: exif.capturedAt ? 'exif' : fileNameCapturedAt ? 'fileName' : null,
    cameraMake: exif.cameraMake ?? null,
    cameraModel: exif.cameraModel ?? null,
    gpsLatitude: exif.gpsLatitude ?? null,
    gpsLongitude: exif.gpsLongitude ?? null,
  };
}

// ─── 민감정보(GPS) 마스킹 ─────────────────────────────────────────────────────

export type MaskedPhotoMetadata = PhotoMetadata & {
  /** 원본 사진에 GPS 좌표가 있었고 마스킹으로 제거했는지 여부 */
  gpsMasked: boolean;
  /** 화면/태그/PDF에 노출할 위치 문구 (좌표가 있었다면 마스킹 문구) */
  locationLabel: string | null;
};

export function hasGpsCoordinates(metadata: Pick<PhotoMetadata, 'gpsLatitude' | 'gpsLongitude'>): boolean {
  return typeof metadata.gpsLatitude === 'number' && typeof metadata.gpsLongitude === 'number';
}

/**
 * 원본 좌표를 지우고 `공개 전 확인 필요` 문구로 대체한다.
 * 좌표가 없던 사진은 문구 없이 그대로 통과시킨다.
 */
export function maskSensitivePhotoMetadata(metadata: PhotoMetadata): MaskedPhotoMetadata {
  const gpsMasked = hasGpsCoordinates(metadata);
  return {
    ...metadata,
    gpsLatitude: null,
    gpsLongitude: null,
    gpsMasked,
    locationLabel: gpsMasked ? GPS_MASK_LABEL : null,
  };
}

/**
 * 사용자가 입력한 장소 텍스트와 마스킹 문구를 합친다.
 * (PDF 생성기의 `장소 · GPS 공개 전 확인 필요` 표기 규칙과 동일한 형태)
 */
export function buildMaskedLocationText(userLocation: string | null | undefined, gpsMasked: boolean): string {
  const location = (userLocation ?? '').trim();
  if (!gpsMasked) return location;
  if (!location) return GPS_MASK_LABEL;
  return location.includes(GPS_MASK_LABEL) ? location : `${location} · ${GPS_MASK_LABEL}`;
}

export function isGpsMaskedLocationText(value: unknown): boolean {
  return typeof value === 'string' && value.includes(GPS_MASK_LABEL);
}

/**
 * JPEG 바이트열에서 EXIF(APP1 `Exif\0\0`) 세그먼트를 제거한다.
 * 제거할 세그먼트가 없으면 `null` 을 반환한다(원본을 그대로 쓰라는 뜻).
 */
export function stripJpegExifSegments(arrayBuffer: ArrayBuffer): ArrayBuffer | null {
  const view = new DataView(arrayBuffer);
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null;

  const source = new Uint8Array(arrayBuffer);
  const keptRanges: Array<[number, number]> = [];
  let keepFrom = 0;
  let offset = 2;
  let removed = false;

  while (offset + 4 <= view.byteLength) {
    if (view.getUint8(offset) !== 0xff) break;
    const marker = view.getUint8(offset + 1);
    if (marker === 0xda || marker === 0xd9) break; // SOS / EOI 이후는 이미지 데이터
    const segmentLength = view.getUint16(offset + 2);
    if (segmentLength < 2) break;
    const segmentEnd = offset + 2 + segmentLength;
    if (segmentEnd > view.byteLength) break;

    if (marker === 0xe1 && readAscii(view, offset + 4, 6) === 'Exif') {
      keptRanges.push([keepFrom, offset]);
      keepFrom = segmentEnd;
      removed = true;
    }

    offset = segmentEnd;
  }

  if (!removed) return null;
  keptRanges.push([keepFrom, view.byteLength]);

  const totalLength = keptRanges.reduce((sum, [start, end]) => sum + (end - start), 0);
  const output = new Uint8Array(totalLength);
  let written = 0;
  for (const [start, end] of keptRanges) {
    output.set(source.subarray(start, end), written);
    written += end - start;
  }
  return output.buffer as ArrayBuffer;
}

export type SanitizedPhotoUpload = {
  /** 업로드에 사용할 파일. EXIF 를 지운 경우 새 File, 지울 것이 없으면 원본 File */
  file: File;
  /** 좌표가 제거된 메타데이터 */
  metadata: MaskedPhotoMetadata;
  /** 좌표가 있어서 마스킹했는지 여부 */
  gpsMasked: boolean;
};

/**
 * 업로드 직전에 호출한다. 원본 GPS 좌표가 서버로 올라가지 않도록
 * (1) 메타데이터의 좌표를 마스킹하고 (2) JPEG 바이트열의 EXIF 세그먼트를 제거한다.
 */
export async function sanitizePhotoForUpload(file: File, now: Date = new Date()): Promise<SanitizedPhotoUpload> {
  const metadata = maskSensitivePhotoMetadata(await extractPhotoMetadata(file, now));
  let sanitizedFile = file;

  if (isJpegFile(file)) {
    try {
      const stripped = stripJpegExifSegments(await file.arrayBuffer());
      if (stripped) {
        sanitizedFile = new File([stripped], file.name, {
          type: file.type || 'image/jpeg',
          lastModified: file.lastModified,
        });
      }
    } catch (error) {
      console.error('Photo metadata: EXIF 제거 실패', error);
    }
  }

  return {
    file: sanitizedFile,
    metadata: { ...metadata, fileSize: sanitizedFile.size },
    gpsMasked: metadata.gpsMasked,
  };
}
