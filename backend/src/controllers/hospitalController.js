const Hospital = require('../models/Hospital');
const { getHospitalForUser } = require('../utils/resolveOrg');
const Referral = require('../models/Referral');
const Admission = require('../models/Admission');
const HospitalDoctor = require('../models/HospitalDoctor');
const {
  getActiveDepartmentNames,
  normalizeDepartmentsUpdate,
} = require('../utils/hospitalDepartments');

exports.listDoctors = async (req, res) => {
  try {
    const hospital = await getHospitalForUser(req.user);
    if (!hospital) {
      return res.status(404).json({ success: false, message: 'Hospital profile not found' });
    }
    const doctors = await HospitalDoctor.find({ hospitalId: hospital._id }).sort({ name: 1 });
    res.json({ success: true, data: doctors });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching doctors' });
  }
};

exports.addDoctor = async (req, res) => {
  try {
    const hospital = await getHospitalForUser(req.user);
    const { name, specialty, pmdcNumber, consultationFee, phone, email } = req.body;
    
    const doctor = await HospitalDoctor.create({
      name,
      specialty,
      pmdcNumber,
      hospitalId: hospital._id,
      consultationFee: consultationFee * 100, // Convert to paisa
      phone,
      email,
      isAvailable: true
    });
    
    res.status(201).json({ success: true, data: doctor });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error adding doctor' });
  }
};

exports.updateDoctor = async (req, res) => {
  try {
    const hospital = await getHospitalForUser(req.user);
    const { id } = req.params;
    const updates = { ...req.body };
    if (updates.consultationFee) updates.consultationFee *= 100;

    const doctor = await HospitalDoctor.findOneAndUpdate(
      { _id: id, hospitalId: hospital._id },
      updates,
      { new: true }
    );
    
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });
    res.json({ success: true, data: doctor });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating doctor' });
  }
};

exports.deleteDoctor = async (req, res) => {
  try {
    const hospital = await getHospitalForUser(req.user);
    const { id } = req.params;
    
    const doctor = await HospitalDoctor.findOneAndDelete({ _id: id, hospitalId: hospital._id });
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });
    
    res.json({ success: true, message: 'Doctor removed' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting doctor' });
  }
};

exports.getDashboardStats = async (req, res) => {
  try {
    const hospital = await getHospitalForUser(req.user);
    if (!hospital) {
      return res.status(404).json({ success: false, message: 'Hospital profile not found' });
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
      beds: hospital.bedsInventory,
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
    res.json({ success: true, data: hospital.bedsInventory });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching bed inventory' });
  }
};

exports.updateBeds = async (req, res) => {
  try {
    const { ward, availableBeds, totalBeds, occupiedBeds } = req.body;
    const hospital = await getHospitalForUser(req.user);

    const wardIndex = hospital.bedsInventory.findIndex((b) => b.ward === ward);
    if (wardIndex > -1) {
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
          beds: hospital.bedsInventory,
        });
      }

      res.json({ success: true, message: 'Bed inventory updated', data: hospital.bedsInventory });
    } else {
      res.status(404).json({ success: false, message: 'Ward not found' });
    }
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
