const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { getLabForUser } = require('../utils/resolveOrg');
const LabReferral = require('../models/LabReferral');
const Laboratory = require('../models/Laboratory');
const Consultant = require('../models/Consultant');
const User = require('../models/User');
const { calculateDistance } = require('../utils/scoringEngine');
const { ageFromDob } = require('../utils/age');
const labBillingService = require('../services/labBillingService');
const notificationService = require('../services/notificationService');
const {
  labDetailsViewAccessOf,
  redactLabReferralIfSuspended,
} = require('../utils/labReferralDetailsAccess');

const DEFAULT_DETAILS_PASSWORD = '123456';

async function ensureLabReferralDetailsPassword(referralDoc) {
  if (referralDoc.detailsPasswordHash) return referralDoc.detailsPasswordHash;
  const hash = await bcrypt.hash(DEFAULT_DETAILS_PASSWORD, 12);
  await LabReferral.updateOne({ _id: referralDoc._id }, { $set: { detailsPasswordHash: hash } });
  referralDoc.detailsPasswordHash = hash;
  return hash;
}

function rejectIfLabDetailsSuspended(res, referral) {
  if (labDetailsViewAccessOf(referral) === 'active') return false;
  res.status(403).json({
    success: false,
    message: 'Patient details viewing is suspended by admin',
    detailsViewAccess: 'suspended',
  });
  return true;
}
/** Only labs tied to an active laboratory user (registration + admin approval). */
async function filterLabsEligible(labs) {
  if (!labs.length) return [];
  const userIds = labs.map((l) => l.userId);
  const activeOwners = await User.find({
    _id: { $in: userIds },
    role: 'laboratory',
    status: 'active',
  }).select('_id');
  const allowed = new Set(activeOwners.map((u) => u._id.toString()));
  return labs.filter((l) => allowed.has(l.userId.toString()));
}

async function getLabUser(labId) {
  const lab = await Laboratory.findById(labId);
  if (!lab) return null;
  return User.findOne({ _id: lab.userId, role: 'laboratory' });
}

// ─── Consultant ────────────────────────────────────────────────────────────────

/**
 * Active+verified labs. Supports three mechanisms (combinable):
 *  - list all: pass nothing → every eligible lab, sorted by name (powers the dropdown)
 *  - nearest: pass lat & lng → results sorted by distance
 *  - by name: pass q → results filtered by lab name (case-insensitive)
 */
exports.getLabSuggestions = async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';

    const filter = { isActive: true, isRegistrationVerified: true };
    if (q) {
      // Escape regex special chars from user input
      const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.labName = { $regex: safe, $options: 'i' };
    }

    const labs = await Laboratory.find(filter);
    const eligible = await filterLabsEligible(labs);

    let suggestions = eligible.map((l) => {
      const distanceKm = hasCoords
        ? Number(calculateDistance(lat, lng, l.location.coordinates[1], l.location.coordinates[0]).toFixed(1))
        : null;
      return {
        laboratoryId: l._id,
        labName: l.labName,
        city: l.city,
        area: l.area,
        address: l.address,
        distanceKm,
        deductionPercentage: l.deductionPercentage,
        testCatalog: l.testCatalog,
        rating: l.rating,
      };
    });

    suggestions = hasCoords
      ? suggestions.sort((a, b) => a.distanceKm - b.distanceKm)
      : suggestions.sort((a, b) => (a.labName || '').localeCompare(b.labName || ''));

    // by-name: top 25 matches; nearest: 10 closest; list-all (dropdown): everything
    const limit = q ? 25 : hasCoords ? 10 : suggestions.length;
    res.json({ success: true, suggestions: suggestions.slice(0, limit) });
  } catch (error) {
    console.error('[LAB_SUGGESTIONS_ERROR]', error);
    res.status(500).json({ success: false, message: 'Error fetching lab suggestions' });
  }
};

