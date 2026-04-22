import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';
import { sanitizeText } from '../../lib/html.js';

export async function parseCvBuffer(buffer, mimeType) {
  if (mimeType === 'application/pdf') {
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const result = await parser.getText();
      return sanitizeText(result.text || '').trim();
    } finally {
      await parser.destroy().catch(() => {});
    }
  }
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/msword'
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return sanitizeText(result.value || '').trim();
  }
  throw { status: 400, message: `Unsupported CV mime type: ${mimeType}` };
}
