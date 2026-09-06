const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { getHospitalForUser } = require('../utils/resolveOrg');
const Referral = require('../models/Referral');
const Hospital = require('../models/Hospital');
const Consultant = require('../models/Consultant');
const User = require('../models/User');
const Payout = require('../models/Payout');
const { scoreHospital } = require('../utils/scoringEngine');
const { slaDeadlineFromUrgency } = require('../utils/sla');
const { resolveDepartmentFromSymptoms } = require('../services/departmentService');
const { getScoringWeights } = require('../services/scoringWeightsService');
const suggestionCache = require('../utils/suggestionCache');
const { logAction } = require('../utils/logger');
const { ageFromDob } = require('../utils/age');
const { updateHospitalStats } = require('../services/statsService');
const HospitalDoctor = require('../models/HospitalDoctor');
const {
  sendEmail,
  referralSubmittedConsultantEmail,
  referralReceivedHospitalEmail,
  referralReceivedDoctorEmail,
  referralStatusUpdateEmail,
  clinicalNoteEmail,
} = require('../utils/emailService');
const notificationService = require('../services/notificationService');
const {
  applyPreferenceForHospital,
  normalizeRankedHospitalPreferences,
} = require('../utils/referralPreferences');

const DEFAULT_DETAILS_PASSWORD = '123456';

const {
  effectiveDetailsViewAccess,
  redactReferralDetailsIfSuspended,
} = require('../utils/referralDetailsAccess');

async function ensureReferralDetailsPassword(referralDoc) {
  if (referralDoc.detailsPasswordHash) return referralDoc.detailsPasswordHash;
  const hash = await bcrypt.hash(DEFAULT_DETAILS_PASSWORD, 12);
  await Referral.updateOne({ _id: referralDoc._id }, { $set: { detailsPasswordHash: hash } });
  referralDoc.detailsPasswordHash = hash;
  return hash;
}

function assertReferralDetailsUnlock(req, referralId) {
  const token = req.headers['x-referral-unlock'] || req.headers['x-profile-unlock'];
  if (!token) {
    const err = new Error('Patient details password required');
    err.statusCode = 403;
    throw err;
  }
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    const err = new Error('Details unlock expired or invalid. Enter password again.');
    err.statusCode = 403;
    throw err;
  }
  if (decoded.purpose !== 'referral_details_unlock' || decoded.referralId !== String(referralId)) {
    const err = new Error('Details unlock is not valid for this referral');
    err.statusCode = 403;
    throw err;
  }
}

async function assertCanAccessReferralRecord(req, referral) {
  const consultant = await Consultant.findOne({ userId: req.user.id });
  const hospital = await getHospitalForUser(req.user);

  const referralConsultantId = referral.consultantId?._id
    ? referral.consultantId._id.toString()
    : referral.consultantId?.toString();
  const referralHospitalId = referral.targetHospitalId?._id
    ? referral.targetHospitalId._id.toString()
    : referral.targetHospitalId?.toString();

  if (req.user.role === 'admin') return { consultant, hospital };

  if (req.user.role === 'consultant') {
    if (!consultant || referralConsultantId !== consultant._id.toString()) {
      const err = new Error('Forbidden');
      err.statusCode = 403;
      throw err;
    }
  } else if (req.user.role === 'hospital') {
    if (!hospital || !referralHospitalId || referralHospitalId !== hospital._id.toString()) {
      const err = new Error('Forbidden');
      err.statusCode = 403;
      throw err;
    }
  } else {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }
  return { consultant, hospital };
}

exports.getHospitalDoctors = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.role === 'hospital') {
      const ownHospital = await getHospitalForUser(req.user);
      if (!ownHospital || ownHospital._id.toString() !== id) {
        return res.status(403).json({ success: false, message: 'Not authorized to view doctors for this hospital' });
      }
    }

    const doctors = await HospitalDoctor.find({ hospitalId: id, isAvailable: { $ne: false } })
      .select('name specialty consultationFee isAvailable')
      .sort({ name: 1 });
    res.json({ success: true, data: doctors });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching doctors' });
  }
};

/** Only hospitals tied to an active hospital user (registration + admin approval). */
async function filterHospitalsEligibleForReferrals(hospitals) {
  if (!hospitals.length) return [];
  const userIds = hospitals.map((h) => h.userId);
  const activeOwners = await User.find({
    _id: { $in: userIds },
    role: 'hospital',
    status: 'active',
  }).select('_id');
  const allowed = new Set(activeOwners.map((u) => u._id.toString()));
  return hospitals.filter((h) => allowed.has(h.userId.toString()));
}

