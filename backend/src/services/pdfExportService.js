/**
 * PDF Export Service
 * -------------------
 * Server-side PDF generation (pdfkit) for downloadable records:
 *   - Individual patient/referral records (consultant, hospital, admin)
 *   - Combined rosters ("download all records")
 *   - Admin "complete file" for a consultant, hospital, or laboratory
 *
 * Uploaded documents (PMDC certs, licenses, attachments, lab reports, bills) are
 * EMBEDDED into the output, not linked: images are drawn on their own page and
 * PDFs are merged page-for-page (via pdf-lib) after the report is built.
 *
 * Because PDF merging requires the whole report up-front, each `build*` buffers
 * its output and sends it once complete. Callers must gather all DB data before
 * invoking these and should `await` them.
 */
const PDFDocument = require('pdfkit');
const axios = require('axios');
const { PDFDocument: PdfLib } = require('pdf-lib');
const { formatAge } = require('../utils/age');

// ── Formatting helpers ────────────────────────────────────────────────────────
// Age display adapts to the patient: days / months / years. Falls back to the
// stored numeric age (legacy records without a date of birth).
const ageDisplay = (r) => formatAge(r && r.dateOfBirth) || (r && r.age != null ? `${r.age}` : '');
const formatPkr = (paisa) => {
  if (paisa === undefined || paisa === null || isNaN(paisa)) return 'PKR 0';
  const rupees = Number(paisa) / 100;
  return `PKR ${rupees.toLocaleString('en-PK', { maximumFractionDigits: 2 })}`;
};

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-PK', { year: 'numeric', month: 'short', day: 'numeric' }) : '—');
const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('en-PK') : '—');
const safe = (v) => (v === undefined || v === null || v === '' ? '—' : String(v));

const COLORS = {
  primary: '#2563eb',
  text: '#1e293b',
  muted: '#64748b',
  line: '#cbd5e1',
  rowLine: '#e2e8f0',
  white: '#ffffff',
};

// ── Low-level layout helpers ──────────────────────────────────────────────────
const contentWidth = (doc) => doc.page.width - doc.page.margins.left - doc.page.margins.right;
const contentBottom = (doc) => doc.page.height - doc.page.margins.bottom;

function ensureSpace(doc, needed = 60) {
  if (doc.y + needed > contentBottom(doc)) doc.addPage();
}

function docHeader(doc, title, subtitle) {
  doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(20).text('CareBridge Health', doc.page.margins.left, doc.page.margins.top);
  doc.font('Helvetica').fontSize(11).fillColor(COLORS.muted).text(title);
  if (subtitle) doc.fontSize(9).text(subtitle);
  doc.fontSize(9).fillColor(COLORS.muted).text(`Generated: ${fmtDateTime(new Date())}`);
  doc.moveTo(doc.page.margins.left, doc.y + 4)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y + 4)
    .strokeColor(COLORS.primary).lineWidth(1.5).stroke();
  doc.moveDown(1);
  doc.fillColor(COLORS.text);
}

function sectionTitle(doc, title) {
  ensureSpace(doc, 46);
  doc.moveDown(0.6);
  doc.font('Helvetica-Bold').fontSize(13).fillColor(COLORS.primary).text(title);
  doc.moveTo(doc.page.margins.left, doc.y + 2)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y + 2)
    .strokeColor(COLORS.line).lineWidth(1).stroke();
  doc.moveDown(0.5);
  doc.fillColor(COLORS.text);
}

/** Render label/value pairs as inline lines. */
function keyValues(doc, pairs) {
  doc.fontSize(10).fillColor(COLORS.text);
  pairs.forEach(([k, v]) => {
    ensureSpace(doc, 16);
    doc.font('Helvetica-Bold').text(`${k}: `, { continued: true });
    doc.font('Helvetica').text(safe(v));
  });
  doc.moveDown(0.3);
}

function paragraph(doc, label, value) {
  ensureSpace(doc, 30);
  doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.text).text(`${label}:`);
  doc.font('Helvetica').fontSize(10).fillColor(COLORS.text).text(safe(value), { width: contentWidth(doc) });
  doc.moveDown(0.3);
}

/** Bullet list of document names (no URLs — the files themselves are embedded later). */
function nameList(doc, items) {
  if (!items || !items.length) {
    doc.font('Helvetica-Oblique').fontSize(10).fillColor(COLORS.muted).text('None on file.');
    doc.fillColor(COLORS.text).font('Helvetica');
    return;
  }
  doc.font('Helvetica').fontSize(10).fillColor(COLORS.text);
  items.forEach((it) => {
    ensureSpace(doc, 14);
    doc.text(`• ${it.name || it.testName || 'Document'}`);
  });
}

/**
 * Minimal table renderer with header row, text wrapping, row separators and
 * automatic page breaks.
 */
