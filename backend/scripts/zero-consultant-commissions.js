/**
 * One-time: set every consultant's doctor commission to 0,
 * and platform default consultant commission to 0.
 *
 * Usage: node scripts/zero-consultant-commissions.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Consultant = require('../src/models/Consultant');
const PlatformSettings = require('../src/models/PlatformSettings');

async function main() {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI is required');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI, { family: 4 });

  const consultants = await Consultant.updateMany(
    {},
    {
      $set: {
        commissionPercentage: 0,
        hospitalCommissionPercentage: 0,
        hospitalFixedCommissionPaisa: 0,
        labCommissionPercentage: 0,
        labFixedCommissionPaisaPerTest: 0,
      },
    }
  );

  const settings = await PlatformSettings.updateMany(
    {},
    { $set: { defaultConsultantCommissionPercentage: 0 } }
  );

  console.log(`Consultants updated: ${consultants.modifiedCount} (matched ${consultants.matchedCount})`);
  console.log(`PlatformSettings updated: ${settings.modifiedCount} (matched ${settings.matchedCount})`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