exports.createLabReferral = async (req, res) => {
  try {
    const { patientName, gender, cnic, phone } = req.body;
    // DOB is the source of truth; derive age from it when supplied, else fall
    // back to the directly-entered age (legacy clients).
    const dateOfBirth = req.body.dateOfBirth || undefined;
    const derivedAge = ageFromDob(dateOfBirth);
    const age = derivedAge != null ? derivedAge : req.body.age;
    if (!patientName) {
      return res.status(400).json({ success: false, message: 'Patient Name is required' });
    }
    if (age == null || Number(age) < 0) {
      return res.status(400).json({ success: false, message: 'Valid patient age is required' });
    }
    if (!['male', 'female', 'other'].includes(gender)) {
      return res.status(400).json({ success: false, message: 'Valid gender is required' });
    }
    const cnicRegex = /^\d{5}-\d{7}-\d{1}$/;
    if (cnic && !cnicRegex.test(cnic)) {
      return res.status(400).json({ success: false, message: 'Patient CNIC must be in the format XXXXX-XXXXXXX-X' });
    }
    const phoneClean = phone ? phone.replace(/[\s\-()]/g, '') : '';
    const phoneRegex = /^((\+92)|(0092)|0)?3\d{9}$/;
    if (!phoneRegex.test(phoneClean)) {
      return res.status(400).json({ success: false, message: 'Phone number must be a valid Pakistani mobile number' });
    }

    const consultant = await Consultant.findOne({ userId: req.user.id });
    if (!consultant) {
      return res.status(404).json({ success: false, message: 'Consultant profile not found' });
    }

    const targetLaboratoryId = req.body.targetLaboratoryId;
    if (!targetLaboratoryId || !mongoose.Types.ObjectId.isValid(targetLaboratoryId)) {
      return res.status(400).json({ success: false, message: 'Valid target laboratory is required' });
    }
    const lab = await Laboratory.findById(targetLaboratoryId);
    if (!lab || !lab.isActive || !lab.isRegistrationVerified) {
      return res.status(400).json({ success: false, message: 'Laboratory is not available for referrals' });
    }
    const labOwner = await User.findOne({ _id: lab.userId, role: 'laboratory', status: 'active' });
    if (!labOwner) {
      return res.status(400).json({ success: false, message: 'Laboratory is not available for referrals' });
    }

    // Validate discount against THIS consultant's admin-set cap (per-consultant, not per-lab)
    const discountPercentage = Math.max(0, Number(req.body.discountPercentage) || 0);
    const cap = consultant.maxLabDiscountPercentage ?? 0;
    if (discountPercentage > cap) {
      return res.status(400).json({
        success: false,
        message: `Discount cannot exceed your ${cap}% limit. Contact the platform admin to raise it.`,
      });
    }

    // Normalize recommended tests
    const recommendedTests = Array.isArray(req.body.recommendedTests)
      ? req.body.recommendedTests
          .filter((t) => t && String(t.testName || '').trim())
          .map((t) => ({ testName: String(t.testName).trim(), note: String(t.note || '').trim() }))
      : [];
    if (recommendedTests.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one recommended test is required' });
    }

    const referral = await LabReferral.create({
      consultantId: consultant._id,
      patientName: String(patientName).trim(),
      dateOfBirth,
      age: Number(age),
      gender,
      phone: phoneClean,
      area: req.body.area?.trim(),
      cnic: cnic || undefined,
      guardianName: req.body.guardianName?.trim(),
      guardianRelation: req.body.guardianRelation || 'S/O',
      urgency: ['emergency', 'urgent', 'routine'].includes(req.body.urgency) ? req.body.urgency : 'routine',
      recommendedTests,
      symptomsText: req.body.symptomsText?.trim(),
      summaryNotes: req.body.summaryNotes?.trim(),
      notes: req.body.notes?.trim(),
      attachments: Array.isArray(req.body.attachments) ? req.body.attachments : [],
      targetLaboratoryId: lab._id,
      discountPercentage,
      status: 'pending',
      detailsViewAccess: 'active',
      detailsPasswordHash: await bcrypt.hash(DEFAULT_DETAILS_PASSWORD, 12),
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`lab:${lab._id.toString()}`).emit('NEW_LAB_REFERRAL', {
        referralId: referral._id.toString(),
        laboratoryId: lab._id.toString(),
      });
    }
    // Notify the whole lab team (owner + added sub-users).
    const labTeam = await notificationService.getLabTeam(lab);
    for (const member of labTeam) {
      notificationService
        .sendAlert({
          userId: member._id,
          role: 'laboratory',
          type: 'NEW_LAB_REFERRAL',
          message: `New lab referral received: ${referral.referralCode}`,
          data: { email: member.email, phone: member.phone, name: member.name, referralCode: referral.referralCode },
        })
        .catch((err) => console.error('Lab referral notify failed:', err.message));
    }

    res.status(201).json({ success: true, data: referral });
  } catch (error) {
    console.error('[CREATE_LAB_REFERRAL_ERROR]', error);
    res.status(500).json({ success: false, message: 'Failed to create lab referral' });
  }
};

