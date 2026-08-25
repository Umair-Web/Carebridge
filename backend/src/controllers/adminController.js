const User = require('../models/User');
const Consultant = require('../models/Consultant');
const Hospital = require('../models/Hospital');
const Referral = require('../models/Referral');
const Admission = require('../models/Admission');
const Payout = require('../models/Payout');
const DepartmentCatalog = require('../models/DepartmentCatalog');
const ScoringConfig = require('../models/ScoringConfig');
const PlatformSettings = require('../models/PlatformSettings');
const AuditLog = require('../models/AuditLog');
const HospitalDoctor = require('../models/HospitalDoctor');
const { logAction } = require('../utils/logger');
const { ageFromDob } = require('../utils/age');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

/** Resolve consultant User by userId or consultantId. */
async function resolveConsultantUser(id) {
  let user = await User.findById(id);
  if (user && user.role === 'consultant') return user;
  const consultant = await Consultant.findById(id);
  if (consultant) {
    user = await User.findById(consultant.userId);
    if (user && user.role === 'consultant') return user;
  }
  return null;
}

/** Require short-lived unlock token from verify-password. */
function assertConsultantProfileUnlock(req, userId) {
  const token = req.headers['x-profile-unlock'];
  if (!token) {
    const err = new Error('Consultant password required to view this profile');
    err.statusCode = 403;
    throw err;
  }
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    const err = new Error('Profile unlock expired or invalid. Enter password again.');
    err.statusCode = 403;
    throw err;
  }
  if (decoded.purpose !== 'consultant_profile_unlock' || decoded.consultantUserId !== String(userId)) {
    const err = new Error('Profile unlock is not valid for this consultant');
    err.statusCode = 403;
    throw err;
  }
}

/** Resolve hospital User by userId or hospitalId. */
async function resolveHospitalUser(id) {
  let user = await User.findById(id);
  if (user && user.role === 'hospital') return user;
  const hospital = await Hospital.findById(id);
  if (hospital) {
    user = await User.findById(hospital.userId);
    if (user && user.role === 'hospital') return user;
  }
  return null;
}

/** Require short-lived unlock token from hospital verify-password. */
function assertHospitalProfileUnlock(req, userId) {
  const token = req.headers['x-profile-unlock'];
  if (!token) {
    const err = new Error('Hospital password required to view this profile');
    err.statusCode = 403;
    throw err;
  }
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    const err = new Error('Profile unlock expired or invalid. Enter password again.');
    err.statusCode = 403;
    throw err;
  }
  if (decoded.purpose !== 'hospital_profile_unlock' || decoded.hospitalUserId !== String(userId)) {
    const err = new Error('Profile unlock is not valid for this hospital');
    err.statusCode = 403;
    throw err;
  }
}

exports.listPendingUsers = async (req, res) => {
  try {
    const users = await User.find({ status: 'pending' }).select('-passwordHash').sort({ createdAt: -1 }).lean();

    const enriched = await Promise.all(
      users.map(async (u) => {
        const base = { ...u };
        if (u.role === 'consultant') {
          base.profile = await Consultant.findOne({ userId: u._id })
            .select('pmdcNumber specialty clinicName clinicAddress cnic verificationDocuments isVerified')
            .lean();
        } else if (u.role === 'hospital') {
          base.profile = await Hospital.findOne({ userId: u._id })
            .select('hospitalName registrationNumber representativeCnic departments bedsInventory address registrationDocuments isRegistrationVerified')
            .lean();
        }
        return base;
      })
    );

    res.json({ success: true, data: enriched });
  } catch (error) {
    console.error('listPendingUsers:', error);
    res.status(500).json({ success: false, message: 'Failed to list pending users' });
  }
};

exports.listAllUsers = async (req, res) => {
  console.log(`[ADMIN] listAllUsers hit: role=${req.query.role}, status=${req.query.status}`);
  try {
    // Exclude team sub-users (hospital/lab staff logins) — they own no facility
    // document and must never be listed as a hospital/laboratory. `field: null`
    // matches both null and legacy documents where the field is absent, so real
    // owner accounts are unaffected.
    const filter = { status: { $ne: 'pending' }, hospitalId: null, labId: null };
    if (req.query.role) filter.role = req.query.role;
    console.log('[ADMIN] Filter:', filter);
    const users = await User.find(filter).select('-passwordHash').sort({ createdAt: -1 }).lean();
    console.log(`[ADMIN] Found ${users.length} users`);

    const enriched = await Promise.all(
      users.map(async (u) => {
        const base = { ...u };
        if (u.role === 'consultant') {
          base.profile = await Consultant.findOne({ userId: u._id })
            .select('pmdcNumber specialty clinicName clinicAddress totalEarnings monthlyEarnings walletBalance commissionPercentage maxLabDiscountPercentage promoCode isVerified preferredHospitals verificationDocuments')
            .lean();
        } else if (u.role === 'hospital') {
          base.profile = await Hospital.findOne({ userId: u._id })
            .select('hospitalName registrationNumber representativeCnic departments inactiveDepartments bedsInventory address city area deductionPercentage isActive isRegistrationVerified registrationDocuments ratePackages')
            .lean();
        }
        return base;
      })
    );

    console.log(`[ADMIN] Returning ${enriched.length} enriched users`);
    res.json({ success: true, data: enriched });
  } catch (error) {
    console.error('[ADMIN] listAllUsers Error:', error);
    res.status(500).json({ success: false, message: 'Failed to list users', details: error.message });
  }
};


exports.updateUserStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'suspended'].includes(status)) {
      return res.status(400).json({ success: false, message: 'status must be active or suspended' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Enforce the flow: a user must verify their email via OTP before an admin
    // can approve them. Approval must never be a back door around OTP.
    if (status === 'active' && !user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: 'User must verify their email via OTP before approval.',
      });
    }

    user.status = status;

    await user.save();

    if (user.role === 'hospital') {
      await Hospital.updateOne(
        { userId: user._id },
        {
          isActive: status === 'active',
          ...(status === 'active' ? { isRegistrationVerified: true } : { isRegistrationVerified: false }),
        }
      );
    }
    if (user.role === 'consultant') {
      await Consultant.updateOne(
        { userId: user._id },
        { isVerified: status === 'active' }
      );
    }

    await logAction({
      req,
      action: 'USER_STATUS_CHANGE',
      entityId: user._id,
      entityModel: 'User',
      details: { role: user.role, newStatus: status }
    });

    const notificationService = require('../services/notificationService');
    if (status === 'active') {
      notificationService.notifyAccountApproved(user).catch((err) =>
        console.error('Account approved WhatsApp failed:', err.message)
      );
    } else {
      notificationService.notifyAccountSuspended(user).catch((err) =>
        console.error('Account suspended WhatsApp failed:', err.message)
      );
    }

    res.json({
      success: true,
      message: `User ${status === 'active' ? 'approved' : 'updated'}`,
      data: { id: user._id, status: user.status, role: user.role },
    });
  } catch (error) {
    console.error('updateUserStatus:', error);
    res.status(500).json({ success: false, message: 'Failed to update user' });
  }
};