function drawTable(doc, { columns }, rows) {
  const startX = doc.page.margins.left;
  const cellPad = 5;
  const tableWidth = columns.reduce((s, c) => s + c.width, 0);
  let y = doc.y;

  const drawRow = (cells, isHeader) => {
    doc.font(isHeader ? 'Helvetica-Bold' : 'Helvetica').fontSize(isHeader ? 8.5 : 8);
    const heights = cells.map((text, i) =>
      doc.heightOfString(String(text ?? ''), { width: columns[i].width - cellPad * 2 })
    );
    const rowHeight = Math.max(14, ...heights) + cellPad * 2;

    if (y + rowHeight > contentBottom(doc)) {
      doc.addPage();
      y = doc.page.margins.top;
      if (!isHeader) drawRow(columns.map((c) => c.label), true);
    }

    let x = startX;
    if (isHeader) {
      doc.rect(startX, y, tableWidth, rowHeight).fill(COLORS.primary);
      doc.fillColor(COLORS.white);
    } else {
      doc.fillColor(COLORS.text);
    }
    cells.forEach((text, i) => {
      doc.text(String(text ?? ''), x + cellPad, y + cellPad, { width: columns[i].width - cellPad * 2 });
      x += columns[i].width;
    });
    if (!isHeader) {
      doc.strokeColor(COLORS.rowLine).lineWidth(0.5)
        .moveTo(startX, y + rowHeight).lineTo(startX + tableWidth, y + rowHeight).stroke();
    }
    doc.fillColor(COLORS.text);
    y += rowHeight;
  };

  drawRow(columns.map((c) => c.label), true);
  if (!rows.length) {
    doc.font('Helvetica-Oblique').fontSize(9).fillColor(COLORS.muted).text('No records.', startX, y + 4);
    doc.fillColor(COLORS.text).font('Helvetica');
    y += 18;
  } else {
    rows.forEach((r) => drawRow(r, false));
  }
  doc.y = y + 4;
}

function addFooters(doc) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    // Writing into the bottom margin would make pdfkit's line-wrapper spill onto
    // a fresh page (causing blank trailing pages). Temporarily zero the bottom
    // margin so the footer text stays on the current page.
    const savedBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted);
    doc.text(
      `CareBridge Health — Confidential  |  Page ${i + 1} of ${range.count}`,
      doc.page.margins.left,
      doc.page.height - 32,
      { width: contentWidth(doc), align: 'center', lineBreak: false }
    );
    doc.page.margins.bottom = savedBottom;
  }
}

// ── Document fetching & embedding ─────────────────────────────────────────────
const MAX_DOCS = 40;
const MAX_BYTES = 20 * 1024 * 1024; // 20 MB per file

/** Fetch a document's bytes. Supports http(s) and inline `data:` URLs. */
async function fetchDocumentBytes(url) {
  if (!url || typeof url !== 'string') return null;
  if (url.startsWith('data:')) {
    const m = /^data:([^;,]+)?(;base64)?,([\s\S]*)$/.exec(url);
    if (!m) return null;
    const mime = (m[1] || 'application/octet-stream').toLowerCase();
    const bytes = m[2] ? Buffer.from(m[3], 'base64') : Buffer.from(decodeURIComponent(m[3]));
    return { bytes, mime };
  }
  try {
    const resp = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 15000,
      maxContentLength: MAX_BYTES,
      maxBodyLength: MAX_BYTES,
      headers: { 'User-Agent': 'CareBridge-Export' },
    });
    return { bytes: Buffer.from(resp.data), mime: String(resp.headers['content-type'] || '').toLowerCase() };
  } catch {
    return null;
  }
}

function classifyDocument(mime, url) {
  const u = (url || '').toLowerCase().split('?')[0];
  if (mime.includes('pdf') || u.endsWith('.pdf')) return 'pdf';
  if (mime.includes('jpeg') || mime.includes('jpg') || u.endsWith('.jpg') || u.endsWith('.jpeg')) return 'image';
  if (mime.includes('png') || u.endsWith('.png')) return 'image';
  return 'other';
}

/**
 * Cheap completeness check before handing bytes to pdfkit. pdfkit only supports
 * PNG/JPEG, and its PNG decoder can spend a very long time on a truncated file
 * before failing — so we verify the magic bytes and end-of-file markers and
 * skip (with a note) anything that isn't a complete PNG or JPEG.
 */
function looksLikeCompleteImage(bytes) {
  if (!bytes || bytes.length < 24) return false;
  // PNG: 8-byte signature + trailing IEND chunk
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return bytes.subarray(bytes.length - 8).includes(Buffer.from('IEND'));
  }
  // JPEG: SOI (FFD8) ... EOI (FFD9)
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    return bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9;
  }
  return false;
}

/** Start a fresh page with a caption for an embedded document. */
function documentPage(doc, name, note) {
  doc.addPage();
  doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.primary).text(safe(name));
  if (note) doc.font('Helvetica').fontSize(9).fillColor(COLORS.muted).text(note);
  doc.moveDown(0.5);
  doc.fillColor(COLORS.text);
}

