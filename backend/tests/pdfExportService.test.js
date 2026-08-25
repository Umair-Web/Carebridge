const test = require('node:test');
const assert = require('node:assert');
const { PassThrough } = require('node:stream');
const { PDFDocument } = require('pdf-lib');
const pdf = require('../src/services/pdfExportService');

/** Drive an async builder and collect its piped output into a Buffer. */
function render(buildFn) {
  const res = new PassThrough();
  res.setHeader = () => {};
  const chunks = [];
  res.on('data', (c) => chunks.push(c));
  const ended = new Promise((resolve) => res.on('end', () => resolve(Buffer.concat(chunks))));
  return Promise.resolve(buildFn(res)).then(() => ended);
}

const isPdf = (buf) => buf.length > 0 && buf.slice(0, 5).toString() === '%PDF-';
// Count pages via pdf-lib (robust whether or not the PDF uses compressed object streams).
const countPages = async (buf) => (await PDFDocument.load(buf)).getPageCount();

// A valid 1x1 PNG as an inline data URL (no network needed to embed an image).
const PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4//8/AAX+Av4N70a4AAAAAElFTkSuQmCC';

async function pdfDataUrl(pageCount = 2) {
  const d = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) d.addPage();
  const bytes = await d.save();
  return `data:application/pdf;base64,${Buffer.from(bytes).toString('base64')}`;
}

const sampleReferral = (overrides = {}) => ({
  _id: 'r1', referralCode: 'CB-2026-0042', patientName: 'Ali Raza', age: 34, gender: 'male',
  phone: '03001234567', cnic: '42101-1234567-1', area: 'Gulshan', urgency: 'urgent',
  department: 'Cardiology', status: 'admitted', createdAt: new Date('2026-01-01'),
  symptomsText: 'Chest pain', symptomTags: ['chest-pain'], attachments: [],
  clinicalNotes: [{ createdAt: new Date('2026-01-02'), type: 'nursing', authorName: 'Nurse Jane', content: 'Stable.' }],
  ...overrides,
});

const sampleLabReferral = (overrides = {}) => ({
  _id: 'l1', referralCode: 'LAB-2026-0007', patientName: 'Sara', age: 28, gender: 'female',
  phone: '0300', cnic: '42101-x', urgency: 'routine', status: 'reported', createdAt: new Date('2026-01-01'),
  discountPercentage: 10, targetLaboratoryId: { labName: 'Chughtai Lab' },
  recommendedTests: [{ testName: 'CBC', note: 'fasting' }], services: [{ description: 'CBC', amountPaisa: 120000 }],
  grossAmountPaisa: 120000, discountAmountPaisa: 12000, billTotalPaisa: 108000, paymentMethod: 'cash',
  reportFiles: [], attachments: [],
  ...overrides,
});

test('buildReferralRecordPdf produces a valid PDF', async () => {
  const buf = await render((res) => pdf.buildReferralRecordPdf(res, {
    referral: sampleReferral(),
    admission: { admitDate: new Date('2026-01-01'), roomNumber: '204', bedNumber: 'B',
      admissionDepartment: 'Cardiology', status: 'active', billTotalPaisa: 1500000,
      services: [{ description: 'ICU', amountPaisa: 1000000 }] },
    labReferrals: [],
  }));
  assert.ok(isPdf(buf));
});

test('a short referral record with no documents is exactly one page', async () => {
  const buf = await render((res) => pdf.buildReferralRecordPdf(res, {
    referral: sampleReferral({ clinicalNotes: [] }), admission: null, labReferrals: [],
  }));
  assert.strictEqual(await countPages(buf), 1);
});

test('an image attachment is embedded as an extra page (not a link)', async () => {
  const base = await render((res) => pdf.buildReferralRecordPdf(res, {
    referral: sampleReferral({ clinicalNotes: [] }), admission: null, labReferrals: [],
  }));
  const withImg = await render((res) => pdf.buildReferralRecordPdf(res, {
    referral: sampleReferral({ clinicalNotes: [], attachments: [PNG_DATA_URL] }), admission: null, labReferrals: [],
  }));
  assert.ok(isPdf(withImg));
  assert.ok(await countPages(withImg) > await countPages(base), 'embedding an image should add a page');
});

test('a PDF attachment is merged page-for-page', async () => {
  const attachment = await pdfDataUrl(3);
  const base = await render((res) => pdf.buildReferralRecordPdf(res, {
    referral: sampleReferral({ clinicalNotes: [] }), admission: null, labReferrals: [],
  }));
  const merged = await render((res) => pdf.buildReferralRecordPdf(res, {
    referral: sampleReferral({ clinicalNotes: [], attachments: [attachment] }), admission: null, labReferrals: [],
  }));
  assert.ok(isPdf(merged));
  // base report + 3 merged pages from the embedded PDF
  assert.ok(await countPages(merged) >= await countPages(base) + 3, 'merged PDF pages should be appended');
});

