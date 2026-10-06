const WeeklySettlement = require('../models/WeeklySettlement');
const { getHospitalForUser } = require('../utils/resolveOrg');
const Admission = require('../models/Admission');
const Payout = require('../models/Payout');
const Hospital = require('../models/Hospital');
const Consultant = require('../models/Consultant');
const { logAction } = require('../utils/logger');
const User = require('../models/User');
const notificationService = require('../services/notificationService');
const PlatformSettings = require('../models/PlatformSettings');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const DEFAULT_ADMIN_SETTLEMENTS_PAGE_PASSWORD = 'Adminsettly123?';
const DEFAULT_HOSPITAL_SETTLEMENTS_PAGE_PASSWORD = 'hospitalsettly123?';

async function ensureAdminSettlementsPagePassword() {
  let settings = await PlatformSettings.findOne().sort({ updatedAt: -1 });
  if (!settings) {
    settings = await PlatformSettings.create({});
  }
  if (!settings.adminSettlementsPageAccessPasswordHash) {
    settings.adminSettlementsPageAccessPasswordHash = await bcrypt.hash(
      DEFAULT_ADMIN_SETTLEMENTS_PAGE_PASSWORD,
      10
    );
    await settings.save();
  }
  return settings;
}

async function ensureHospitalSettlementsPagePassword() {
  let settings = await PlatformSettings.findOne().sort({ updatedAt: -1 });
  if (!settings) {
    settings = await PlatformSettings.create({});
  }
  if (!settings.hospitalSettlementsPageAccessPasswordHash) {
    settings.hospitalSettlementsPageAccessPasswordHash = await bcrypt.hash(
      DEFAULT_HOSPITAL_SETTLEMENTS_PAGE_PASSWORD,
      10
    );
    await settings.save();
  }
  return settings;
}

// 1. List admissions eligible for weekly settlement (Billed and not settled)
exports.listPendingAdmissions = async (req, res) => {
  try {
    const hospital = await getHospitalForUser(req.user);
    if (!hospital) {
      return res.status(404).json({ success: false, message: 'Hospital profile not found' });
    }

    const admissions = await Admission.find({
      hospitalId: hospital._id,
      status: 'billed',
      weeklySettlementId: null
    })
    .populate('referralId', 'referralCode patientName urgency department completedAt')
    .populate({
      path: 'consultantId',
      populate: { path: 'userId', select: 'name email' }
    })
    .sort({ completedAt: -1 });

    // Read the immutable Payout snapshot so the preview == the final settled amount
    // (legacy: platform cut; additive: doctor commission + platform charge). Never recompute
    // from a live percentage, which would drift if a rate changed after finalization.
    const payouts = await Payout.find({ admissionId: { $in: admissions.map((a) => a._id) } });
    const snapByAdmission = {};
    for (const p of payouts) {
      if (!p.admissionId) continue;
      snapByAdmission[p.admissionId.toString()] = p;
    }

    const results = admissions.map(adm => {
      const doc = adm.toObject();
      const snap = snapByAdmission[adm._id.toString()];
      const fallback = Math.round((doc.billTotalPaisa || 0) * ((hospital.deductionPercentage || 20) / 100));
      // platform charge (admin revenue) + doctor commission = what the hospital owes for this case
      doc.platformChargePaisa = snap ? (snap.platformChargePaisa ?? snap.adminSharePaisa ?? 0) : fallback;
      doc.doctorCommissionPaisa = snap ? (snap.doctorCommissionPaisa ?? snap.amountPaisa ?? 0) : 0;
      doc.totalCutPaisa = snap ? (snap.totalCutPaisa || snap.platformCutPaisa || 0) : fallback;
      // calculatedPlatformCutPaisa kept = the TOTAL the hospital owes (back-compat field name)
      doc.calculatedPlatformCutPaisa = doc.totalCutPaisa;
      return doc;
    });

    res.json({ success: true, data: results });
  } catch (error) {
    console.error('[LIST_PENDING_ADMISSIONS_ERROR]', error);
    res.status(500).json({ success: false, message: 'Failed to fetch pending admissions' });
  }
};