exports.getPlatformAnalytics = async (req, res) => {
  try {
    const [users, referrals, hospitals, admissions, consultantCount, hospitalCount] = await Promise.all([
      User.countDocuments(),
      Referral.countDocuments(),
      Hospital.countDocuments({ isActive: true }),
      Admission.countDocuments({ status: 'billed' }),
      Consultant.countDocuments(),
      Hospital.countDocuments(),
    ]);
    const pendingUsers = await User.countDocuments({ status: 'pending' });
    const revenueAgg = await Admission.aggregate([
      { $match: { status: 'billed' } },
      { $group: { _id: null, total: { $sum: '$billTotalPaisa' } } },
    ]);
    const platformRevenuePaisa = revenueAgg[0]?.total || 0;

    const byHospital = await Referral.aggregate([
      { $match: { targetHospitalId: { $ne: null } } },
      { $group: { _id: '$targetHospitalId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]);
    const hospitalIds = byHospital.map((h) => h._id);
    const hospitalDocs = await Hospital.find({ _id: { $in: hospitalIds } }).select('hospitalName').lean();
    const nameById = Object.fromEntries(hospitalDocs.map((h) => [h._id.toString(), h.hospitalName]));
    const topHospitals = byHospital.map((row) => ({
      hospitalId: row._id,
      name: nameById[row._id.toString()] || 'Hospital',
      referrals: row.count,
    }));

    res.json({
      success: true,
      data: {
        totalUsers: users,
        totalConsultants: consultantCount,
        totalHospitals: hospitalCount,
        pendingApprovals: pendingUsers,
        totalReferrals: referrals,
        activeHospitals: hospitals,
        completedAdmissions: admissions,
        platformRevenuePaisa,
        topHospitals,
      },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Analytics failed' });
  }
};

exports.getScoringConfig = async (req, res) => {
  try {
    let doc = await ScoringConfig.findOne().sort({ updatedAt: -1 });
    if (!doc) doc = await ScoringConfig.create({});
    res.json({ success: true, data: doc });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to load scoring config' });
  }
};

exports.updateScoringConfig = async (req, res) => {
  try {
    const body = req.body || {};
    const fields = ['specialtyMatch', 'bedAvailability', 'distance', 'costFit', 'slaHistory', 'preference'];
    const update = {};
    for (const f of fields) {
      if (body[f] != null) update[f] = Number(body[f]);
    }
    let doc = await ScoringConfig.findOne().sort({ updatedAt: -1 });
    if (!doc) doc = new ScoringConfig(update);
    else Object.assign(doc, update);
    await doc.save();

    await logAction({
      req,
      action: 'SCORING_CONFIG_UPDATE',
      entityId: doc._id,
      entityModel: 'ScoringConfig',
      details: update
    });

    res.json({ success: true, data: doc });
  } catch (e) {
    const msg = e.message || 'Update failed';
    res.status(400).json({ success: false, message: msg });
  }
};

exports.listDepartments = async (req, res) => {
  try {
    const rows = await DepartmentCatalog.find().sort({ sortOrder: 1, name: 1 }).lean();
    res.json({ success: true, data: rows });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to list departments' });
  }
};

exports.createDepartment = async (req, res) => {
  try {
    const { name, keywords = [], sortOrder = 0 } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: 'name required' });
    }
    const row = await DepartmentCatalog.create({
      name: name.trim(),
      keywords: keywords.map((k) => String(k).toLowerCase().trim()).filter(Boolean),
      sortOrder,
    });
    res.status(201).json({ success: true, data: row });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message || 'Create failed' });
  }
};

exports.updateDepartment = async (req, res) => {
  try {
    const row = await DepartmentCatalog.findById(req.params.id);
    if (!row) return res.status(404).json({ success: false, message: 'Not found' });
    const { name, keywords, sortOrder, isActive } = req.body;
    if (name != null) row.name = String(name).trim();
    if (Array.isArray(keywords)) {
      row.keywords = keywords.map((k) => String(k).toLowerCase().trim()).filter(Boolean);
    }
    if (sortOrder != null) row.sortOrder = Number(sortOrder);
    if (typeof isActive === 'boolean') row.isActive = isActive;
    await row.save();
    res.json({ success: true, data: row });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message || 'Update failed' });
  }
};

exports.deleteDepartment = async (req, res) => {
  try {
    await DepartmentCatalog.deleteOne({ _id: req.params.id });
    res.json({ success: true, message: 'Deleted' });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Delete failed' });
  }
};

exports.getPlatformSettings = async (req, res) => {
  try {
    let doc = await PlatformSettings.findOne().sort({ updatedAt: -1 });
    if (!doc) doc = await PlatformSettings.create({});
    res.json({ success: true, data: doc });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed' });
  }
};

