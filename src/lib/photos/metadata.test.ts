import { describe, expect, it } from 'vitest';
import { extractExifMetadata, extractPhotoMetadata, inferCapturedAtFromFileName, inferPlaceFromFileName } from './metadata';

function writeAscii(view: DataView, offset: number, value: string) {
  [...value].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
}

function writeEntry(
  view: DataView,
  offset: number,
  tag: number,
  type: number,
  count: number,
  value: number
) {
  view.setUint16(offset, tag, true);
  view.setUint16(offset + 2, type, true);
  view.setUint32(offset + 4, count, true);
  view.setUint32(offset + 8, value, true);
}

function writeRational(view: DataView, offset: number, numerator: number, denominator: number) {
  view.setUint32(offset, numerator, true);
  view.setUint32(offset + 4, denominator, true);
}

function createJpegWithExif(): ArrayBuffer {
  const buffer = new ArrayBuffer(320);
  const view = new DataView(buffer);
  const tiffStart = 12;
  const ifd0 = tiffStart + 8;
  const makeOffset = 96;
  const modelOffset = 104;
  const dateOffset = 116;
  const gpsIfdRelative = 160;
  const gpsIfd = tiffStart + gpsIfdRelative;
  const gpsDataRelative = 224;
  const gpsData = tiffStart + gpsDataRelative;

  view.setUint16(0, 0xffd8);
  view.setUint16(2, 0xffe1);
  view.setUint16(4, 316);
  writeAscii(view, 6, 'Exif\0\0');
  writeAscii(view, tiffStart, 'II');
  view.setUint16(tiffStart + 2, 42, true);
  view.setUint32(tiffStart + 4, 8, true);

  view.setUint16(ifd0, 4, true);
  writeEntry(view, ifd0 + 2, 0x010f, 2, 6, makeOffset - tiffStart);
  writeEntry(view, ifd0 + 14, 0x0110, 2, 8, modelOffset - tiffStart);
  writeEntry(view, ifd0 + 26, 0x0132, 2, 20, dateOffset - tiffStart);
  writeEntry(view, ifd0 + 38, 0x8825, 4, 1, gpsIfdRelative);
  writeAscii(view, makeOffset, 'Canon\0');
  writeAscii(view, modelOffset, 'EOS 80D\0');
  writeAscii(view, dateOffset, '2020:01:02 03:04:05\0');

  view.setUint16(gpsIfd, 4, true);
  writeEntry(view, gpsIfd + 2, 0x0001, 2, 2, 'N'.charCodeAt(0));
  writeEntry(view, gpsIfd + 14, 0x0002, 5, 3, gpsDataRelative);
  writeEntry(view, gpsIfd + 26, 0x0003, 2, 2, 'E'.charCodeAt(0));
  writeEntry(view, gpsIfd + 38, 0x0004, 5, 3, gpsDataRelative + 24);
  writeRational(view, gpsData, 37, 1);
  writeRational(view, gpsData + 8, 30, 1);
  writeRational(view, gpsData + 16, 0, 1);
  writeRational(view, gpsData + 24, 127, 1);
  writeRational(view, gpsData + 32, 0, 1);
  writeRational(view, gpsData + 40, 0, 1);

  return buffer;
}

describe('photo metadata helpers', () => {
  it('infers captured date and place hints from file names', () => {
    expect(inferCapturedAtFromFileName('2020-01-02_place-욕실.jpg')).toBe('2020-01-02T00:00:00.000Z');
    expect(inferCapturedAtFromFileName('IMG_20200102.jpg')).toBe('2020-01-02T00:00:00.000Z');
    expect(inferPlaceFromFileName('2020-01-02_place-욕실.jpg')).toBe('욕실');
  });

  it('extracts browser-safe file metadata without requiring EXIF access', async () => {
    const file = new File(['hello'], '20200102_@서울역.jpg', {
      type: 'image/jpeg',
      lastModified: Date.parse('2024-03-04T00:00:00.000Z'),
    });

    await expect(extractPhotoMetadata(file)).resolves.toMatchObject({
      fileName: '20200102_@서울역.jpg',
      fileType: 'image/jpeg',
      fileSize: 5,
      lastModified: '2024-03-04T00:00:00.000Z',
      capturedAt: '2020-01-02T00:00:00.000Z',
      inferredPlace: '서울역',
      capturedAtSource: 'fileName',
    });
  });

  it('extracts EXIF capture date, camera model, and GPS when JPEG metadata is available', async () => {
    const exif = extractExifMetadata(createJpegWithExif());
    expect(exif).toMatchObject({
      capturedAt: '2020-01-02T03:04:05.000Z',
      cameraMake: 'Canon',
      cameraModel: 'EOS 80D',
      gpsLatitude: 37.5,
      gpsLongitude: 127,
    });

    const file = new File([createJpegWithExif()], 'no-date.jpg', {
      type: 'image/jpeg',
      lastModified: Date.parse('2024-03-04T00:00:00.000Z'),
    });

    await expect(extractPhotoMetadata(file)).resolves.toMatchObject({
      capturedAt: '2020-01-02T03:04:05.000Z',
      capturedAtSource: 'exif',
      cameraMake: 'Canon',
      cameraModel: 'EOS 80D',
      gpsLatitude: 37.5,
      gpsLongitude: 127,
    });
  });
});