exports.getMyLabReferrals = async (req, res) => {
  try {
    const consultant = await Consultant.findOne({ userId: req.user.id });
    if (!consultant) {
      return res.status(404).json({ success: false, message: 'Consultant profile not found' });
    }
    const referrals = await LabReferral.find({ consultantId: consultant._id })
      .populate('targetLaboratoryId', 'labName branding city area')
      .sort({ createdAt: -1 });
    res.json({
      success: true,
      data: referrals.map((r) => redactLabReferralIfSuspended(r)),
    });
  } catch (error) {
    console.error('[GET_MY_LAB_REFERRALS_ERROR]', error);
    res.status(500).json({ success: false, message: 'Failed to fetch lab referrals' });
  }
};

/** Re-refer a pending/rejected lab referral to a different lab (manual escalation). */
exports.reReferLab = async (req, res) => {
  try {
    const consultant = await Consultant.findOne({ userId: req.user.id });
    if (!consultant) {
      return res.status(404).json({ success: false, message: 'Consultant profile not found' });
    }
    const referral = await LabReferral.findOne({ _id: req.params.id, consultantId: consultant._id });
    if (!referral) {
      return res.status(404).json({ success: false, message: 'Lab referral not found' });
    }
    if (!['pending', 'rejected'].includes(referral.status)) {
      return res.status(400).json({ success: false, message: 'Only pending or rejected referrals can be re-referred' });
    }

    const newLabId = req.body.targetLaboratoryId;
    if (!newLabId || !mongoose.Types.ObjectId.isValid(newLabId)) {
      return res.status(400).json({ success: false, message: 'Valid target laboratory is required' });
    }
    const lab = await Laboratory.findById(newLabId);
    if (!lab || !lab.isActive || !lab.isRegistrationVerified) {
      return res.status(400).json({ success: false, message: 'Laboratory is not available for referrals' });
    }
    const labOwner = await User.findOne({ _id: lab.userId, role: 'laboratory', status: 'active' });
    if (!labOwner) {
      return res.status(400).json({ success: false, message: 'Laboratory is not available for referrals' });
    }

    // Re-validate discount against the consultant's admin-set cap
    const cap = consultant.maxLabDiscountPercentage ?? 0;
    if ((referral.discountPercentage || 0) > cap) {
      referral.discountPercentage = cap;
    }

    referral.targetLaboratoryId = lab._id;
    referral.status = 'pending';
    referral.rejectionReason = undefined;
    await referral.save();

    const io = req.app.get('io');
    if (io) {
      io.to(`lab:${lab._id.toString()}`).emit('NEW_LAB_REFERRAL', {
        referralId: referral._id.toString(),
        laboratoryId: lab._id.toString(),
      });
    }

    res.json({ success: true, data: referral });
  } catch (error) {
    console.error('[RE_REFER_LAB_ERROR]', error);
    res.status(500).json({ success: false, message: 'Failed to re-refer lab referral' });
  }
};

// ─── Shared details (consultant owner | target lab | admin) ──────────────────────

