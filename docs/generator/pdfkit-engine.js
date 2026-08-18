/**
 * Shared PDF rendering engine for CareBridge handover documentation.
 *
 * Documents are authored as plain-JS block arrays (see ./documents/*.js) and
 * rendered here so every deliverable shares one visual identity: cover page,
 * table of contents, numbered headings, tables, and page furniture.
 *
 * Usage:  node docs/generator/build.js
 */

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// --- Design tokens -----------------------------------------------------------

const C = {
  brand: '#1d4ed8',
  brandDark: '#1e3a8a',
  ink: '#0f172a',
  body: '#334155',
  muted: '#64748b',
  faint: '#94a3b8',
  rule: '#e2e8f0',
  band: '#f1f5f9',
  ok: '#059669',
  warn: '#b45309',
  danger: '#b91c1c',
};

const F = {
  regular: 'Helvetica',
  bold: 'Helvetica-Bold',
  italic: 'Helvetica-Oblique',
};

const PAGE = { margin: 56, width: 595.28, height: 841.89 };
const CONTENT_W = PAGE.width - PAGE.margin * 2;
const FOOTER_Y = PAGE.height - 42;
// Body content must stop above the footer rule, otherwise text collides with it.
const BODY_BOTTOM = FOOTER_Y - 16;

// --- Renderer ----------------------------------------------------------------

class DocBuilder {
  constructor(meta) {
    this.meta = meta;
    this.doc = new PDFDocument({
      size: 'A4',
      margin: PAGE.margin,
      bufferPages: true,
      autoFirstPage: false,
      info: {
        Title: meta.title,
        Author: 'CareBridge Health',
        Subject: meta.subtitle || '',
        Keywords: 'CareBridge, healthcare referral, handover documentation',
      },
    });
    this.toc = [];
    this.h1 = 0;
    this.h2 = 0;
    this.h3 = 0;
    // Pages 1 (cover) and 2 (TOC) carry no header/footer furniture.
    this.frontMatterPages = 2;
  }

  // -- low-level helpers ------------------------------------------------------

  get y() { return this.doc.y; }
  set y(v) { this.doc.y = v; }

  /** Start a new page when `needed` points of vertical space are unavailable. */
  ensure(needed) {
    if (this.doc.y + needed > BODY_BOTTOM) this.newPage();
  }

  newPage() {
    this.doc.addPage();
    this.doc.y = PAGE.margin + 26; // clearance for the running header
  }

  rule(color = C.rule, width = 1) {
    this.doc.strokeColor(color).lineWidth(width)
      .moveTo(PAGE.margin, this.doc.y).lineTo(PAGE.width - PAGE.margin, this.doc.y).stroke();
  }

  // -- blocks -----------------------------------------------------------------

  cover() {
    const d = this.doc;
    d.addPage();

    d.rect(0, 0, PAGE.width, 200).fill(C.brand);
    d.fillColor('#ffffff').font(F.bold).fontSize(30)
      .text('CareBridge', PAGE.margin, 74);
    d.font(F.regular).fontSize(13).fillColor('#dbeafe')
      .text('Healthcare Referral & Settlement Platform', PAGE.margin, 114);

    d.fillColor(C.ink).font(F.bold).fontSize(26)
      .text(this.meta.title, PAGE.margin, 290, { width: CONTENT_W, lineGap: 4 });

    if (this.meta.subtitle) {
      d.moveDown(0.5);
      d.font(F.regular).fontSize(13).fillColor(C.muted)
        .text(this.meta.subtitle, { width: CONTENT_W, lineGap: 3 });
    }

    d.y = 470;
    this.rule(C.brand, 2);
    d.moveDown(1.4);

    const rows = [
      ['Document reference', this.meta.ref],
      ['Version', this.meta.version],
      ['Date of issue', this.meta.date],
      ['Prepared for', this.meta.client],
      ['Prepared by', this.meta.author],
      ['Classification', this.meta.classification],
    ];
    for (const [k, v] of rows) {
      const top = d.y;
      d.font(F.bold).fontSize(10).fillColor(C.muted)
        .text(k.toUpperCase(), PAGE.margin, top, { width: 160 });
      d.font(F.regular).fontSize(11).fillColor(C.ink)
        .text(v, PAGE.margin + 170, top, { width: CONTENT_W - 170 });
      d.y = Math.max(d.y, top + 20);
    }

    d.font(F.regular).fontSize(8.5).fillColor(C.faint)
      .text(
        `© ${new Date(this.meta.date).getFullYear()} CareBridge Health. ` +
        'This document is provided to the client named above as part of the project handover package.',
        PAGE.margin, PAGE.height - 96, { width: CONTENT_W, align: 'center' },
      );
  }