/**
 * Embed each document. Images get their own page; PDFs are returned for merging
 * after the report is finalized; anything unreadable becomes a note page that
 * preserves the original link so nothing is silently lost.
 * @returns {Promise<Array<{name:string,bytes:Buffer}>>} PDF buffers to append.
 */
async function embedDocuments(doc, items) {
  const list = (items || []).filter((it) => it && it.url).slice(0, MAX_DOCS);
  if (!list.length) return [];

  sectionTitle(doc, 'Attached Documents');
  doc.font('Helvetica').fontSize(10).fillColor(COLORS.text)
    .text(`${list.length} document(s) attached and embedded on the following page(s).`);

  const results = await Promise.all(list.map((it) => fetchDocumentBytes(it.url).then((r) => ({ it, r }))));

  const pdfDocs = [];
  for (const { it, r } of results) {
    const name = it.name || it.testName || 'Document';
    if (!r) {
      documentPage(doc, name, `Could not load file — ${it.url}`);
      continue;
    }
    const kind = classifyDocument(it.mime || r.mime || '', it.url);
    if (kind === 'pdf') {
      pdfDocs.push({ name, bytes: r.bytes });
    } else if (kind === 'image') {
      if (!looksLikeCompleteImage(r.bytes)) {
        documentPage(doc, name, `Image appears corrupt or truncated — ${it.url}`);
        continue;
      }
      documentPage(doc, name);
      const w = contentWidth(doc);
      const h = contentBottom(doc) - doc.y;
      try {
        doc.image(r.bytes, doc.page.margins.left, doc.y, { fit: [w, h], align: 'center', valign: 'top' });
      } catch {
        doc.font('Helvetica').fontSize(9).fillColor(COLORS.muted).text(`Could not render image — ${it.url}`);
        doc.fillColor(COLORS.text);
      }
    } else {
      documentPage(doc, name, `Preview not available for this file type — ${it.url}`);
    }
  }
  return pdfDocs;
}

/** Append embedded PDF documents page-for-page onto the finished report. */
async function mergePdfDocs(reportBytes, pdfDocs) {
  if (!pdfDocs || !pdfDocs.length) return reportBytes;
  let out;
  try {
    out = await PdfLib.load(reportBytes);
  } catch {
    return reportBytes;
  }
  for (const d of pdfDocs) {
    try {
      const src = await PdfLib.load(d.bytes, { ignoreEncryption: true });
      const pages = await out.copyPages(src, src.getPageIndices());
      pages.forEach((p) => out.addPage(p));
    } catch {
      // Unreadable/encrypted PDF — its name still appears in the report body.
    }
  }
  try {
    return Buffer.from(await out.save());
  } catch {
    return reportBytes;
  }
}

// ── Document lifecycle ────────────────────────────────────────────────────────
function createDoc() {
  const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));
  return { doc, done };
}

/**
 * Standard builder tail: embed documents, add footers, flush, merge embedded
 * PDFs, and send. Keeps every builder's epilogue identical.
 */
async function finish(doc, done, res, filename, docItems) {
  const pdfDocs = await embedDocuments(doc, docItems);
  addFooters(doc);
  doc.end();
  let buffer = await done;
  buffer = await mergePdfDocs(buffer, pdfDocs);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.end(buffer);
}