// 2. Create a weekly settlement summary upload
exports.createSettlement = async (req, res) => {
  try {
    const { billingPeriodStart, billingPeriodEnd, admissionIds, billSummaryFileUrl, notes } = req.body;
    
    if (!billingPeriodStart || !billingPeriodEnd || !admissionIds || !admissionIds.length || !billSummaryFileUrl) {
      return res.status(400).json({ success: false, message: 'Missing required settlement parameters' });
    }

    const hospital = await getHospitalForUser(req.user);
    if (!hospital) {
      return res.status(404).json({ success: false, message: 'Hospital profile not found' });
    }

    // 1. Verify admissions are eligible
    const admissions = await Admission.find({
      _id: { $in: admissionIds },
      hospitalId: hospital._id,
      status: 'billed',
      weeklySettlementId: null
    });

    if (admissions.length !== admissionIds.length) {
      return res.status(400).json({ success: false, message: 'Some selected admissions are invalid or already settled' });
    }

    // 2. Load accrued payouts for these admissions to extract precise splits
    const payouts = await Payout.find({
      admissionId: { $in: admissionIds },
      status: 'accrued',
      weeklySettlementId: null
    });

    // 3. Compute sums from the immutable payout snapshots (mode-agnostic identity:
    //    totalCut == doctorCommission + platformCharge). facility owes Σ totalCut.
    const grossAmountPaisa = admissions.reduce((sum, adm) => sum + (adm.billTotalPaisa || 0), 0);
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
    const calculatedPlatformCutPaisa = facilityTotalPayablePaisa; // what the hospital transfers

    // 4. Group payouts by consultant, snapshotting the commission FROM the payout
    //    (not the live consultant) so a mid-cycle rate change can't alter a settled amount.
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
          status: 'pending_payout'
        };
      }
      consultantMap[cIdStr].amountPaisa += payout.amountPaisa;
    }
    const consultantPayouts = Object.values(consultantMap);

    // 5. Create settlement record
    const settlement = await WeeklySettlement.create({
      hospitalId: hospital._id,
      billingPeriodStart: new Date(billingPeriodStart),
      billingPeriodEnd: new Date(billingPeriodEnd),
      admissionIds,
      grossAmountPaisa,
      deductionPercentage: hospital.deductionPercentage || 20,
      calculatedPlatformCutPaisa,
      doctorCommissionTotalPaisa,
      platformChargeTotalPaisa,
      facilityTotalPayablePaisa,
      billSummaryFileUrl,
      notes,
      status: 'pending_payment',
      consultantPayouts
    });

    // 6. Link admissions and payouts to this settlement
    await Admission.updateMany({ _id: { $in: admissionIds } }, { $set: { weeklySettlementId: settlement._id } });
    await Payout.updateMany({ admissionId: { $in: admissionIds } }, { $set: { weeklySettlementId: settlement._id } });

    // 7. Audit log
    await logAction({
      userId: req.user.id,
      action: 'WEEKLY_SETTLEMENT_CREATED',
      entityId: settlement._id,
      entityModel: 'WeeklySettlement',
      details: { grossAmountPaisa, calculatedPlatformCutPaisa }
    });

    notificationService.notifySettlementCreated(settlement, hospital).catch((err) =>
      console.error('Settlement created WhatsApp failed:', err.message)
    );

    res.status(201).json({ success: true, message: 'Weekly settlement summary uploaded successfully', data: settlement });
  } catch (error) {
    console.error('[CREATE_SETTLEMENT_ERROR]', error);
    res.status(500).json({ success: false, message: 'Failed to create weekly settlement summary' });
  }
};