  /**
   * Reserve `count` pages for the TOC; entries are painted in finalize() once
   * page numbers are known. The count is decided up front (see render) because
   * reserving pages later would shift every number already recorded.
   */
  tocPlaceholder(count = 1) {
    this.tocPageIndex = this.doc.bufferedPageRange().count;
    this.tocPageCount = count;
    for (let i = 0; i < count; i++) this.doc.addPage();
    this.frontMatterPages = 1 + count; // cover + TOC pages carry no furniture
  }

  h(level, text) {
    const d = this.doc;
    if (level === 1) {
      // Every top-level section opens a fresh page.
      if (this.h1 > 0) this.newPage(); else { d.addPage(); d.y = PAGE.margin + 26; }
      this.h1 += 1; this.h2 = 0; this.h3 = 0;
      const num = String(this.h1);
      this.toc.push({ level, num, text, page: d.bufferedPageRange().count });
      d.font(F.bold).fontSize(19).fillColor(C.brandDark)
        .text(`${num}.  ${text}`, { width: CONTENT_W });
      d.moveDown(0.35);
      this.rule(C.brand, 2);
      d.moveDown(0.9);
      return;
    }
    if (level === 2) {
      this.ensure(70);
      this.h2 += 1; this.h3 = 0;
      const num = `${this.h1}.${this.h2}`;
      this.toc.push({ level, num, text, page: d.bufferedPageRange().count });
      d.moveDown(0.5);
      d.font(F.bold).fontSize(13.5).fillColor(C.ink)
        .text(`${num}  ${text}`, { width: CONTENT_W });
      d.moveDown(0.45);
      return;
    }
    this.ensure(56);
    this.h3 += 1;
    d.moveDown(0.35);
    d.font(F.bold).fontSize(11).fillColor(C.brand)
      .text(`${this.h1}.${this.h2}.${this.h3}  ${text}`, { width: CONTENT_W });
    d.moveDown(0.35);
  }

  p(text, opts = {}) {
    this.ensure(34);
    this.doc.font(opts.bold ? F.bold : F.regular).fontSize(10.5)
      .fillColor(opts.color || C.body)
      .text(text, { width: CONTENT_W, align: opts.align || 'justify', lineGap: 2.6 });
    this.doc.moveDown(0.6);
  }

  bullets(items, { ordered = false } = {}) {
    const d = this.doc;
    items.forEach((item, i) => {
      this.ensure(30);
      const marker = ordered ? `${i + 1}.` : '•';
      const top = d.y;
      d.font(F.bold).fontSize(10.5).fillColor(C.brand)
        .text(marker, PAGE.margin + 6, top, { width: 18 });
      // Bold text before the first " — " reads as a term/definition pair.
      const split = item.indexOf(' — ');
      d.fontSize(10.5);
      if (split > 0) {
        d.font(F.bold).fillColor(C.ink)
          .text(item.slice(0, split), PAGE.margin + 26, top, {
            width: CONTENT_W - 26, continued: true, lineGap: 2.4,
          });
        d.font(F.regular).fillColor(C.body).text(item.slice(split), { lineGap: 2.4 });
      } else {
        d.font(F.regular).fillColor(C.body)
          .text(item, PAGE.margin + 26, top, { width: CONTENT_W - 26, lineGap: 2.4 });
      }
      d.y += 3;
    });
    d.x = PAGE.margin;
    d.moveDown(0.5);
  }

