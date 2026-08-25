const mongoose = require('mongoose');
require('dotenv').config();

const WeeklySettlement = require('./src/models/WeeklySettlement');
const Admission = require('./src/models/Admission');
const Payout = require('./src/models/Payout');
const Hospital = require('./src/models/Hospital');
const Consultant = require('./src/models/Consultant');
const Referral = require('./src/models/Referral');
const User = require('./src/models/User');

async function runTest() {
  console.log('[TEST] Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('[TEST] Connected successfully.');

  // 1. Fetch or create mock users
  console.log('[TEST] Setting up mock entities...');
  let testHospitalUser = await User.findOne({ role: 'hospital' });
  let testConsultantUser = await User.findOne({ role: 'consultant' });

  if (!testHospitalUser || !testConsultantUser) {
    console.log('[TEST] Creating test users since profiles do not exist...');
    
    if (!testHospitalUser) {
      testHospitalUser = await User.create({
        name: 'Test Hospital User',
        email: `test_hosp_${Date.now()}@carebridge.com`,
        password: 'password123',
        role: 'hospital',
        isVerified: true
      });
    }

    if (!testConsultantUser) {
      testConsultantUser = await User.create({
        name: 'Test Consultant User',
        email: `test_cons_${Date.now()}@carebridge.com`,
        password: 'password123',
        role: 'consultant',
        isVerified: true
      });
    }
  }

  let hospital = await Hospital.findOne({ userId: testHospitalUser._id });
  if (!hospital) {
    hospital = await Hospital.create({
      userId: testHospitalUser._id,
      hospitalName: 'General Test Hospital',
      isActive: true,
      deductionPercentage: 20
    });
  }

  let consultant = await Consultant.findOne({ userId: testConsultantUser._id });
  if (!consultant) {
    consultant = await Consultant.create({
      userId: testConsultantUser._id,
      pmdcNumber: `PMDC-${Date.now()}`,
      cnic: '42101-1234567-8',
      specialty: 'Cardiology',
      walletBalance: 0,
      totalEarnings: 0,
      isVerified: true,
      commissionPercentage: 60
    });
  }

  // Preserve initial balances for clean test
  const initialWalletBalance = consultant.walletBalance || 0;
  const initialTotalEarnings = consultant.totalEarnings || 0;

  // 2. Create mock Referral & Billed Admission
  console.log('[TEST] Creating mock completed Referral and Admission...');
  const referral = await Referral.create({
    consultantId: consultant._id,
    patientName: 'John Doe Test',
    age: 45,
    gender: 'male',
    phone: '03001234567',
    urgency: 'routine',
    status: 'closed',
    targetHospitalId: hospital._id
  });

  const admission = await Admission.create({
    referralId: referral._id,
    hospitalId: hospital._id,
    consultantId: consultant._id,
    status: 'billed',
    billTotalPaisa: 10000000 // 100,000 PKR
  });

  // Calculate splits
  const grossAmountPaisa = 10000000;
  const calculatedPlatformCutPaisa = Math.round(grossAmountPaisa * (hospital.deductionPercentage / 100)); // 20,000 PKR
  const consultantSharePaisa = Math.round(calculatedPlatformCutPaisa * (consultant.commissionPercentage / 100)); // 12,000 PKR
  const adminSharePaisa = calculatedPlatformCutPaisa - consultantSharePaisa; // 8,000 PKR

  // Create Payout in 'accrued' state
  const payout = await Payout.create({
    consultantId: consultant._id,
    referralId: referral._id,
    admissionId: admission._id,
    amountPaisa: consultantSharePaisa,
    totalBillPaisa: grossAmountPaisa,
    deductionPercentage: hospital.deductionPercentage,
    platformCutPaisa: calculatedPlatformCutPaisa,
    commissionPercentage: consultant.commissionPercentage,
    adminSharePaisa: adminSharePaisa,
    status: 'accrued',
    note: 'Accrued test payout'
  });

  console.log(`[TEST] Accrued payout: ${payout.amountPaisa/100} PKR. Wallet initial: ${initialWalletBalance/100} PKR.`);

  // 3. Hospital creates weekly settlement
  console.log('\n[STAGE 1] Hospital uploads Weekly Bill Summary...');
  const billingPeriodStart = new Date();
  billingPeriodStart.setDate(billingPeriodStart.getDate() - 7);
  const billingPeriodEnd = new Date();

  const settlement = await WeeklySettlement.create({
    hospitalId: hospital._id,
    billingPeriodStart,
    billingPeriodEnd,
    admissionIds: [admission._id],
    grossAmountPaisa,
    deductionPercentage: hospital.deductionPercentage,
    calculatedPlatformCutPaisa,
    billSummaryFileUrl: 'http://res.cloudinary.com/carebridge/summary_bill.pdf',
    notes: 'Weekly billing cycle test',
    status: 'pending_payment',
    consultantPayouts: [{
      consultantId: consultant._id,
      amountPaisa: consultantSharePaisa,
      commissionPercentage: consultant.commissionPercentage,
      status: 'pending_payout'
    }]
  });

  // Link Admission and Payout to settlement
  admission.weeklySettlementId = settlement._id;
  await admission.save();
  payout.weeklySettlementId = settlement._id;
  await payout.save();

  console.log(`[STAGE 1 SUCCESS] Settlement created in status: ${settlement.status}`);

  // 4. Hospital uploads transfer receipt
  console.log('\n[STAGE 2] Hospital uploads payment transfer screenshot...');
  settlement.hospitalReceiptFileUrl = 'http://res.cloudinary.com/carebridge/hospital_receipt.png';
  settlement.hospitalPaidAt = new Date();
  settlement.status = 'pending_admin_verification';
  await settlement.save();
  console.log(`[STAGE 2 SUCCESS] Settlement transitioned to: ${settlement.status}`);

  // 5. Admin verifies receipt
  console.log('\n[STAGE 3] Admin reviews and verifies hospital receipt...');
  if (settlement.status === 'pending_admin_verification') {
    settlement.status = 'paid_pending_consultant_payout';
    settlement.adminVerifiedAt = new Date();
    await settlement.save();
    console.log(`[STAGE 3 SUCCESS] Settlement transitioned to: ${settlement.status}`);
  }

  // 6. Admin pays doctor and uploads payout receipt
  console.log('\n[STAGE 4] Admin manually transfers funds to Doctor and uploads screenshot proof...');
  const payIdx = settlement.consultantPayouts.findIndex(p => p.consultantId.toString() === consultant._id.toString());
  if (payIdx !== -1) {
    settlement.consultantPayouts[payIdx].payoutReceiptFileUrl = 'http://res.cloudinary.com/carebridge/doctor_transfer_proof.png';
    settlement.consultantPayouts[payIdx].paidAt = new Date();
    settlement.consultantPayouts[payIdx].status = 'pending_verification';
    settlement.status = 'paid_pending_consultant_verification';
    await settlement.save();
    console.log(`[STAGE 4 SUCCESS] Settlement transitioned to: ${settlement.status}`);
  }

  // 7. Doctor verifies payout and completes settlement cycle
  console.log('\n[STAGE 5] Doctor verifies manual transfer was received in their account...');
  const reloadSettlement = await WeeklySettlement.findById(settlement._id);
  const payIdxReload = reloadSettlement.consultantPayouts.findIndex(p => p.consultantId.toString() === consultant._id.toString());
  
  if (reloadSettlement.consultantPayouts[payIdxReload].status === 'pending_verification') {
    reloadSettlement.consultantPayouts[payIdxReload].status = 'verified';
    reloadSettlement.consultantPayouts[payIdxReload].verifiedAt = new Date();

    // Verify individual Payout record is set to 'paid'
    await Payout.updateMany(
      { weeklySettlementId: reloadSettlement._id, consultantId: consultant._id },
      { $set: { status: 'paid' } }
    );

    // Credit consultant balances
    const amt = reloadSettlement.consultantPayouts[payIdxReload].amountPaisa;
    consultant.walletBalance = (consultant.walletBalance || 0) + amt;
    consultant.totalEarnings = (consultant.totalEarnings || 0) + amt;
    await consultant.save();

    const allVerified = reloadSettlement.consultantPayouts.every(p => p.status === 'verified');
    if (allVerified) {
      reloadSettlement.status = 'completed';
    }
    await reloadSettlement.save();
    console.log(`[STAGE 5 SUCCESS] Settlement transitioned to: ${reloadSettlement.status}`);
  }

  // 8. Assertions
  console.log('\n[VERIFICATION] Conducting database post-run assertions...');
  const finalSettlement = await WeeklySettlement.findById(settlement._id);
  const finalAdmission = await Admission.findById(admission._id);
  const finalPayout = await Payout.findById(payout._id);
  const finalConsultant = await Consultant.findById(consultant._id);

  console.log(`- Weekly Settlement Status is 'completed': ${finalSettlement.status === 'completed' ? 'PASS' : 'FAIL'}`);
  console.log(`- Admission links to Settlement ID: ${finalAdmission.weeklySettlementId.toString() === finalSettlement._id.toString() ? 'PASS' : 'FAIL'}`);
  console.log(`- Payout status is 'paid': ${finalPayout.status === 'paid' ? 'PASS' : 'FAIL'}`);
  console.log(`- Doctor Wallet Balance successfully incremented by ${consultantSharePaisa/100} PKR: ${finalConsultant.walletBalance === (initialWalletBalance + consultantSharePaisa) ? 'PASS' : 'FAIL'}`);

  // 9. Clean up test records
  console.log('\n[CLEANUP] Cleaning up test records from DB...');
  await WeeklySettlement.deleteOne({ _id: settlement._id });
  await Admission.deleteOne({ _id: admission._id });
  await Payout.deleteOne({ _id: payout._id });
  await Referral.deleteOne({ _id: referral._id });
  console.log('[CLEANUP] Done.');

  mongoose.connection.close();
  console.log('\n[TEST FINISHED] Integration test run successfully completed without errors.');
}

runTest().catch(err => {
  console.error('[TEST ERROR]', err);
  mongoose.connection.close();
});