exports.updatePlatformSettings = async (req, res) => {
  try {
    const {
      defaultHospitalDeductionPercentage,
      defaultConsultantCommissionPercentage,
      walletThresholdPaisa,
      walletInitialHoldPaisa,
      platformName,
      logoUrl,
      primaryColor,
      accentColor,
      faviconUrl,
    } = req.body;

    let doc = await PlatformSettings.findOne().sort({ updatedAt: -1 });
    if (!doc) doc = new PlatformSettings();

    if (defaultHospitalDeductionPercentage != null) {
      doc.defaultHospitalDeductionPercentage = Math.max(0, Math.min(100, Number(defaultHospitalDeductionPercentage)));
    }
    if (defaultConsultantCommissionPercentage != null) {
      doc.defaultConsultantCommissionPercentage = Math.max(0, Math.min(100, Number(defaultConsultantCommissionPercentage)));
    }
    if (walletThresholdPaisa != null) {
      doc.walletThresholdPaisa = Math.max(0, Number(walletThresholdPaisa));
    }
    if (walletInitialHoldPaisa != null) {
      doc.walletInitialHoldPaisa = Math.max(0, Number(walletInitialHoldPaisa));
    }
    if (platformName != null) doc.platformName = String(platformName).trim();
    if (logoUrl != null) doc.logoUrl = String(logoUrl).trim();
    if (primaryColor != null) doc.primaryColor = String(primaryColor).trim();
    if (accentColor != null) doc.accentColor = String(accentColor).trim();
    if (faviconUrl != null) doc.faviconUrl = String(faviconUrl).trim();

    await doc.save();

    await logAction({
      req,
      action: 'PLATFORM_SETTINGS_UPDATE',
      entityId: doc._id,
      entityModel: 'PlatformSettings',
      details: {
        defaultHospitalDeductionPercentage,
        defaultConsultantCommissionPercentage,
        walletThresholdPaisa,
        walletInitialHoldPaisa,
        platformName,
        logoUrl,
        primaryColor,
        accentColor,
        faviconUrl,
      }
    });

    res.json({ success: true, data: doc });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

exports.listPayouts = async (req, res) => {
  try {
    const rows = await Payout.find()
      .populate({ path: 'consultantId', select: 'pmdcNumber specialty promoCode', populate: { path: 'userId', select: 'name email' } })
      .populate('referralId', 'referralCode patientName status createdAt')
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    res.json({ success: true, data: rows });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed' });
  }
};

exports.markPayoutAsPaid = async (req, res) => {
  try {
    const { payoutId } = req.params;
    const { note } = req.body;

    const payout = await Payout.findById(payoutId);
    if (!payout) {
      return res.status(404).json({ success: false, message: 'Payout not found' });
    }

    if (payout.status === 'paid') {
      return res.status(400).json({ success: false, message: 'Already paid' });
    }

    payout.status = 'paid';
    payout.note = note || payout.note;
    await payout.save();

    await logAction({
      req,
      action: 'PAYOUT_DISBURSED',
      entityId: payout._id,
      entityModel: 'Payout',
      details: { amountPaisa: payout.amountPaisa, consultantId: payout.consultantId }
    });

    res.json({ success: true, message: 'Payout marked as paid' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Update failed' });
  }
};

exports.listAllReferrals = async (req, res) => {
  try {
    const referrals = await Referral.find()
      .populate({ path: 'consultantId', populate: { path: 'userId', select: 'name email phone' } })
      .populate('targetHospitalId', 'hospitalName')
      .populate('targetDoctorId', 'name specialty')
      .sort({ createdAt: -1 })
      .lean();

    const enriched = await Promise.all(
      referrals.map(async (r) => {
        let admission = null;
        if (['admitted', 'closed'].includes(r.status)) {
          admission = await Admission.findOne({ referralId: r._id })
            .populate('treatingDoctorId', 'name specialty')
            .lean();
        }
        return {
          ...r,
          consultantName: r.consultantId?.userId?.name || 'Unknown',
          admission,
          detailsViewAccess:
            r.status === 'closed'
              ? r.detailsViewAccess === 'active'
                ? 'active'
                : 'suspended'
              : r.detailsViewAccess === 'suspended'
                ? 'suspended'
                : 'active',
        };
      })
    );

    res.json({ success: true, data: enriched });
  } catch (error) {
    console.error('listAllReferrals error:', error);
    res.status(500).json({ success: false, message: 'Failed to list referrals' });
  }
};

exports.overrideReferral = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, hospitalId, priority } = req.body;
    
    const referral = await Referral.findById(id);
    if (!referral) return res.status(404).json({ success: false, message: 'Referral not found' });
    
    const updates = {};
    if (status) updates.status = status;
    if (hospitalId) updates.targetHospitalId = hospitalId;
    if (priority) updates.priority = priority;

    Object.assign(referral, updates);
    await referral.save();

    await logAction({
      req,
      action: 'ADMIN_OVERRIDE_REFERRAL',
      entityId: referral._id,
      entityModel: 'Referral',
      details: updates
    });

    res.json({ success: true, data: referral });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to override referral' });
  }
};

exports.listAllBeds = async (req, res) => {
  try {
    const hospitals = await Hospital.find({ isActive: true })
      .select('hospitalName city bedsInventory')
      .lean();
    res.json({ success: true, data: hospitals });
  } catch (error) {
    console.error('listAllBeds error:', error);
    res.status(500).json({ success: false, message: 'Error fetching beds' });
  }
};

exports.exportAuditLogs = async (req, res) => {
  try {
    const logs = await AuditLog.find()
      .populate('actorId', 'name role email')
      .sort({ createdAt: -1 })
      .lean();

    // Wrap every field in quotes and escape embedded quotes so commas, newlines
    // and JSON details never break the CSV columns.
    const csvField = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;

    const csvLines = [
      ['Timestamp', 'Administrator', 'Email', 'Role', 'Action', 'Entity Model', 'Entity ID', 'IP Address', 'Details']
        .map(csvField)
        .join(','),
    ];

    logs.forEach((log) => {
      csvLines.push([
        new Date(log.createdAt).toISOString(),
        log.actorId?.name || 'System',
        log.actorId?.email || 'N/A',
        log.actorId?.role || 'N/A',
        log.action || '',
        log.entityModel || '',
        log.entityId || '',
        log.ipAddress || '',
        log.details ? JSON.stringify(log.details) : '',
      ].map(csvField).join(','));
    });

    // Prepend a UTF-8 BOM so Excel opens the file with correct encoding.
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=audit-logs.csv');
    return res.send('﻿' + csvLines.join('\r\n'));
  } catch (error) {
    console.error('Export Audit Logs error:', error);
    res.status(500).json({ success: false, message: 'Error exporting audit logs' });
  }
};

exports.listAuditLogs = async (req, res) => {
  try {
    const logs = await AuditLog.find()
      .populate('actorId', 'name email')
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();
    
    const mappedLogs = logs.map(log => ({
      ...log,
      adminId: log.actorId
    }));

    res.json({ success: true, data: mappedLogs });
  } catch (error) {
    console.error('listAuditLogs error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch audit logs' });
  }
};