test('buildConsultantReferralsPdf produces a valid PDF', async () => {
  const buf = await render((res) => pdf.buildConsultantReferralsPdf(res, {
    consultantName: 'Dr. Sara',
    referrals: [{ referralCode: 'CB-1', createdAt: new Date(), patientName: 'A', gender: 'female',
      targetHospitalId: { hospitalName: 'City' }, department: 'ENT', status: 'closed' }],
  }));
  assert.ok(isPdf(buf));
});

test('buildHospitalRecordsPdf produces a valid PDF (empty roster)', async () => {
  const buf = await render((res) => pdf.buildHospitalRecordsPdf(res, { hospital: { hospitalName: 'City Hospital' }, referrals: [] }));
  assert.ok(isPdf(buf));
});

test('buildConsultantFilePdf produces a valid PDF and embeds verification documents', async () => {
  const buf = await render((res) => pdf.buildConsultantFilePdf(res, {
    user: { name: 'Dr. Sara', email: 's@x.com', phone: '0300', status: 'active', createdAt: new Date() },
    consultant: { pmdcNumber: 'P1', specialty: 'Cardiology', commissionPercentage: 60,
      walletBalance: 500000, totalEarnings: 9000000, monthlyEarnings: 300000,
      payoutAccount: { accountType: 'bank', accountHolder: 'Sara', accountNumber: '123', bankName: 'HBL' },
      verificationDocuments: [{ name: 'PMDC Cert', url: PNG_DATA_URL }] },
    referrals: [{ referralCode: 'CB-1', createdAt: new Date(), patientName: 'A', targetHospitalId: { hospitalName: 'City' }, status: 'closed' }],
    payouts: [{ createdAt: new Date(), referralId: { referralCode: 'CB-1' }, amountPaisa: 100000, status: 'paid', note: 'ok' }],
    auditLogs: [{ createdAt: new Date(), action: 'REFERRAL_CREATE', entityModel: 'Referral', details: { x: 1 } }],
  }));
  assert.ok(isPdf(buf));
  assert.ok(await countPages(buf) >= 2, 'embedded verification document should add a page');
});

test('buildHospitalFilePdf produces a valid PDF (empty collections)', async () => {
  const buf = await render((res) => pdf.buildHospitalFilePdf(res, {
    user: { email: 'h@x.com', phone: '0', status: 'active' },
    hospital: { hospitalName: 'City Hospital', departments: [], bedsInventory: [], ratePackages: [],
      registrationDocuments: [], createdAt: new Date() },
    referrals: [], admissions: [], settlements: [], auditLogs: [],
  }));
  assert.ok(isPdf(buf));
});

test('buildLabReferralRecordPdf produces a valid PDF and merges report PDFs', async () => {
  const report = await pdfDataUrl(1);
  const buf = await render((res) => pdf.buildLabReferralRecordPdf(res, {
    referral: sampleLabReferral({ reportFiles: [{ name: 'CBC', url: report }] }), labPayout: { amountPaisa: 30000 },
  }));
  assert.ok(isPdf(buf));
  assert.ok(await countPages(buf) >= 2, 'embedded lab report PDF should be merged');
});

test('a short lab record with no documents is exactly one page', async () => {
  const buf = await render((res) => pdf.buildLabReferralRecordPdf(res, { referral: sampleLabReferral(), labPayout: null }));
  assert.strictEqual(await countPages(buf), 1);
});

test('buildLabReferralsRosterPdf produces valid PDFs (consultant + lab views)', async () => {
  const a = await render((res) => pdf.buildLabReferralsRosterPdf(res, {
    heading: 'X', filename: 'x.pdf', referrals: [sampleLabReferral()],
    partyLabel: 'Laboratory', partyValue: (r) => r.targetLaboratoryId?.labName,
  }));
  const b = await render((res) => pdf.buildLabReferralsRosterPdf(res, {
    heading: 'X', filename: 'x.pdf', referrals: [], partyLabel: 'Consultant', partyValue: () => null,
  }));
  assert.ok(isPdf(a) && isPdf(b));
});

test('buildLaboratoryFilePdf produces a valid PDF (and empty)', async () => {
  const a = await render((res) => pdf.buildLaboratoryFilePdf(res, {
    user: { email: 'l@x.com', phone: '0', status: 'active' },
    laboratory: { labName: 'Chughtai', testCatalog: [{ testName: 'CBC', price: 120000, turnaroundHours: 24 }],
      registrationDocuments: [], createdAt: new Date() },
    referrals: [sampleLabReferral()],
    payouts: [{ createdAt: new Date(), labReferralId: { referralCode: 'LAB-1' }, amountPaisa: 30000, status: 'paid', note: 'ok' }],
    auditLogs: [],
  }));
  const b = await render((res) => pdf.buildLaboratoryFilePdf(res, {
    user: { email: 'l' }, laboratory: { labName: 'Empty', testCatalog: [], registrationDocuments: [], createdAt: new Date() },
    referrals: [], payouts: [], auditLogs: [],
  }));
  assert.ok(isPdf(a) && isPdf(b));
});