exports.getSuggestions = async (req, res) => {
  try {
    const rawSymptoms = req.query.symptoms;
    const symptoms = typeof rawSymptoms === 'string' ? rawSymptoms.trim() : '';
    const { urgency, budgetMax, lat, lng } = req.query;

    const consultant = await Consultant.findOne({ userId: req.user.id });
    const weights = await getScoringWeights();
    const detectedDept = await resolveDepartmentFromSymptoms(symptoms);

    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
      return res.status(400).json({
        success: false,
        message: 'Valid lat and lng query parameters are required',
      });
    }

    const cacheKey = suggestionCache.makeKey({
      detectedDept,
      urgency: urgency || 'routine',
      budgetMax: parseInt(budgetMax, 10) || 10000000,
      lat: latNum,
      lng: lngNum,
      consultantId: consultant?._id?.toString() || '',
      weights,
    });
    const cached = suggestionCache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const hospitals = await Hospital.find({
      departments: detectedDept,
      isActive: true,
      inactiveDepartments: { $nin: [detectedDept] },
    });

    const eligibleHospitals = await filterHospitalsEligibleForReferrals(hospitals);

    const referralData = {
      department: detectedDept,
      urgency: urgency || 'routine',
      budgetMax: parseInt(budgetMax, 10) || 10000000,
      location: { lat: latNum, lng: lngNum },
    };

    const suggestions = eligibleHospitals
      .map((h) => scoreHospital(h, referralData, consultant, weights))
      .filter((s) => s !== null)
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, 10);

    const payload = {
      success: true,
      detectedDept,
      suggestions,
    };
    suggestionCache.set(cacheKey, payload);
    res.json(payload);
  } catch (error) {
    console.error('Suggestions error:', error);
    res.status(500).json({ success: false, message: 'Error generating suggestions' });
  }
};

async function ensureConsultantPromoCode(consultant) {
  if (consultant.promoCode) {
    return consultant.promoCode;
  }
  const base = String(consultant.pmdcNumber || consultant._id).replace(/\s+/g, '').slice(-12);
  const promoCode = `PR-${base.toUpperCase()}`;
  consultant.promoCode = promoCode;
  await consultant.save();
  return promoCode;
}

async function findReferralCodeByCnic(consultantId, inputCnic) {
  if (!inputCnic) return null;
  const Referral = require('../models/Referral');
  const referrals = await Referral.find({ consultantId });
  for (const ref of referrals) {
    if (ref.cnic === inputCnic) {
      return ref.referralCode;
    }
  }
  return null;
}