  /**
   * Render a table. `widths` are relative weights, normalised to the text width.
   * Rows paginate individually and repeat the header on each new page.
   */
  table(headers, rows, widths) {
    const d = this.doc;
    const weights = widths || headers.map(() => 1);
    const total = weights.reduce((a, b) => a + b, 0);
    const cols = weights.map(w => (w / total) * CONTENT_W);
    const PAD = 6;

    const heights = (cells, font, size) => cells.map((c, i) => {
      d.font(font).fontSize(size);
      return d.heightOfString(String(c ?? ''), { width: cols[i] - PAD * 2, lineGap: 1.5 });
    });

    const header = () => {
      const h = Math.max(...heights(headers, F.bold, 9.5)) + PAD * 2;
      this.ensure(h + 26);
      const top = d.y;
      d.rect(PAGE.margin, top, CONTENT_W, h).fill(C.brand);
      let x = PAGE.margin;
      headers.forEach((cell, i) => {
        d.font(F.bold).fontSize(9.5).fillColor('#ffffff')
          .text(String(cell), x + PAD, top + PAD, { width: cols[i] - PAD * 2, lineGap: 1.5 });
        x += cols[i];
      });
      d.y = top + h;
    };

    header();

    rows.forEach((row, r) => {
      const h = Math.max(...heights(row, F.regular, 9.5)) + PAD * 2;
      if (d.y + h > BODY_BOTTOM) { this.newPage(); header(); }
      const top = d.y;
      if (r % 2 === 1) d.rect(PAGE.margin, top, CONTENT_W, h).fill(C.band);
      let x = PAGE.margin;
      row.forEach((cell, i) => {
        const s = String(cell ?? '');
        // Leading status tokens are colour-coded for scannability.
        let color = i === 0 ? C.ink : C.body;
        if (/^(Implemented|Pass|Passed|Complete|Delivered|Yes)\b/i.test(s)) color = C.ok;
        else if (/^(Partial|Planned|Deferred|Pending)\b/i.test(s)) color = C.warn;
        else if (/^(Not implemented|Fail|Failed|No)\b/i.test(s)) color = C.danger;
        d.font(i === 0 ? F.bold : F.regular).fontSize(9.5).fillColor(color)
          .text(s, x + PAD, top + PAD, { width: cols[i] - PAD * 2, lineGap: 1.5 });
        x += cols[i];
      });
      d.y = top + h;
      d.strokeColor(C.rule).lineWidth(0.5)
        .moveTo(PAGE.margin, d.y).lineTo(PAGE.width - PAGE.margin, d.y).stroke();
    });

    d.x = PAGE.margin;
    d.moveDown(0.9);
  }

  /** Callout box for notes, warnings, and prerequisites. */
  note(title, text, tone = 'info') {
    const d = this.doc;
    const accent = tone === 'warn' ? C.warn : tone === 'danger' ? C.danger : C.brand;
    d.font(F.regular).fontSize(10);
    const inner = CONTENT_W - 34;
    const h = d.heightOfString(text, { width: inner, lineGap: 2.4 }) + 40;
    this.ensure(h + 12);
    const top = d.y;
    d.rect(PAGE.margin, top, CONTENT_W, h).fill(C.band);
    d.rect(PAGE.margin, top, 4, h).fill(accent);
    d.font(F.bold).fontSize(10).fillColor(accent)
      .text(title.toUpperCase(), PAGE.margin + 16, top + 11, { width: inner });
    d.font(F.regular).fontSize(10).fillColor(C.body)
      .text(text, PAGE.margin + 16, top + 25, { width: inner, lineGap: 2.4 });
    d.y = top + h;
    d.x = PAGE.margin;
    d.moveDown(0.85);
  }