exports.getLabReferralDetails = async (req, res) => {
  try {
    const referral = await LabReferral.findById(req.params.id)
      .populate('targetLaboratoryId', 'labName branding city area address')
      .populate({ path: 'consultantId', populate: { path: 'userId', select: 'name email phone' } });
    if (!referral) {
      return res.status(404).json({ success: false, message: 'Lab referral not found' });
    }

    if (req.user.role === 'consultant') {
      const consultant = await Consultant.findOne({ userId: req.user.id });
      if (!consultant || referral.consultantId._id.toString() !== consultant._id.toString()) {
        return res.status(403).json({ success: false, message: 'Not authorized to view this referral' });
      }
      if (labDetailsViewAccessOf(referral) !== 'active') {
        return res.status(403).json({
          success: false,
          message: 'Patient details viewing is suspended by admin',
          detailsViewAccess: 'suspended',
        });
      }
    } else if (req.user.role === 'laboratory') {
      const lab = await getLabForUser(req.user);
      if (!lab || referral.targetLaboratoryId?._id?.toString() !== lab._id.toString()) {
        return res.status(403).json({ success: false, message: 'Not authorized to view this referral' });
      }
      if (labDetailsViewAccessOf(referral) !== 'active') {
        return res.status(403).json({
          success: false,
          message: 'Patient details viewing is suspended by admin',
          detailsViewAccess: 'suspended',
        });
      }
    }
    // admin: full access (Activate/Suspend controls consultant + laboratory portals)

    let data = {
      ...(referral.toJSON ? referral.toJSON() : referral),
      detailsViewAccess: labDetailsViewAccessOf(referral),
    };
    // Consultant never sees billing on closed lab referrals.
    if (req.user.role === 'consultant' && referral.status === 'closed') {
      data = {
        ...data,
        services: [],
        grossAmountPaisa: undefined,
        discountAmountPaisa: undefined,
        billTotalPaisa: undefined,
        paymentMethod: undefined,
        paymentReference: undefined,
        patientBillFileUrl: undefined,
      };
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error('[GET_LAB_REFERRAL_DETAILS_ERROR]', error);
    res.status(500).json({ success: false, message: 'Failed to fetch lab referral' });
  }
};

// ─── Laboratory ──────────────────────────────────────────────────────────────

async function ownLab(req, res) {
  const lab = await getLabForUser(req.user);
  if (!lab) {
    res.status(404).json({ success: false, message: 'Laboratory profile not found' });
    return null;
  }
  return lab;
}

exports.getLabInbox = async (req, res) => {
  try {
    const lab = await ownLab(req, res);
    if (!lab) return;
    const referrals = await LabReferral.find({ targetLaboratoryId: lab._id, status: 'pending' })
      .populate({ path: 'consultantId', populate: { path: 'userId', select: 'name' } })
      .sort({ createdAt: -1 });
    res.json({ success: true, data: referrals });
  } catch (error) {
    console.error('[GET_LAB_INBOX_ERROR]', error);
    res.status(500).json({ success: false, message: 'Failed to fetch lab inbox' });
  }
};

exports.getLabReferrals = async (req, res) => {
  try {
    const lab = await ownLab(req, res);
    if (!lab) return;
    const referrals = await LabReferral.find({ targetLaboratoryId: lab._id })
      .populate({ path: 'consultantId', populate: { path: 'userId', select: 'name' } })
      .sort({ updatedAt: -1 });
    res.json({ success: true, data: referrals });
  } catch (error) {
    console.error('[GET_LAB_REFERRALS_ERROR]', error);
    res.status(500).json({ success: false, message: 'Failed to fetch lab referrals' });
  }
};

exports.acceptLabReferral = async (req, res) => {
  try {
    const lab = await ownLab(req, res);
    if (!lab) return;
    const referral = await LabReferral.findOne({ _id: req.params.id, targetLaboratoryId: lab._id });
    if (!referral) {
      return res.status(404).json({ success: false, message: 'Lab referral not found' });
    }
    if (referral.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Only pending referrals can be accepted' });
    }
    const expectedReportAt = req.body.expectedReportAt ? new Date(req.body.expectedReportAt) : null;
    if (!expectedReportAt || isNaN(expectedReportAt.getTime())) {
      return res.status(400).json({ success: false, message: 'A valid expected report date/time is required' });
    }

    referral.status = 'accepted';
    referral.expectedReportAt = expectedReportAt;
    referral.acceptedAt = new Date();
    await referral.save();

    const io = req.app.get('io');
    if (io) {
      io.to(`consultant:${referral.consultantId.toString()}`).emit('LAB_STATUS_UPDATE', {
        referralId: referral._id.toString(),
        status: 'accepted',
      });
    }
    res.json({ success: true, data: referral });
  } catch (error) {
    console.error('[ACCEPT_LAB_REFERRAL_ERROR]', error);
    res.status(500).json({ success: false, message: 'Failed to accept lab referral' });
  }
};

exports.rejectLabReferral = async (req, res) => {
  try {
    const lab = await ownLab(req, res);
    if (!lab) return;
    const referral = await LabReferral.findOne({ _id: req.params.id, targetLaboratoryId: lab._id });
    if (!referral) {
      return res.status(404).json({ success: false, message: 'Lab referral not found' });
    }
    if (referral.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Only pending referrals can be rejected' });
    }
    referral.status = 'rejected';
    referral.rejectionReason = String(req.body.rejectionReason || 'Declined by laboratory').trim();
    await referral.save();

    const io = req.app.get('io');
    if (io) {
      io.to(`consultant:${referral.consultantId.toString()}`).emit('LAB_STATUS_UPDATE', {
        referralId: referral._id.toString(),
        status: 'rejected',
      });
    }
    res.json({ success: true, data: referral });
  } catch (error) {
    console.error('[REJECT_LAB_REFERRAL_ERROR]', error);
    res.status(500).json({ success: false, message: 'Failed to reject lab referral' });
  }
};

exports.uploadLabReports = async (req, res) => {
  try {
    const lab = await ownLab(req, res);
    if (!lab) return;
    const referral = await LabReferral.findOne({ _id: req.params.id, targetLaboratoryId: lab._id });
    if (!referral) {
      return res.status(404).json({ success: false, message: 'Lab referral not found' });
    }
    if (rejectIfLabDetailsSuspended(res, referral)) return;
    if (!['accepted', 'reported'].includes(referral.status)) {
      return res.status(400).json({ success: false, message: 'Referral must be accepted before uploading reports' });
    }
    const files = Array.isArray(req.body.reportFiles) ? req.body.reportFiles : [];
    const valid = files
      .filter((f) => f && f.url)
      .map((f) => ({
        name: String(f.name || 'Report').trim(),
        url: String(f.url).trim(),
        testName: f.testName ? String(f.testName).trim() : undefined,
      }));
    if (valid.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one report file is required' });
    }

    referral.reportFiles.push(...valid);
    referral.status = 'reported';
    referral.reportedAt = new Date();
    await referral.save();

    const io = req.app.get('io');
    if (io) {
      io.to(`consultant:${referral.consultantId.toString()}`).emit('LAB_REPORT_UPLOADED', {
        referralId: referral._id.toString(),
      });
    }
    res.json({ success: true, data: referral });
  } catch (error) {
    console.error('[UPLOAD_LAB_REPORTS_ERROR]', error);
    res.status(500).json({ success: false, message: 'Failed to upload reports' });
  }
};

/** Save/update the bill (services, payment, patient bill file) before finalizing. */
exports.updateLabBill = async (req, res) => {
  try {
    const lab = await ownLab(req, res);
    if (!lab) return;
    const referral = await LabReferral.findOne({ _id: req.params.id, targetLaboratoryId: lab._id });
    if (!referral) {
      return res.status(404).json({ success: false, message: 'Lab referral not found' });
    }
    if (rejectIfLabDetailsSuspended(res, referral)) return;
    if (referral.status === 'closed') {
      return res.status(400).json({ success: false, message: 'This referral is already finalized' });
    }
    if (!['accepted', 'reported'].includes(referral.status)) {
      return res.status(400).json({ success: false, message: 'Referral must be accepted before billing' });
    }

    const { services, paymentMethod, paymentReference, patientBillFileUrl } = req.body;
    if (Array.isArray(services)) {
      referral.services = services.map((s) => ({
        description: String(s.description || '').trim(),
        amountPaisa: Math.max(0, Number(s.amountPaisa) || 0),
      }));
    }
    const gross = (referral.services || []).reduce((sum, s) => sum + (s.amountPaisa || 0), 0);
    const discountAmt = Math.round(gross * ((referral.discountPercentage || 0) / 100));
    referral.grossAmountPaisa = gross;
    referral.discountAmountPaisa = discountAmt;
    referral.billTotalPaisa = Math.max(0, gross - discountAmt);

    if (paymentMethod) referral.paymentMethod = paymentMethod;
    if (paymentReference != null) referral.paymentReference = String(paymentReference).trim();
    if (patientBillFileUrl != null) referral.patientBillFileUrl = String(patientBillFileUrl).trim();

    await referral.save();
    res.json({ success: true, data: referral });
  } catch (error) {
    console.error('[UPDATE_LAB_BILL_ERROR]', error);
    res.status(500).json({ success: false, message: 'Failed to update lab bill' });
  }
};

/** Finalize billing: closes referral, accrues consultant payout. */
exports.finalizeLabBill = async (req, res) => {
  try {
    const lab = await ownLab(req, res);
    if (!lab) return;
    const referral = await LabReferral.findOne({ _id: req.params.id, targetLaboratoryId: lab._id });
    if (!referral) {
      return res.status(404).json({ success: false, message: 'Lab referral not found' });
    }
    if (rejectIfLabDetailsSuspended(res, referral)) return;
    if (referral.status === 'closed') {
      return res.status(400).json({ success: false, message: 'Already finalized' });
    }
    if (referral.status !== 'reported' || referral.reportFiles.length === 0) {
      return res.status(400).json({ success: false, message: 'Upload the test report(s) before finalizing the bill' });
    }
    const gross = (referral.services || []).reduce((sum, s) => sum + (s.amountPaisa || 0), 0);
    if (gross <= 0) {
      return res.status(400).json({ success: false, message: 'Add at least one billed service before finalizing' });
    }
    if (!referral.patientBillFileUrl) {
      return res.status(400).json({ success: false, message: 'Upload the patient bill document before finalizing' });
    }

    const io = req.app.get('io');
    const { resolveCloserActor } = require('../utils/closerActor');
    const closerActor = await resolveCloserActor(req.user);
    const finalized = await labBillingService.finalizeLabReferral(referral._id, io, closerActor);
    res.json({ success: true, message: 'Lab case finalized; consultant payout accrued', data: finalized });
  } catch (error) {
    console.error('[FINALIZE_LAB_BILL_ERROR]', error);
    res.status(500).json({ success: false, message: 'Failed to finalize lab bill' });
  }
};

/** Lab portal: verify patient-details password and issue a short-lived unlock token. */
exports.verifyLabReferralDetailsPassword = async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ success: false, message: 'Password is required' });
    }

    const lab = await getLabForUser(req.user);
    if (!lab) {
      return res.status(404).json({ success: false, message: 'Laboratory profile not found' });
    }

    const referral = await LabReferral.findOne({
      _id: req.params.id,
      targetLaboratoryId: lab._id,
    }).select('+detailsPasswordHash');
    if (!referral) {
      return res.status(404).json({ success: false, message: 'Lab referral not found' });
    }

    const hash = await ensureLabReferralDetailsPassword(referral);
    const isMatch = await bcrypt.compare(password, hash);
    if (!isMatch) {
      return res.status(403).json({ success: false, message: 'Incorrect patient details password' });
    }

    const unlockToken = jwt.sign(
      {
        purpose: 'lab_referral_details_unlock',
        referralId: referral._id.toString(),
        userId: req.user.id,
      },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    res.json({
      success: true,
      message: 'Password verified',
      unlockToken,
    });
  } catch (error) {
    console.error('[VERIFY_LAB_REFERRAL_DETAILS_PASSWORD]', error);
    res.status(500).json({ success: false, message: 'Failed to verify password' });
  }
};