exports.createReferral = async (req, res) => {
  try {
    const { patientName, cnic, phone } = req.body;
    if (!patientName) {
      return res.status(400).json({ success: false, message: 'Patient Name is required' });
    }
    // CNIC is optional — validate format only when provided
    const cnicRegex = /^\d{5}-\d{7}-\d{1}$/;
    if (cnic && !cnicRegex.test(cnic)) {
      return res.status(400).json({ success: false, message: 'Patient CNIC must be in the format XXXXX-XXXXXXX-X' });
    }
    const phoneClean = phone ? phone.replace(/[\s\-()]/g, '') : '';
    const phoneRegex = /^((\+92)|(0092)|0)?3\d{9}$/;
    if (!phoneRegex.test(phoneClean)) {
      return res.status(400).json({ success: false, message: 'Phone number must be a valid Pakistani mobile number' });
    }
    req.body.phone = phoneClean; // use sanitized phone number

    const consultant = await Consultant.findOne({ userId: req.user.id });
    if (!consultant) {
      return res.status(404).json({ success: false, message: 'Consultant profile not found' });
    }

    const urgency = req.body.urgency || 'routine';
    if (!['emergency', 'urgent', 'routine'].includes(urgency)) {
      return res.status(400).json({ success: false, message: 'Invalid urgency' });
    }

    const promoCode = await ensureConsultantPromoCode(consultant);

    // Check if there is an existing referral code for this consultant/patient CNIC pair
    const existingReferralCode = await findReferralCodeByCnic(consultant._id, cnic);

    const targetHospitalId = req.body.targetHospitalId;
    if (!targetHospitalId || !mongoose.Types.ObjectId.isValid(targetHospitalId)) {
      return res.status(400).json({ success: false, message: 'Valid target hospital is required' });
    }

    const targetHospital = await Hospital.findById(targetHospitalId);
    if (!targetHospital || !targetHospital.isActive) {
      return res.status(400).json({ success: false, message: 'Hospital is not available for referrals' });
    }
    const targetOwner = await User.findOne({
      _id: targetHospital.userId,
      role: 'hospital',
      status: 'active',
    });
    if (!targetOwner) {
      return res.status(400).json({ success: false, message: 'Hospital is not available for referrals' });
    }

    // Already declared above:
    // const urgency = req.body.urgency || 'routine';
    // if (!['emergency', 'urgent', 'routine'].includes(urgency)) {
    //   return res.status(400).json({ success: false, message: 'Invalid urgency' });
    // }
    // const promoCode = await ensureConsultantPromoCode(consultant);

    let ranked = (req.body.rankedHospitalIds || [])
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));
    const seenIds = new Set();
    ranked = ranked.filter((id) => {
      const s = id.toString();
      if (seenIds.has(s)) return false;
      seenIds.add(s);
      return true;
    });
    if (ranked.length > 10) {
      return res.status(400).json({ success: false, message: 'At most 10 ranked hospitals allowed' });
    }
    const targetOid = new mongoose.Types.ObjectId(targetHospitalId);
    if (ranked.length === 0) {
      ranked = [targetOid];
    }
    const rankIdx = ranked.findIndex((id) => id.equals(targetOid));
    if (rankIdx === -1) {
      return res.status(400).json({
        success: false,
        message: 'Selected hospital must be included in the ranked hospital list',
      });
    }

    const rankedHospitalDocs = await Hospital.find({ _id: { $in: ranked }, isActive: true });
    if (rankedHospitalDocs.length !== ranked.length) {
      return res.status(400).json({ success: false, message: 'One or more ranked hospitals are invalid or inactive' });
    }
    const rankedEligible = await filterHospitalsEligibleForReferrals(rankedHospitalDocs);
    if (rankedEligible.length !== rankedHospitalDocs.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more ranked hospitals are not approved referral facilities',
      });
    }

    const fallbackDepartment = String(req.body.department || '').trim();
    const { preferences: rankedHospitalPreferences, error: prefError } =
      await normalizeRankedHospitalPreferences(
        req.body.rankedHospitalPreferences,
        rankedEligible,
        fallbackDepartment
      );
    if (prefError) {
      return res.status(400).json({ success: false, message: prefError });
    }

    const targetPref = rankedHospitalPreferences.find((p) =>
      p.hospitalId.equals(targetOid)
    );
    if (!targetPref) {
      return res.status(400).json({
        success: false,
        message: 'Department must be selected for the chosen hospital',
      });
    }

    // DOB is the source of truth; derive age from it when supplied, else fall
    // back to the directly-entered age (legacy clients).
    const dateOfBirth = req.body.dateOfBirth || undefined;
    const derivedAge = ageFromDob(dateOfBirth);

    const referral = new Referral({
      consultantId: consultant._id,
      rankedHospitalIds: ranked,
      rankedHospitalPreferences,
      currentRankIndex: rankIdx,
      patientName: req.body.patientName,
      dateOfBirth,
      age: derivedAge != null ? derivedAge : Number(req.body.age),
      gender: req.body.gender,
      phone: req.body.phone,
      area: req.body.area,
      cnic: req.body.cnic,
      guardianName: req.body.guardianName,
      guardianRelation: req.body.guardianRelation,
      urgency,
      symptomsText: req.body.symptoms ?? req.body.symptomsText,
      summaryNotes: req.body.summaryNotes,
      symptomTags: req.body.symptomTags,
      department: targetPref.department,
      diagnosisText: req.body.diagnosisText,
      notes: req.body.notes,
      attachments: req.body.attachments,
      budgetMin: req.body.budgetMin != null ? Number(req.body.budgetMin) : undefined,
      budgetMax: req.body.budgetMax != null ? Number(req.body.budgetMax) : undefined,
      budgetBracket: req.body.budgetBracket,
      targetHospitalId,
      targetDoctorId: targetPref.targetDoctorId,
      scoringData: req.body.scoringData,
      promoCode,
      slaDeadline: slaDeadlineFromUrgency(urgency),
      status: 'pending',
      detailsPasswordHash: await bcrypt.hash(DEFAULT_DETAILS_PASSWORD, 12),
      detailsViewAccess: 'active',
    });

    if (existingReferralCode) {
      referral.referralCode = existingReferralCode;
    }

    await referral.save();

    await logAction({
      req,
      action: 'REFERRAL_CREATED',
      entityId: referral._id,
      entityModel: 'Referral',
      details: { targetHospitalId, urgency }
    });

    // 1. Send confirmation email to Consultant (async)
    try {
      sendEmail({
        to: req.user.email,
        subject: `Referral submitted — ${referral.referralCode} — CareBridge Health`,
        html: referralSubmittedConsultantEmail({
          consultantName: req.user.name,
          patientName: referral.patientName,
          hospitalName: targetHospital.hospitalName,
          referralCode: referral.referralCode,
          urgency: urgency,
        }),
        text: `Referral ${referral.referralCode} submitted to ${targetHospital.hospitalName}.`,
      });
    } catch (err) {
      console.error('Consultant referral email notification failed:', err.message);
    }

    // 2. Send alert email + notifications to the WHOLE target-hospital team
    //    (owner account + added sub-users) — not just the owner.
    try {
      const team = await notificationService.getHospitalTeam(targetHospital);
      for (const member of team) {
        if (!member.email) continue;
        sendEmail({
          to: member.email,
          subject: `New referral received — ${referral.referralCode} — CareBridge Health`,
          html: referralReceivedHospitalEmail({
            hospitalName: targetHospital.hospitalName,
            patientName: referral.patientName,
            referralCode: referral.referralCode,
            urgency,
          }),
          text: `New referral ${referral.referralCode} for ${referral.patientName}.`,
        });
      }
    } catch (err) {
      console.error('Hospital new referral email notification failed:', err.message);
    }

    // 3. If a specific hospital doctor was selected, email that doctor too.
    if (targetPref.targetDoctorId) {
      try {
        const targetDoctor = await HospitalDoctor.findById(targetPref.targetDoctorId).lean();
        if (targetDoctor?.email) {
          const consultantProfile = await Consultant.findById(consultant._id).select('specialty').lean();
          sendEmail({
            to: targetDoctor.email,
            subject: `New referral for you — ${referral.referralCode} — CareBridge Health`,
            html: referralReceivedDoctorEmail({
              doctorName: targetDoctor.name,
              consultantName: req.user.name,
              consultantSpecialty: consultantProfile?.specialty,
              patientName: referral.patientName,
              hospitalName: targetHospital.hospitalName,
              referralCode: referral.referralCode,
              urgency,
              department: referral.department,
            }),
            text: `${req.user.name} has referred patient ${referral.patientName} to Dr. ${targetDoctor.name} (${referral.referralCode}).`,
          });
        } else if (targetDoctor) {
          console.warn(
            `[REFERRAL] Target doctor ${targetDoctor._id} has no email — skipping doctor notification`
          );
        }
      } catch (err) {
        console.error('Target doctor referral email notification failed:', err.message);
      }
    }

    notificationService.notifyHospitalNewReferral(referral, targetHospital).catch((err) =>
      console.error('Hospital new referral notification failed:', err.message)
    );

    const io = req.app.get('io');
    if (io) {
      io.to(`hospital:${targetHospitalId}`).emit('NEW_REFERRAL', {
        hospitalId: String(targetHospitalId),
        referralId: referral._id.toString(),
      });
      io.to(`consultant:${consultant._id.toString()}`).emit('NEW_REFERRAL', {
        referralId: referral._id.toString(),
        hospitalId: String(targetHospitalId),
      });
    }

    res.status(201).json({
      success: true,
      message: 'Referral submitted successfully',
      data: referral,
    });
  } catch (error) {
    console.error('Create referral error:', error);
    res.status(500).json({ success: false, message: 'Error submitting referral' });
  }
};

