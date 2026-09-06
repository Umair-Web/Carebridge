const mongoose = require('mongoose');
const Laboratory = require('../models/Laboratory');
const LabReferral = require('../models/LabReferral');
const LabPayout = require('../models/LabPayout');
const Consultant = require('../models/Consultant');
const User = require('../models/User');
const PlatformSettings = require('../models/PlatformSettings');
const { logAction } = require('../utils/logger');
const { ageFromDob } = require('../utils/age');
const notificationService = require('../services/notificationService');
const { labDetailsViewAccessOf } = require('../utils/labReferralDetailsAccess');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const DEFAULT_ADMIN_LAB_ACCESS_PASSWORD = '123456';

async function ensureAdminLabAccessPassword() {
  let settings = await PlatformSettings.findOne().sort({ updatedAt: -1 });
  if (!settings) {
    settings = await PlatformSettings.create({});
  }
  if (!settings.adminLabProfileAccessPasswordHash) {
    settings.adminLabProfileAccessPasswordHash = await bcrypt.hash(DEFAULT_ADMIN_LAB_ACCESS_PASSWORD, 10);
    await settings.save();
  }
  return settings;
}

/** Verify admin lab-access password without a specific lab (e.g. lab referrals list). */
exports.verifyLabAccessPassword = async (req, res) => {
  try {
    const password = String(req.body.password || '');
    if (!password) {
      return res.status(400).json({ success: false, message: 'Password is required' });
    }

    const settings = await ensureAdminLabAccessPassword();
    const ok = await bcrypt.compare(password, settings.adminLabProfileAccessPasswordHash);
    if (!ok) {
      return res.status(403).json({ success: false, message: 'Incorrect access password' });
    }

    const unlockToken = jwt.sign(
      {
        purpose: 'admin_lab_profile_unlock',
        adminUserId: String(req.user.id),
        scope: 'lab_referrals',
      },
      process.env.JWT_SECRET,
      { expiresIn: '30m' }
    );

    res.json({
      success: true,
      message: 'Access granted',
      data: { unlockToken, expiresInMinutes: 30 },
    });
  } catch (error) {
    console.error('[ADMIN_VERIFY_LAB_ACCESS_GENERIC]', error);
    res.status(500).json({ success: false, message: 'Failed to verify access password' });
  }
};

/** Verify admin lab-profile access password (not the laboratory login). */
exports.verifyLabProfileAccess = async (req, res) => {
  try {
    const password = String(req.body.password || '');
    if (!password) {
      return res.status(400).json({ success: false, message: 'Password is required' });
    }

    const lab = await Laboratory.findById(req.params.id);
    if (!lab) {
      return res.status(404).json({ success: false, message: 'Laboratory not found' });
    }

    const settings = await ensureAdminLabAccessPassword();
    const ok = await bcrypt.compare(password, settings.adminLabProfileAccessPasswordHash);
    if (!ok) {
      return res.status(403).json({ success: false, message: 'Incorrect access password' });
    }

    const unlockToken = jwt.sign(
      {
        purpose: 'admin_lab_profile_unlock',
        laboratoryId: String(lab._id),
        adminUserId: String(req.user.id),
      },
      process.env.JWT_SECRET,
      { expiresIn: '30m' }
    );

    res.json({
      success: true,
      message: 'Access granted',
      data: { unlockToken, expiresInMinutes: 30 },
    });
  } catch (error) {
    console.error('[ADMIN_VERIFY_LAB_ACCESS]', error);
    res.status(500).json({ success: false, message: 'Failed to verify access password' });
  }
};

