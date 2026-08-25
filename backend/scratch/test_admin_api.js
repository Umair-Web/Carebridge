const mongoose = require('mongoose');
require('dotenv').config();

async function check() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected.');

  const User = require('../src/models/User');
  const Consultant = require('../src/models/Consultant');
  const Hospital = require('../src/models/Hospital');
  const Referral = require('../src/models/Referral');
  const Admission = require('../src/models/Admission');
  const AuditLog = require('../src/models/AuditLog');

  console.log('\n--- 1. Testing Analytics ---');
  try {
    const [users, referrals, hospitals, admissions] = await Promise.all([
      User.countDocuments(),
      Referral.countDocuments(),
      Hospital.countDocuments({ isActive: true }),
      Admission.countDocuments({ status: 'billed' }),
    ]);
    const pendingUsers = await User.countDocuments({ status: 'pending' });
    
    console.log('Counts fetched:', { users, referrals, hospitals, admissions, pendingUsers });

    const revenueAgg = await Admission.aggregate([
      { $match: { status: 'billed' } },
      { $group: { _id: null, total: { $sum: '$billTotalPaisa' } } },
    ]);
    console.log('Revenue agg:', revenueAgg);

    const byHospital = await Referral.aggregate([
      { $match: { targetHospitalId: { $ne: null } } },
      { $group: { _id: '$targetHospitalId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]);
    console.log('By hospital agg:', byHospital);

    const hospitalIds = byHospital.map((h) => h._id);
    const hospitalDocs = await Hospital.find({ _id: { $in: hospitalIds } }).select('hospitalName').lean();
    console.log('Hospital docs:', hospitalDocs);

    console.log('Analytics logic succeeded!');
  } catch (err) {
    console.error('Analytics logic FAILED:', err);
  }

  console.log('\n--- 2. Testing Beds ---');
  try {
    const hospitals = await Hospital.find({ isActive: true })
      .select('hospitalName city bedsInventory')
      .lean();
    console.log('Beds logic succeeded! Hospital count:', hospitals.length);
  } catch (err) {
    console.error('Beds logic FAILED:', err);
  }

  console.log('\n--- 3. Testing Audit Logs ---');
  try {
    const logs = await AuditLog.find()
      .populate('actorId', 'name email')
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();
    console.log('Audit logs count fetched:', logs.length);
    if (logs.length > 0) {
      console.log('Sample audit log populated actorId:', logs[0].actorId);
    }
    console.log('Audit logs logic succeeded!');
  } catch (err) {
    console.error('Audit logs logic FAILED:', err);
  }

  process.exit();
}

check().catch(console.error);
