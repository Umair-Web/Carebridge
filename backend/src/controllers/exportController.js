/**
 * Export Controller — downloadable PDF records.
 *
 * Data is fully gathered BEFORE streaming begins, so authorization/lookup
 * failures return clean JSON; only once a builder is invoked do we commit the
 * PDF response headers.
 */
const Consultant = require('../models/Consultant');
const Hospital = require('../models/Hospital');
const Referral = require('../models/Referral');
const Admission = require('../models/Admission');
const LabReferral = require('../models/LabReferral');
const Payout = require('../models/Payout');
const LabPayout = require('../models/LabPayout');
const Laboratory = require('../models/Laboratory');
const AuditLog = require('../models/AuditLog');
const User = require('../models/User');
const WeeklySettlement = require('../models/WeeklySettlement');
const { getHospitalForUser, getLabForUser } = require('../utils/resolveOrg');
const { effectiveDetailsViewAccess } = require('../utils/referralDetailsAccess');
const { labDetailsViewAccessOf } = require('../utils/labReferralDetailsAccess');
const pdf = require('../services/pdfExportService');

/** Fetch admission + best-effort related lab referrals for a single referral. */
async function loadRecordExtras(referral) {
  const admission = await Admission.findOne({ referralId: referral._id })
    .populate('treatingDoctorId', 'name specialty')
    .lean();
  // Lab referrals share no hard FK with a hospital referral; match on the same
  // consultant + patient phone as a best-effort link.
  const labReferrals = await LabReferral.find({
    consultantId: referral.consultantId,
    phone: referral.phone,
  })
    .sort({ createdAt: -1 })
    .lean();
  return { admission, labReferrals };
}

/**
 * Run an async builder, guarding against errors. The builder buffers its output
 * and only writes to `res` at the very end, so a failure during data fetch /
 * document embedding / merge still leaves headers unsent and returns clean JSON.
 */
function stream(res, fn) {
  Promise.resolve()
    .then(fn)
    .catch((err) => {
      console.error('PDF export stream error:', err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: 'Failed to generate PDF' });
      } else {
        res.end();
      }
    });
}

// ── Consultant ────────────────────────────────────────────────────────────────

/** GET /v1/exports/consultant/referrals/:id — individual patient record PDF. */
exports.consultantReferralRecord = async (req, res) => {
  try {
    const consultant = await Consultant.findOne({ userId: req.user.id });
    if (!consultant) return res.status(404).json({ success: false, message: 'Consultant profile not found' });

    const referral = await Referral.findById(req.params.id); // non-lean → cnic getter decrypts
    if (!referral) return res.status(404).json({ success: false, message: 'Referral not found' });
    if (referral.consultantId.toString() !== consultant._id.toString()) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    if (effectiveDetailsViewAccess(referral) !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Patient details viewing is suspended by admin',
        detailsViewAccess: effectiveDetailsViewAccess(referral),
      });
    }

    const { admission, labReferrals } = await loadRecordExtras(referral);
    // Consultant PDF omits billing / payment amounts — clinical + admission only.
    stream(res, () => pdf.buildReferralRecordPdf(res, { referral, admission, labReferrals, hideBilling: true }));
  } catch (err) {
    console.error('consultantReferralRecord error:', err);
    if (!res.headersSent) res.status(500).json({ success: false, message: 'Error generating record' });
  }
};

/** GET /v1/exports/consultant/referrals — combined roster of all my referrals. */
exports.consultantReferralsRoster = async (req, res) => {
  try {
    const consultant = await Consultant.findOne({ userId: req.user.id });
    if (!consultant) return res.status(404).json({ success: false, message: 'Consultant profile not found' });

    const referrals = await Referral.find({ consultantId: consultant._id })
      .populate('targetHospitalId', 'hospitalName')
      .sort({ createdAt: -1 })
      .lean();

    stream(res, () => pdf.buildConsultantReferralsPdf(res, { consultantName: req.user.name, referrals }));
  } catch (err) {
    console.error('consultantReferralsRoster error:', err);
    if (!res.headersSent) res.status(500).json({ success: false, message: 'Error generating roster' });
  }
};