exports.getConsultantProfile = async (req, res) => {
  try {
    const { id } = req.params;
    let user = await User.findById(id).select('-passwordHash').lean();
    let consultant = null;
    if (user) {
      consultant = await Consultant.findOne({ userId: user._id }).lean();
    } else {
      consultant = await Consultant.findById(id).lean();
      if (consultant) {
        user = await User.findById(consultant.userId).select('-passwordHash').lean();
      }
    }

    if (!user || !consultant) {
      return res.status(404).json({ success: false, message: 'Consultant not found' });
    }

    try {
      assertConsultantProfileUnlock(req, user._id);
    } catch (unlockErr) {
      return res.status(unlockErr.statusCode || 403).json({ success: false, message: unlockErr.message });
    }

    // Referral Performance
    const referrals = await Referral.find({ consultantId: consultant._id }).lean();
    const totalReferrals = referrals.length;
    const acceptedReferrals = referrals.filter(r => ['accepted', 'admitted', 'closed'].includes(r.status)).length;
    const rejectedReferrals = referrals.filter(r => r.status === 'rejected').length;
    const emergencyReferrals = referrals.filter(r => r.urgency === 'emergency').length;

    // Average SLA Response Time
    const resolved = referrals.filter(r => r.acceptedAt);
    let averageSlaResponseTime = '—';
    if (resolved.length > 0) {
      const sumMs = resolved.reduce((acc, curr) => acc + (curr.acceptedAt.getTime() - curr.createdAt.getTime()), 0);
      const avgMin = Math.round(sumMs / (60000 * resolved.length));
      if (avgMin < 60) {
        averageSlaResponseTime = `${avgMin} mins`;
      } else {
        averageSlaResponseTime = `${(avgMin / 60).toFixed(1)} hours`;
      }
    }
    const successRate = totalReferrals > 0 ? Math.round((acceptedReferrals / totalReferrals) * 100) : 0;

    // Wallet Section
    const payouts = await Payout.find({ consultantId: consultant._id }).lean();
    const pendingAmountPaisa = payouts.filter(p => p.status === 'pending').reduce((acc, curr) => acc + curr.amountPaisa, 0);
    const withdrawnAmountPaisa = payouts.filter(p => p.status === 'paid').reduce((acc, curr) => acc + curr.amountPaisa, 0);
    
    const settings = await PlatformSettings.findOne().sort({ updatedAt: -1 });
    const commPct = consultant.commissionPercentage ?? settings?.defaultConsultantCommissionPercentage ?? 60;
    const commissionVal = `${commPct}% of platform's referral cut (Dynamic split)`;

    // Activity Logs
    const logs = await AuditLog.find({ actorId: user._id })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const loginHistory = logs
      .filter(l => l.action === 'USER_LOGIN' || l.action?.toLowerCase().includes('login'))
      .map(l => ({
        time: l.createdAt,
        ip: l.ipAddress || 'Unknown IP',
        device: l.userAgent || 'Unknown Device'
      }));

    const referralActionsLog = logs
      .filter(l => l.entityModel === 'Referral' || l.action?.toLowerCase().includes('referral'))
      .map(l => ({
        time: l.createdAt,
        action: l.action,
        details: l.details || {}
      }));

    res.json({
      success: true,
      data: {
        user,
        profile: {
          ...consultant,
          performance: {
            totalReferrals,
            acceptedReferrals,
            rejectedReferrals,
            emergencyReferrals,
            averageSlaResponseTime,
            successRate
          },
          wallet: {
            currentBalancePaisa: consultant.walletBalance || 0,
            pendingAmountPaisa,
            withdrawnAmountPaisa,
            commissionStructure: commissionVal
          },
          loginHistory: loginHistory.slice(0, 5),
          referralActionsLog: referralActionsLog.slice(0, 5)
        }
      }
    });
  } catch (error) {
    console.error('getConsultantProfile error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve consultant profile details' });
  }
};

exports.adminChangePassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long' });
    }
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    
    user.passwordHash = await bcrypt.hash(password, 12);
    await user.save();

    await logAction({
      req,
      action: 'ADMIN_CHANGE_PASSWORD',
      entityId: user._id,
      entityModel: 'User',
      details: { email: user.email }
    });

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Failed to change password' });
  }
};

/** Verify consultant login password and issue a short-lived profile unlock token. */
exports.verifyConsultantPassword = async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ success: false, message: 'Password is required' });
    }

    const user = await resolveConsultantUser(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Consultant not found' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      // Use 403 (not 401) so the frontend auth interceptor does not treat this as a session expiry.
      return res.status(403).json({ success: false, message: 'Incorrect consultant password' });
    }

    const unlockToken = jwt.sign(
      {
        purpose: 'consultant_profile_unlock',
        consultantUserId: user._id.toString(),
      },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    await logAction({
      req,
      action: 'ADMIN_VERIFY_CONSULTANT_PASSWORD',
      entityId: user._id,
      entityModel: 'User',
      details: { email: user.email },
    });

    res.json({
      success: true,
      message: 'Password verified',
      unlockToken,
    });
  } catch (e) {
    console.error('verifyConsultantPassword error:', e);
    res.status(500).json({ success: false, message: 'Failed to verify password' });
  }
};

/** Verify hospital login password and issue a short-lived profile unlock token. */
exports.verifyHospitalPassword = async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ success: false, message: 'Password is required' });
    }

    const user = await resolveHospitalUser(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Hospital not found' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      // Use 403 (not 401) so the frontend auth interceptor does not treat this as a session expiry.
      return res.status(403).json({ success: false, message: 'Incorrect hospital password' });
    }

    const unlockToken = jwt.sign(
      {
        purpose: 'hospital_profile_unlock',
        hospitalUserId: user._id.toString(),
      },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    await logAction({
      req,
      action: 'ADMIN_VERIFY_HOSPITAL_PASSWORD',
      entityId: user._id,
      entityModel: 'User',
      details: { email: user.email },
    });

    res.json({
      success: true,
      message: 'Password verified',
      unlockToken,
    });
  } catch (e) {
    console.error('verifyHospitalPassword error:', e);
    res.status(500).json({ success: false, message: 'Failed to verify password' });
  }
};

exports.adminDeleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (user.role === 'admin' && !user.createdBy) {
      return res.status(400).json({ success: false, message: 'You cannot remove the main/primary user account' });
    }

    if (await user.isAncestorOf(req.user.id)) {
      return res.status(400).json({
        success: false,
        message: 'You cannot remove a user who is the creator (or ancestor creator) of your account',
      });
    }

    if (user.role === 'consultant') {
      await Consultant.deleteOne({ userId: user._id });
    } else if (user.role === 'hospital') {
      // Facility owner → remove its Hospital and every linked team sub-user login
      // so no orphaned accounts remain. Sub-users (no Hospital doc) skip this.
      const hospital = await Hospital.findOne({ userId: user._id });
      if (hospital) {
        await User.deleteMany({ hospitalId: hospital._id });
        await Hospital.deleteOne({ _id: hospital._id });
      }
    } else if (user.role === 'laboratory') {
      const Laboratory = require('../models/Laboratory');
      const lab = await Laboratory.findOne({ userId: user._id });
      if (lab) {
        await User.deleteMany({ labId: lab._id });
        await Laboratory.deleteOne({ _id: lab._id });
      }
    }

    await User.deleteOne({ _id: user._id });

    await logAction({
      req,
      action: 'ADMIN_DELETE_USER',
      entityId: user._id,
      entityModel: 'User',
      details: { email: user.email, role: user.role }
    });

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Failed to delete user' });
  }
};

