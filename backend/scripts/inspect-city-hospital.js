require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Hospital = require('../src/models/Hospital');

async function run() {
  await mongoose.connect(process.env.MONGO_URI, { family: 4 });

  const hospitals = await Hospital.find({
    $or: [
      { hospitalName: /city/i },
      { hospitalName: /City General/i },
    ],
  }).lean();

  for (const h of hospitals) {
    const user = await User.findById(h.userId).lean();
    console.log('\n========== HOSPITAL PROFILE ==========');
    console.log(JSON.stringify(
      {
        hospital: {
          _id: h._id,
          hospitalName: h.hospitalName,
          registrationNumber: h.registrationNumber,
          representativeCnic: h.representativeCnic,
          city: h.city,
          area: h.area,
          address: h.address,
          isActive: h.isActive,
          isRegistrationVerified: h.isRegistrationVerified,
          departments: h.departments,
          registrationDocuments: h.registrationDocuments,
          branding: h.branding,
          createdAt: h.createdAt,
          updatedAt: h.updatedAt,
        },
        user: user
          ? {
              _id: user._id,
              name: user.name,
              email: user.email,
              phone: user.phone,
              role: user.role,
              status: user.status,
              isEmailVerified: user.isEmailVerified,
              isPhoneVerified: user.isPhoneVerified,
              createdAt: user.createdAt,
              updatedAt: user.updatedAt,
            }
          : null,
        verificationSummary: user
          ? {
              canLogin: user.status === 'active' && user.isPhoneVerified,
              emailOk: user.isEmailVerified,
              phoneOk: user.isPhoneVerified,
              accountActive: user.status === 'active',
              hospitalActive: h.isActive,
            }
          : null,
      },
      null,
      2
    ));
  }

  if (hospitals.length === 0) {
    const byEmail = await User.findOne({ email: /city/i }).lean();
    const byName = await User.findOne({ name: /city hospital/i }).lean();
    console.log('No hospital name match. User by email:', byEmail);
    console.log('User by name:', byName);
  }

  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