// ── Hospital ──────────────────────────────────────────────────────────────────

/** GET /v1/exports/hospital/referrals/:id — individual patient record PDF. */
exports.hospitalReferralRecord = async (req, res) => {
  try {
    const hospital = await getHospitalForUser(req.user);
    if (!hospital) return res.status(404).json({ success: false, message: 'Hospital profile not found' });

    const referral = await Referral.findById(req.params.id);
    if (!referral) return res.status(404).json({ success: false, message: 'Referral not found' });
    if (!referral.targetHospitalId || referral.targetHospitalId.toString() !== hospital._id.toString()) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    if (effectiveDetailsViewAccess(referral) !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Patient details viewing is suspended by admin',
        detailsViewAccess: effectiveDetailsViewAccess(referral),
      });
    }

    const { admission, labReferrals } = await loadRecordExtras(referral);
    stream(res, () => pdf.buildReferralRecordPdf(res, { referral, admission, labReferrals, hideBilling: true }));
  } catch (err) {
    console.error('hospitalReferralRecord error:', err);
    if (!res.headersSent) res.status(500).json({ success: false, message: 'Error generating record' });
  }
};

/** GET /v1/exports/hospital/records — combined PDF of all hospital patient records. */
exports.hospitalRecords = async (req, res) => {
  try {
    const hospital = await getHospitalForUser(req.user);
    if (!hospital) return res.status(404).json({ success: false, message: 'Hospital profile not found' });

    const referrals = await Referral.find({ targetHospitalId: hospital._id })
      .populate({ path: 'consultantId', select: 'userId', populate: { path: 'userId', select: 'name' } })
      .sort({ createdAt: -1 })
      .lean();

    stream(res, () => pdf.buildHospitalRecordsPdf(res, { hospital, referrals }));
  } catch (err) {
    console.error('hospitalRecords error:', err);
    if (!res.headersSent) res.status(500).json({ success: false, message: 'Error generating records' });
  }
};

// ── Admin ─────────────────────────────────────────────────────────────────────

/** GET /v1/exports/admin/referrals/:id — individual patient record PDF (any). */
exports.adminReferralRecord = async (req, res) => {
  try {
    const referral = await Referral.findById(req.params.id);
    if (!referral) return res.status(404).json({ success: false, message: 'Referral not found' });
    const { admission, labReferrals } = await loadRecordExtras(referral);
    stream(res, () => pdf.buildReferralRecordPdf(res, { referral, admission, labReferrals }));
  } catch (err) {
    console.error('adminReferralRecord error:', err);
    if (!res.headersSent) res.status(500).json({ success: false, message: 'Error generating record' });
  }
};

/** GET /v1/exports/admin/consultants/:id — complete consultant file. (:id = User or Consultant id) */
exports.adminConsultantFile = async (req, res) => {
  try {
    const { id } = req.params;
    let user = await User.findById(id).select('-passwordHash').lean();
    let consultant = null;
    if (user) {
      consultant = await Consultant.findOne({ userId: user._id }).lean();
    } else {
      consultant = await Consultant.findById(id).lean();
      if (consultant) user = await User.findById(consultant.userId).select('-passwordHash').lean();
    }
    if (!user || !consultant) return res.status(404).json({ success: false, message: 'Consultant not found' });

    const [referrals, payouts, auditLogs] = await Promise.all([
      Referral.find({ consultantId: consultant._id }).populate('targetHospitalId', 'hospitalName').sort({ createdAt: -1 }).lean(),
      Payout.find({ consultantId: consultant._id }).populate('referralId', 'referralCode').sort({ createdAt: -1 }).lean(),
      AuditLog.find({ actorId: user._id }).sort({ createdAt: -1 }).limit(200).lean(),
    ]);

    stream(res, () => pdf.buildConsultantFilePdf(res, { user, consultant, referrals, payouts, auditLogs }));
  } catch (err) {
    console.error('adminConsultantFile error:', err);
    if (!res.headersSent) res.status(500).json({ success: false, message: 'Error generating consultant file' });
  }
};