exports.adminUpdateConsultantCommission = async (req, res) => {
  try {
    const { rupeesToPaisa, clampPct } = require('../services/commissionService');
    const { id } = req.params;
    const b = req.body || {};
    const { commissionPercentage, commissionModel } = b;

    let consultant = await Consultant.findOne({ userId: id });
    if (!consultant) {
      consultant = await Consultant.findById(id);
    }
    if (!consultant) {
      return res.status(404).json({ success: false, message: 'Consultant not found' });
    }

    const TYPES = ['percentage', 'fixed'];
    const bad = (msg) => res.status(400).json({ success: false, message: msg });
    // Accept a fixed amount as rupees (preferred from UI) or already-paisa.
    const fixedPaisa = (rupeesKey, paisaKey) => {
      if (b[paisaKey] !== undefined && b[paisaKey] !== null) return Math.max(0, Math.round(Number(b[paisaKey]) || 0));
      if (b[rupeesKey] !== undefined && b[rupeesKey] !== null) return rupeesToPaisa(b[rupeesKey]);
      return undefined;
    };
    const setType = (key, val) => {
      if (val === undefined) return true;
      if (!TYPES.includes(val)) { bad(`Invalid ${key}`); return false; }
      consultant[key] = val;
      return true;
    };
    const setPct = (key, val) => {
      if (val === undefined || val === null) return true;
      if (isNaN(val) || val < 0 || val > 100) { bad(`${key} must be 0-100`); return false; }
      consultant[key] = clampPct(val);
      return true;
    };
    const setPaisa = (key, val) => {
      if (val === undefined) return true;
      consultant[key] = Math.max(0, Math.round(Number(val) || 0));
      return true;
    };

    // Legacy field (kept; still used while a doctor is on the legacy model).
    if (commissionPercentage !== undefined) {
      if (isNaN(commissionPercentage) || commissionPercentage < 0 || commissionPercentage > 100) {
        return bad('Valid commission percentage (0-100) is required');
      }
      consultant.commissionPercentage = Number(commissionPercentage);
    }

    // Commission model switch.
    if (commissionModel !== undefined) {
      if (!['legacy', 'additive'].includes(commissionModel)) return bad('Invalid commissionModel');
      consultant.commissionModel = commissionModel;
    }

    // ── Doctor COMMISSION only (platform charge lives on the facility) ──
    let ok = true;
    // Hospital commission deal
    ok = ok && setType('hospitalCommissionType', b.hospitalCommissionType);
    ok = ok && setPct('hospitalCommissionPercentage', b.hospitalCommissionPercentage);
    ok = ok && setPaisa('hospitalFixedCommissionPaisa', fixedPaisa('hospitalFixedCommissionRupees', 'hospitalFixedCommissionPaisa'));
    // Lab commission deal (per test)
    ok = ok && setType('labCommissionType', b.labCommissionType);
    ok = ok && setPct('labCommissionPercentage', b.labCommissionPercentage);
    ok = ok && setPaisa('labFixedCommissionPaisaPerTest', fixedPaisa('labFixedCommissionRupeesPerTest', 'labFixedCommissionPaisaPerTest'));
    if (!ok) return; // a setter already sent a 400

    // Require at least one recognized field so an empty body is a clear error.
    if (
      commissionPercentage === undefined &&
      commissionModel === undefined &&
      ![
        'hospitalCommissionType', 'hospitalCommissionPercentage', 'hospitalFixedCommissionRupees', 'hospitalFixedCommissionPaisa',
        'labCommissionType', 'labCommissionPercentage', 'labFixedCommissionRupeesPerTest', 'labFixedCommissionPaisaPerTest',
      ].some((k) => b[k] !== undefined)
    ) {
      return bad('No commission fields provided');
    }

    await consultant.save();

    await logAction({
      req,
      action: 'ADMIN_UPDATE_CONSULTANT_COMMISSION',
      entityId: consultant._id,
      entityModel: 'Consultant',
      details: {
        commissionModel: consultant.commissionModel,
        commissionPercentage: consultant.commissionPercentage,
        hospitalCommissionType: consultant.hospitalCommissionType,
        hospitalCommissionPercentage: consultant.hospitalCommissionPercentage,
        hospitalFixedCommissionPaisa: consultant.hospitalFixedCommissionPaisa,
        labCommissionType: consultant.labCommissionType,
        labCommissionPercentage: consultant.labCommissionPercentage,
        labFixedCommissionPaisaPerTest: consultant.labFixedCommissionPaisaPerTest,
      },
    });

    res.json({ success: true, message: 'Consultant commission updated successfully', data: consultant });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Failed to update commission' });
  }
};

exports.adminUpdateHospitalDeduction = async (req, res) => {
  try {
    const { rupeesToPaisa } = require('../services/commissionService');
    const { id } = req.params;
    const { deductionPercentage, platformChargeType } = req.body;

    let hospital = await Hospital.findOne({ userId: id });
    if (!hospital) {
      hospital = await Hospital.findById(id);
    }
    if (!hospital) {
      return res.status(404).json({ success: false, message: 'Hospital not found' });
    }

    // Platform charge type (percentage of bill OR a flat fee per patient).
    if (platformChargeType !== undefined) {
      if (!['percentage', 'fixed'].includes(platformChargeType)) {
        return res.status(400).json({ success: false, message: 'Invalid platformChargeType' });
      }
      hospital.platformChargeType = platformChargeType;
    }
    // Percentage value (also the legacy nested cut).
    if (deductionPercentage !== undefined && deductionPercentage !== null) {
      if (isNaN(deductionPercentage) || deductionPercentage < 0 || deductionPercentage > 100) {
        return res.status(400).json({ success: false, message: 'Valid deduction percentage (0-100) is required' });
      }
      hospital.deductionPercentage = Number(deductionPercentage);
    }
    // Flat platform fee per patient (rupees from UI -> paisa, or direct paisa).
    if (req.body.fixedPlatformChargePaisa !== undefined && req.body.fixedPlatformChargePaisa !== null) {
      hospital.fixedPlatformChargePaisa = Math.max(0, Math.round(Number(req.body.fixedPlatformChargePaisa) || 0));
    } else if (req.body.fixedPlatformChargeRupees !== undefined && req.body.fixedPlatformChargeRupees !== null) {
      hospital.fixedPlatformChargePaisa = rupeesToPaisa(req.body.fixedPlatformChargeRupees);
    }

    await hospital.save();

    await logAction({
      req,
      action: 'ADMIN_UPDATE_HOSPITAL_DEDUCTION',
      entityId: hospital._id,
      entityModel: 'Hospital',
      details: {
        platformChargeType: hospital.platformChargeType,
        deductionPercentage: hospital.deductionPercentage,
        fixedPlatformChargePaisa: hospital.fixedPlatformChargePaisa,
      },
    });

    res.json({ success: true, message: 'Hospital platform charge updated successfully', data: hospital });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Failed to update platform charge' });
  }
};

