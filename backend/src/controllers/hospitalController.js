const Hospital = require('../models/Hospital');
const { getHospitalForUser } = require('../utils/resolveOrg');
const Referral = require('../models/Referral');
const Admission = require('../models/Admission');
const HospitalDoctor = require('../models/HospitalDoctor');
const {
  getActiveDepartmentNames,
  getActiveBedsInventory,
  isDepartmentActive,
  normalizeDepartmentsUpdate,
  syncBedsInventoryWithDepartments,
} = require('../utils/hospitalDepartments');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const DEFAULT_DOCTOR_PROFILE_ACCESS_PASSWORD = '123456';
const DEFAULT_DOCTOR_PASSWORD = '123456';

async function ensureHospitalDoctorAccessPassword(hospital) {
  if (hospital.doctorProfileAccessPasswordHash) return hospital;
  hospital.doctorProfileAccessPasswordHash = await bcrypt.hash(DEFAULT_DOCTOR_PROFILE_ACCESS_PASSWORD, 10);
  await hospital.save();
  return hospital;
}

function assertDoctorProfileUnlock(req, hospitalId) {
  const token = req.headers['x-doctor-profile-unlock'];
  if (!token) {
    const err = new Error('Hospital doctor-access password required');
    err.statusCode = 403;
    throw err;
  }
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    const err = new Error('Unlock expired or invalid. Enter password again.');
    err.statusCode = 403;
    throw err;
  }
  if (decoded.purpose !== 'hospital_doctor_profile_unlock' || decoded.hospitalId !== String(hospitalId)) {
    const err = new Error('Unlock is not valid for this hospital');
    err.statusCode = 403;
    throw err;
  }
}

const sanitizeDoctor = (doc) => {
  const o = doc.toObject ? doc.toObject() : { ...doc };
  delete o.passwordHash;
  return o;
};