/** GET /v1/exports/admin/hospitals/:id — complete hospital file. (:id = User or Hospital id) */
exports.adminHospitalFile = async (req, res) => {
  try {
    const { id } = req.params;
    let hospital = await Hospital.findById(id).lean();
    if (!hospital) hospital = await Hospital.findOne({ userId: id }).lean();
    if (!hospital) return res.status(404).json({ success: false, message: 'Hospital not found' });

    const user = await User.findById(hospital.userId).select('-passwordHash').lean();

    const [referrals, admissions, settlements, auditLogs] = await Promise.all([
      Referral.find({ targetHospitalId: hospital._id }).sort({ createdAt: -1 }).lean(),
      Admission.find({ hospitalId: hospital._id }).sort({ admitDate: -1 }).lean(),
      WeeklySettlement.find({ hospitalId: hospital._id }).sort({ billingPeriodStart: -1 }).lean(),
      AuditLog.find({ actorId: hospital.userId }).sort({ createdAt: -1 }).limit(200).lean(),
    ]);

    stream(res, () => pdf.buildHospitalFilePdf(res, { user, hospital, referrals, admissions, settlements, auditLogs }));
  } catch (err) {
    console.error('adminHospitalFile error:', err);
    if (!res.headersSent) res.status(500).json({ success: false, message: 'Error generating hospital file' });
  }
};

// ── Laboratory module ─────────────────────────────────────────────────────────

/** GET /v1/exports/consultant/lab-referrals/:id — consultant's individual lab record. */
exports.consultantLabReferralRecord = async (req, res) => {
  try {
    const consultant = await Consultant.findOne({ userId: req.user.id });
    if (!consultant) return res.status(404).json({ success: false, message: 'Consultant profile not found' });

    const referral = await LabReferral.findById(req.params.id).populate('targetLaboratoryId', 'labName city area');
    if (!referral) return res.status(404).json({ success: false, message: 'Lab referral not found' });
    if (referral.consultantId.toString() !== consultant._id.toString()) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    if (labDetailsViewAccessOf(referral) !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Patient details viewing is suspended by admin',
        detailsViewAccess: 'suspended',
      });
    }
    const labPayout = await LabPayout.findOne({ labReferralId: referral._id }).lean();
    stream(res, () =>
      pdf.buildLabReferralRecordPdf(res, {
        referral,
        labPayout: null,
        hideBilling: true,
      })
    );
  } catch (err) {
    console.error('consultantLabReferralRecord error:', err);
    if (!res.headersSent) res.status(500).json({ success: false, message: 'Error generating lab record' });
  }
};

/** GET /v1/exports/consultant/lab-referrals — consultant's combined lab roster. */
exports.consultantLabReferralsRoster = async (req, res) => {
  try {
    const consultant = await Consultant.findOne({ userId: req.user.id });
    if (!consultant) return res.status(404).json({ success: false, message: 'Consultant profile not found' });

    const referrals = await LabReferral.find({ consultantId: consultant._id })
      .populate('targetLaboratoryId', 'labName')
      .sort({ createdAt: -1 })
      .lean();

    stream(res, () => pdf.buildLabReferralsRosterPdf(res, {
      heading: 'Laboratory Referral History',
      subtitle: req.user.name ? `Consultant: ${req.user.name}` : undefined,
      filename: 'My_Lab_Referrals.pdf',
      referrals,
      partyLabel: 'Laboratory',
      partyValue: (r) => r.targetLaboratoryId?.labName,
      hideBilling: true,
    }));
  } catch (err) {
    console.error('consultantLabReferralsRoster error:', err);
    if (!res.headersSent) res.status(500).json({ success: false, message: 'Error generating lab roster' });
  }
};