// 3. Hospital uploads proof of manual transfer receipt
exports.uploadHospitalReceipt = async (req, res) => {
  try {
    const { hospitalReceiptFileUrl } = req.body;
    const { id } = req.params;

    if (!hospitalReceiptFileUrl) {
      return res.status(400).json({ success: false, message: 'Receipt URL is required' });
    }

    const hospital = await getHospitalForUser(req.user);
    if (!hospital) {
      return res.status(404).json({ success: false, message: 'Hospital profile not found' });
    }

    const settlement = await WeeklySettlement.findOne({ _id: id, hospitalId: hospital._id });
    if (!settlement) {
      return res.status(404).json({ success: false, message: 'Weekly settlement not found' });
    }

    if (settlement.status !== 'pending_payment') {
      return res.status(400).json({ success: false, message: 'Settlement is not in pending payment state' });
    }

    settlement.hospitalReceiptFileUrl = hospitalReceiptFileUrl;
    settlement.hospitalPaidAt = new Date();
    settlement.status = 'pending_admin_verification';
    settlement.rejectionReason = null; // Clear previous rejection if any
    await settlement.save();

    await logAction({
      userId: req.user.id,
      action: 'HOSPITAL_RECEIPT_UPLOADED',
      entityId: settlement._id,
      entityModel: 'WeeklySettlement',
      details: { hospitalReceiptFileUrl }
    });

    notificationService.notifyAllAdmins(
      'HOSPITAL_RECEIPT_UPLOADED',
      `${hospital.hospitalName} uploaded a payment receipt for verification`,
      { hospitalName: hospital.hospitalName }
    ).catch((err) => console.error('Receipt uploaded WhatsApp failed:', err.message));

    res.json({ success: true, message: 'Payment receipt uploaded successfully', data: settlement });
  } catch (error) {
    console.error('[UPLOAD_HOSPITAL_RECEIPT_ERROR]', error);
    res.status(500).json({ success: false, message: 'Failed to upload receipt' });
  }
};

// 4. Hospital lists its settlements
exports.listHospitalSettlements = async (req, res) => {
  try {
    const hospital = await getHospitalForUser(req.user);
    if (!hospital) {
      return res.status(404).json({ success: false, message: 'Hospital profile not found' });
    }

    const settlements = await WeeklySettlement.find({ hospitalId: hospital._id })
      .populate({
        path: 'admissionIds',
        select: 'referralId billTotalPaisa status completedAt patientBillFileUrl',
        populate: {
          path: 'referralId',
          select: 'patientName referralCode',
        },
      })
      .populate({
        path: 'consultantPayouts.consultantId',
        populate: { path: 'userId', select: 'name payoutAccount' }
      })
      .sort({ createdAt: -1 });

    const results = settlements.map(s => {
      const doc = s.toObject();
      if (doc.consultantPayouts) {
        doc.consultantPayouts = doc.consultantPayouts.map(p => {
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
    console.error('[LIST_HOSPITAL_SETTLEMENTS_ERROR]', error);
    res.status(500).json({ success: false, message: 'Failed to list settlements' });
  }
};

// 5. Admin lists all settlements in the manual approval queue
exports.adminListSettlements = async (req, res) => {
  try {
    const settlements = await WeeklySettlement.find()
      .populate('hospitalId', 'hospitalName deductionPercentage')
      .populate({
        path: 'admissionIds',
        select: 'billTotalPaisa completedAt patientBillFileUrl referralId',
        populate: {
          path: 'referralId',
          select: 'patientName referralCode promoCode consultantId closedByName closedByKind',
          populate: {
            path: 'consultantId',
            select: 'promoCode',
            populate: { path: 'userId', select: 'name' },
          },
        },
      })
      .populate({
        path: 'consultantPayouts.consultantId',
        select: 'promoCode',
        populate: { path: 'userId', select: 'name payoutAccount' },
      })
      .sort({ createdAt: -1 });

    res.json({ success: true, data: settlements });
  } catch (error) {
    console.error('[ADMIN_LIST_SETTLEMENTS_ERROR]', error);
    res.status(500).json({ success: false, message: 'Failed to fetch settlements' });
  }
};

// 6. Admin verifies or rejects the hospital receipt
exports.adminVerifyHospitalReceipt = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, rejectionReason } = req.body; // 'approve' or 'reject'

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Action must be approve or reject' });
    }

    const settlement = await WeeklySettlement.findById(id);
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
      settlement.hospitalReceiptFileUrl = null; // Reset so they can re-upload
    }

    await settlement.save();

    await logAction({
      userId: req.user.id,
      action: action === 'approve' ? 'ADMIN_SETTLEMENT_APPROVED' : 'ADMIN_SETTLEMENT_REJECTED',
      entityId: settlement._id,
      entityModel: 'WeeklySettlement',
      details: { rejectionReason }
    });

    const hospital = await Hospital.findById(settlement.hospitalId);
    // Notify the whole hospital team (owner + added sub-users).
    const team = hospital ? await notificationService.getHospitalTeam(hospital) : [];
    for (const member of team) {
      if (action === 'approve') {
        notificationService.notifySettlementVerified(member).catch((err) =>
          console.error('Settlement verified notification failed:', err.message)
        );
      } else {
        notificationService.notifySettlementRejected(member, rejectionReason).catch((err) =>
          console.error('Settlement rejected notification failed:', err.message)
        );
      }
    }

    res.json({ success: true, message: `Settlement successfully ${action}d`, data: settlement });
  } catch (error) {
    console.error('[ADMIN_VERIFY_SETTLEMENT_ERROR]', error);
    res.status(500).json({ success: false, message: 'Failed to process verification' });
  }
};