/** Change the admin lab-profile access password (requires unlock token). */
exports.changeLabProfileAccessPassword = async (req, res) => {
  try {
    const token = req.headers['x-lab-profile-unlock'];
    if (!token) {
      return res.status(403).json({ success: false, message: 'Unlock required' });
    }
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(403).json({ success: false, message: 'Unlock expired or invalid' });
    }
    if (decoded.purpose !== 'admin_lab_profile_unlock') {
      return res.status(403).json({ success: false, message: 'Invalid unlock token' });
    }

    const currentPassword = String(req.body.currentPassword || '');
    const newPassword = String(req.body.newPassword || '');
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current and new passwords are required' });
    }
    if (newPassword.length < 4) {
      return res.status(400).json({ success: false, message: 'New password must be at least 4 characters' });
    }

    const settings = await ensureAdminLabAccessPassword();
    const ok = await bcrypt.compare(currentPassword, settings.adminLabProfileAccessPasswordHash);
    if (!ok) {
      return res.status(403).json({ success: false, message: 'Current access password is incorrect' });
    }

    settings.adminLabProfileAccessPasswordHash = await bcrypt.hash(newPassword, 10);
    await settings.save();
    res.json({ success: true, message: 'Lab profile access password updated' });
  } catch (error) {
    console.error('[ADMIN_CHANGE_LAB_ACCESS]', error);
    res.status(500).json({ success: false, message: 'Failed to update access password' });
  }
};

/** Email the logged-in admin a link to reset lab-access password. */
exports.forgotLabProfileAccessPassword = async (req, res) => {
  try {
    const admin = await User.findById(req.user.id).select('name email role');
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin only' });
    }
    if (!admin.email) {
      return res.status(400).json({ success: false, message: 'Admin account has no email on file' });
    }

    await ensureAdminLabAccessPassword();

    const resetToken = jwt.sign(
      {
        purpose: 'admin_lab_access_password_reset',
        adminUserId: String(admin._id),
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const { sendAdminLabAccessResetEmail } = require('../utils/emailService');
    const sent = await sendAdminLabAccessResetEmail(admin, resetToken);
    if (sent && sent.success === false) {
      return res.status(500).json({
        success: false,
        message: sent.error || 'Failed to send reset email',
      });
    }

    res.json({
      success: true,
      message: `Reset link sent to ${admin.email}`,
    });
  } catch (error) {
    console.error('[ADMIN_FORGOT_LAB_ACCESS]', error);
    res.status(500).json({ success: false, message: 'Failed to send reset email' });
  }
};

/** Set a new lab-access password using the emailed reset token (no unlock needed). */
exports.resetLabProfileAccessPassword = async (req, res) => {
  try {
    const token = String(req.body.token || '');
    const newPassword = String(req.body.newPassword || '');
    if (!token) {
      return res.status(400).json({ success: false, message: 'Reset token is required' });
    }
    if (newPassword.length < 4) {
      return res.status(400).json({ success: false, message: 'New password must be at least 4 characters' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(403).json({ success: false, message: 'Reset link is invalid or expired' });
    }
    if (decoded.purpose !== 'admin_lab_access_password_reset' || !decoded.adminUserId) {
      return res.status(403).json({ success: false, message: 'Invalid reset token' });
    }

    const settings = await ensureAdminLabAccessPassword();
    settings.adminLabProfileAccessPasswordHash = await bcrypt.hash(newPassword, 10);
    await settings.save();

    res.json({ success: true, message: 'Laboratory access password updated. You can unlock lab profiles now.' });
  } catch (error) {
    console.error('[ADMIN_RESET_LAB_ACCESS]', error);
    res.status(500).json({ success: false, message: 'Failed to reset access password' });
  }
};

/** List labs, optionally filtered by owner-user status (?status=pending|active|suspended). */
exports.listLabs = async (req, res) => {
  try {
    const labs = await Laboratory.find()
      .populate('userId', 'name email phone status createdAt')
      .sort({ createdAt: -1 })
      .lean();

    const { status } = req.query;
    const filtered = status ? labs.filter((l) => l.userId?.status === status) : labs;

    res.json({ success: true, data: filtered });
  } catch (error) {
    console.error('[ADMIN_LIST_LABS_ERROR]', error);
    res.status(500).json({ success: false, message: 'Failed to list laboratories' });
  }
};

exports.getLab = async (req, res) => {
  try {
    const lab = await Laboratory.findById(req.params.id).populate('userId', 'name email phone status createdAt');
    if (!lab) {
      return res.status(404).json({ success: false, message: 'Laboratory not found' });
    }
    res.json({ success: true, data: lab });
  } catch (error) {
    console.error('[ADMIN_GET_LAB_ERROR]', error);
    res.status(500).json({ success: false, message: 'Failed to fetch laboratory' });
  }
};

/** Approve / suspend a laboratory — mirrors adminController.updateUserStatus hospital branch. */
exports.setLabStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'suspended'].includes(status)) {
      return res.status(400).json({ success: false, message: 'status must be active or suspended' });
    }

    const lab = await Laboratory.findById(req.params.id);
    if (!lab) {
      return res.status(404).json({ success: false, message: 'Laboratory not found' });
    }
    // Guard against an orphaned lab with no owner — without this an empty userId
    // could broaden the owner lookup and touch the wrong account.
    if (!lab.userId) {
      return res.status(409).json({ success: false, message: 'Laboratory has no linked owner account' });
    }
    const user = await User.findOne({ _id: lab.userId, role: 'laboratory' });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Laboratory owner account not found' });
    }

    user.status = status;
    if (status === 'active') {
      user.isPhoneVerified = true;
      user.isEmailVerified = true;
    }
    await user.save();

    lab.isActive = status === 'active';
    lab.isRegistrationVerified = status === 'active';
    await lab.save();

    await logAction({
      actorId: req.user.id,
      action: status === 'active' ? 'LAB_APPROVED' : 'LAB_SUSPENDED',
      entityId: lab._id,
      entityModel: 'Laboratory',
      details: { labName: lab.labName },
    });

    const notify = status === 'active' ? notificationService.notifyAccountApproved : notificationService.notifyAccountSuspended;
    notify(user).catch((err) => console.error('Lab status notify failed:', err.message));

    res.json({ success: true, message: `Laboratory ${status === 'active' ? 'approved' : 'suspended'}`, data: lab });
  } catch (error) {
    console.error('[ADMIN_SET_LAB_STATUS_ERROR]', error);
    res.status(500).json({ success: false, message: 'Failed to update laboratory status' });
  }
};