/** Lab portal: change the patient-details password for a lab referral. */
exports.changeLabReferralDetailsPassword = async (req, res) => {
  try {
    const currentPassword = String(req.body.currentPassword || '');
    const newPassword = String(req.body.newPassword || req.body.password || '');
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current and new passwords are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
    }

    const lab = await getLabForUser(req.user);
    if (!lab) {
      return res.status(404).json({ success: false, message: 'Laboratory profile not found' });
    }

    const referral = await LabReferral.findOne({
      _id: req.params.id,
      targetLaboratoryId: lab._id,
    }).select('+detailsPasswordHash');
    if (!referral) {
      return res.status(404).json({ success: false, message: 'Lab referral not found' });
    }

    const hash = await ensureLabReferralDetailsPassword(referral);
    const ok = await bcrypt.compare(currentPassword, hash);
    if (!ok) {
      return res.status(403).json({ success: false, message: 'Current access password is incorrect' });
    }

    referral.detailsPasswordHash = await bcrypt.hash(newPassword, 12);
    await referral.save();

    res.json({ success: true, message: 'Referral access password updated' });
  } catch (error) {
    console.error('[CHANGE_LAB_REFERRAL_DETAILS_PASSWORD]', error);
    res.status(500).json({ success: false, message: 'Failed to change access password' });
  }
};