// 7. Admin uploads proof of manual payout to a doctor under a settlement
exports.adminUploadConsultantPayout = async (req, res) => {
  try {
    const { id } = req.params; // Settlement ID
    const { consultantId, payoutReceiptFileUrl } = req.body;

    if (!consultantId || !payoutReceiptFileUrl) {
      return res.status(400).json({ success: false, message: 'Consultant ID and payout receipt URL are required' });
    }

    const settlement = await WeeklySettlement.findById(id);
    if (!settlement) {
      return res.status(404).json({ success: false, message: 'Settlement not found' });
    }

    if (!['paid_pending_consultant_payout', 'paid_pending_consultant_verification'].includes(settlement.status)) {
      return res.status(400).json({ success: false, message: 'Invalid settlement status for payouts' });
    }

    // Find and update consultant payout details
    const payoutIndex = settlement.consultantPayouts.findIndex(p => p.consultantId.toString() === consultantId);
    if (payoutIndex === -1) {
      return res.status(404).json({ success: false, message: 'Consultant not associated with this settlement' });
    }

    settlement.consultantPayouts[payoutIndex].payoutReceiptFileUrl = payoutReceiptFileUrl;
    settlement.consultantPayouts[payoutIndex].paidAt = new Date();
    settlement.consultantPayouts[payoutIndex].status = 'pending_verification';

    // Transition master settlement status to reflect that payouts are uploaded and awaiting doctor sign-offs
    settlement.status = 'paid_pending_consultant_verification';
    await settlement.save();

    await logAction({
      userId: req.user.id,
      action: 'ADMIN_CONSULTANT_PAYOUT_UPLOADED',
      entityId: settlement._id,
      entityModel: 'WeeklySettlement',
      details: { consultantId, payoutReceiptFileUrl }
    });

    const consultant = await Consultant.findById(consultantId).populate('userId', 'name email phone');
    const payoutAmount = settlement.consultantPayouts[payoutIndex]?.amountPaisa;
    if (consultant?.userId) {
      notificationService.notifyConsultantPayout(consultant.userId, payoutAmount).catch((err) =>
        console.error('Consultant payout WhatsApp failed:', err.message)
      );
    }

    res.json({ success: true, message: 'Consultant payout receipt uploaded successfully', data: settlement });
  } catch (error) {
    console.error('[ADMIN_CONSULTANT_PAYOUT_ERROR]', error);
    res.status(500).json({ success: false, message: 'Failed to upload payout proof' });
  }
};