/** Update admin-controlled economics: platform deduction % and max consultant discount %. */
exports.updateLab = async (req, res) => {
  try {
    const lab = await Laboratory.findById(req.params.id);
    if (!lab) {
      return res.status(404).json({ success: false, message: 'Laboratory not found' });
    }

    const { rupeesToPaisa } = require('../services/commissionService');
    const {
      deductionPercentage,
      platformChargeType,
      labName,
      registrationNumber,
      city,
      area,
      address,
    } = req.body;
    if (deductionPercentage != null) {
      const d = Number(deductionPercentage);
      if (!Number.isFinite(d) || d < 0 || d > 100) {
        return res.status(400).json({ success: false, message: 'deductionPercentage must be between 0 and 100' });
      }
      lab.deductionPercentage = d;
    }
    // Platform charge: percentage of bill OR a flat fee per test.
    if (platformChargeType !== undefined) {
      if (!['percentage', 'fixed'].includes(platformChargeType)) {
        return res.status(400).json({ success: false, message: 'Invalid platformChargeType' });
      }
      lab.platformChargeType = platformChargeType;
    }
    if (req.body.fixedPlatformChargePaisaPerTest !== undefined && req.body.fixedPlatformChargePaisaPerTest !== null) {
      lab.fixedPlatformChargePaisaPerTest = Math.max(0, Math.round(Number(req.body.fixedPlatformChargePaisaPerTest) || 0));
    } else if (req.body.fixedPlatformChargeRupeesPerTest !== undefined && req.body.fixedPlatformChargeRupeesPerTest !== null) {
      lab.fixedPlatformChargePaisaPerTest = rupeesToPaisa(req.body.fixedPlatformChargeRupeesPerTest);
    }
    // Profile fields (admin-editable)
    if (labName != null && String(labName).trim()) lab.labName = String(labName).trim();
    if (registrationNumber != null) lab.registrationNumber = String(registrationNumber).trim();
    if (city != null) lab.city = String(city).trim();
    if (area != null) lab.area = String(area).trim();
    if (address != null) lab.address = String(address).trim();

    await lab.save();

    await logAction({
      actorId: req.user.id,
      action: 'LAB_UPDATED',
      entityId: lab._id,
      entityModel: 'Laboratory',
      details: {
        platformChargeType: lab.platformChargeType,
        deductionPercentage: lab.deductionPercentage,
        fixedPlatformChargePaisaPerTest: lab.fixedPlatformChargePaisaPerTest,
      },
    });

    res.json({ success: true, data: lab });
  } catch (error) {
    console.error('[ADMIN_UPDATE_LAB_ERROR]', error);
    res.status(500).json({ success: false, message: 'Failed to update laboratory' });
  }
};

