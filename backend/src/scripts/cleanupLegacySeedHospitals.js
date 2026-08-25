/**
 * Removes legacy demo hospitals created by the old seedHospitals script.
 *
 *   npm run cleanup:legacy-hospitals
 *   npm run cleanup:legacy-hospitals -- --purge-referrals
 *
 * Use --purge-referrals to delete any referrals that reference those hospitals first.
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
const Hospital = require('../models/Hospital');
const Referral = require('../models/Referral');

dotenv.config();

const LEGACY_SEED_EMAILS = [
  'kgh@hospital.com',
  'chi@hospital.com',
  'occ@hospital.com',
];

const run = async () => {
  const purgeReferrals = process.argv.includes('--purge-referrals');

  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI missing');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI, { family: 4 });
  console.log('Connected', purgeReferrals ? '(will purge referrals tied to legacy hospitals)' : '');

  for (const email of LEGACY_SEED_EMAILS) {
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      console.log('No user for', email);
      continue;
    }
    const hospital = await Hospital.findOne({ userId: user._id });
    if (hospital) {
      const refFilter = {
        $or: [{ targetHospitalId: hospital._id }, { rankedHospitalIds: hospital._id }],
      };
      const refCount = await Referral.countDocuments(refFilter);
      if (refCount > 0) {
        if (purgeReferrals) {
          const del = await Referral.deleteMany(refFilter);
          console.log(`Deleted ${del.deletedCount} referral(s) referencing legacy hospital ${email}`);
        } else {
          console.warn(
            `Skipping delete for ${email}: hospital ${hospital._id} still referenced by ${refCount} referral(s). Re-run with --purge-referrals to remove those referrals first.`
          );
          continue;
        }
      }
      await Hospital.deleteOne({ _id: hospital._id });
      console.log('Deleted Hospital profile for', email);
    }
    await User.deleteOne({ _id: user._id });
    console.log('Deleted User for', email);
  }

  console.log('Cleanup finished');
  process.exit(0);
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
