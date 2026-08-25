/**
 * Mark City General Hospital user as fully verified (email + phone + hospital).
 * Usage: node scripts/verify-city-hospital.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Hospital = require('../src/models/Hospital');
const { normalisePhone } = require('../src/utils/whatsappService');

const HOSPITAL_EMAIL = process.env.CITY_HOSPITAL_EMAIL || 'city@carebridge.local';

async function run() {
  await mongoose.connect(process.env.MONGO_URI, { family: 4 });

  const user = await User.findOne({ email: HOSPITAL_EMAIL.toLowerCase() });
  if (!user) {
    console.error(`No user found with email: ${HOSPITAL_EMAIL}`);
    process.exit(1);
  }

  const hospital = await Hospital.findOne({ userId: user._id });
  if (!hospital) {
    console.error('Hospital profile not found for this user.');
    process.exit(1);
  }

  user.status = 'active';
  user.isEmailVerified = true;
  user.isPhoneVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  await user.save();

  hospital.isActive = true;
  hospital.isRegistrationVerified = true;
  await hospital.save();

  const phoneNorm = normalisePhone(user.phone);

  console.log('\n✅ City Hospital user verified successfully\n');
  console.log(JSON.stringify(
    {
      login: {
        email: user.email,
        passwordHint: 'Default seed password is password123 (change if you updated it)',
      },
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        phoneE164: phoneNorm,
        status: user.status,
        isEmailVerified: user.isEmailVerified,
        isPhoneVerified: user.isPhoneVerified,
      },
      hospital: {
        id: hospital._id,
        hospitalName: hospital.hospitalName,
        registrationNumber: hospital.registrationNumber,
        representativeCnic: hospital.representativeCnic || '(not set)',
        city: hospital.city,
        address: hospital.address,
        isActive: hospital.isActive,
        isRegistrationVerified: hospital.isRegistrationVerified,
        documents: (hospital.registrationDocuments || []).map((d) => d.name),
      },
      notes: [
        phoneNorm && !/^\+923\d{9}$/.test(phoneNorm)
          ? 'Phone is a landline (021…). WhatsApp OTP only works with mobile 03XX numbers.'
          : 'Phone format is OK for WhatsApp.',
        'User can log in without Verify Phone step.',
      ],
    },
    null,
    2
  ));

  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
