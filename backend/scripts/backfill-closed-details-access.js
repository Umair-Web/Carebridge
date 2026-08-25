require('dotenv').config();
const mongoose = require('mongoose');
const Referral = require('../src/models/Referral');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  // Closed referrals created before detailsViewAccess existed have no field set.
  // Treat those as suspended (admin can still Activate explicitly).
  const result = await Referral.updateMany(
    {
      status: 'closed',
      $or: [
        { detailsViewAccess: { $exists: false } },
        { detailsViewAccess: null },
        { detailsViewAccess: { $nin: ['active', 'suspended'] } },
      ],
    },
    { $set: { detailsViewAccess: 'suspended' } }
  );
  const salman = await Referral.findOne({ referralCode: 'CB-2026-0009' })
    .select('referralCode status detailsViewAccess')
    .lean();
  console.log(JSON.stringify({ modified: result.modifiedCount, matched: result.matchedCount, salman }, null, 2));
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
