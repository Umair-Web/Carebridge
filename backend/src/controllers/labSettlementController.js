const LabSettlement = require('../models/LabSettlement');
const { getLabForUser } = require('../utils/resolveOrg');
const LabReferral = require('../models/LabReferral');
const LabPayout = require('../models/LabPayout');
const Laboratory = require('../models/Laboratory');
const Consultant = require('../models/Consultant');
const User = require('../models/User');
const PlatformSettings = require('../models/PlatformSettings');
const { logAction } = require('../utils/logger');
const notificationService = require('../services/notificationService');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const DEFAULT_LAB_PORTAL_SETTLEMENTS_PAGE_PASSWORD = 'labsettly123?';

async function ensureLabPortalSettlementsPagePassword() {
  let settings = await PlatformSettings.findOne().sort({ updatedAt: -1 });
  if (!settings) {
    settings = await PlatformSettings.create({});
  }
  if (!settings.labPortalSettlementsPageAccessPasswordHash) {
    settings.labPortalSettlementsPageAccessPasswordHash = await bcrypt.hash(
      DEFAULT_LAB_PORTAL_SETTLEMENTS_PAGE_PASSWORD,
      10
    );
    await settings.save();
  }
  return settings;
}
// 1. Lab lists referrals eligible for weekly settlement (closed and not settled)
exports.listPendingReferrals = async (req, res) => {
  try {
    const lab = await getLabForUser(req.user);
    if (!lab) {
      return res.status(404).json({ success: false, message: 'Laboratory profile not found' });
    }

    const referrals = await LabReferral.find({
      targetLaboratoryId: lab._id,
      status: 'closed',
      weeklySettlementId: null,
    })
      .populate({ path: 'consultantId', select: 'promoCode', populate: { path: 'userId', select: 'name email' } })
      .sort({ completedAt: -1 });

    // Read the immutable LabPayout snapshot so the preview == the final settled amount.
    const payouts = await LabPayout.find({ labReferralId: { $in: referrals.map((r) => r._id) } });
    const snapByReferral = {};
    for (const p of payouts) {
      if (!p.labReferralId) continue;
      snapByReferral[p.labReferralId.toString()] = p;
    }

    const results = referrals.map((ref) => {
      const doc = ref.toObject();
      const snap = snapByReferral[ref._id.toString()];
      const fallback = Math.round((doc.billTotalPaisa || 0) * ((lab.deductionPercentage || 20) / 100));
      doc.platformChargePaisa = snap ? (snap.platformChargePaisa ?? snap.adminSharePaisa ?? 0) : fallback;
      doc.doctorCommissionPaisa = snap ? (snap.doctorCommissionPaisa ?? snap.amountPaisa ?? 0) : 0;
      doc.totalCutPaisa = snap ? (snap.totalCutPaisa || snap.platformCutPaisa || 0) : fallback;
      doc.calculatedPlatformCutPaisa = doc.totalCutPaisa; // total the lab owes (back-compat name)
      return doc;
    });

    res.json({ success: true, data: results });
  } catch (error) {
    console.error('[LIST_PENDING_LAB_REFERRALS_ERROR]', error);
    res.status(500).json({ success: false, message: 'Failed to fetch pending referrals' });
  }
};

