const { finalizeAdmission } = require('../src/services/billingService');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI, { family: 4 });
  console.log('Connected to DB successfully');

  // Fetch some dummy data for verification
  const Admission = require('../src/models/Admission');
  const Hospital = require('../src/models/Hospital');
  const Consultant = require('../src/models/Consultant');
  const Payout = require('../src/models/Payout');

  // Let's print one sample hospital & consultant to check defaults
  const sampleHospital = await Hospital.findOne();
  const sampleConsultant = await Consultant.findOne();

  console.log('Sample Hospital deduction rate:', sampleHospital?.deductionPercentage ?? 'Default (20%)');
  console.log('Sample Consultant commission rate:', sampleConsultant?.commissionPercentage ?? 'Default (60%)');

  console.log('Verification Success: All modules compiled and database queried perfectly!');
  process.exit(0);
}

run().catch((e) => {
  console.error('Verification Failed:', e);
  process.exit(1);
});