/**
 * List every consultant with their per-consultant platform-fee override (if any) for a specific
 * hospital, plus how many referrals they've sent there — so the admin can decide who gets a
 * special platform fee. `:id` may be the hospital's userId or _id.
 */
exports.adminListHospitalConsultantOverrides = async (req, res) => {
  try {
    const { id } = req.params;
    let hospital = await Hospital.findOne({ userId: id });
    if (!hospital) hospital = await Hospital.findById(id);
    if (!hospital) return res.status(404).json({ success: false, message: 'Hospital not found' });

    try {
      assertHospitalProfileUnlock(req, hospital.userId);
    } catch (unlockErr) {
      return res.status(unlockErr.statusCode || 403).json({ success: false, message: unlockErr.message });
    }

    const hospitalId = String(hospital._id);
    const consultants = await Consultant.find()
      .populate('userId', 'name email status')
      .select('specialty referralHistoryCount facilityPlatformOverrides userId')
      .lean();

    const data = consultants
      .filter((c) => c.userId)
      .map((c) => {
        const ov = (c.facilityPlatformOverrides || []).find(
          (o) => o && o.facilityType === 'hospital' && String(o.facilityId) === hospitalId
        );
        // referralHistoryCount is a Mongoose Map; under .lean() it may be a native Map or a plain object.
        const rhc = c.referralHistoryCount;
        const referralCount = rhc instanceof Map ? Number(rhc.get(hospitalId) || 0) : Number((rhc || {})[hospitalId] || 0);
        return {
          consultantId: c._id,
          name: c.userId?.name || 'Unknown',
          email: c.userId?.email || '',
          status: c.userId?.status || '',
          specialty: c.specialty || '',
          referralCount,
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
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Failed to load consultant overrides' });
  }
};

/**
 * Set (or clear, with `remove: true`) one consultant's platform-fee override for a specific
 * hospital. This ONLY changes the platform charge (admin revenue / what the hospital pays) for
 * that consultant's referrals to this hospital — the doctor's commission is never touched.
 * `:id` may be the hospital's userId or _id.
 */
exports.adminSetHospitalConsultantOverride = async (req, res) => {
  try {
    const { rupeesToPaisa, clampPct } = require('../services/commissionService');
    const { id } = req.params;
    const { consultantId, platformChargeType, platformChargePercentage, fixedPlatformChargeRupees, remove } = req.body || {};

    let hospital = await Hospital.findOne({ userId: id });
    if (!hospital) hospital = await Hospital.findById(id);
    if (!hospital) return res.status(404).json({ success: false, message: 'Hospital not found' });

    if (!consultantId) return res.status(400).json({ success: false, message: 'consultantId is required' });
    const consultant = await Consultant.findById(consultantId);
    if (!consultant) return res.status(404).json({ success: false, message: 'Consultant not found' });

    const hospitalId = String(hospital._id);
    // Replace, never duplicate: drop any existing override for this hospital first.
    consultant.facilityPlatformOverrides = (consultant.facilityPlatformOverrides || []).filter(
      (o) => !(o && o.facilityType === 'hospital' && String(o.facilityId) === hospitalId)
    );

    if (!remove) {
      if (!['percentage', 'fixed'].includes(platformChargeType)) {
        return res.status(400).json({ success: false, message: 'platformChargeType must be percentage or fixed' });
      }
      const entry = { facilityType: 'hospital', facilityId: hospital._id, platformChargeType };
      if (platformChargeType === 'percentage') {
        const pct = Number(platformChargePercentage);
        if (isNaN(pct) || pct < 0 || pct > 100) {
          return res.status(400).json({ success: false, message: 'platformChargePercentage must be 0-100' });
        }
        entry.platformChargePercentage = clampPct(pct);
        entry.fixedPlatformChargePaisa = 0;
      } else {
        entry.fixedPlatformChargePaisa = rupeesToPaisa(fixedPlatformChargeRupees);
        entry.platformChargePercentage = 0;
      }
      consultant.facilityPlatformOverrides.push(entry);
    }

    await consultant.save();

    await logAction({
      req,
      action: remove ? 'ADMIN_CLEAR_CONSULTANT_PLATFORM_OVERRIDE' : 'ADMIN_SET_CONSULTANT_PLATFORM_OVERRIDE',
      entityId: consultant._id,
      entityModel: 'Consultant',
      details: { hospitalId, platformChargeType, platformChargePercentage, fixedPlatformChargeRupees, remove: !!remove },
    });

    res.json({ success: true, message: remove ? 'Special platform fee removed' : 'Special platform fee saved' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Failed to save consultant platform fee' });
  }
};

exports.updateReferralFull = async (req, res) => {
  try {
    const { id } = req.params;
    const referral = await Referral.findById(id);
    if (!referral) return res.status(404).json({ success: false, message: 'Referral not found' });

    const updates = { ...req.body };
    
    // Drop guardianCnic if a stale client still sends it (field removed from schema)
    delete updates.guardianCnic;

    // Keep age in sync with DOB whenever a date of birth is provided.
    if (updates.dateOfBirth) {
      const derivedAge = ageFromDob(updates.dateOfBirth);
      if (derivedAge != null) updates.age = derivedAge;
    }

    Object.assign(referral, updates);
    await referral.save();

    // Synchronize admission details if present
    if (updates.roomNumber || updates.bedNumber || updates.admissionDepartment || updates.treatingDoctorId) {
      const admissionUpdates = {};
      if (updates.roomNumber) admissionUpdates.roomNumber = updates.roomNumber;
      if (updates.bedNumber) admissionUpdates.bedNumber = updates.bedNumber;
      if (updates.admissionDepartment) admissionUpdates.admissionDepartment = updates.admissionDepartment;
      if (updates.treatingDoctorId) admissionUpdates.treatingDoctorId = updates.treatingDoctorId;

      await Admission.findOneAndUpdate(
        { referralId: referral._id },
        { $set: admissionUpdates },
        { new: true }
      );
    }

    await logAction({
      req,
      action: 'ADMIN_UPDATE_REFERRAL_FULL',
      entityId: referral._id,
      entityModel: 'Referral',
      details: updates
    });

    res.json({ success: true, data: referral });
  } catch (error) {
    console.error('updateReferralFull error:', error);
    res.status(500).json({ success: false, message: 'Failed to update referral' });
  }
};

exports.deleteReferral = async (req, res) => {
  try {
    const { id } = req.params;
    const referral = await Referral.findById(id);
    if (!referral) return res.status(404).json({ success: false, message: 'Referral not found' });

    await Admission.deleteOne({ referralId: referral._id });
    await Referral.deleteOne({ _id: referral._id });

    await logAction({
      req,
      action: 'ADMIN_DELETE_REFERRAL',
      entityId: referral._id,
      entityModel: 'Referral',
      details: { referralCode: referral.referralCode, patientName: referral.patientName }
    });

    res.json({ success: true, message: 'Referral and associated admission records deleted successfully.' });
  } catch (error) {
    console.error('deleteReferral error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete referral' });
  }
};

exports.listAllAdmissions = async (req, res) => {
  try {
    const admissions = await Admission.find()
      .populate('referralId', 'referralCode patientName urgency status department cnic guardianName guardianRelation phone')
      .populate('consultantId', 'pmdcNumber specialty clinicName')
      .populate('hospitalId', 'hospitalName city area')
      .populate('treatingDoctorId', 'name specialty')
      .sort({ updatedAt: -1 });
    res.json({ success: true, data: admissions });
  } catch (error) {
    console.error('listAllAdmissions error:', error);
    res.status(500).json({ success: false, message: 'Failed to list admissions' });
  }
};

exports.adminUpdateHospitalBeds = async (req, res) => {
  try {
    const { hospitalId } = req.params;
    const { beds } = req.body;

    if (!Array.isArray(beds)) {
      return res.status(400).json({ success: false, message: 'Invalid beds payload, expected array.' });
    }

    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) {
      return res.status(404).json({ success: false, message: 'Hospital not found' });
    }

    beds.forEach((updatedWard) => {
      const { ward, totalBeds, occupiedBeds } = updatedWard;
      let wardItem = hospital.bedsInventory.find((b) => b.ward === ward);
      if (!wardItem) {
        hospital.bedsInventory.push({
          ward,
          totalBeds: Number(totalBeds) || 0,
          occupiedBeds: Number(occupiedBeds) || 0,
          availableBeds: Math.max(0, (Number(totalBeds) || 0) - (Number(occupiedBeds) || 0)),
        });
      } else {
        wardItem.totalBeds = Number(totalBeds) || 0;
        wardItem.occupiedBeds = Number(occupiedBeds) || 0;
        wardItem.availableBeds = Math.max(0, wardItem.totalBeds - wardItem.occupiedBeds);
      }
    });

    await hospital.save();

    const io = req.app.get('io');
    if (io) {
      io.to(`hospital:${hospital._id.toString()}`).emit('BED_UPDATE', {
        hospitalId: hospital._id.toString(),
        beds: hospital.bedsInventory,
      });
    }

    await logAction({
      req,
      action: 'ADMIN_UPDATE_HOSPITAL_BEDS',
      entityId: hospital._id,
      entityModel: 'Hospital',
      details: { beds }
    });

    res.json({ success: true, message: 'Bed inventory updated successfully', data: hospital.bedsInventory });
  } catch (error) {
    console.error('adminUpdateHospitalBeds error:', error);
    res.status(500).json({ success: false, message: 'Failed to update bed inventory' });
  }
};

async function attachAdmissionsToReferrals(referrals) {
  if (!referrals.length) return [];
  const referralIds = referrals.map((r) => r._id);
  const admissions = await Admission.find({ referralId: { $in: referralIds } })
    .populate('treatingDoctorId', 'name specialty')
    .lean();
  const byReferral = new Map(admissions.map((a) => [a.referralId.toString(), a]));
  return referrals.map((r) => ({
    ...r,
    admission: byReferral.get(r._id.toString()) || null,
  }));
}

/** Patients / referrals for a hospital with admission placement details */
exports.getHospitalPatients = async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.params.id);
    if (!hospital) {
      return res.status(404).json({ success: false, message: 'Hospital not found' });
    }

    try {
      assertHospitalProfileUnlock(req, hospital.userId);
    } catch (unlockErr) {
      return res.status(unlockErr.statusCode || 403).json({ success: false, message: unlockErr.message });
    }

    const referrals = await Referral.find({ targetHospitalId: hospital._id })
      .populate('targetDoctorId', 'name specialty')
      .populate({
        path: 'consultantId',
        select: 'userId pmdcNumber',
        populate: { path: 'userId', select: 'name email phone' },
      })
      .sort({ updatedAt: -1 })
      .lean();

    const data = await attachAdmissionsToReferrals(referrals);
    res.json({ success: true, data });
  } catch (error) {
    console.error('getHospitalPatients error:', error);
    res.status(500).json({ success: false, message: 'Failed to load hospital patients' });
  }
};