/**
 * List every consultant with their per-consultant platform-fee override (if any) for a specific
 * lab, plus how many referrals they've sent there — so the admin can set a special per-test
 * platform fee for chosen consultants. The doctor's commission is never affected.
 */
exports.listLabConsultantOverrides = async (req, res) => {
  try {
    const lab = await Laboratory.findById(req.params.id);
    if (!lab) return res.status(404).json({ success: false, message: 'Laboratory not found' });
    const labId = String(lab._id);

    const consultants = await Consultant.find()
      .populate('userId', 'name email status')
      .select('specialty facilityPlatformOverrides userId')
      .lean();

    // Referral volume per consultant for this lab.
    const counts = await LabReferral.aggregate([
      { $match: { targetLaboratoryId: lab._id } },
      { $group: { _id: '$consultantId', n: { $sum: 1 } } },
    ]);
    const countMap = {};
    for (const c of counts) countMap[String(c._id)] = c.n;

    const data = consultants
      .filter((c) => c.userId)
      .map((c) => {
        const ov = (c.facilityPlatformOverrides || []).find(
          (o) => o && o.facilityType === 'lab' && String(o.facilityId) === labId
        );
        return {
          consultantId: c._id,
          name: c.userId?.name || 'Unknown',
          email: c.userId?.email || '',
          status: c.userId?.status || '',
          specialty: c.specialty || '',
          referralCount: Number(countMap[String(c._id)] || 0),
          override: ov
            ? {
                platformChargeType: ov.platformChargeType,
                platformChargePercentage: ov.platformChargePercentage || 0,
                fixedPlatformChargeRupees: (ov.fixedPlatformChargePaisa || 0) / 100,
              }
            : null,
        };
      })
      .sort((a, b) => b.referralCount - a.referralCount);

    res.json({ success: true, data });
  } catch (error) {
    console.error('[LAB_LIST_CONSULTANT_OVERRIDES_ERROR]', error);
    res.status(500).json({ success: false, message: 'Failed to load consultant platform fees' });
  }
};

/**
 * Set (or clear, with `remove: true`) one consultant's per-test platform-fee override for a
 * specific lab. Changes ONLY the platform charge for that consultant's referrals to this lab —
 * the doctor's commission is never touched.
 */
exports.setLabConsultantOverride = async (req, res) => {
  try {
    const { rupeesToPaisa, clampPct } = require('../services/commissionService');
    const { consultantId, platformChargeType, platformChargePercentage, fixedPlatformChargeRupees, remove } = req.body || {};

    const lab = await Laboratory.findById(req.params.id);
    if (!lab) return res.status(404).json({ success: false, message: 'Laboratory not found' });
    if (!consultantId) return res.status(400).json({ success: false, message: 'consultantId is required' });
    const consultant = await Consultant.findById(consultantId);
    if (!consultant) return res.status(404).json({ success: false, message: 'Consultant not found' });

    const labId = String(lab._id);
    // Replace, never duplicate: drop any existing override for this lab first.
    consultant.facilityPlatformOverrides = (consultant.facilityPlatformOverrides || []).filter(
      (o) => !(o && o.facilityType === 'lab' && String(o.facilityId) === labId)
    );

    if (!remove) {
      if (!['percentage', 'fixed'].includes(platformChargeType)) {
        return res.status(400).json({ success: false, message: 'platformChargeType must be percentage or fixed' });
      }
      const entry = { facilityType: 'lab', facilityId: lab._id, platformChargeType };
      if (platformChargeType === 'percentage') {
        const pct = Number(platformChargePercentage);
        if (isNaN(pct) || pct < 0 || pct > 100) {
          return res.status(400).json({ success: false, message: 'platformChargePercentage must be 0-100' });
        }
        entry.platformChargePercentage = clampPct(pct);
        entry.fixedPlatformChargePaisa = 0;
      } else {
        entry.fixedPlatformChargePaisa = rupeesToPaisa(fixedPlatformChargeRupees); // per test
        entry.platformChargePercentage = 0;
      }
      consultant.facilityPlatformOverrides.push(entry);
    }

    await consultant.save();

    await logAction({
      actorId: req.user.id,
      action: remove ? 'ADMIN_CLEAR_LAB_CONSULTANT_OVERRIDE' : 'ADMIN_SET_LAB_CONSULTANT_OVERRIDE',
      entityId: consultant._id,
      entityModel: 'Consultant',
      details: { labId, platformChargeType, platformChargePercentage, fixedPlatformChargeRupees, remove: !!remove },
    });

    res.json({ success: true, message: remove ? 'Special platform fee removed' : 'Special platform fee saved' });
  } catch (error) {
    console.error('[LAB_SET_CONSULTANT_OVERRIDE_ERROR]', error);
    res.status(500).json({ success: false, message: 'Failed to save consultant platform fee' });
  }
};