// ── Shared section: a single referral's clinical detail ───────────────────────
function writeReferralDetail(doc, referral, admission, labReferrals, { hideBilling = false } = {}) {
  sectionTitle(doc, 'Patient Information');
  keyValues(doc, [
    ['Referral Code', referral.referralCode],
    ['Patient Name', referral.patientName],
    ['Age / Gender', `${safe(ageDisplay(referral))} / ${safe(referral.gender)}`],
    ['Phone', referral.phone],
    ['CNIC', referral.cnic],
    ['Guardian', referral.guardianName ? `${referral.guardianName} (${safe(referral.guardianRelation)})` : null],
    ['Area', referral.area],
  ]);

  sectionTitle(doc, 'Clinical Details');
  keyValues(doc, [
    ['Urgency', referral.urgency],
    ['Department', referral.department],
    ['Assigned Department', referral.assignedDepartment],
    ['Symptom Tags', (referral.symptomTags || []).join(', ')],
    ['Status', (referral.status || '').toUpperCase()],
    ['Created', fmtDateTime(referral.createdAt)],
    ['Accepted', referral.acceptedAt ? fmtDateTime(referral.acceptedAt) : null],
    ['Admitted', referral.admittedAt ? fmtDateTime(referral.admittedAt) : null],
    ['Closed', referral.closedAt ? fmtDateTime(referral.closedAt) : null],
  ]);
  if (referral.symptomsText) paragraph(doc, 'Symptoms', referral.symptomsText);
  if (referral.summaryNotes) paragraph(doc, 'Clinical Summary', referral.summaryNotes);
  if (referral.diagnosisText) paragraph(doc, 'Diagnosis', referral.diagnosisText);
  if (referral.notes) paragraph(doc, 'Notes', referral.notes);

  sectionTitle(doc, 'Clinical Notes Timeline');
  const noteRows = (referral.clinicalNotes || []).map((n) => [
    fmtDateTime(n.createdAt),
    (n.type || '').toUpperCase(),
    safe(n.authorName),
    safe(n.content),
  ]);
  drawTable(doc, { columns: [
    { label: 'When', width: 110 },
    { label: 'Type', width: 70 },
    { label: 'Author', width: 90 },
    { label: 'Note', width: 225 },
  ] }, noteRows);

  if (admission) {
    sectionTitle(doc, hideBilling ? 'Admission' : 'Admission & Billing');
    const admissionFields = [
      ['Admit Date', fmtDateTime(admission.admitDate)],
      ['Discharge Date', admission.dischargeDate ? fmtDateTime(admission.dischargeDate) : null],
      ['Room / Bed', `${safe(admission.roomNumber)} / ${safe(admission.bedNumber)}`],
      ['Department', admission.admissionDepartment],
      ['Treating Doctor', admission.treatingDoctorId?.name],
      ['Status', (admission.status || '').toUpperCase()],
    ];
    if (!hideBilling) {
      admissionFields.push(
        ['Payment Method', admission.paymentMethod],
        ['Payment Reference', admission.paymentReference],
        ['Bill Total', admission.billTotalPaisa != null ? formatPkr(admission.billTotalPaisa) : null],
      );
    }
    keyValues(doc, admissionFields);
    if (!hideBilling && admission.services && admission.services.length) {
      const svcRows = admission.services.map((s) => [safe(s.description), formatPkr(s.amountPaisa)]);
      drawTable(doc, { columns: [
        { label: 'Service', width: 360 },
        { label: 'Amount', width: 135 },
      ] }, svcRows);
    }
  }

  if (labReferrals && labReferrals.length) {
    sectionTitle(doc, 'Laboratory Referrals & Reports');
    labReferrals.forEach((lab) => {
      const labFields = [
        ['Lab Code', lab.referralCode],
        ['Tests', (lab.recommendedTests || []).map((t) => t.testName).join(', ')],
        ['Status', (lab.status || '').toUpperCase()],
      ];
      if (!hideBilling) {
        labFields.push(['Bill Total', lab.billTotalPaisa != null ? formatPkr(lab.billTotalPaisa) : null]);
      }
      keyValues(doc, labFields);
      if (lab.reportFiles && lab.reportFiles.length) {
        doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.text).text('Reports:');
        nameList(doc, lab.reportFiles);
      }
      doc.moveDown(0.3);
    });
  }
}

/** Collect every embeddable document from a hospital/consultant referral record. */
function collectReferralDocs(referral, admission, labReferrals, { hideBilling = false } = {}) {
  const docs = [];
  (referral.attachments || []).forEach((url, i) => docs.push({ name: `Attachment ${i + 1}`, url }));
  if (!hideBilling && admission?.patientBillFileUrl) {
    docs.push({ name: 'Patient Bill', url: admission.patientBillFileUrl });
  }
  (labReferrals || []).forEach((lab) => {
    (lab.reportFiles || []).forEach((f) => docs.push({ name: `${lab.referralCode} — ${f.name || f.testName || 'Report'}`, url: f.url }));
  });
  return docs;
}