exports.getMyReferrals = async (req, res) => {
  try {
    const consultant = await Consultant.findOne({ userId: req.user.id });
    if (!consultant) {
      return res.status(404).json({ success: false, message: 'Consultant profile not found' });
    }
    const referrals = await Referral.find({ consultantId: consultant._id })
      .populate('targetHospitalId', 'hospitalName')
      .populate('targetDoctorId', 'name specialty')
      .populate('rankedHospitalPreferences.targetDoctorId', 'name specialty')
      .sort({ createdAt: -1 })
      .lean();

    const Admission = require('../models/Admission');
    const referralIds = referrals.map((r) => r._id);
    const admissions = await Admission.find({ referralId: { $in: referralIds } })
      .populate('treatingDoctorId', 'name specialty')
      .lean();
    const admissionByReferral = new Map(
      admissions.map((a) => [a.referralId.toString(), a])
    );

    const data = referrals.map((r) =>
      redactReferralDetailsIfSuspended({
        ...r,
        admission: admissionByReferral.get(r._id.toString()) || null,
      })
    );

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching referrals' });
  }
};

exports.getHospitalInbox = async (req, res) => {
  try {
    const hospital = await getHospitalForUser(req.user);
    if (!hospital) {
      return res.status(404).json({ success: false, message: 'Hospital profile not found' });
    }

    const referrals = await Referral.find({
      targetHospitalId: hospital._id,
      status: 'pending',
    })
      .populate('targetDoctorId', 'name specialty')
      .populate('rankedHospitalPreferences.targetDoctorId', 'name specialty')
      .populate({
        path: 'consultantId',
        select: 'userId pmdcNumber specialty',
        populate: { path: 'userId', select: 'name email phone' },
      })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: referrals.map((r) => redactReferralDetailsIfSuspended(r.toObject ? r.toObject() : r)),
    });
  } catch (error) {
    console.error('Hospital inbox error:', error);
    res.status(500).json({ success: false, message: 'Error fetching hospital inbox' });
  }
};

exports.getHospitalReferrals = async (req, res) => {
  try {
    const hospital = await getHospitalForUser(req.user);
    if (!hospital) {
      return res.status(404).json({ success: false, message: 'Hospital profile not found' });
    }

    const referrals = await Referral.find({
      targetHospitalId: hospital._id,
    })
      .populate('targetDoctorId', 'name specialty')
      .populate({
        path: 'consultantId',
        select: 'userId pmdcNumber specialty',
        populate: { path: 'userId', select: 'name email phone' },
      })
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      data: referrals.map((r) => redactReferralDetailsIfSuspended(r)),
    });
  } catch (error) {
    console.error('Hospital referrals error:', error);
    res.status(500).json({ success: false, message: 'Error fetching hospital referrals' });
  }
};

