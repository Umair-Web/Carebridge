require('dotenv').config();
const mongoose = require('mongoose');
const LabSettlement = require('./src/models/LabSettlement');
const LabReferral = require('./src/models/LabReferral');
const LabPayout = require('./src/models/LabPayout');
(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const count = await LabSettlement.countDocuments();
  console.log('LabSettlement count:', count);
  // closed referrals not settled (eligible for lab to submit)
  const closedUnsettled = await LabReferral.countDocuments({ status:'closed', weeklySettlementId: null });
  console.log('Closed & unsettled referrals:', closedUnsettled);
  const accrued = await LabPayout.countDocuments({ status:'accrued' });
  console.log('Accrued lab payouts:', accrued);
  try {
    const settlements = await LabSettlement.find()
      .populate('laboratoryId', 'labName deductionPercentage')
      .populate('labReferralIds', 'billTotalPaisa completedAt patientBillFileUrl referralCode')
      .populate({ path: 'consultantPayouts.consultantId', populate: { path: 'userId', select: 'name payoutAccount' } })
      .sort({ createdAt: -1 });
    console.log('Admin query OK, returned:', settlements.length);
    settlements.forEach(s => console.log(' -', s._id.toString(), s.status, 'lab=', s.laboratoryId?.labName));
  } catch (e) {
    console.error('ADMIN QUERY FAILED:', e.message);
  }
  await mongoose.disconnect();
})().catch(e=>{console.error(e);process.exit(1);});