// ── Laboratory: shared single lab-referral detail ────────────────────────────
function writeLabReferralDetail(doc, referral, labPayout, { hideBilling = false } = {}) {
  sectionTitle(doc, 'Patient Information');
  keyValues(doc, [
    ['Lab Referral Code', referral.referralCode],
    ['Patient Name', referral.patientName],
    ['Age / Gender', `${safe(ageDisplay(referral))} / ${safe(referral.gender)}`],
    ['Phone', referral.phone],
    ['CNIC', referral.cnic],
    ['Guardian', referral.guardianName ? `${referral.guardianName} (${safe(referral.guardianRelation)})` : null],
    ['Area', referral.area],
  ]);

  sectionTitle(doc, 'Laboratory & Test Details');
  const labDetailFields = [
    ['Laboratory', referral.targetLaboratoryId?.labName],
    ['Urgency', referral.urgency],
    ['Status', (referral.status || '').toUpperCase()],
    ['Created', fmtDateTime(referral.createdAt)],
    ['Accepted', referral.acceptedAt ? fmtDateTime(referral.acceptedAt) : null],
    ['Expected Report', referral.expectedReportAt ? fmtDateTime(referral.expectedReportAt) : null],
    ['Reported', referral.reportedAt ? fmtDateTime(referral.reportedAt) : null],
    ['Closed', referral.closedAt ? fmtDateTime(referral.closedAt) : null],
  ];
  if (!hideBilling) {
    labDetailFields.splice(3, 0, ['Patient Discount %', referral.discountPercentage]);
  }
  keyValues(doc, labDetailFields);

  sectionTitle(doc, 'Recommended Tests');
  drawTable(doc, { columns: [
    { label: 'Test', width: 200 },
    { label: 'Note', width: 295 },
  ] }, (referral.recommendedTests || []).map((t) => [safe(t.testName), safe(t.note)]));

  if (referral.symptomsText) paragraph(doc, 'Symptoms', referral.symptomsText);
  if (referral.summaryNotes) paragraph(doc, 'Clinical Summary', referral.summaryNotes);
  if (referral.notes) paragraph(doc, 'Notes', referral.notes);

  if (!hideBilling) {
    sectionTitle(doc, 'Billing');
    if (referral.services && referral.services.length) {
      drawTable(doc, { columns: [
        { label: 'Service', width: 360 },
        { label: 'Amount', width: 135 },
      ] }, referral.services.map((s) => [safe(s.description), formatPkr(s.amountPaisa)]));
    }
    keyValues(doc, [
      ['Gross Amount', referral.grossAmountPaisa != null ? formatPkr(referral.grossAmountPaisa) : null],
      ['Discount', referral.discountAmountPaisa != null ? formatPkr(referral.discountAmountPaisa) : null],
      ['Bill Total', referral.billTotalPaisa != null ? formatPkr(referral.billTotalPaisa) : null],
      ['Payment Method', referral.paymentMethod],
      ['Payment Reference', referral.paymentReference],
      ['Consultant Commission / Platform Charge', labPayout ? formatPkr(labPayout.amountPaisa) : null],
    ]);
  }

  if (referral.reportFiles && referral.reportFiles.length) {
    sectionTitle(doc, 'Lab Reports');
    nameList(doc, referral.reportFiles);
  }
}

/** Collect every embeddable document from a lab referral. */
function collectLabReferralDocs(referral, { hideBilling = false } = {}) {
  const docs = [];
  (referral.reportFiles || []).forEach((f, i) => docs.push({ name: f.name || f.testName || `Report ${i + 1}`, url: f.url }));
  (referral.attachments || []).forEach((url, i) => docs.push({ name: `Attachment ${i + 1}`, url }));
  if (!hideBilling && referral.patientBillFileUrl) docs.push({ name: 'Patient Bill', url: referral.patientBillFileUrl });
  return docs;
}

// ── Public builders ───────────────────────────────────────────────────────────

/** Individual patient/referral record (consultant, hospital, admin). */
async function buildReferralRecordPdf(res, { referral, admission, labReferrals, hideBilling = false }) {
  const { doc, done } = createDoc();
  docHeader(doc, 'Patient Referral Record', `Referral ${safe(referral.referralCode)}`);
  writeReferralDetail(doc, referral, admission, labReferrals, { hideBilling });
  await finish(doc, done, res, `Patient_Record_${referral.referralCode || referral._id}.pdf`,
    collectReferralDocs(referral, admission, labReferrals, { hideBilling }));
}

/** Combined roster of a consultant's referrals. */
async function buildConsultantReferralsPdf(res, { consultantName, referrals }) {
  const { doc, done } = createDoc();
  docHeader(doc, 'Referral History', consultantName ? `Consultant: ${consultantName}` : undefined);
  sectionTitle(doc, `Referrals (${referrals.length})`);
  drawTable(doc, { columns: [
    { label: 'Code', width: 80 },
    { label: 'Date', width: 70 },
    { label: 'Patient', width: 95 },
    { label: 'Age/Sex', width: 50 },
    { label: 'Hospital', width: 95 },
    { label: 'Dept', width: 60 },
    { label: 'Status', width: 45 },
  ] }, referrals.map((r) => [
    safe(r.referralCode), fmtDate(r.createdAt), safe(r.patientName),
    `${safe(ageDisplay(r))}/${(r.gender || '').charAt(0).toUpperCase()}`,
    safe(r.targetHospitalId?.hospitalName), safe(r.department), (r.status || '').toUpperCase(),
  ]));
  await finish(doc, done, res, `My_Referrals_${new Date().toISOString().slice(0, 10)}.pdf`);
}

/** Combined roster of all of a hospital's patient records. */
async function buildHospitalRecordsPdf(res, { hospital, referrals }) {
  const { doc, done } = createDoc();
  docHeader(doc, 'Patient Records', `Hospital: ${safe(hospital.hospitalName)}`);

  const counts = referrals.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});
  sectionTitle(doc, 'Summary');
  keyValues(doc, [
    ['Total Records', referrals.length],
    ['Pending', counts.pending || 0],
    ['Accepted', counts.accepted || 0],
    ['Admitted', counts.admitted || 0],
    ['Closed', counts.closed || 0],
    ['Rejected', counts.rejected || 0],
  ]);

  sectionTitle(doc, 'All Patient Records');
  drawTable(doc, { columns: [
    { label: 'Code', width: 80 },
    { label: 'Date', width: 70 },
    { label: 'Patient', width: 95 },
    { label: 'Age/Sex', width: 50 },
    { label: 'Consultant', width: 95 },
    { label: 'Dept', width: 60 },
    { label: 'Status', width: 45 },
  ] }, referrals.map((r) => [
    safe(r.referralCode), fmtDate(r.createdAt), safe(r.patientName),
    `${safe(ageDisplay(r))}/${(r.gender || '').charAt(0).toUpperCase()}`,
    safe(r.consultantId?.userId?.name), safe(r.department), (r.status || '').toUpperCase(),
  ]));
  await finish(doc, done, res, `Hospital_Records_${new Date().toISOString().slice(0, 10)}.pdf`);
}