exports.listDoctors = async (req, res) => {
  try {
    const hospital = await getHospitalForUser(req.user);
    if (!hospital) {
      return res.status(404).json({ success: false, message: 'Hospital profile not found' });
    }
    const doctors = await HospitalDoctor.find({ hospitalId: hospital._id }).sort({ name: 1 });
    res.json({ success: true, data: doctors.map(sanitizeDoctor) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching doctors' });
  }
};

/** Verify hospital doctor-profile access password and return short-lived unlock token. */
exports.verifyDoctorProfileAccess = async (req, res) => {
  try {
    const hospital = await getHospitalForUser(req.user);
    if (!hospital) {
      return res.status(404).json({ success: false, message: 'Hospital profile not found' });
    }
    const password = String(req.body.password || '');
    if (!password) {
      return res.status(400).json({ success: false, message: 'Password is required' });
    }

    await ensureHospitalDoctorAccessPassword(hospital);
    const ok = await bcrypt.compare(password, hospital.doctorProfileAccessPasswordHash);
    if (!ok) {
      return res.status(403).json({ success: false, message: 'Incorrect access password' });
    }

    const doctorId = req.body.doctorId || req.params.id;
    if (doctorId) {
      const doctor = await HospitalDoctor.findOne({ _id: doctorId, hospitalId: hospital._id });
      if (!doctor) {
        return res.status(404).json({ success: false, message: 'Doctor not found' });
      }
    }

    const unlockToken = jwt.sign(
      {
        purpose: 'hospital_doctor_profile_unlock',
        hospitalId: String(hospital._id),
        doctorId: doctorId ? String(doctorId) : undefined,
      },
      process.env.JWT_SECRET,
      { expiresIn: '30m' }
    );

    res.json({
      success: true,
      data: { unlockToken, expiresInMinutes: 30 },
    });
  } catch (error) {
    console.error('verifyDoctorProfileAccess:', error);
    res.status(500).json({ success: false, message: 'Failed to verify access password' });
  }
};

exports.changeDoctorProfileAccessPassword = async (req, res) => {
  try {
    const hospital = await getHospitalForUser(req.user);
    if (!hospital) {
      return res.status(404).json({ success: false, message: 'Hospital profile not found' });
    }
    assertDoctorProfileUnlock(req, hospital._id);

    const currentPassword = String(req.body.currentPassword || '');
    const newPassword = String(req.body.newPassword || '');
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current and new passwords are required' });
    }
    if (newPassword.length < 4) {
      return res.status(400).json({ success: false, message: 'New password must be at least 4 characters' });
    }

    await ensureHospitalDoctorAccessPassword(hospital);
    const ok = await bcrypt.compare(currentPassword, hospital.doctorProfileAccessPasswordHash);
    if (!ok) {
      return res.status(403).json({ success: false, message: 'Current access password is incorrect' });
    }

    hospital.doctorProfileAccessPasswordHash = await bcrypt.hash(newPassword, 10);
    await hospital.save();
    res.json({ success: true, message: 'Hospital doctor-access password updated' });
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({ success: false, message: error.message || 'Failed to update access password' });
  }
};

exports.changeDoctorPassword = async (req, res) => {
  try {
    const hospital = await getHospitalForUser(req.user);
    if (!hospital) {
      return res.status(404).json({ success: false, message: 'Hospital profile not found' });
    }
    assertDoctorProfileUnlock(req, hospital._id);

    const newPassword = String(req.body.newPassword || '');
    if (newPassword.length < 4) {
      return res.status(400).json({ success: false, message: 'New password must be at least 4 characters' });
    }

    const doctor = await HospitalDoctor.findOne({ _id: req.params.id, hospitalId: hospital._id }).select('+passwordHash');
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    doctor.passwordHash = await bcrypt.hash(newPassword, 10);
    await doctor.save();
    res.json({ success: true, message: 'Doctor password updated' });
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({ success: false, message: error.message || 'Failed to update doctor password' });
  }
};

exports.addDoctor = async (req, res) => {
  try {
    const hospital = await getHospitalForUser(req.user);
    const { name, specialty, pmdcNumber, consultationFee, phone, email } = req.body;

    const passwordHash = await bcrypt.hash(DEFAULT_DOCTOR_PASSWORD, 10);
    const doctor = await HospitalDoctor.create({
      name,
      specialty,
      pmdcNumber,
      hospitalId: hospital._id,
      consultationFee: consultationFee * 100, // Convert to paisa
      phone,
      email,
      isAvailable: true,
      passwordHash,
    });

    res.status(201).json({ success: true, data: sanitizeDoctor(doctor) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error adding doctor' });
  }
};

exports.updateDoctor = async (req, res) => {
  try {
    const hospital = await getHospitalForUser(req.user);
    const { id } = req.params;
    assertDoctorProfileUnlock(req, hospital._id);

    const updates = { ...req.body };
    delete updates.passwordHash;
    delete updates.password;
    delete updates.hospitalId;
    if (updates.consultationFee != null && updates.consultationFee !== '') {
      updates.consultationFee = Number(updates.consultationFee) * 100;
    }

    const doctor = await HospitalDoctor.findOneAndUpdate(
      { _id: id, hospitalId: hospital._id },
      updates,
      { new: true }
    );

    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });
    res.json({ success: true, data: sanitizeDoctor(doctor) });
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({ success: false, message: error.message || 'Error updating doctor' });
  }
};

exports.deleteDoctor = async (req, res) => {
  try {
    const hospital = await getHospitalForUser(req.user);
    const { id } = req.params;
    assertDoctorProfileUnlock(req, hospital._id);

    const doctor = await HospitalDoctor.findOneAndDelete({ _id: id, hospitalId: hospital._id });
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });

    res.json({ success: true, message: 'Doctor removed' });
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({ success: false, message: error.message || 'Error deleting doctor' });
  }
};

/** Availability toggle does not require unlock (quick action on cards). */
exports.toggleDoctorAvailability = async (req, res) => {
  try {
    const hospital = await getHospitalForUser(req.user);
    const { id } = req.params;
    const isAvailable = req.body.isAvailable;

    const doctor = await HospitalDoctor.findOneAndUpdate(
      { _id: id, hospitalId: hospital._id },
      { isAvailable: Boolean(isAvailable) },
      { new: true }
    );
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });
    res.json({ success: true, data: sanitizeDoctor(doctor) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating availability' });
  }
};