// 2. Lab creates a weekly settlement and uploads its payment receipt in one step.
//    The selected referrals' individual bills (patientBillFileUrl) are auto-attached
//    via labReferralIds — no separate weekly bill summary is collected.
exports.createSettlement = async (req, res) => {
  try {
    const { billingPeriodStart, billingPeriodEnd, labReferralIds, labReceiptFileUrl, notes } = req.body;

    if (!billingPeriodStart || !billingPeriodEnd || !labReferralIds || !labReferralIds.length || !labReceiptFileUrl) {
      return res.status(400).json({ success: false, message: 'Missing required settlement parameters' });
    }

    const lab = await getLabForUser(req.user);
    if (!lab) {
      return res.status(404).json({ success: false, message: 'Laboratory profile not found' });
    }

    // 1. Verify referrals are eligible
    const referrals = await LabReferral.find({
      _id: { $in: labReferralIds },
      targetLaboratoryId: lab._id,
      status: 'closed',
      weeklySettlementId: null,
    });

    if (referrals.length !== labReferralIds.length) {
      return res.status(400).json({ success: false, message: 'Some selected referrals are invalid or already settled' });
    }

    // 2. Load accrued payouts for these referrals to extract precise splits
    const payouts = await LabPayout.find({
      labReferralId: { $in: labReferralIds },
      status: 'accrued',
      weeklySettlementId: null,
    });

    // 3. Compute sums from the immutable payout snapshots (lab owes Σ totalCut).
    const grossAmountPaisa = referrals.reduce((sum, r) => sum + (r.billTotalPaisa || 0), 0);
    const facilityTotalPayablePaisa = payouts.reduce(
      (sum, p) => sum + (p.totalCutPaisa || p.platformCutPaisa || 0),
      0
    );
    const doctorCommissionTotalPaisa = payouts.reduce(
      (sum, p) => sum + (p.doctorCommissionPaisa || p.amountPaisa || 0),
      0
    );
    const platformChargeTotalPaisa = payouts.reduce(
      (sum, p) => sum + (p.platformChargePaisa || p.adminSharePaisa || 0),
      0
    );
    const calculatedPlatformCutPaisa = facilityTotalPayablePaisa; // what the lab transfers

    // 4. Group payouts by consultant, snapshotting commission FROM the payout (not live).
    const consultantMap = {};
    for (const payout of payouts) {
      const cIdStr = payout.consultantId.toString();
      if (!consultantMap[cIdStr]) {
        consultantMap[cIdStr] = {
          consultantId: payout.consultantId,
          amountPaisa: 0,
          commissionPercentage: payout.commissionPercentage || 0,
          commissionType: payout.commissionType || 'percentage',
          fixedCommissionPaisa: payout.fixedCommissionPaisa || 0,
          status: 'pending_payout',
        };
      }
      consultantMap[cIdStr].amountPaisa += payout.amountPaisa;
    }
    const consultantPayouts = Object.values(consultantMap);

    // 5. Create settlement record — lab pays the platform fee and uploads its
    //    receipt at creation, so it goes straight to admin verification.
    const settlement = await LabSettlement.create({
      laboratoryId: lab._id,
      billingPeriodStart: new Date(billingPeriodStart),
      billingPeriodEnd: new Date(billingPeriodEnd),
      labReferralIds,
      grossAmountPaisa,
      deductionPercentage: lab.deductionPercentage || 20,
      calculatedPlatformCutPaisa,
      doctorCommissionTotalPaisa,
      platformChargeTotalPaisa,
      facilityTotalPayablePaisa,
      labReceiptFileUrl,
      labPaidAt: new Date(),
      notes,
      status: 'pending_admin_verification',
      consultantPayouts,
    });

    // 6. Link referrals and payouts to this settlement
    await LabReferral.updateMany({ _id: { $in: labReferralIds } }, { $set: { weeklySettlementId: settlement._id } });
    await LabPayout.updateMany({ labReferralId: { $in: labReferralIds } }, { $set: { weeklySettlementId: settlement._id } });

    // 7. Audit log
    await logAction({
      actorId: req.user.id,
      action: 'LAB_SETTLEMENT_CREATED',
      entityId: settlement._id,
      entityModel: 'LabSettlement',
      details: { grossAmountPaisa, calculatedPlatformCutPaisa },
    });

    notificationService
      .notifyAllAdmins('LAB_SETTLEMENT_CREATED', `New weekly lab settlement submitted by ${lab.labName}`, {
        labName: lab.labName,
        grossAmount: (grossAmountPaisa / 100).toFixed(2),
        platformCut: (calculatedPlatformCutPaisa / 100).toFixed(2),
      })
      .catch((err) => console.error('Lab settlement created notify failed:', err.message));

    res.status(201).json({ success: true, message: 'Settlement submitted with payment receipt — awaiting admin verification', data: settlement });
  } catch (error) {
    console.error('[CREATE_LAB_SETTLEMENT_ERROR]', error);
    res.status(500).json({ success: false, message: 'Failed to create weekly lab settlement summary' });
  }
};