/** Admin: complete file for a consultant. */
async function buildConsultantFilePdf(res, { user, consultant, referrals, payouts, auditLogs }) {
  const { doc, done } = createDoc();
  docHeader(doc, 'Consultant — Complete File', user.name);

  sectionTitle(doc, 'Profile & Credentials');
  keyValues(doc, [
    ['Name', user.name], ['Email', user.email], ['Phone', user.phone],
    ['Account Status', (user.status || '').toUpperCase()],
    ['PMDC Number', consultant.pmdcNumber], ['CNIC', consultant.cnic],
    ['Specialty', consultant.specialty], ['Clinic', consultant.clinicName],
    ['Clinic Address', consultant.clinicAddress], ['City', consultant.city],
    ['Promo Code', consultant.promoCode], ['Verified', consultant.isVerified ? 'Yes' : 'No'],
    ['Commission %', consultant.commissionPercentage], ['Max Lab Discount %', consultant.maxLabDiscountPercentage],
    ['Member Since', fmtDate(user.createdAt)],
  ]);

  sectionTitle(doc, 'Accounts & Wallet');
  const pa = consultant.payoutAccount || {};
  keyValues(doc, [
    ['Wallet Balance', formatPkr(consultant.walletBalance)],
    ['Total Earnings', formatPkr(consultant.totalEarnings)],
    ['Monthly Earnings', formatPkr(consultant.monthlyEarnings)],
    ['Payout Type', pa.accountType], ['Account Holder', pa.accountHolder],
    ['Account Number', pa.accountNumber], ['Bank', pa.bankName],
  ]);

  sectionTitle(doc, 'Verification Documents');
  nameList(doc, consultant.verificationDocuments || []);

  sectionTitle(doc, `Referrals (${referrals.length})`);
  drawTable(doc, { columns: [
    { label: 'Code', width: 80 }, { label: 'Date', width: 70 }, { label: 'Patient', width: 110 },
    { label: 'Hospital', width: 120 }, { label: 'Status', width: 115 },
  ] }, referrals.map((r) => [
    safe(r.referralCode), fmtDate(r.createdAt), safe(r.patientName),
    safe(r.targetHospitalId?.hospitalName), (r.status || '').toUpperCase(),
  ]));

  sectionTitle(doc, `Payouts (${payouts.length})`);
  drawTable(doc, { columns: [
    { label: 'Date', width: 80 }, { label: 'Referral', width: 90 }, { label: 'Amount', width: 110 },
    { label: 'Status', width: 100 }, { label: 'Note', width: 115 },
  ] }, payouts.map((p) => [
    fmtDate(p.createdAt), safe(p.referralId?.referralCode), formatPkr(p.amountPaisa),
    (p.status || '').toUpperCase(), safe(p.note),
  ]));

  sectionTitle(doc, `Activity Log (${auditLogs.length})`);
  drawTable(doc, { columns: [
    { label: 'When', width: 110 }, { label: 'Action', width: 150 }, { label: 'Entity', width: 90 }, { label: 'Details', width: 145 },
  ] }, auditLogs.map((l) => [
    fmtDateTime(l.createdAt), safe(l.action), safe(l.entityModel),
    l.details ? JSON.stringify(l.details).slice(0, 200) : '—',
  ]));

  await finish(doc, done, res, `Consultant_File_${safe(user.name).replace(/\s+/g, '_')}.pdf`,
    consultant.verificationDocuments || []);
}