/** GET /v1/exports/lab/referrals/:id — laboratory's individual lab record. */
exports.labReferralRecord = async (req, res) => {
  try {
    const lab = await getLabForUser(req.user);
    if (!lab) return res.status(404).json({ success: false, message: 'Laboratory profile not found' });

    const referral = await LabReferral.findById(req.params.id).populate('targetLaboratoryId', 'labName city area');
    if (!referral) return res.status(404).json({ success: false, message: 'Lab referral not found' });
    if (!referral.targetLaboratoryId || referral.targetLaboratoryId._id.toString() !== lab._id.toString()) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    stream(res, () => pdf.buildLabReferralRecordPdf(res, { referral, labPayout: null, hideBilling: true }));
  } catch (err) {
    console.error('labReferralRecord error:', err);
    if (!res.headersSent) res.status(500).json({ success: false, message: 'Error generating lab record' });
  }
};

/** GET /v1/exports/lab/records — laboratory's combined lab roster. */
exports.labRecords = async (req, res) => {
  try {
    const lab = await getLabForUser(req.user);
    if (!lab) return res.status(404).json({ success: false, message: 'Laboratory profile not found' });

    const referrals = await LabReferral.find({ targetLaboratoryId: lab._id })
      .populate({ path: 'consultantId', select: 'userId', populate: { path: 'userId', select: 'name' } })
      .sort({ createdAt: -1 })
      .lean();

    stream(res, () => pdf.buildLabReferralsRosterPdf(res, {
      heading: 'Laboratory Patient Records',
      subtitle: `Laboratory: ${lab.labName}`,
      filename: 'Lab_Records.pdf',
      referrals,
      partyLabel: 'Consultant',
      partyValue: (r) => r.consultantId?.userId?.name,
      hideBilling: true,
    }));
  } catch (err) {
    console.error('labRecords error:', err);
    if (!res.headersSent) res.status(500).json({ success: false, message: 'Error generating lab records' });
  }
};

/** GET /v1/exports/admin/lab-referrals/:id — individual lab record (any). */
exports.adminLabReferralRecord = async (req, res) => {
  try {
    const referral = await LabReferral.findById(req.params.id).populate('targetLaboratoryId', 'labName city area');
    if (!referral) return res.status(404).json({ success: false, message: 'Lab referral not found' });
    const labPayout = await LabPayout.findOne({ labReferralId: referral._id }).lean();
    stream(res, () => pdf.buildLabReferralRecordPdf(res, { referral, labPayout }));
  } catch (err) {
    console.error('adminLabReferralRecord error:', err);
    if (!res.headersSent) res.status(500).json({ success: false, message: 'Error generating lab record' });
  }
};

/** GET /v1/exports/admin/laboratories/:id — complete laboratory file. (:id = User or Laboratory id) */
exports.adminLaboratoryFile = async (req, res) => {
  try {
    const { id } = req.params;
    let laboratory = await Laboratory.findById(id).lean();
    if (!laboratory) laboratory = await Laboratory.findOne({ userId: id }).lean();
    if (!laboratory) return res.status(404).json({ success: false, message: 'Laboratory not found' });

    const user = await User.findById(laboratory.userId).select('-passwordHash').lean();

    const [referrals, payouts, auditLogs] = await Promise.all([
      LabReferral.find({ targetLaboratoryId: laboratory._id }).sort({ createdAt: -1 }).lean(),
      LabPayout.find({ laboratoryId: laboratory._id }).populate('labReferralId', 'referralCode').sort({ createdAt: -1 }).lean(),
      AuditLog.find({ actorId: laboratory.userId }).sort({ createdAt: -1 }).limit(200).lean(),
    ]);

    stream(res, () => pdf.buildLaboratoryFilePdf(res, { user, laboratory, referrals, payouts, auditLogs }));
  } catch (err) {
    console.error('adminLaboratoryFile error:', err);
    if (!res.headersSent) res.status(500).json({ success: false, message: 'Error generating laboratory file' });
  }
};