exports.getDashboardStats = async (req, res) => {
  try {
    const hospital = await getHospitalForUser(req.user);
    if (!hospital) {
      return res.status(404).json({ success: false, message: 'Hospital profile not found' });
    }

    if (syncBedsInventoryWithDepartments(hospital)) {
      await hospital.save();
    }

    const referrals = await Referral.find({ targetHospitalId: hospital._id });

    const billed = await Admission.find({
      hospitalId: hospital._id,
      status: 'billed',
    }).select('billTotalPaisa');

    const revenuePaisa = billed.reduce((s, a) => s + (a.billTotalPaisa || 0), 0);

    const stats = {
      totalReferrals: referrals.length,
      pendingReferrals: referrals.filter((r) => r.status === 'pending').length,
      acceptedReferrals: referrals.filter((r) => r.status === 'accepted').length,
      admittedReferrals: referrals.filter((r) => r.status === 'admitted').length,
      closedReferrals: referrals.filter((r) => r.status === 'closed').length,
      revenuePaisa,
      beds: getActiveBedsInventory(hospital),
      departments: getActiveDepartmentNames(hospital),
      inactiveDepartments: hospital.inactiveDepartments || [],
    };

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching dashboard stats' });
  }
};

/** FR-25 — conversion, response proxy, monthly billing totals (simplified). */
exports.getHospitalAnalytics = async (req, res) => {
  try {
    const hospital = await getHospitalForUser(req.user);
    if (!hospital) {
      return res.status(404).json({ success: false, message: 'Hospital profile not found' });
    }

    const referrals = await Referral.find({ targetHospitalId: hospital._id }).lean();
    const pending = referrals.filter((r) => r.status === 'pending').length;
    const accepted = referrals.filter((r) => r.status === 'accepted').length;
    const admitted = referrals.filter((r) => r.status === 'admitted').length;
    const closed = referrals.filter((r) => r.status === 'closed').length;
    const rejected = referrals.filter((r) => r.status === 'rejected').length;
    const decided = accepted + admitted + closed + rejected;
    const conversionRate = decided > 0 ? Math.round((closed / decided) * 100) : 0;

    const admissions = await Admission.find({ hospitalId: hospital._id, status: 'billed' })
      .select('billTotalPaisa completedAt createdAt')
      .lean();

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlyBillPaisa = admissions
      .filter((a) => a.completedAt && new Date(a.completedAt) >= startOfMonth)
      .reduce((s, a) => s + (a.billTotalPaisa || 0), 0);

    const byDayMap = {};
    for (const r of referrals) {
      const d = new Date(r.createdAt).toISOString().slice(0, 10);
      byDayMap[d] = (byDayMap[d] || 0) + 1;
    }
    const referralsByDay = Object.entries(byDayMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14)
      .map(([date, count]) => ({ date, count }));

    res.json({
      success: true,
      data: {
        conversionRate,
        avgResponseTimeMinutes: hospital.avgResponseTime ?? 60,
        pending,
        accepted,
        admitted,
        closed,
        rejected,
        monthlyBillPaisa,
        totalBilledPaisa: admissions.reduce((s, a) => s + (a.billTotalPaisa || 0), 0),
        referralsByDay,
      },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Analytics error' });
  }
};

/** Accepted / admitted referrals for admissions workflow */
exports.getReferralPipeline = async (req, res) => {
  try {
    const hospital = await getHospitalForUser(req.user);
    if (!hospital) {
      return res.status(404).json({ success: false, message: 'Hospital profile not found' });
    }
    const rows = await Referral.find({
      targetHospitalId: hospital._id,
      status: { $in: ['accepted', 'admitted'] },
    })
      .populate({
        path: 'consultantId',
        select: 'userId pmdcNumber',
        populate: { path: 'userId', select: 'name' },
      })
      .sort({ updatedAt: -1 })
      .lean();

    const admissionIds = await Admission.find({
      referralId: { $in: rows.map((r) => r._id) },
    })
      .select('referralId status')
      .lean();
    const admByRef = Object.fromEntries(admissionIds.map((a) => [a.referralId.toString(), a]));

    const data = rows.map((r) => ({
      ...r,
      admission: admByRef[r._id.toString()] || null,
    }));

    res.json({ success: true, data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Failed' });
  }
};

exports.getBeds = async (req, res) => {
  try {
    const hospital = await getHospitalForUser(req.user);
    if (!hospital) {
      return res.status(404).json({ success: false, message: 'Hospital profile not found' });
    }
    if (syncBedsInventoryWithDepartments(hospital)) {
      await hospital.save();
    }
    res.json({ success: true, data: getActiveBedsInventory(hospital) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching bed inventory' });
  }
};

exports.updateBeds = async (req, res) => {
  try {
    const { ward, availableBeds, totalBeds, occupiedBeds } = req.body;
    const hospital = await getHospitalForUser(req.user);
    if (!hospital) {
      return res.status(404).json({ success: false, message: 'Hospital profile not found' });
    }

    const wardName = String(ward || '').trim();
    if (!wardName) {
      return res.status(400).json({ success: false, message: 'Department is required' });
    }
    if (!isDepartmentActive(hospital, wardName)) {
      return res.status(400).json({ success: false, message: 'Beds can only be updated for active departments' });
    }

    syncBedsInventoryWithDepartments(hospital);

    let wardIndex = hospital.bedsInventory.findIndex((b) => b.ward === wardName);
    if (wardIndex < 0) {
      hospital.bedsInventory.push({
        ward: wardName,
        totalBeds: 0,
        occupiedBeds: 0,
        availableBeds: 0,
      });
      wardIndex = hospital.bedsInventory.length - 1;
    }

    const row = hospital.bedsInventory[wardIndex];
    if (totalBeds != null && totalBeds !== '') {
      row.totalBeds = Math.max(0, Number(totalBeds));
    }
    if (occupiedBeds != null && occupiedBeds !== '') {
      row.occupiedBeds = Math.max(0, Number(occupiedBeds));
      row.availableBeds = Math.max(0, row.totalBeds - row.occupiedBeds);
    } else if (availableBeds != null && availableBeds !== '') {
      row.availableBeds = Math.max(0, Number(availableBeds));
      row.occupiedBeds = Math.max(0, row.totalBeds - row.availableBeds);
    }
    if (row.occupiedBeds > row.totalBeds) {
      row.occupiedBeds = row.totalBeds;
      row.availableBeds = 0;
    }
    await hospital.save();

    const io = req.app.get('io');
    if (io) {
      io.to(`hospital:${hospital._id.toString()}`).emit('BED_UPDATE', {
        hospitalId: hospital._id.toString(),
        beds: getActiveBedsInventory(hospital),
      });
    }

    res.json({ success: true, message: 'Bed inventory updated', data: getActiveBedsInventory(hospital) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating bed inventory' });
  }
};

exports.updateDepartments = async (req, res) => {
  try {
    const { departments, inactiveDepartments } = req.body;
    if (!departments || !Array.isArray(departments)) {
      return res.status(400).json({ success: false, message: 'Invalid departments array' });
    }

    const hospital = await getHospitalForUser(req.user);
    if (!hospital) {
      return res.status(404).json({ success: false, message: 'Hospital profile not found' });
    }

    const normalized = normalizeDepartmentsUpdate(
      departments,
      inactiveDepartments != null ? inactiveDepartments : hospital.inactiveDepartments
    );
    hospital.departments = normalized.departments;
    hospital.inactiveDepartments = normalized.inactiveDepartments;
    syncBedsInventoryWithDepartments(hospital);
    await hospital.save();

    res.json({
      success: true,
      message: 'Departments updated',
      data: {
        departments: hospital.departments,
        inactiveDepartments: hospital.inactiveDepartments || [],
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating departments' });
  }
};

exports.getFinancialLedger = async (req, res) => {
  try {
    const hospital = await getHospitalForUser(req.user);
    if (!hospital) {
      return res.status(404).json({ success: false, message: 'Hospital profile not found' });
    }

    // Query payouts matching this hospital's admissions
    const admissions = await Admission.find({ hospitalId: hospital._id }).select('_id');
    const admissionIds = admissions.map(a => a._id);

    const Payout = require('../models/Payout');
    const payouts = await Payout.find({ admissionId: { $in: admissionIds } }, {
      amountPaisa: 0,
      commissionPercentage: 0,
      adminSharePaisa: 0,
    })
      .populate('referralId', 'referralCode patientName urgency department')
      .populate({ path: 'consultantId', populate: { path: 'userId', select: 'name email' } })
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, data: payouts });
  } catch (error) {
    console.error('getFinancialLedger Error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve financial ledger' });
  }
};
