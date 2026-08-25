const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Hospital = require('./src/models/Hospital');

dotenv.config();

async function checkDocs() {
  await mongoose.connect(process.env.MONGO_URI);
  const hospitals = await Hospital.find({}).select('hospitalName registrationDocuments').lean();
  console.log('Hospitals and their documents:');
  hospitals.forEach(h => {
    console.log(`- ${h.hospitalName}: ${JSON.stringify(h.registrationDocuments || [])}`);
  });
  await mongoose.disconnect();
}

checkDocs();