/** Referred patients for a consultant with admission details */
exports.getConsultantPatients = async (req, res) => {
  try {
    let consultant = await Consultant.findById(req.params.id);
    if (!consultant) {
      consultant = await Consultant.findOne({ userId: req.params.id });
    }
    if (!consultant) {
      return res.status(404).json({ success: false, message: 'Consultant not found' });
    }

    try {
      assertConsultantProfileUnlock(req, consultant.userId);
    } catch (unlockErr) {
      return res.status(unlockErr.statusCode || 403).json({ success: false, message: unlockErr.message });
    }

    const referrals = await Referral.find({ consultantId: consultant._id })
      .populate('targetHospitalId', 'hospitalName city')
      .populate('targetDoctorId', 'name specialty')
      .sort({ updatedAt: -1 })
      .lean();

    const data = await attachAdmissionsToReferrals(referrals);
    res.json({ success: true, data });
  } catch (error) {
    console.error('getConsultantPatients error:', error);
    res.status(500).json({ success: false, message: 'Failed to load consultant patients' });
  }
};

async function resolveHospitalByParam(id) {
  let hospital = await Hospital.findById(id);
  if (!hospital) {
    hospital = await Hospital.findOne({ userId: id });
  }
  return hospital;
}

/** Admin: full hospital profile update */
exports.adminUpdateHospital = async (req, res) => {
  try {
    const hospital = await resolveHospitalByParam(req.params.id);
    if (!hospital) {
      return res.status(404).json({ success: false, message: 'Hospital not found' });
    }

    const allowed = [
      'hospitalName',
      'registrationNumber',
      'representativeCnic',
      'address',
      'city',
      'area',
      'departments',
      'ratePackages',
      'isActive',
      'deductionPercentage',
      'avgResponseTime',
      'acceptanceRate',
      'rating',
    ];

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        hospital[key] = req.body[key];
      }
    }

    if (req.body.departments !== undefined) {
      const names = Array.isArray(hospital.departments) ? hospital.departments : [];
      hospital.inactiveDepartments = (hospital.inactiveDepartments || []).filter((d) => names.includes(d));
    }

    if (req.body.branding) {
      hospital.branding = {
        primaryColor: req.body.branding.primaryColor ?? hospital.branding?.primaryColor,
        logoUrl: req.body.branding.logoUrl ?? hospital.branding?.logoUrl,
      };
    }

    if (req.body.location?.coordinates) {
      hospital.location = {
        type: 'Point',
        coordinates: req.body.location.coordinates,
      };
    }

    if (Array.isArray(req.body.bedsInventory)) {
      hospital.bedsInventory = req.body.bedsInventory.map((b) => ({
        ward: b.ward,
        totalBeds: Number(b.totalBeds) || 0,
        occupiedBeds: Number(b.occupiedBeds) || 0,
        availableBeds: Math.max(
          0,
          (Number(b.totalBeds) || 0) - (Number(b.occupiedBeds) || 0)
        ),
      }));
    }

    await hospital.save();

    await logAction({
      req,
      action: 'ADMIN_UPDATE_HOSPITAL',
      entityId: hospital._id,
      entityModel: 'Hospital',
      details: { fields: Object.keys(req.body) },
    });

    res.json({ success: true, data: hospital });
  } catch (error) {
    console.error('adminUpdateHospital error:', error);
    res.status(500).json({ success: false, message: 'Failed to update hospital' });
  }
};