// 8. Consultant list payouts assigned to them
exports.consultantListPayouts = async (req, res) => {
  try {
    const consultant = await Consultant.findOne({ userId: req.user.id });
    if (!consultant) {
      return res.status(404).json({ success: false, message: 'Consultant profile not found' });
    }

    const settlements = await WeeklySettlement.find({
      'consultantPayouts.consultantId': consultant._id
    })
    .populate('hospitalId', 'hospitalName branding logoUrl')
    .sort({ createdAt: -1 });

    // Format output to be consultant-centric
    const payoutsList = settlements.map(s => {
      const myPayout = s.consultantPayouts.find(p => p.consultantId.toString() === consultant._id.toString());
      return {
        settlementId: s._id,
        billingPeriodStart: s.billingPeriodStart,
        billingPeriodEnd: s.billingPeriodEnd,
        hospitalName: s.hospitalId?.hospitalName || 'Unknown Hospital',
        branding: s.hospitalId?.branding,
        myPayoutId: myPayout._id,
        amountPaisa: myPayout.amountPaisa,
        commissionPercentage: myPayout.commissionPercentage,
        payoutReceiptFileUrl: myPayout.payoutReceiptFileUrl,
        paidAt: myPayout.paidAt,
        status: myPayout.status,
        verifiedAt: myPayout.verifiedAt,
        masterStatus: s.status
      };
    });

    res.json({ success: true, data: payoutsList });
  } catch (error) {
    console.error('[CONSULTANT_LIST_PAYOUTS_ERROR]', error);
    res.status(500).json({ success: false, message: 'Failed to list payouts' });
  }
};

// 9. Consultant verifies/confirms manual payout received
exports.consultantVerifyPayout = async (req, res) => {
  try {
    const { id } = req.params; // Settlement ID
    const consultant = await Consultant.findOne({ userId: req.user.id });

    if (!consultant) {
      return res.status(404).json({ success: false, message: 'Consultant profile not found' });
    }

    const settlement = await WeeklySettlement.findById(id);
    if (!settlement) {
      return res.status(404).json({ success: false, message: 'Settlement not found' });
    }

    const payoutIndex = settlement.consultantPayouts.findIndex(p => p.consultantId.toString() === consultant._id.toString());
    if (payoutIndex === -1) {
      return res.status(404).json({ success: false, message: 'Consultant not associated with this settlement' });
    }

    if (settlement.consultantPayouts[payoutIndex].status !== 'pending_verification') {
      return res.status(400).json({ success: false, message: 'Payout is not in pending verification state' });
    }

    // 1. Update verification state in settlement array
    settlement.consultantPayouts[payoutIndex].status = 'verified';
    settlement.consultantPayouts[payoutIndex].verifiedAt = new Date();

    // 2. Update status of the individual matching Payout records to 'paid'
    const amt = settlement.consultantPayouts[payoutIndex].amountPaisa;
    await Payout.updateMany(
      { weeklySettlementId: settlement._id, consultantId: consultant._id },
      { $set: { status: 'paid' } }
    );

    // 3. Update the Consultant's digital wallet balances
    consultant.walletBalance = (consultant.walletBalance || 0) + amt;
    consultant.totalEarnings = (consultant.totalEarnings || 0) + amt;
    consultant.monthlyEarnings = (consultant.monthlyEarnings || 0) + amt;
    await consultant.save();

    // 4. Check if all consultant payouts under this weekly settlement are now verified
    const allVerified = settlement.consultantPayouts.every(p => p.status === 'verified');
    if (allVerified) {
      settlement.status = 'completed';
    }

    await settlement.save();

    await logAction({
      userId: req.user.id,
      action: 'CONSULTANT_PAYOUT_VERIFIED',
      entityId: settlement._id,
      entityModel: 'WeeklySettlement',
      details: { amountPaisa: amt }
    });

    res.json({ success: true, message: 'Payout marked as received and verified successfully!', data: settlement });
  } catch (error) {
    console.error('[CONSULTANT_VERIFY_PAYOUT_ERROR]', error);
    res.status(500).json({ success: false, message: 'Failed to verify payout' });
  }
};