// 3. Lab uploads proof of manual transfer receipt
exports.uploadLabReceipt = async (req, res) => {
  try {
    const { labReceiptFileUrl } = req.body;
    const { id } = req.params;

    if (!labReceiptFileUrl) {
      return res.status(400).json({ success: false, message: 'Receipt URL is required' });
    }

    const lab = await getLabForUser(req.user);
    if (!lab) {
      return res.status(404).json({ success: false, message: 'Laboratory profile not found' });
    }

    const settlement = await LabSettlement.findOne({ _id: id, laboratoryId: lab._id });
    if (!settlement) {
      return res.status(404).json({ success: false, message: 'Lab settlement not found' });
    }

    if (settlement.status !== 'pending_payment') {
      return res.status(400).json({ success: false, message: 'Settlement is not in pending payment state' });
    }

    settlement.labReceiptFileUrl = labReceiptFileUrl;
    settlement.labPaidAt = new Date();
    settlement.status = 'pending_admin_verification';
    settlement.rejectionReason = null;
    await settlement.save();

    await logAction({
      actorId: req.user.id,
      action: 'LAB_RECEIPT_UPLOADED',
      entityId: settlement._id,
      entityModel: 'LabSettlement',
      details: { labReceiptFileUrl },
    });

    notificationService
      .notifyAllAdmins('LAB_RECEIPT_UPLOADED', `${lab.labName} uploaded a payment receipt for verification`, {
        labName: lab.labName,
      })
      .catch((err) => console.error('Lab receipt uploaded notify failed:', err.message));

    res.json({ success: true, message: 'Payment receipt uploaded successfully', data: settlement });
  } catch (error) {
    console.error('[UPLOAD_LAB_RECEIPT_ERROR]', error);
    res.status(500).json({ success: false, message: 'Failed to upload receipt' });
  }
};

// 4. Lab lists its settlements
exports.listLabSettlements = async (req, res) => {
  try {
    const lab = await getLabForUser(req.user);
    if (!lab) {
      return res.status(404).json({ success: false, message: 'Laboratory profile not found' });
    }

    const settlements = await LabSettlement.find({ laboratoryId: lab._id })
      .populate({
        path: 'labReferralIds',
        select: 'referralCode patientName billTotalPaisa status completedAt patientBillFileUrl consultantId',
        populate: { path: 'consultantId', select: 'promoCode' },
      })
      .populate({ path: 'consultantPayouts.consultantId', populate: { path: 'userId', select: 'name payoutAccount' } })
      .sort({ createdAt: -1 });

    // Hide consultant payout amounts from the lab (they only owe the platform cut)
    const results = settlements.map((s) => {
      const doc = s.toObject();
      if (doc.consultantPayouts) {
        doc.consultantPayouts = doc.consultantPayouts.map((p) => {
          delete p.amountPaisa;
          delete p.commissionPercentage;
          delete p.commissionType;
          delete p.fixedCommissionPaisa;
          return p;
        });
      }
      return doc;
    });

    res.json({ success: true, data: results });
  } catch (error) {
    console.error('[LIST_LAB_SETTLEMENTS_ERROR]', error);
    res.status(500).json({ success: false, message: 'Failed to list settlements' });
  }
};

// 5. Admin lists all lab settlements in the manual approval queue
exports.adminListSettlements = async (req, res) => {
  try {
    const settlements = await LabSettlement.find()
      .populate('laboratoryId', 'labName deductionPercentage')
      .populate({
        path: 'labReferralIds',
        select: 'billTotalPaisa completedAt patientBillFileUrl referralCode patientName consultantId',
        populate: { path: 'consultantId', select: 'promoCode', populate: { path: 'userId', select: 'name' } },
      })
      .populate({ path: 'consultantPayouts.consultantId', select: 'promoCode', populate: { path: 'userId', select: 'name payoutAccount' } })
      .sort({ createdAt: -1 });

    res.json({ success: true, data: settlements });
  } catch (error) {
    console.error('[ADMIN_LIST_LAB_SETTLEMENTS_ERROR]', error);
    res.status(500).json({ success: false, message: 'Failed to fetch settlements' });
  }
};