exports.adminListHospitalDoctors = async (req, res) => {
  try {
    const hospital = await resolveHospitalByParam(req.params.id);
    if (!hospital) {
      return res.status(404).json({ success: false, message: 'Hospital not found' });
    }
    try {
      assertHospitalProfileUnlock(req, hospital.userId);
    } catch (unlockErr) {
      return res.status(unlockErr.statusCode || 403).json({ success: false, message: unlockErr.message });
    }
    const doctors = await HospitalDoctor.find({ hospitalId: hospital._id }).sort({ name: 1 });
    res.json({ success: true, data: doctors });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to list doctors' });
  }
};

exports.adminAddHospitalDoctor = async (req, res) => {
  try {
    const hospital = await resolveHospitalByParam(req.params.id);
    if (!hospital) {
      return res.status(404).json({ success: false, message: 'Hospital not found' });
    }
    const { name, specialty, pmdcNumber, consultationFee, phone, email, isAvailable } = req.body;
    if (!name || !specialty) {
      return res.status(400).json({ success: false, message: 'Name and specialty are required' });
    }
    const doctor = await HospitalDoctor.create({
      hospitalId: hospital._id,
      name: String(name).trim(),
      specialty: String(specialty).trim(),
      pmdcNumber: pmdcNumber?.trim(),
      phone: phone?.trim(),
      email: email?.trim(),
      consultationFee: consultationFee != null ? Math.round(Number(consultationFee) * 100) : 0,
      isAvailable: isAvailable !== false,
    });
    res.status(201).json({ success: true, data: doctor });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to add doctor' });
  }
};

exports.adminUpdateHospitalDoctor = async (req, res) => {
  try {
    const hospital = await resolveHospitalByParam(req.params.id);
    if (!hospital) {
      return res.status(404).json({ success: false, message: 'Hospital not found' });
    }
    const updates = { ...req.body };
    if (updates.consultationFee != null) {
      updates.consultationFee = Math.round(Number(updates.consultationFee) * 100);
    }
    const doctor = await HospitalDoctor.findOneAndUpdate(
      { _id: req.params.doctorId, hospitalId: hospital._id },
      updates,
      { new: true }
    );
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }
    res.json({ success: true, data: doctor });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update doctor' });
  }
};

exports.adminDeleteHospitalDoctor = async (req, res) => {
  try {
    const hospital = await resolveHospitalByParam(req.params.id);
    if (!hospital) {
      return res.status(404).json({ success: false, message: 'Hospital not found' });
    }
    const doctor = await HospitalDoctor.findOneAndDelete({
      _id: req.params.doctorId,
      hospitalId: hospital._id,
    });
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }
    res.json({ success: true, message: 'Doctor removed' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete doctor' });
  }
};

/** Admin: update consultant profile fields */
exports.adminUpdateConsultant = async (req, res) => {
  try {
    let consultant = await Consultant.findById(req.params.id);
    if (!consultant) {
      consultant = await Consultant.findOne({ userId: req.params.id });
    }
    if (!consultant) {
      return res.status(404).json({ success: false, message: 'Consultant not found' });
    }

    const allowed = [
      'specialty',
      'clinicName',
      'clinicAddress',
      'city',
      'cnic',
      'commissionPercentage',
      'maxLabDiscountPercentage',
      'isVerified',
    ];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        consultant[key] = req.body[key];
      }
    }
    // Clamp the lab discount cap to a sane [0,100] range.
    if (req.body.maxLabDiscountPercentage !== undefined) {
      consultant.maxLabDiscountPercentage = Math.max(0, Math.min(100, Number(req.body.maxLabDiscountPercentage) || 0));
    }
    if (req.body.payoutAccount) {
      consultant.payoutAccount = { ...consultant.payoutAccount, ...req.body.payoutAccount };
    }

    await consultant.save();
    await logAction({
      req,
      action: 'ADMIN_UPDATE_CONSULTANT',
      entityId: consultant._id,
      entityModel: 'Consultant',
      details: { fields: Object.keys(req.body) },
    });

    res.json({ success: true, data: consultant });
  } catch (error) {
    console.error('adminUpdateConsultant error:', error);
    res.status(500).json({ success: false, message: 'Failed to update consultant' });
  }
};
