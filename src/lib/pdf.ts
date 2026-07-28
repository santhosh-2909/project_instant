/**
 * Minimal, dependency-free PDF writer.
 *
 * Produces a genuine PDF 1.4 byte stream so "Download PDF" actually downloads a
 * PDF (audit finding P1-9 / §7.1: the old button only showed a success toast
 * and downloaded nothing).
 *
 * Scope is deliberately small — text, headings, rules and wrapping on A4 with
 * the standard Helvetica family. That covers a verification report without
 * pulling in a rendering library.
 */

const PAGE_WIDTH = 595.28; // A4 @ 72dpi
const PAGE_HEIGHT = 841.89;
const MARGIN = 56;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

export type PdfFont = 'regular' | 'bold' | 'oblique';

const FONT_RESOURCE: Record<PdfFont, string> = {
  regular: '/F1',
  bold: '/F2',
  oblique: '/F3',
};

/**
 * Average glyph widths for Helvetica as a fraction of font size. Close enough
 * for wrapping; exact metrics would need the full AFM table.
 */
const CHAR_WIDTH: Record<PdfFont, number> = {
  regular: 0.5,
  bold: 0.54,
  oblique: 0.5,
};

export interface TextOptions {
  font?: PdfFont;
  size?: number;
  /** Extra space above the block. */
  spaceBefore?: number;
  /** Extra space below the block. */
  spaceAfter?: number;
  /** Grey level 0 (black) … 1 (white). */
  grey?: number;
  indent?: number;
}

/** Escapes a string for a PDF literal and drops characters outside WinAnsi. */
function escapeText(text: string): string {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/[^\x20-\x7E]/g, '') // keep it to printable ASCII
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

export function wrapText(text: string, font: PdfFont, size: number, maxWidth: number): string[] {
  const perChar = CHAR_WIDTH[font] * size;
  const maxChars = Math.max(8, Math.floor(maxWidth / perChar));
  const lines: string[] = [];

  for (const paragraph of String(text ?? '').split('\n')) {
    if (paragraph.trim() === '') {
      lines.push('');
      continue;
    }

    let current = '';
    for (const word of paragraph.split(/\s+/)) {
      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length <= maxChars) {
        current = candidate;
      } else {
        if (current) lines.push(current);
        // A single word longer than the line gets hard-split.
        let remainder = word;
        while (remainder.length > maxChars) {
          lines.push(remainder.slice(0, maxChars));
          remainder = remainder.slice(maxChars);
        }
        current = remainder;
      }
    }
    if (current) lines.push(current);
  }

  return lines;
}

export class PdfDocument {
  private pages: string[] = [];
  private current: string[] = [];
  private cursorY = PAGE_HEIGHT - MARGIN;

  private newPage() {
    if (this.current.length > 0) {
      this.pages.push(this.current.join('\n'));
      this.current = [];
    }
    this.cursorY = PAGE_HEIGHT - MARGIN;
  }

  private ensureSpace(needed: number) {
    if (this.cursorY - needed < MARGIN) this.newPage();
  }

  text(content: string, options: TextOptions = {}): this {
    const { font = 'regular', size = 10, spaceBefore = 0, spaceAfter = 6, grey = 0.2, indent = 0 } = options;

    this.cursorY -= spaceBefore;
    const leading = size * 1.42;
    const lines = wrapText(content, font, size, CONTENT_WIDTH - indent);

    for (const line of lines) {
      this.ensureSpace(leading);
      if (line !== '') {
        this.current.push(
          `BT ${FONT_RESOURCE[font]} ${size} Tf ${grey} g ${MARGIN + indent} ${this.cursorY.toFixed(2)} Td (${escapeText(line)}) Tj ET`
        );
      }
      this.cursorY -= leading;
    }

    this.cursorY -= spaceAfter;
    return this;
  }

  heading(content: string, size = 16): this {
    return this.text(content, { font: 'bold', size, grey: 0.1, spaceBefore: 10, spaceAfter: 8 });
  }

  label(content: string): this {
    return this.text(content.toUpperCase(), { font: 'bold', size: 7.5, grey: 0.45, spaceAfter: 3 });
  }

  rule(): this {
    this.ensureSpace(14);
    this.cursorY -= 6;
    this.current.push(
      `0.82 G 0.8 w ${MARGIN} ${this.cursorY.toFixed(2)} m ${PAGE_WIDTH - MARGIN} ${this.cursorY.toFixed(2)} l S`
    );
    this.cursorY -= 12;
    return this;
  }

  spacer(height = 10): this {
    this.cursorY -= height;
    return this;
  }

  /** Two-column key/value row, used for the report fact strip. */
  keyValue(key: string, value: string): this {
    const leading = 14;
    this.ensureSpace(leading);
    this.current.push(
      `BT /F1 9 Tf 0.42 g ${MARGIN} ${this.cursorY.toFixed(2)} Td (${escapeText(key)}) Tj ET`
    );
    this.current.push(
      `BT /F2 9 Tf 0.15 g ${MARGIN + 170} ${this.cursorY.toFixed(2)} Td (${escapeText(value)}) Tj ET`
    );
    this.cursorY -= leading;
    return this;
  }

  /** Serialises the document to PDF bytes. */
  build(): Uint8Array {
    this.newPage();
    const pageCount = Math.max(1, this.pages.length);

    const objects: string[] = [];
    const fontObjectStart = 3 + pageCount * 2;

    // 1 catalog, 2 pages tree
    const kids = Array.from({ length: pageCount }, (_, i) => `${3 + i * 2} 0 R`).join(' ');
    objects.push('<< /Type /Catalog /Pages 2 0 R >>');
    objects.push(`<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>`);

    for (let i = 0; i < pageCount; i++) {
      const contentRef = 4 + i * 2;
      objects.push(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
          `/Resources << /Font << /F1 ${fontObjectStart} 0 R /F2 ${fontObjectStart + 1} 0 R /F3 ${fontObjectStart + 2} 0 R >> >> ` +
          `/Contents ${contentRef} 0 R >>`
      );
      const stream = this.pages[i] ?? '';
      objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    }

    objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>');

    let pdf = '%PDF-1.4\n';
    const offsets: number[] = [];

    objects.forEach((body, index) => {
      offsets.push(pdf.length);
      pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
    });

    const xrefOffset = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const offset of offsets) {
      pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

    const bytes = new Uint8Array(pdf.length);
    for (let i = 0; i < pdf.length; i++) bytes[i] = pdf.charCodeAt(i) & 0xff;
    return bytes;
  }
}