exports.getReferralDetails = async (req, res) => {
  try {
    const referral = await Referral.findById(req.params.id)
      .populate('targetHospitalId', 'hospitalName location')
      .populate('targetDoctorId', 'name specialty pmdcNumber')
      .populate({
        path: 'consultantId',
        select: 'userId pmdcNumber',
        populate: { path: 'userId', select: 'name email phone' },
      });

    if (!referral) {
      return res.status(404).json({ success: false, message: 'Referral not found' });
    }

    try {
      await assertCanAccessReferralRecord(req, referral);
    } catch (authErr) {
      return res.status(authErr.statusCode || 403).json({ success: false, message: authErr.message });
    }

    if (req.user.role !== 'admin') {
      const access = effectiveDetailsViewAccess(referral);
      if (access !== 'active') {
        return res.status(403).json({
          success: false,
          message: 'Patient details viewing is suspended by admin',
          detailsViewAccess: access,
        });
      }
      // When active, consultant/hospital may view details without a password.
    }

    let admission = null;

    // Fetch admission if admitted to hospital
    if (['admitted', 'closed'].includes(referral.status)) {
      const Admission = require('../models/Admission');
      admission = await Admission.findOne({ referralId: referral._id }).populate('treatingDoctorId', 'name specialty').lean();
    }

    res.json({
      success: true,
      data: {
        ...referral.toJSON(),
        admission,
        detailsViewAccess: effectiveDetailsViewAccess(referral),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching referral details' });
  }
};

/** Verify patient-details password and issue a short-lived unlock token. */
exports.verifyReferralDetailsPassword = async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ success: false, message: 'Password is required' });
    }

    const referral = await Referral.findById(req.params.id).select('+detailsPasswordHash detailsViewAccess consultantId targetHospitalId');
    if (!referral) {
      return res.status(404).json({ success: false, message: 'Referral not found' });
    }

    try {
      await assertCanAccessReferralRecord(req, referral);
    } catch (authErr) {
      return res.status(authErr.statusCode || 403).json({ success: false, message: authErr.message });
    }

    if (req.user.role !== 'admin' && effectiveDetailsViewAccess(referral) !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Patient details viewing is suspended by admin',
        detailsViewAccess: effectiveDetailsViewAccess(referral),
      });
    }

    const hash = await ensureReferralDetailsPassword(referral);
    const isMatch = await bcrypt.compare(password, hash);
    if (!isMatch) {
      return res.status(403).json({ success: false, message: 'Incorrect patient details password' });
    }

    const unlockToken = jwt.sign(
      {
        purpose: 'referral_details_unlock',
        referralId: referral._id.toString(),
        userId: req.user.id,
      },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    await logAction({
      req,
      action: 'VERIFY_REFERRAL_DETAILS_PASSWORD',
      entityId: referral._id,
      entityModel: 'Referral',
      details: { role: req.user.role },
    });

    res.json({
      success: true,
      message: 'Password verified',
      unlockToken,
      detailsViewAccess: effectiveDetailsViewAccess(referral),
    });
  } catch (error) {
    console.error('verifyReferralDetailsPassword error:', error);
    res.status(500).json({ success: false, message: 'Failed to verify password' });
  }
};

/** Admin: change the patient-details password for a referral. */
exports.changeReferralDetailsPassword = async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || String(password).length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }
    const referral = await Referral.findById(req.params.id);
    if (!referral) {
      return res.status(404).json({ success: false, message: 'Referral not found' });
    }
    referral.detailsPasswordHash = await bcrypt.hash(String(password), 12);
    await referral.save();

    await logAction({
      req,
      action: 'ADMIN_CHANGE_REFERRAL_DETAILS_PASSWORD',
      entityId: referral._id,
      entityModel: 'Referral',
    });

    res.json({ success: true, message: 'Referral access password updated' });
  } catch (error) {
    console.error('changeReferralDetailsPassword error:', error);
    res.status(500).json({ success: false, message: 'Failed to change password' });
  }
};

