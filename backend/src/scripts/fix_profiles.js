const mongoose = require('mongoose');
const User = require('../models/User');
const Consultant = require('../models/Consultant');
const Hospital = require('../models/Hospital');
const dotenv = require('dotenv');
dotenv.config();

async function fix() {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI not found in env');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to DB');

  const consultantUser = await User.findOne({ email: '2143rehman@gmail.com' });
  if (consultantUser) {
    const existing = await Consultant.findOne({ userId: consultantUser._id });
    if (!existing) {
      await Consultant.create({
        userId: consultantUser._id,
        pmdcNumber: 'TEST-' + Math.random().toString(36).substr(2, 5).toUpperCase(),
        specialty: 'General Physician',
        city: 'Karachi'
      });
      console.log('Created Consultant profile for 2143rehman@gmail.com');
    }
    consultantUser.status = 'active';
    await consultantUser.save();
  } else {
      console.log('Consultant user not found');
  }

  const hospitalUser = await User.findOne({ email: 'hospital@gmail.com' });
  if (hospitalUser) {
    const existing = await Hospital.findOne({ userId: hospitalUser._id });
    if (!existing) {
      await Hospital.create({
        userId: hospitalUser._id,
        hospitalName: 'Test Hospital',
        departments: ['Cardiology', 'Orthopedics', 'Neurology', 'Internal Medicine'],
        bedsInventory: [
          { ward: 'ICU', totalBeds: 10, occupiedBeds: 0, availableBeds: 10 },
          { ward: 'General', totalBeds: 50, occupiedBeds: 0, availableBeds: 50 }
        ],
        isActive: true
      });
      console.log('Created Hospital profile for hospital@gmail.com');
    }
    hospitalUser.status = 'active';
    await hospitalUser.save();
  } else {
      console.log('Hospital user not found');
  }

  console.log('Done');
  process.exit();
}

fix();