/** Oversight: list lab referrals (optionally for a single lab via ?laboratoryId=). */
exports.listLabReferrals = async (req, res) => {
  try {
    const filter = {};
    if (req.query.laboratoryId && mongoose.Types.ObjectId.isValid(req.query.laboratoryId)) {
      filter.targetLaboratoryId = req.query.laboratoryId;
    }
    const referrals = await LabReferral.find(filter)
      .populate('targetLaboratoryId', 'labName')
      .populate({ path: 'consultantId', populate: { path: 'userId', select: 'name email phone' } })
      .sort({ createdAt: -1 })
      .limit(500);
    res.json({
      success: true,
      data: referrals.map((r) => ({
        ...(r.toObject ? r.toObject() : r),
        detailsViewAccess: labDetailsViewAccessOf(r),
      })),
    });
  } catch (error) {
    console.error('[ADMIN_LIST_LAB_REFERRALS_ERROR]', error);
    res.status(500).json({ success: false, message: 'Failed to list lab referrals' });
  }
};

/** Oversight: list lab payouts (optionally for a single lab via ?laboratoryId=). */
exports.listLabPayouts = async (req, res) => {
  try {
    const filter = {};
    if (req.query.laboratoryId && mongoose.Types.ObjectId.isValid(req.query.laboratoryId)) {
      filter.laboratoryId = req.query.laboratoryId;
    }
    const payouts = await LabPayout.find(filter)
      .populate('laboratoryId', 'labName')
      .populate('labReferralId', 'referralCode patientName')
      .populate({ path: 'consultantId', populate: { path: 'userId', select: 'name' } })
      .sort({ createdAt: -1 })
      .limit(500);

    const accruedPaisa = payouts.filter((p) => p.status === 'accrued').reduce((s, p) => s + (p.amountPaisa || 0), 0);
    const paidPaisa = payouts.filter((p) => p.status === 'paid').reduce((s, p) => s + (p.amountPaisa || 0), 0);

    res.json({ success: true, data: payouts, summary: { accruedPaisa, paidPaisa, totalPaisa: accruedPaisa + paidPaisa } });
  } catch (error) {
    console.error('[ADMIN_LIST_LAB_PAYOUTS_ERROR]', error);
    res.status(500).json({ success: false, message: 'Failed to list lab payouts' });
  }
};