/** Admin: email a fixed inbox a reset link for this referral's details-access password. */
exports.forgotReferralDetailsPassword = async (req, res) => {
  try {
    const admin = await User.findById(req.user.id).select('name email role');
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin only' });
    }

    const referral = await Referral.findById(req.params.id).select('referralCode');
    if (!referral) {
      return res.status(404).json({ success: false, message: 'Referral not found' });
    }

    const resetToken = jwt.sign(
      {
        purpose: 'admin_referral_details_password_reset',
        referralId: String(referral._id),
        adminUserId: String(admin._id),
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const { sendAdminReferralAccessResetEmail, ADMIN_DETAIL_ACCESS_RESET_EMAIL } = require('../utils/emailService');
    const sent = await sendAdminReferralAccessResetEmail(admin, resetToken, referral.referralCode);
    if (sent && sent.success === false) {
      return res.status(500).json({
        success: false,
        message: sent.error || 'Failed to send reset email',
      });
    }

    res.json({
      success: true,
      message: `Reset link sent to ${ADMIN_DETAIL_ACCESS_RESET_EMAIL}`,
    });
  } catch (error) {
    console.error('forgotReferralDetailsPassword error:', error);
    res.status(500).json({ success: false, message: 'Failed to send reset email' });
  }
};

/** Set a new referral details-access password using the emailed reset token. */
exports.resetReferralDetailsPassword = async (req, res) => {
  try {
    const token = String(req.body.token || '');
    const newPassword = String(req.body.newPassword || '');
    if (!token) {
      return res.status(400).json({ success: false, message: 'Reset token is required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(403).json({ success: false, message: 'Reset link is invalid or expired' });
    }
    if (decoded.purpose !== 'admin_referral_details_password_reset' || !decoded.referralId) {
      return res.status(403).json({ success: false, message: 'Invalid reset token' });
    }

    const referral = await Referral.findById(decoded.referralId);
    if (!referral) {
      return res.status(404).json({ success: false, message: 'Referral not found' });
    }

    referral.detailsPasswordHash = await bcrypt.hash(newPassword, 12);
    await referral.save();

    res.json({
      success: true,
      message: 'Referral access password updated. You can unlock details now.',
      referralCode: referral.referralCode,
    });
  } catch (error) {
    console.error('resetReferralDetailsPassword error:', error);
    res.status(500).json({ success: false, message: 'Failed to reset access password' });
  }
};

/** Admin: toggle whether consultant/hospital may unlock patient details. */
exports.setReferralDetailsViewAccess = async (req, res) => {
  try {
    const { detailsViewAccess } = req.body;
    if (!['active', 'suspended'].includes(detailsViewAccess)) {
      return res.status(400).json({ success: false, message: 'detailsViewAccess must be active or suspended' });
    }
    const referral = await Referral.findById(req.params.id);
    if (!referral) {
      return res.status(404).json({ success: false, message: 'Referral not found' });
    }
    referral.detailsViewAccess = detailsViewAccess;
    await referral.save();

    await logAction({
      req,
      action: 'ADMIN_SET_REFERRAL_DETAILS_VIEW_ACCESS',
      entityId: referral._id,
      entityModel: 'Referral',
      details: { detailsViewAccess },
    });

    res.json({
      success: true,
      message: `Patient details view set to ${detailsViewAccess}`,
      data: { detailsViewAccess: referral.detailsViewAccess },
    });
  } catch (error) {
    console.error('setReferralDetailsViewAccess error:', error);
    res.status(500).json({ success: false, message: 'Failed to update view access' });
  }
};

exports.updateReferralStatus = async (req, res) => {
  try {
    const { status, reason, assignedDepartment } = req.body;
    const allowed = ['accepted', 'rejected', 'admitted', 'closed'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const hospital = await getHospitalForUser(req.user);

    const referral = await Referral.findOne({
      _id: req.params.id,
      targetHospitalId: hospital._id,
    }).populate({
      path: 'consultantId',
      populate: { path: 'userId' }
    });

    if (!referral) {
      return res.status(404).json({ success: false, message: 'Referral not found or unauthorized' });
    }

    if (status === 'rejected') {
      const r = reason != null ? String(reason).trim() : '';
      if (!r) {
        return res.status(400).json({ success: false, message: 'Rejection reason is required' });
      }
      referral.rejectionReason = r;
    }

    const oldStatus = referral.status;
    referral.status = status;
    const now = new Date();
    if (status === 'accepted') {
      referral.acceptedAt = now;
      if (assignedDepartment != null && String(assignedDepartment).trim()) {
        referral.assignedDepartment = String(assignedDepartment).trim();
      }
    }
    if (status === 'admitted') {
      referral.admittedAt = now;
    }
    if (status === 'closed') {
      referral.closedAt = now;
      referral.detailsViewAccess = 'suspended';
      // Trigger payout logic (Q14)
      const { creditConsultantWallet } = require('../services/paymentService');
      await creditConsultantWallet(referral.consultantId, referral._id, 100000);
    }

    await referral.save();

    // Send email notifications (async)
    const consultantUser = referral.consultantId?.userId;
    if (consultantUser) {
      try {
        sendEmail({
          to: consultantUser.email,
          subject: `Referral ${status} — ${referral.referralCode} — CareBridge Health`,
          html: referralStatusUpdateEmail({
            recipientName: consultantUser.name,
            patientName: referral.patientName,
            referralCode: referral.referralCode,
            hospitalName: hospital.hospitalName,
            status,
            rejectionReason: referral.rejectionReason,
            recipientRole: 'consultant',
          }),
          text: `Referral ${referral.referralCode} status: ${status}`,
        });
      } catch (err) {
        console.error('Consultant status email notification failed:', err.message);
      }
    }

    try {
      sendEmail({
        to: req.user.email,
        subject: `Status confirmed — ${referral.referralCode} — CareBridge Health`,
        html: referralStatusUpdateEmail({
          recipientName: hospital.hospitalName,
          patientName: referral.patientName,
          referralCode: referral.referralCode,
          hospitalName: hospital.hospitalName,
          status,
          recipientRole: 'hospital',
        }),
        text: `Referral ${referral.referralCode} updated to ${status}.`,
      });
    } catch (err) {
      console.error('Hospital status email notification failed:', err.message);
    }

    if (consultantUser?.phone) {
      if (status === 'accepted') {
        notificationService
          .notifyReferralAccepted(referral, consultantUser, hospital.hospitalName)
          .catch((err) => console.error('Referral accepted WhatsApp failed:', err.message));
      } else if (status === 'rejected') {
        notificationService
          .notifyReferralRejected(referral, consultantUser, referral.rejectionReason)
          .catch((err) => console.error('Referral rejected WhatsApp failed:', err.message));
      }
    }

    // Recalculate hospital performance metrics (Factor 5: SLA History)
    if (['accepted', 'rejected'].includes(status)) {
      await updateHospitalStats(hospital._id);
    }

    await logAction({
      req,
      action: 'REFERRAL_STATUS_CHANGE',
      entityId: referral._id,
      entityModel: 'Referral',
      details: { oldStatus, newStatus: status, reason }
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`hospital:${hospital._id.toString()}`).emit('STATUS_UPDATE', {
        referralId: referral._id.toString(),
        status,
      });
      io.to(`consultant:${referral.consultantId.toString()}`).emit('STATUS_UPDATE', {
        referralId: referral._id.toString(),
        status,
      });
    }

    res.json({
      success: true,
      message: `Referral ${status} successfully`,
      data: referral,
    });
  } catch (error) {
    console.error('Update referral status error:', error);
    res.status(500).json({ success: false, message: 'Error updating referral status' });
  }
};

exports.getConsultantEarnings = async (req, res) => {
  try {
    const consultant = await Consultant.findOne({ userId: req.user.id });
    if (!consultant) {
      return res.status(404).json({ success: false, message: 'Consultant profile not found' });
    }

    const referrals = await Referral.find({
      consultantId: consultant._id,
      status: { $in: ['accepted', 'admitted', 'closed'] },
    }).sort({ createdAt: -1 });

    const payouts = await Payout.find({ consultantId: consultant._id }, {
      deductionPercentage: 0,
      platformCutPaisa: 0,
      adminSharePaisa: 0,
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('referralId', 'referralCode patientName urgency department')
      .lean();

    res.json({
      success: true,
      data: {
        consultant: await Consultant.findById(consultant._id).populate('userId', 'name email phone'),
        totalEarningsPaisa: consultant.totalEarnings || 0,
        monthlyEarningsPaisa: consultant.monthlyEarnings || 0,
        referralCount: referrals.length,
        referrals,
        payouts,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching earnings' });
  }
};
exports.createWithdrawalRequest = async (req, res) => {
  try {
    const { amountPaisa, paymentMethod, mobileNumber } = req.body;
    const consultant = await Consultant.findOne({ userId: req.user.id });

    if (!consultant) {
      return res.status(404).json({ success: false, message: 'Consultant not found' });
    }

    if (!amountPaisa || amountPaisa < 50000) { // Min 500 PKR
      return res.status(400).json({ success: false, message: 'Minimum withdrawal is 500 PKR' });
    }

    if (consultant.totalEarnings < amountPaisa) {
      return res.status(400).json({ success: false, message: 'Insufficient balance' });
    }

    // Since we don't have a WithdrawalRequest model yet, I'll log it and update Payouts status
    // For now, I'll create a Payout record with status 'pending_withdrawal'
    const withdrawal = await Payout.create({
      consultantId: consultant._id,
      amountPaisa: -amountPaisa, // Negative to reflect withdrawal in history
      status: 'pending',
      note: `Withdrawal request via ${paymentMethod} (${mobileNumber})`,
    });

    // Deduct from consultant's total earnings
    consultant.totalEarnings -= amountPaisa;
    await consultant.save();

    await logAction({
      req,
      action: 'WITHDRAWAL_REQUESTED',
      entityId: withdrawal._id,
      entityModel: 'Payout',
      details: { amountPaisa, paymentMethod, mobileNumber }
    });

    res.json({
      success: true,
      message: 'Withdrawal request submitted successfully.',
      data: withdrawal
    });
  } catch (error) {
    console.error('Withdrawal error:', error);
    res.status(500).json({ success: false, message: 'Failed to process withdrawal' });
  }
};

/**
 * PATCH /referrals/:id — Consultant can edit their own referral's clinical fields
 * Only allowed when status is NOT 'admitted' or 'closed'.
 */
exports.updateReferralByConsultant = async (req, res) => {
  try {
    const consultant = await Consultant.findOne({ userId: req.user.id });
    if (!consultant) {
      return res.status(404).json({ success: false, message: 'Consultant profile not found' });
    }

    const referral = await Referral.findOne({
      _id: req.params.id,
      consultantId: consultant._id,
    });

    if (!referral) {
      return res.status(404).json({ success: false, message: 'Referral not found or unauthorized' });
    }

    if (['admitted', 'closed'].includes(referral.status)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot edit a referral that is already admitted or closed',
      });
    }

    // Only allow updating clinical/patient fields — NOT status, hospital, or scoring
    const allowedFields = [
      'patientName', 'dateOfBirth', 'age', 'gender', 'phone', 'area', 'cnic',
      'guardianName', 'guardianRelation', 'urgency', 'symptomsText',
      'summaryNotes', 'department', 'diagnosisText', 'notes',
      'attachments',
    ];

    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    // Keep age in sync with DOB whenever a date of birth is provided.
    if (updates.dateOfBirth) {
      const derivedAge = ageFromDob(updates.dateOfBirth);
      if (derivedAge != null) updates.age = derivedAge;
    }

    // Validate CNIC format if provided
    const cnicRegex = /^\d{5}-\d{7}-\d{1}$/;
    if (updates.cnic && !cnicRegex.test(updates.cnic)) {
      return res.status(400).json({ success: false, message: 'Patient CNIC must be in the format XXXXX-XXXXXXX-X' });
    }
    if (updates.urgency && !['emergency', 'urgent', 'routine'].includes(updates.urgency)) {
      return res.status(400).json({ success: false, message: 'Invalid urgency value' });
    }

    Object.assign(referral, updates);
    await referral.save();

    await logAction({
      req,
      action: 'REFERRAL_UPDATED_BY_CONSULTANT',
      entityId: referral._id,
      entityModel: 'Referral',
      details: { updatedFields: Object.keys(updates) }
    });

    res.json({ success: true, message: 'Referral updated successfully', data: referral });
  } catch (error) {
    console.error('updateReferralByConsultant error:', error);
    res.status(500).json({ success: false, message: 'Failed to update referral' });
  }
};

exports.addClinicalNote = async (req, res) => {

  try {
    const { content, type } = req.body;
    if (!content || !type) {
      return res.status(400).json({ success: false, message: 'Content and type are required' });
    }

    const referral = await Referral.findById(req.params.id)
      .populate({ path: 'consultantId', populate: { path: 'userId' } })
      .populate({ path: 'targetHospitalId', populate: { path: 'userId' } });
    if (!referral) {
      return res.status(404).json({ success: false, message: 'Referral not found' });
    }

    // Authorization check: Only assigned hospital or the referring consultant can add notes
    const consultant = await Consultant.findOne({ userId: req.user.id });
    const hospital = await getHospitalForUser(req.user);

    const isConsultant = consultant && referral.consultantId && referral.consultantId._id.toString() === consultant._id.toString();
    const isHospital = hospital && referral.targetHospitalId && referral.targetHospitalId._id.toString() === hospital._id.toString();

    if (!isConsultant && !isHospital) {
      return res.status(403).json({ success: false, message: 'Unauthorized to add notes to this referral' });
    }

    if (effectiveDetailsViewAccess(referral) !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Patient details viewing is suspended by admin',
        detailsViewAccess: effectiveDetailsViewAccess(referral),
      });
    }

    referral.clinicalNotes.push({
      type,
      content,
      author: req.user.id,
      authorName: req.user.name,
      createdAt: new Date()
    });

    await referral.save();

    // Send email notifications to the other party (async)
    if (isHospital) {
      const consultantUser = referral.consultantId?.userId;
      if (consultantUser) {
        try {
          sendEmail({
            to: consultantUser.email,
            subject: `New clinical note — ${referral.referralCode} — CareBridge Health`,
            html: clinicalNoteEmail({
              recipientName: consultantUser.name,
              authorName: req.user.name,
              patientName: referral.patientName,
              referralCode: referral.referralCode,
              content,
              recipientRole: 'consultant',
            }),
            text: `New clinical note on referral ${referral.referralCode}.`,
          });
        } catch (err) {
          console.error('Clinical note email notification failed:', err.message);
        }
      }
    } else if (isConsultant) {
      // Fan the clinical-note email out to the whole hospital team (owner + sub-users).
      try {
        const team = await notificationService.getHospitalTeam(referral.targetHospitalId);
        for (const member of team) {
          if (!member.email) continue;
          sendEmail({
            to: member.email,
            subject: `New clinical note — ${referral.referralCode} — CareBridge Health`,
            html: clinicalNoteEmail({
              recipientName: referral.targetHospitalId?.hospitalName || 'Clinical Staff',
              authorName: req.user.name,
              patientName: referral.patientName,
              referralCode: referral.referralCode,
              content,
              recipientRole: 'hospital',
            }),
            text: `New clinical note on referral ${referral.referralCode}.`,
          });
        }
      } catch (err) {
        console.error('Clinical note email notification failed:', err.message);
      }
    }

    // Notify other party via socket
    const io = req.app.get('io');
    if (io) {
      const room = isHospital ? `consultant:${referral.consultantId._id.toString()}` : `hospital:${referral.targetHospitalId._id.toString()}`;
      io.to(room).emit('NEW_CLINICAL_NOTE', {
        referralId: referral._id,
        type,
        authorName: req.user.name
      });
    }

    res.json({
      success: true,
      message: 'Note added successfully',
      data: referral.clinicalNotes[referral.clinicalNotes.length - 1]
    });
  } catch (error) {
    console.error('Add clinical note error:', error);
    res.status(500).json({ success: false, message: 'Error adding clinical note' });
  }
};