  /** Monospace-ish block for commands, payloads, and directory trees. */
  code(text) {
    const d = this.doc;
    const lines = text.replace(/\t/g, '  ').split('\n');
    d.font('Courier').fontSize(8.8);
    const lh = 11.5;
    const h = lines.length * lh + 20;
    // Long blocks are allowed to split across pages rather than overflow.
    if (h > BODY_BOTTOM - PAGE.margin - 30) {
      this.ensure(60);
    } else {
      this.ensure(h + 10);
    }
    let i = 0;
    while (i < lines.length) {
      const room = Math.max(1, Math.floor((BODY_BOTTOM - d.y - 20) / lh));
      const chunk = lines.slice(i, i + room);
      const ch = chunk.length * lh + 18;
      const top = d.y;
      d.rect(PAGE.margin, top, CONTENT_W, ch).fill('#0f172a');
      chunk.forEach((ln, k) => {
        d.font('Courier').fontSize(8.8).fillColor('#e2e8f0')
          .text(ln, PAGE.margin + 12, top + 9 + k * lh, {
            width: CONTENT_W - 24, lineBreak: false, ellipsis: true,
          });
      });
      d.y = top + ch;
      i += chunk.length;
      if (i < lines.length) this.newPage();
    }
    d.x = PAGE.margin;
    d.moveDown(0.85);
  }

  /**
   * ASCII/box diagram rendered in a bordered frame. Kept monospace so the
   * alignment authored in the source string survives.
   */
  diagram(caption, text) {
    const d = this.doc;
    const lines = text.split('\n');
    const lh = 10.5;
    const h = lines.length * lh + 24;
    this.ensure(h + 34);
    const top = d.y;
    d.rect(PAGE.margin, top, CONTENT_W, h).fillAndStroke('#f8fafc', C.rule);
    lines.forEach((ln, k) => {
      d.font('Courier').fontSize(7.6).fillColor(C.ink)
        .text(ln, PAGE.margin + 10, top + 11 + k * lh, {
          width: CONTENT_W - 20, lineBreak: false,
        });
    });
    d.y = top + h;
    d.moveDown(0.35);
    if (caption) {
      this.figure = (this.figure || 0) + 1;
      d.font(F.italic).fontSize(9).fillColor(C.muted)
        .text(`Figure ${this.figure}: ${caption}`, PAGE.margin, d.y, {
          width: CONTENT_W, align: 'center',
        });
    }
    d.x = PAGE.margin;
    d.moveDown(0.9);
  }

  /** Signature block used to close sign-off documents. */
  signatures(parties) {
    const d = this.doc;
    this.ensure(150);
    d.moveDown(1);
    const colW = CONTENT_W / parties.length;
    const top = d.y;
    parties.forEach((party, i) => {
      const x = PAGE.margin + i * colW;
      d.font(F.bold).fontSize(10).fillColor(C.ink)
        .text(party.role, x, top, { width: colW - 20 });
      let yy = top + 52;
      for (const label of ['Name', 'Signature', 'Date']) {
        d.strokeColor(C.faint).lineWidth(0.75)
          .moveTo(x, yy).lineTo(x + colW - 30, yy).stroke();
        d.font(F.regular).fontSize(8.5).fillColor(C.muted)
          .text(label, x, yy + 4, { width: colW - 30 });
        yy += 34;
      }
    });
    d.y = top + 160;
    d.x = PAGE.margin;
  }

  // -- finishing --------------------------------------------------------------

