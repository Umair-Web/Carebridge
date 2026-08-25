const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Hospital = require('./src/models/Hospital');

dotenv.config();

async function updateDocs() {
  await mongoose.connect(process.env.MONGO_URI);
  
  // Find the first hospital
  const hospital = await Hospital.findOne({});
  if (hospital) {
    hospital.registrationDocuments = [
      { name: 'SHCC Professional License', url: 'http://localhost:5000/uploads/test-license.pdf' },
      { name: 'Rate List (Billing Dept)', url: 'http://localhost:5000/uploads/test-rates.pdf' }
    ];
    await hospital.save();
    console.log(`Updated documents for: ${hospital.hospitalName}`);
  } else {
    console.log('No hospitals found to update.');
  }
  
  await mongoose.disconnect();
}

updateDocs();