// 6. Admin verifies or rejects the lab receipt
exports.adminVerifyLabReceipt = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, rejectionReason } = req.body;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Action must be approve or reject' });
    }

    const settlement = await LabSettlement.findById(id);
    if (!settlement) {
      return res.status(404).json({ success: false, message: 'Settlement not found' });
    }

    if (!['pending_admin_verification', 'pending_payment'].includes(settlement.status)) {
      return res.status(400).json({ success: false, message: 'Settlement is not in a verifiable state' });
    }

    if (action === 'approve') {
      settlement.status = 'paid_pending_consultant_payout';
      settlement.adminVerifiedAt = new Date();
      settlement.adminVerifierId = req.user.id;
    } else {
      if (!rejectionReason) {
        return res.status(400).json({ success: false, message: 'Rejection reason is required' });
      }
      settlement.status = 'pending_payment';
      settlement.rejectionReason = rejectionReason;
      settlement.labReceiptFileUrl = null;
    }

    await settlement.save();

    await logAction({
      actorId: req.user.id,
      action: action === 'approve' ? 'ADMIN_LAB_SETTLEMENT_APPROVED' : 'ADMIN_LAB_SETTLEMENT_REJECTED',
      entityId: settlement._id,
      entityModel: 'LabSettlement',
      details: { rejectionReason },
    });

    const lab = await Laboratory.findById(settlement.laboratoryId);
    const labUser = lab ? await User.findOne({ _id: lab.userId, role: 'laboratory' }) : null;
    if (labUser) {
      const type = action === 'approve' ? 'SETTLEMENT_VERIFIED' : 'SETTLEMENT_REJECTED';
      const message =
        action === 'approve'
          ? 'Your lab payment receipt has been verified.'
          : `Your lab payment receipt was rejected: ${rejectionReason}`;
      notificationService
        .sendAlert({
          userId: labUser._id,
          role: 'laboratory',
          type,
          message,
          data: { email: labUser.email, phone: labUser.phone, name: labUser.name, reason: rejectionReason },
        })
        .catch((err) => console.error('Lab settlement verify notify failed:', err.message));
    }

    res.json({ success: true, message: `Settlement successfully ${action}d`, data: settlement });
  } catch (error) {
    console.error('[ADMIN_VERIFY_LAB_SETTLEMENT_ERROR]', error);
    res.status(500).json({ success: false, message: 'Failed to process verification' });
  }
};

// 7. Admin uploads proof of manual payout to a consultant under a settlement
exports.adminUploadConsultantPayout = async (req, res) => {
  try {
    const { id } = req.params;
    const { consultantId, payoutReceiptFileUrl } = req.body;

    if (!consultantId || !payoutReceiptFileUrl) {
      return res.status(400).json({ success: false, message: 'Consultant ID and payout receipt URL are required' });
    }

    const settlement = await LabSettlement.findById(id);
    if (!settlement) {
      return res.status(404).json({ success: false, message: 'Settlement not found' });
    }

    if (!['paid_pending_consultant_payout', 'paid_pending_consultant_verification'].includes(settlement.status)) {
      return res.status(400).json({ success: false, message: 'Invalid settlement status for payouts' });
    }

    const payoutIndex = settlement.consultantPayouts.findIndex((p) => p.consultantId.toString() === consultantId);
    if (payoutIndex === -1) {
      return res.status(404).json({ success: false, message: 'Consultant not associated with this settlement' });
    }

    settlement.consultantPayouts[payoutIndex].payoutReceiptFileUrl = payoutReceiptFileUrl;
    settlement.consultantPayouts[payoutIndex].paidAt = new Date();
    settlement.consultantPayouts[payoutIndex].status = 'pending_verification';
    settlement.status = 'paid_pending_consultant_verification';
    await settlement.save();

    await logAction({
      actorId: req.user.id,
      action: 'ADMIN_LAB_CONSULTANT_PAYOUT_UPLOADED',
      entityId: settlement._id,
      entityModel: 'LabSettlement',
      details: { consultantId, payoutReceiptFileUrl },
    });

    const consultant = await Consultant.findById(consultantId).populate('userId', 'name email phone');
    const payoutAmount = settlement.consultantPayouts[payoutIndex]?.amountPaisa;
    if (consultant?.userId) {
      notificationService
        .notifyConsultantPayout(consultant.userId, payoutAmount)
        .catch((err) => console.error('Lab consultant payout notify failed:', err.message));
    }

    res.json({ success: true, message: 'Consultant payout receipt uploaded successfully', data: settlement });
  } catch (error) {
    console.error('[ADMIN_LAB_CONSULTANT_PAYOUT_ERROR]', error);
    res.status(500).json({ success: false, message: 'Failed to upload payout proof' });
  }
};