  /** Paint the TOC into its reserved page, then add headers/footers everywhere. */
  finalize(outPath) {
    const d = this.doc;
    const range = d.bufferedPageRange();

    // Table of contents, painted across the pages reserved for it.
    let tocPage = 0;
    const openTocPage = () => {
      d.switchToPage(this.tocPageIndex + tocPage);
      d.page.margins.bottom = 0;
      d.y = PAGE.margin;
      d.font(F.bold).fontSize(19).fillColor(C.brandDark)
        .text(tocPage === 0 ? 'Table of Contents' : 'Table of Contents (continued)');
      d.moveDown(0.4);
      this.rule(C.brand, 2);
      d.moveDown(1);
    };
    openTocPage();

    for (const e of this.toc) {
      if (d.y > BODY_BOTTOM - 20) {
        if (tocPage + 1 >= this.tocPageCount) break; // no page left to flow into
        tocPage += 1;
        openTocPage();
      }
      const indent = e.level === 1 ? 0 : e.level === 2 ? 18 : 34;
      const top = d.y;
      const label = `${e.num}  ${e.text}`;
      d.font(e.level === 1 ? F.bold : F.regular)
        .fontSize(e.level === 1 ? 10.5 : 9.8)
        .fillColor(e.level === 1 ? C.ink : C.body)
        .text(label, PAGE.margin + indent, top, { width: CONTENT_W - indent - 40, ellipsis: true });
      d.font(F.regular).fontSize(9.5).fillColor(C.muted)
        .text(String(e.page), PAGE.width - PAGE.margin - 34, top, { width: 34, align: 'right' });
      d.y = Math.max(d.y, top + (e.level === 1 ? 17 : 14));
    }

    // Running header + footer on body pages only.
    for (let i = this.frontMatterPages; i < range.count; i++) {
      d.switchToPage(i);
      // The footer sits below the bottom margin. Without this, pdfkit treats
      // writing there as an overflow and appends a blank page per footer.
      d.page.margins.bottom = 0;

      d.font(F.regular).fontSize(8).fillColor(C.faint)
        .text(this.meta.title, PAGE.margin, PAGE.margin - 26,
          { width: CONTENT_W * 0.7, lineBreak: false });
      d.text(this.meta.ref, PAGE.width - PAGE.margin - 180, PAGE.margin - 26,
        { width: 180, align: 'right', lineBreak: false });
      d.strokeColor(C.rule).lineWidth(0.5)
        .moveTo(PAGE.margin, PAGE.margin - 12).lineTo(PAGE.width - PAGE.margin, PAGE.margin - 12).stroke();

      d.strokeColor(C.rule).lineWidth(0.5)
        .moveTo(PAGE.margin, FOOTER_Y).lineTo(PAGE.width - PAGE.margin, FOOTER_Y).stroke();
      d.font(F.regular).fontSize(8).fillColor(C.faint)
        .text(`${this.meta.classification}  ·  v${this.meta.version}`,
          PAGE.margin, FOOTER_Y + 8, { width: CONTENT_W * 0.6, lineBreak: false });
      d.text(`Page ${i + 1} of ${range.count}`,
        PAGE.width - PAGE.margin - 160, FOOTER_Y + 8,
        { width: 160, align: 'right', lineBreak: false });
    }

    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    const stream = fs.createWriteStream(outPath);
    d.pipe(stream);
    d.end();
    return new Promise((resolve, reject) => {
      stream.on('finish', () => resolve(outPath));
      stream.on('error', reject);
    });
  }
}

/**
 * Count how many pages the TOC needs, by running the body against a stub that
 * records nothing but heading levels. This has to happen before rendering:
 * the TOC pages are reserved up front, and inserting one later would shift
 * every page number already recorded.
 */
function countTocPages(def) {
  const H1 = 17, H2 = 14;
  const usable = BODY_BOTTOM - 20 - (PAGE.margin + 64); // heading + rule + gap
  let height = 0, pages = 1;
  const noop = () => {};
  const stub = {
    h(level) {
      if (level > 2) return; // only levels 1 and 2 are indexed
      const h = level === 1 ? H1 : H2;
      if (height + h > usable) { pages += 1; height = 0; }
      height += h;
    },
    p: noop, bullets: noop, table: noop, note: noop,
    code: noop, diagram: noop, signatures: noop,
  };
  def.body(stub);
  return pages;
}

/**
 * Render a document definition to PDF.
 * `def.body(b)` receives the builder and emits blocks in order.
 */
async function render(def, outPath) {
  const b = new DocBuilder(def.meta);
  b.cover();
  b.tocPlaceholder(countTocPages(def));
  def.body(b);
  return b.finalize(outPath);
}

module.exports = { render, DocBuilder, C, F };