/** Verify admin Settlements Queue page-access password. */
exports.verifySettlementsPageAccess = async (req, res) => {
  try {
    const password = String(req.body.password || '');
    if (!password) {
      return res.status(400).json({ success: false, message: 'Password is required' });
    }

    const settings = await ensureAdminSettlementsPagePassword();
    const ok = await bcrypt.compare(password, settings.adminSettlementsPageAccessPasswordHash);
    if (!ok) {
      return res.status(403).json({ success: false, message: 'Incorrect access password' });
    }

    const unlockToken = jwt.sign(
      {
        purpose: 'admin_settlements_page_unlock',
        adminUserId: String(req.user.id),
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
    console.error('[ADMIN_VERIFY_SETTLEMENTS_PAGE]', error);
    res.status(500).json({ success: false, message: 'Failed to verify access password' });
  }
};

/** Email the logged-in admin a link to reset Settlements Queue page password. */
exports.forgotSettlementsPageAccess = async (req, res) => {
  try {
    const admin = await User.findById(req.user.id).select('name email role');
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin only' });
    }
    if (!admin.email) {
      return res.status(400).json({ success: false, message: 'Your account has no email on file' });
    }

    await ensureAdminSettlementsPagePassword();

    const resetToken = jwt.sign(
      {
        purpose: 'admin_settlements_page_password_reset',
        adminUserId: String(admin._id),
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const { sendAdminSettlementsPageAccessResetEmail } = require('../utils/emailService');
    const sent = await sendAdminSettlementsPageAccessResetEmail(admin, resetToken, req);
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
    console.error('[ADMIN_FORGOT_SETTLEMENTS_PAGE]', error);
    res.status(500).json({ success: false, message: 'Failed to send reset email' });
  }
};

/** Set a new Settlements Queue page password using the emailed reset token. */
exports.resetSettlementsPageAccessPassword = async (req, res) => {
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
    if (decoded.purpose !== 'admin_settlements_page_password_reset' || !decoded.adminUserId) {
      return res.status(403).json({ success: false, message: 'Invalid reset token' });
    }

    const settings = await ensureAdminSettlementsPagePassword();
    settings.adminSettlementsPageAccessPasswordHash = await bcrypt.hash(newPassword, 10);
    await settings.save();

    res.json({
      success: true,
      message: 'Settlements page password updated. You can unlock the Settlements Queue now.',
    });
  } catch (error) {
    console.error('[ADMIN_RESET_SETTLEMENTS_PAGE]', error);
    res.status(500).json({ success: false, message: 'Failed to reset access password' });
  }
};

/** Verify hospital Weekly Settlements page-access password. */
exports.verifyHospitalSettlementsPageAccess = async (req, res) => {
  try {
    const password = String(req.body.password || '');
    if (!password) {
      return res.status(400).json({ success: false, message: 'Password is required' });
    }

    const settings = await ensureHospitalSettlementsPagePassword();
    const ok = await bcrypt.compare(password, settings.hospitalSettlementsPageAccessPasswordHash);
    if (!ok) {
      return res.status(403).json({ success: false, message: 'Incorrect access password' });
    }

    const unlockToken = jwt.sign(
      {
        purpose: 'hospital_settlements_page_unlock',
        hospitalUserId: String(req.user.id),
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
    console.error('[HOSPITAL_VERIFY_SETTLEMENTS_PAGE]', error);
    res.status(500).json({ success: false, message: 'Failed to verify access password' });
  }
};