// 8. Consultant lists lab payouts assigned to them
exports.consultantListPayouts = async (req, res) => {
  try {
    const consultant = await Consultant.findOne({ userId: req.user.id });
    if (!consultant) {
      return res.status(404).json({ success: false, message: 'Consultant profile not found' });
    }

    const settlements = await LabSettlement.find({ 'consultantPayouts.consultantId': consultant._id })
      .populate('laboratoryId', 'labName branding')
      .sort({ createdAt: -1 });

    const payoutsList = settlements.map((s) => {
      const myPayout = s.consultantPayouts.find((p) => p.consultantId.toString() === consultant._id.toString());
      return {
        settlementId: s._id,
        billingPeriodStart: s.billingPeriodStart,
        billingPeriodEnd: s.billingPeriodEnd,
        labName: s.laboratoryId?.labName || 'Unknown Laboratory',
        branding: s.laboratoryId?.branding,
        myPayoutId: myPayout._id,
        amountPaisa: myPayout.amountPaisa,
        commissionPercentage: myPayout.commissionPercentage,
        payoutReceiptFileUrl: myPayout.payoutReceiptFileUrl,
        paidAt: myPayout.paidAt,
        status: myPayout.status,
        verifiedAt: myPayout.verifiedAt,
        masterStatus: s.status,
      };
    });

    res.json({ success: true, data: payoutsList });
  } catch (error) {
    console.error('[CONSULTANT_LIST_LAB_PAYOUTS_ERROR]', error);
    res.status(500).json({ success: false, message: 'Failed to list payouts' });
  }
};

// 9. Consultant verifies/confirms manual lab payout received
exports.consultantVerifyPayout = async (req, res) => {
  try {
    const { id } = req.params;
    const consultant = await Consultant.findOne({ userId: req.user.id });
    if (!consultant) {
      return res.status(404).json({ success: false, message: 'Consultant profile not found' });
    }

    const settlement = await LabSettlement.findById(id);
    if (!settlement) {
      return res.status(404).json({ success: false, message: 'Settlement not found' });
    }

    const payoutIndex = settlement.consultantPayouts.findIndex(
      (p) => p.consultantId.toString() === consultant._id.toString()
    );
    if (payoutIndex === -1) {
      return res.status(404).json({ success: false, message: 'Consultant not associated with this settlement' });
    }

    if (settlement.consultantPayouts[payoutIndex].status !== 'pending_verification') {
      return res.status(400).json({ success: false, message: 'Payout is not in pending verification state' });
    }

    settlement.consultantPayouts[payoutIndex].status = 'verified';
    settlement.consultantPayouts[payoutIndex].verifiedAt = new Date();

    // Mark the matching LabPayout records 'paid'
    await LabPayout.updateMany(
      { weeklySettlementId: settlement._id, consultantId: consultant._id },
      { $set: { status: 'paid' } }
    );

    const allVerified = settlement.consultantPayouts.every((p) => p.status === 'verified');
    if (allVerified) {
      settlement.status = 'completed';
    }

    await settlement.save();

    await logAction({
      actorId: req.user.id,
      action: 'LAB_CONSULTANT_PAYOUT_VERIFIED',
      entityId: settlement._id,
      entityModel: 'LabSettlement',
      details: { amountPaisa: settlement.consultantPayouts[payoutIndex].amountPaisa },
    });

    res.json({ success: true, message: 'Payout marked as received and verified successfully!', data: settlement });
  } catch (error) {
    console.error('[CONSULTANT_VERIFY_LAB_PAYOUT_ERROR]', error);
    res.status(500).json({ success: false, message: 'Failed to verify payout' });
  }
};

