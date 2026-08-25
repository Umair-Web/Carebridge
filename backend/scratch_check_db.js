
const mongoose = require('mongoose');
require('dotenv').config();

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  const User = require('./src/models/User');
  const counts = await User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]);
  console.log('Counts:', counts);
  
  const sampleConsultant = await User.findOne({ role: 'consultant' }).lean();
  console.log('Sample Consultant:', sampleConsultant);
  
  if (sampleConsultant) {
    const Consultant = require('./src/models/Consultant');
    const profile = await Consultant.findOne({ userId: sampleConsultant._id }).lean();
    console.log('Profile:', profile);
  }
  
  process.exit();
}

check().catch(console.error);
