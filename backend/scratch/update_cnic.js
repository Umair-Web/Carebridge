const mongoose = require('mongoose');
const Consultant = require('../src/models/Consultant');
const dotenv = require('dotenv');
dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI, { family: 4 });
  console.log('Connected to DB');

  const res = await Consultant.updateMany(
    { cnic: { $exists: false } },
    { $set: { cnic: '42101-1234567-9' } }
  );
  console.log('Consultants CNIC update outcome:', res);
  process.exit(0);
}

run().catch(console.error);
