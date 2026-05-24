import { jsPDF } from 'jspdf';
import { prisma } from './db';
import { writeLocalFile } from './storage';

export async function generateLocalPrintPdf(input: {
  seniorId: string;
  coverDesignId?: string | null;
  format: 'A5' | 'B5';
}) {
  const [senior, records, cover, chapters] = await Promise.all([
    prisma.user.findUnique({ where: { id: input.seniorId } }),
    prisma.interviewRecord.findMany({
      where: { userId: input.seniorId },
      orderBy: { recordedAt: 'asc' },
      include: { chapter: true },
    }),
    input.coverDesignId ? prisma.coverDesign.findUnique({ where: { id: input.coverDesignId } }) : null,
    prisma.chapter.findMany({ orderBy: { order: 'asc' } }),
  ]);

  const doc = new jsPDF({ unit: 'mm', format: input.format.toLowerCase() as 'a5' | 'b5' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFillColor(246, 241, 233);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');
  doc.setFontSize(24);
  doc.text('나의 이야기', pageWidth / 2, 54, { align: 'center' });
  doc.setFontSize(12);
  doc.text(senior?.name ?? '시니어', pageWidth / 2, 74, { align: 'center' });
  doc.setFontSize(9);
  doc.text(`표지: ${cover?.palette ?? 'warm_archive'} / ${cover?.template ?? 'letterpress'} / ${cover?.font ?? '명조체'}`, pageWidth / 2, pageHeight - 30, { align: 'center' });

  for (const chapter of chapters) {
    const chapterRecords = records.filter((record) => record.chapterId === chapter.id);
    if (chapterRecords.length === 0) continue;
    doc.addPage();
    doc.setFontSize(17);
    doc.text(chapter.title, 16, 24);
    doc.setFontSize(10);
    let y = 38;
    const lines = doc.splitTextToSize(chapterRecords.map((record) => record.transcriptText).join('\n\n'), pageWidth - 32);
    for (const line of lines) {
      if (y > pageHeight - 18) {
        doc.addPage();
        y = 20;
      }
      doc.text(line, 16, y);
      y += 6;
    }
  }

  const bytes = new Uint8Array(doc.output('arraybuffer'));
  return writeLocalFile('pdfs', bytes, 'pdf');
}