/** Admin edits a lab referral (oversight correction). */
exports.updateLabReferral = async (req, res) => {
  try {
    const referral = await LabReferral.findById(req.params.id);
    if (!referral) {
      return res.status(404).json({ success: false, message: 'Lab referral not found' });
    }

    const b = req.body;
    if (b.patientName != null && String(b.patientName).trim()) referral.patientName = String(b.patientName).trim();
    // DOB is the source of truth; derive age from it when supplied.
    if (b.dateOfBirth) {
      referral.dateOfBirth = new Date(b.dateOfBirth);
      const derivedAge = ageFromDob(b.dateOfBirth);
      if (derivedAge != null) referral.age = derivedAge;
    } else if (b.age != null && Number(b.age) >= 0) {
      referral.age = Number(b.age);
    }
    if (b.gender && ['male', 'female', 'other'].includes(b.gender)) referral.gender = b.gender;
    if (b.phone != null) referral.phone = String(b.phone).replace(/[\s\-()]/g, '');
    if (b.area != null) referral.area = String(b.area).trim();
    if (b.guardianName != null) referral.guardianName = String(b.guardianName).trim();
    if (b.guardianRelation && ['S/O', 'D/O', 'W/O'].includes(b.guardianRelation)) referral.guardianRelation = b.guardianRelation;
    if (b.urgency && ['emergency', 'urgent', 'routine'].includes(b.urgency)) referral.urgency = b.urgency;
    if (b.summaryNotes != null) referral.summaryNotes = String(b.summaryNotes).trim();
    if (b.symptomsText != null) referral.symptomsText = String(b.symptomsText).trim();
    if (b.notes != null) referral.notes = String(b.notes).trim();
    if (b.status && ['pending', 'accepted', 'reported', 'closed', 'rejected'].includes(b.status)) referral.status = b.status;
    if (b.rejectionReason != null) referral.rejectionReason = String(b.rejectionReason).trim();
    if (b.expectedReportAt) {
      const d = new Date(b.expectedReportAt);
      if (!isNaN(d.getTime())) referral.expectedReportAt = d;
    }
    if (Array.isArray(b.recommendedTests)) {
      referral.recommendedTests = b.recommendedTests
        .filter((t) => t && String(t.testName || '').trim())
        .map((t) => ({ testName: String(t.testName).trim(), note: String(t.note || '').trim() }));
    }
    if (b.discountPercentage != null) {
      // Cap admin-set discount to the consultant's per-consultant max as well.
      const refConsultant = await Consultant.findById(referral.consultantId).select('maxLabDiscountPercentage');
      const cap = refConsultant?.maxLabDiscountPercentage ?? 100;
      referral.discountPercentage = Math.max(0, Math.min(cap, Number(b.discountPercentage) || 0));
    }
    if (Array.isArray(b.services)) {
      referral.services = b.services
        .filter((s) => String(s.description || '').trim())
        .map((s) => ({ description: String(s.description).trim(), amountPaisa: Math.max(0, Number(s.amountPaisa) || 0) }));
    }
    // Recompute bill totals from current services + discount
    const gross = (referral.services || []).reduce((sum, s) => sum + (s.amountPaisa || 0), 0);
    const discountAmt = Math.round(gross * ((referral.discountPercentage || 0) / 100));
    referral.grossAmountPaisa = gross;
    referral.discountAmountPaisa = discountAmt;
    referral.billTotalPaisa = Math.max(0, gross - discountAmt);

    await referral.save();

    await logAction({
      actorId: req.user.id,
      action: 'ADMIN_LAB_REFERRAL_UPDATED',
      entityId: referral._id,
      entityModel: 'LabReferral',
      details: { referralCode: referral.referralCode },
    });

    res.json({ success: true, data: referral });
  } catch (error) {
    console.error('[ADMIN_UPDATE_LAB_REFERRAL_ERROR]', error);
    res.status(500).json({ success: false, message: 'Failed to update lab referral' });
  }
};

/** Toggle consultant external view of lab referral patient details (no password). */
exports.setLabReferralDetailsViewAccess = async (req, res) => {
  try {
    const { detailsViewAccess } = req.body;
    if (!['active', 'suspended'].includes(detailsViewAccess)) {
      return res.status(400).json({ success: false, message: 'detailsViewAccess must be active or suspended' });
    }

    const referral = await LabReferral.findById(req.params.id);
    if (!referral) {
      return res.status(404).json({ success: false, message: 'Lab referral not found' });
    }

    referral.detailsViewAccess = detailsViewAccess;
    await referral.save();

    await logAction({
      actorId: req.user.id,
      action: 'ADMIN_LAB_REFERRAL_DETAILS_VIEW_ACCESS',
      entityId: referral._id,
      entityModel: 'LabReferral',
      details: { detailsViewAccess, referralCode: referral.referralCode },
    });

    res.json({
      success: true,
      message: `Consultant details view set to ${detailsViewAccess}`,
      data: { detailsViewAccess: labDetailsViewAccessOf(referral) },
    });
  } catch (error) {
    console.error('[ADMIN_LAB_REFERRAL_VIEW_ACCESS_ERROR]', error);
    res.status(500).json({ success: false, message: 'Failed to update details view access' });
  }
};