// 10. Consultant lab earnings summary (Laboratory tab only)
exports.consultantLabEarnings = async (req, res) => {
  try {
    const consultant = await Consultant.findOne({ userId: req.user.id });
    if (!consultant) {
      return res.status(404).json({ success: false, message: 'Consultant profile not found' });
    }

    const payouts = await LabPayout.find({ consultantId: consultant._id })
      .populate('laboratoryId', 'labName')
      .populate('labReferralId', 'referralCode patientName')
      .sort({ createdAt: -1 });

    const accruedPaisa = payouts
      .filter((p) => p.status === 'accrued')
      .reduce((sum, p) => sum + (p.amountPaisa || 0), 0);
    const paidPaisa = payouts.filter((p) => p.status === 'paid').reduce((sum, p) => sum + (p.amountPaisa || 0), 0);

    res.json({
      success: true,
      data: {
        accruedPaisa,
        paidPaisa,
        totalPaisa: accruedPaisa + paidPaisa,
        payouts,
      },
    });
  } catch (error) {
    console.error('[CONSULTANT_LAB_EARNINGS_ERROR]', error);
    res.status(500).json({ success: false, message: 'Failed to fetch lab earnings' });
  }
};

/** Verify laboratory portal Weekly Settlements page-access password. */
exports.verifyLabPortalSettlementsPageAccess = async (req, res) => {
  try {
    const password = String(req.body.password || '');
    if (!password) {
      return res.status(400).json({ success: false, message: 'Password is required' });
    }

    const settings = await ensureLabPortalSettlementsPagePassword();
    const ok = await bcrypt.compare(password, settings.labPortalSettlementsPageAccessPasswordHash);
    if (!ok) {
      return res.status(403).json({ success: false, message: 'Incorrect access password' });
    }

    const unlockToken = jwt.sign(
      {
        purpose: 'lab_portal_settlements_page_unlock',
        labUserId: String(req.user.id),
      },
      process.env.JWT_SECRET,
      { expiresIn: '4h' }
    );

    res.json({
      success: true,
      message: 'Access granted',
      data: { unlockToken, expiresInMinutes: 240 },
    });
  } catch (error) {
    console.error('[LAB_VERIFY_SETTLEMENTS_PAGE]', error);
    res.status(500).json({ success: false, message: 'Failed to verify access password' });
  }
};

/** Email the logged-in lab user a link to reset Weekly Settlements page password. */
exports.forgotLabPortalSettlementsPageAccess = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('name email role');
    if (!user || user.role !== 'laboratory') {
      return res.status(403).json({ success: false, message: 'Laboratory only' });
    }
    if (!user.email) {
      return res.status(400).json({ success: false, message: 'Your account has no email on file' });
    }

    await ensureLabPortalSettlementsPagePassword();

    const resetToken = jwt.sign(
      {
        purpose: 'lab_portal_settlements_page_password_reset',
        labUserId: String(user._id),
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const { sendLabPortalSettlementsPageAccessResetEmail } = require('../utils/emailService');
    const sent = await sendLabPortalSettlementsPageAccessResetEmail(user, resetToken, req);
    if (sent && sent.success === false) {
      return res.status(500).json({
        success: false,
        message: sent.error || 'Failed to send reset email',
      });
    }

    res.json({
      success: true,
      message: `Reset link sent to ${user.email}`,
    });
  } catch (error) {
    console.error('[LAB_FORGOT_SETTLEMENTS_PAGE]', error);
    res.status(500).json({ success: false, message: 'Failed to send reset email' });
  }
};

/** Set a new lab portal Settlements page password using the emailed reset token. */
exports.resetLabPortalSettlementsPageAccessPassword = async (req, res) => {
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
    if (decoded.purpose !== 'lab_portal_settlements_page_password_reset' || !decoded.labUserId) {
      return res.status(403).json({ success: false, message: 'Invalid reset token' });
    }

    const settings = await ensureLabPortalSettlementsPagePassword();
    settings.labPortalSettlementsPageAccessPasswordHash = await bcrypt.hash(newPassword, 10);
    await settings.save();

    res.json({
      success: true,
      message: 'Lab settlements page password updated. You can unlock Weekly Settlement now.',
    });
  } catch (error) {
    console.error('[LAB_RESET_SETTLEMENTS_PAGE]', error);
    res.status(500).json({ success: false, message: 'Failed to reset access password' });
  }
};