/** Admin: complete file for a hospital. */
async function buildHospitalFilePdf(res, { user, hospital, referrals, admissions, settlements, auditLogs }) {
  const { doc, done } = createDoc();
  docHeader(doc, 'Hospital — Complete File', hospital.hospitalName);

  sectionTitle(doc, 'Profile & Registration');
  keyValues(doc, [
    ['Hospital Name', hospital.hospitalName], ['Registration Number', hospital.registrationNumber],
    ['Representative CNIC', hospital.representativeCnic], ['Contact Email', user?.email],
    ['Contact Phone', user?.phone], ['Account Status', (user?.status || '').toUpperCase()],
    ['Address', hospital.address], ['City / Area', `${safe(hospital.city)} / ${safe(hospital.area)}`],
    ['Departments', (hospital.departments || []).join(', ')], ['Active', hospital.isActive ? 'Yes' : 'No'],
    ['Registration Verified', hospital.isRegistrationVerified ? 'Yes' : 'No'],
    ['Deduction %', hospital.deductionPercentage], ['Avg Response (min)', hospital.avgResponseTime],
    ['Acceptance Rate %', hospital.acceptanceRate], ['Rating', hospital.rating],
    ['Member Since', fmtDate(hospital.createdAt)],
  ]);

  sectionTitle(doc, 'Bed Inventory');
  drawTable(doc, { columns: [
    { label: 'Ward', width: 165 }, { label: 'Total', width: 110 }, { label: 'Occupied', width: 110 }, { label: 'Available', width: 110 },
  ] }, (hospital.bedsInventory || []).map((b) => [safe(b.ward), safe(b.totalBeds), safe(b.occupiedBeds), safe(b.availableBeds)]));

  sectionTitle(doc, 'Rate Packages');
  drawTable(doc, { columns: [
    { label: 'Department', width: 130 }, { label: 'Service', width: 165 }, { label: 'Min', width: 100 }, { label: 'Max', width: 100 },
  ] }, (hospital.ratePackages || []).map((p) => [safe(p.department), safe(p.serviceName), formatPkr(p.minPrice), formatPkr(p.maxPrice)]));

  sectionTitle(doc, 'Registration Documents');
  nameList(doc, hospital.registrationDocuments || []);

  sectionTitle(doc, `Patient Records (${referrals.length})`);
  drawTable(doc, { columns: [
    { label: 'Code', width: 80 }, { label: 'Date', width: 70 }, { label: 'Patient', width: 120 }, { label: 'Dept', width: 110 }, { label: 'Status', width: 115 },
  ] }, referrals.map((r) => [
    safe(r.referralCode), fmtDate(r.createdAt), safe(r.patientName), safe(r.department), (r.status || '').toUpperCase(),
  ]));

  sectionTitle(doc, `Admissions (${admissions.length})`);
  drawTable(doc, { columns: [
    { label: 'Admit Date', width: 90 }, { label: 'Room/Bed', width: 90 }, { label: 'Department', width: 120 }, { label: 'Bill Total', width: 100 }, { label: 'Status', width: 95 },
  ] }, admissions.map((a) => [
    fmtDate(a.admitDate), `${safe(a.roomNumber)}/${safe(a.bedNumber)}`, safe(a.admissionDepartment),
    a.billTotalPaisa != null ? formatPkr(a.billTotalPaisa) : '—', (a.status || '').toUpperCase(),
  ]));

  sectionTitle(doc, `Settlements (${settlements.length})`);
  drawTable(doc, { columns: [
    { label: 'Period', width: 150 }, { label: 'Gross', width: 110 }, { label: 'Platform Cut', width: 120 }, { label: 'Status', width: 115 },
  ] }, settlements.map((s) => [
    `${fmtDate(s.billingPeriodStart)} – ${fmtDate(s.billingPeriodEnd)}`,
    formatPkr(s.grossAmountPaisa), formatPkr(s.calculatedPlatformCutPaisa), (s.status || '').replace(/_/g, ' ').toUpperCase(),
  ]));

  sectionTitle(doc, `Activity Log (${auditLogs.length})`);
  drawTable(doc, { columns: [
    { label: 'When', width: 110 }, { label: 'Action', width: 150 }, { label: 'Entity', width: 90 }, { label: 'Details', width: 145 },
  ] }, auditLogs.map((l) => [
    fmtDateTime(l.createdAt), safe(l.action), safe(l.entityModel), l.details ? JSON.stringify(l.details).slice(0, 200) : '—',
  ]));

  await finish(doc, done, res, `Hospital_File_${safe(hospital.hospitalName).replace(/\s+/g, '_')}.pdf`,
    hospital.registrationDocuments || []);
}

/** Individual lab-referral record (consultant, laboratory, admin). */
async function buildLabReferralRecordPdf(res, { referral, labPayout, hideBilling = false }) {
  const { doc, done } = createDoc();
  docHeader(doc, 'Laboratory Referral Record', `Lab Referral ${safe(referral.referralCode)}`);
  writeLabReferralDetail(doc, referral, labPayout, { hideBilling });
  await finish(doc, done, res, `Lab_Record_${referral.referralCode || referral._id}.pdf`,
    collectLabReferralDocs(referral, { hideBilling }));
}

