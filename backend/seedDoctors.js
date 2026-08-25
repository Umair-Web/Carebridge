const mongoose = require('mongoose');
const Hospital = require('./src/models/Hospital');
const HospitalDoctor = require('./src/models/HospitalDoctor');
require('dotenv').config();

const seedDoctors = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const hospitals = await Hospital.find();
    if (hospitals.length === 0) {
      console.log('No hospitals found. Please register a hospital first.');
      process.exit(0);
    }

    const doctorData = [
      { name: 'Dr. Sarah Ahmed', specialty: 'Cardiology', fee: 150000 },
      { name: 'Dr. Faisal Khan', specialty: 'Neurology', fee: 200000 },
      { name: 'Dr. Maria Ali', specialty: 'Pediatrics', fee: 120000 },
      { name: 'Dr. Usman Sheikh', specialty: 'Orthopedics', fee: 180000 },
    ];

    for (const hospital of hospitals) {
      // Clear existing for this hospital to avoid duplicates in test
      await HospitalDoctor.deleteMany({ hospitalId: hospital._id });
      
      const doctorsToInsert = doctorData.map(d => ({
        name: d.name,
        specialty: d.specialty,
        hospitalId: hospital._id,
        consultationFee: d.fee,
        isAvailable: true
      }));

      await HospitalDoctor.insertMany(doctorsToInsert);
      console.log(`Seeded 4 doctors for hospital: ${hospital.hospitalName}`);
    }

    console.log('Seeding complete!');
    process.exit(0);
  } catch (err) {
    console.error('Seeding failed:', err);
    process.exit(1);
  }
};

seedDoctors();
