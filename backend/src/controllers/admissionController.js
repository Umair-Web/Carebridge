const mongoose = require('mongoose');
const { getHospitalForUser } = require('../utils/resolveOrg');
const Admission = require('../models/Admission');
const Referral = require('../models/Referral');
const Hospital = require('../models/Hospital');
const HospitalDoctor = require('../models/HospitalDoctor');
const Consultant = require('../models/Consultant');
const Payout = require('../models/Payout');
const PlatformSettings = require('../models/PlatformSettings');
const commissionService = require('../services/commissionService');

exports.listAdmissions = async (req, res) => {
  try {
    const hospital = await getHospitalForUser(req.user);
    if (!hospital) {
      return res.status(404).json({ success: false, message: 'Hospital profile not found' });
    }
    const rows = await Admission.find({ hospitalId: hospital._id })
      .populate('referralId', 'referralCode patientName urgency status department')
      .populate({
        path: 'consultantId',
        select: 'pmdcNumber specialty hospitalCommissionType hospitalFixedCommissionPaisa hospitalCommissionPercentage commissionPercentage commissionModel facilityPlatformOverrides',
        populate: { path: 'userId', select: 'name email' },
      })
      .populate('treatingDoctorId', 'name specialty')
      .sort({ updatedAt: -1 });

    const settings = await PlatformSettings.findOne().sort({ updatedAt: -1 });
    const data = rows.map((row) => {
      const doc = row.toObject ? row.toObject() : row;
      try {
        // Preview the configured platform charge for this referring consultant at this hospital.
        // billPaisa=0 is fine for fixed charges; percentage charges preview as 0 until a bill exists.
        const split = commissionService.computeHospitalSplit({
          billPaisa: doc.billTotalPaisa || 0,
          consultant: doc.consultantId,
          hospital,
          settings,
        });
        // Prefer the live configured fixed fee when type is fixed (independent of bill).
        const liveFixed = commissionService.computeHospitalSplit({
          billPaisa: 0,
          consultant: doc.consultantId,
          hospital,
          settings,
        });
        doc.expectedPlatformChargePaisa =
          liveFixed.platformChargeType === 'fixed'
            ? liveFixed.platformChargePaisa
            : split.platformChargePaisa;
        doc.platformChargeType = liveFixed.platformChargeType || split.platformChargeType;
        doc.referringConsultantName = doc.consultantId?.userId?.name || null;
      } catch {
        doc.expectedPlatformChargePaisa = hospital.fixedPlatformChargePaisa || 0;
        doc.platformChargeType = hospital.platformChargeType || 'fixed';
        doc.referringConsultantName = doc.consultantId?.userId?.name || null;
      }
      return doc;
    });

    res.json({ success: true, data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Failed to list admissions' });
  }
};

/** Start admission for an accepted referral (marks referral admitted). */
exports.createAdmission = async (req, res) => {
  try {
    const hospital = await getHospitalForUser(req.user);
    if (!hospital) {
      return res.status(404).json({ success: false, message: 'Hospital profile not found' });
    }
    const { referralId, roomNumber, bedNumber, admissionDepartment, treatingDoctorId } = req.body;
    const room = roomNumber != null ? String(roomNumber).trim() : '';
    const bed = bedNumber != null ? String(bedNumber).trim() : '';
    const dept = admissionDepartment != null ? String(admissionDepartment).trim() : '';

    if (!referralId || !room || !bed || !dept || !treatingDoctorId) {
      return res.status(400).json({
        success: false,
        message: 'referralId, roomNumber, bedNumber, admissionDepartment, and treatingDoctorId are all required.'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(treatingDoctorId)) {
      return res.status(400).json({ success: false, message: 'Invalid treating doctor' });
    }

    const referral = await Referral.findOne({
      _id: referralId,
      targetHospitalId: hospital._id,
      status: 'accepted',
    });
    if (!referral) {
      return res.status(404).json({
        success: false,
        message: 'Referral not found or must be accepted first',
      });
    }

    const existing = await Admission.findOne({ referralId: referral._id });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Admission already exists for this referral' });
    }

    const doctor = await HospitalDoctor.findOne({
      _id: treatingDoctorId,
      hospitalId: hospital._id,
    });
    if (!doctor) {
      return res.status(400).json({ success: false, message: 'Treating doctor not found at this hospital' });
    }

    const admission = await Admission.create({
      referralId: referral._id,
      hospitalId: hospital._id,
      consultantId: referral.consultantId,
      roomNumber: room,
      bedNumber: bed,
      admissionDepartment: dept,
      treatingDoctorId: doctor._id,
      status: 'active',
      admitDate: new Date(),
    });

    referral.status = 'admitted';
    referral.admittedAt = new Date();
    await referral.save();

    const io = req.app.get('io');
    if (io) {
      io.to(`hospital:${hospital._id.toString()}`).emit('STATUS_UPDATE', {
        referralId: referral._id.toString(),
        status: 'admitted',
      });
      io.to(`consultant:${referral.consultantId.toString()}`).emit('STATUS_UPDATE', {
        referralId: referral._id.toString(),
        status: 'admitted',
      });
    }

    res.status(201).json({ success: true, data: admission });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Failed to create admission' });
  }
};

exports.updateAdmission = async (req, res) => {
  try {
    const hospital = await getHospitalForUser(req.user);
    if (!hospital) {
      return res.status(404).json({ success: false, message: 'Hospital profile not found' });
    }

    const admission = await Admission.findOne({
      _id: req.params.id,
      hospitalId: hospital._id,
    });
    if (!admission) {
      return res.status(404).json({ success: false, message: 'Admission not found' });
    }

    if (admission.status === 'billed') {
      return res.status(400).json({ success: false, message: 'Admission is already finalized' });
    }

    const {
      services,
      billTotalPaisa,
      paymentMethod,
      paymentReference,
      notes,
      dischargeDate,
      status,
      roomNumber,
      bedNumber,
      admissionDepartment,
      treatingDoctorId,
      patientBillFileUrl,
    } = req.body;

    if (admission.status === 'active') {
      if (roomNumber != null) {
        const room = String(roomNumber).trim();
        if (!room) {
          return res.status(400).json({ success: false, message: 'Room number cannot be empty' });
        }
        admission.roomNumber = room;
      }
      if (bedNumber != null) {
        const bed = String(bedNumber).trim();
        if (!bed) {
          return res.status(400).json({ success: false, message: 'Bed number cannot be empty' });
        }
        admission.bedNumber = bed;
      }
      if (admissionDepartment != null) {
        const dept = String(admissionDepartment).trim();
        if (!dept) {
          return res.status(400).json({ success: false, message: 'Admission department cannot be empty' });
        }
        admission.admissionDepartment = dept;
      }
      if (treatingDoctorId != null) {
        if (!mongoose.Types.ObjectId.isValid(treatingDoctorId)) {
          return res.status(400).json({ success: false, message: 'Invalid treating doctor' });
        }
        const doctor = await HospitalDoctor.findOne({
          _id: treatingDoctorId,
          hospitalId: hospital._id,
        });
        if (!doctor) {
          return res.status(400).json({ success: false, message: 'Treating doctor not found at this hospital' });
        }
        admission.treatingDoctorId = doctor._id;
      }
    }

    if (Array.isArray(services)) {
      admission.services = services.map((s) => ({
        description: String(s.description || '').trim(),
        amountPaisa: Math.max(0, Number(s.amountPaisa) || 0),
      }));
    }
    if (billTotalPaisa != null) admission.billTotalPaisa = Math.max(0, Number(billTotalPaisa));
    if (paymentMethod) admission.paymentMethod = paymentMethod;
    if (paymentReference != null) admission.paymentReference = String(paymentReference).trim();
    if (patientBillFileUrl != null) admission.patientBillFileUrl = String(patientBillFileUrl).trim();
    if (notes != null) admission.notes = String(notes).trim();
    if (dischargeDate) admission.dischargeDate = new Date(dischargeDate);
    if (status === 'discharged') admission.status = 'discharged';

    await admission.save();
    res.json({ success: true, data: admission });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Failed to update admission' });
  }
};

const billingService = require('../services/billingService');

/** Finalize billing: closes referral, accrues consultant payout (SRS §12.2). */
exports.completeAdmission = async (req, res) => {
  try {
    const hospital = await getHospitalForUser(req.user);
    if (!hospital) {
      return res.status(404).json({ success: false, message: 'Hospital profile not found' });
    }

    const admission = await Admission.findOne({
      _id: req.params.id,
      hospitalId: hospital._id,
    });

    if (!admission) {
      return res.status(404).json({ success: false, message: 'Admission not found' });
    }

    if (admission.status === 'billed') {
      return res.status(400).json({ success: false, message: 'Already completed' });
    }

    const bill = admission.billTotalPaisa != null ? Number(admission.billTotalPaisa) : 0;
    if (bill <= 0) {
      return res.status(400).json({ success: false, message: 'Set bill total (PKR as paisa) before completing' });
    }

    const pm = admission.paymentMethod || 'pending';
    if (pm === 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Select payment method (manual, cash, jazzcash, easypaisa, bank_transfer)',
      });
    }

    const io = req.app.get('io');
    const { resolveCloserActor } = require('../utils/closerActor');
    const closerActor = await resolveCloserActor(req.user);
    const finalized = await billingService.finalizeAdmission(
      admission._id,
      pm,
      admission.paymentReference,
      io,
      closerActor
    );

    res.json({
      success: true,
      message: 'Admission completed; consultant payout accrued',
      data: finalized,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Failed to complete admission' });
  }
};