/** Combined roster of lab referrals (consultant or laboratory view). */
async function buildLabReferralsRosterPdf(res, { heading, subtitle, filename, referrals, partyLabel, partyValue, hideBilling = false }) {
  const { doc, done } = createDoc();
  docHeader(doc, heading || 'Laboratory Referrals', subtitle);
  sectionTitle(doc, `Lab Referrals (${referrals.length})`);
  const columns = hideBilling
    ? [
        { label: 'Code', width: 90 }, { label: 'Date', width: 70 }, { label: 'Patient', width: 110 },
        { label: 'Age/Sex', width: 55 }, { label: partyLabel || 'Party', width: 110 }, { label: 'Status', width: 60 },
      ]
    : [
        { label: 'Code', width: 80 }, { label: 'Date', width: 65 }, { label: 'Patient', width: 90 },
        { label: 'Age/Sex', width: 48 }, { label: partyLabel || 'Party', width: 92 }, { label: 'Status', width: 60 }, { label: 'Bill', width: 60 },
      ];
  drawTable(doc, { columns }, referrals.map((r) => {
    const row = [
      safe(r.referralCode), fmtDate(r.createdAt), safe(r.patientName),
      `${safe(ageDisplay(r))}/${(r.gender || '').charAt(0).toUpperCase()}`,
      partyValue ? safe(partyValue(r)) : '—', (r.status || '').toUpperCase(),
    ];
    if (!hideBilling) row.push(r.billTotalPaisa != null ? formatPkr(r.billTotalPaisa) : '—');
    return row;
  }));
  await finish(doc, done, res, filename || `Lab_Referrals_${new Date().toISOString().slice(0, 10)}.pdf`);
}

/** Admin: complete file for a laboratory. */
async function buildLaboratoryFilePdf(res, { user, laboratory, referrals, payouts, auditLogs }) {
  const { doc, done } = createDoc();
  docHeader(doc, 'Laboratory — Complete File', laboratory.labName);

  sectionTitle(doc, 'Profile & Registration');
  keyValues(doc, [
    ['Laboratory Name', laboratory.labName], ['Registration Number', laboratory.registrationNumber],
    ['Representative CNIC', laboratory.representativeCnic], ['Contact Email', user?.email],
    ['Contact Phone', user?.phone], ['Account Status', (user?.status || '').toUpperCase()],
    ['Address', laboratory.address], ['City / Area', `${safe(laboratory.city)} / ${safe(laboratory.area)}`],
    ['Active', laboratory.isActive ? 'Yes' : 'No'], ['Registration Verified', laboratory.isRegistrationVerified ? 'Yes' : 'No'],
    ['Deduction %', laboratory.deductionPercentage],
    ['Avg Response (min)', laboratory.avgResponseTime], ['Acceptance Rate %', laboratory.acceptanceRate],
    ['Rating', laboratory.rating], ['Member Since', fmtDate(laboratory.createdAt)],
  ]);

  sectionTitle(doc, 'Test Catalog');
  drawTable(doc, { columns: [
    { label: 'Test', width: 245 }, { label: 'Price', width: 130 }, { label: 'Turnaround (h)', width: 120 },
  ] }, (laboratory.testCatalog || []).map((t) => [safe(t.testName), formatPkr(t.price), safe(t.turnaroundHours)]));

  sectionTitle(doc, 'Registration Documents');
  nameList(doc, laboratory.registrationDocuments || []);

  sectionTitle(doc, `Lab Referrals (${referrals.length})`);
  drawTable(doc, { columns: [
    { label: 'Code', width: 80 }, { label: 'Date', width: 70 }, { label: 'Patient', width: 120 }, { label: 'Status', width: 100 }, { label: 'Bill', width: 125 },
  ] }, referrals.map((r) => [
    safe(r.referralCode), fmtDate(r.createdAt), safe(r.patientName),
    (r.status || '').toUpperCase(), r.billTotalPaisa != null ? formatPkr(r.billTotalPaisa) : '—',
  ]));

  sectionTitle(doc, `Consultant Payouts (${payouts.length})`);
  drawTable(doc, { columns: [
    { label: 'Date', width: 80 }, { label: 'Lab Referral', width: 100 }, { label: 'Amount', width: 110 }, { label: 'Status', width: 100 }, { label: 'Note', width: 105 },
  ] }, payouts.map((p) => [
    fmtDate(p.createdAt), safe(p.labReferralId?.referralCode), formatPkr(p.amountPaisa),
    (p.status || '').toUpperCase(), safe(p.note),
  ]));

  sectionTitle(doc, `Activity Log (${auditLogs.length})`);
  drawTable(doc, { columns: [
    { label: 'When', width: 110 }, { label: 'Action', width: 150 }, { label: 'Entity', width: 90 }, { label: 'Details', width: 145 },
  ] }, auditLogs.map((l) => [
    fmtDateTime(l.createdAt), safe(l.action), safe(l.entityModel), l.details ? JSON.stringify(l.details).slice(0, 200) : '—',
  ]));

  await finish(doc, done, res, `Laboratory_File_${safe(laboratory.labName).replace(/\s+/g, '_')}.pdf`,
    laboratory.registrationDocuments || []);
}

module.exports = {
  buildReferralRecordPdf,
  buildConsultantReferralsPdf,
  buildHospitalRecordsPdf,
  buildConsultantFilePdf,
  buildHospitalFilePdf,
  buildLabReferralRecordPdf,
  buildLabReferralsRosterPdf,
  buildLaboratoryFilePdf,
};
