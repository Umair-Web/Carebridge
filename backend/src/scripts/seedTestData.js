const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
const User = require('../models/User');
const Consultant = require('../models/Consultant');
const Hospital = require('../models/Hospital');
const PlatformSettings = require('../models/PlatformSettings');
const ScoringConfig = require('../models/ScoringConfig');
const DepartmentCatalog = require('../models/DepartmentCatalog');

dotenv.config();

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, { family: 4 });
    console.log('Connected to MongoDB.');

    // Clear existing
    await User.deleteMany({});
    await Consultant.deleteMany({});
    await Hospital.deleteMany({});
    console.log('Cleared existing users, consultants, and hospitals.');

    const passwordHash = await bcrypt.hash('password123', 12);

    // 1. Create Admin
    await User.create({
      name: 'Super Admin',
      email: 'admin@carebridge.local',
      phone: '0000000000',
      passwordHash,
      role: 'admin',
      status: 'active'
    });
    console.log('Created Admin (admin@carebridge.local / password123)');

    // 2. Create Consultant
    const consultantUser = await User.create({
      name: 'Dr. Sarah Ahmed',
      email: 'doctor@carebridge.local',
      phone: '03001234567',
      passwordHash,
      role: 'consultant',
      status: 'active'
    });
    await Consultant.create({
      userId: consultantUser._id,
      pmdcNumber: '12345-S',
      cnic: '42101-1234567-9',
      specialty: 'General Physician',
      clinicName: 'Health First Clinic',
      isVerified: true
    });
    console.log('Created Consultant (doctor@carebridge.local / password123)');

    // 3. Create Hospital 1
    const h1User = await User.create({
      name: 'City Hospital Admin',
      email: 'city@carebridge.local',
      phone: '02134567890',
      passwordHash,
      role: 'hospital',
      status: 'active'
    });
    await Hospital.create({
      userId: h1User._id,
      hospitalName: 'City General Hospital',
      registrationNumber: 'H-001',
      address: 'Main University Road, Karachi',
      location: { type: 'Point', coordinates: [67.0221, 24.8607] }, // Approx coordinates
      departments: ['Internal Medicine', 'Cardiology'],
      bedsInventory: [
        { ward: 'General', totalBeds: 50, availableBeds: 20 },
        { ward: 'Private', totalBeds: 10, availableBeds: 5 },
        { ward: 'ICU', totalBeds: 10, availableBeds: 3 },
        { ward: 'NICU', totalBeds: 5, availableBeds: 2 },
        { ward: 'PICU', totalBeds: 5, availableBeds: 1 }
      ],
      ratePackages: [
        { department: 'Internal Medicine', serviceName: 'General Consultation', minPrice: 150000, maxPrice: 300000 } // Paisa
      ],
      isActive: true
    });
    console.log('Created Hospital 1 (city@carebridge.local / password123)');

    // 4. Create Hospital 2
    const h2User = await User.create({
      name: 'Ziauddin Admin',
      email: 'ziauddin@carebridge.local',
      phone: '02134567891',
      passwordHash,
      role: 'hospital',
      status: 'active'
    });
    await Hospital.create({
      userId: h2User._id,
      hospitalName: 'Ziauddin Hospital',
      registrationNumber: 'H-002',
      address: 'Clifton, Karachi',
      location: { type: 'Point', coordinates: [67.0121, 24.8138] }, // Approx coordinates
      departments: ['Internal Medicine', 'Neurology', 'Orthopedics'],
      bedsInventory: [
        { ward: 'General', totalBeds: 100, availableBeds: 40 },
        { ward: 'Private', totalBeds: 20, availableBeds: 10 },
        { ward: 'ICU', totalBeds: 15, availableBeds: 5 },
        { ward: 'NICU', totalBeds: 10, availableBeds: 4 },
        { ward: 'PICU', totalBeds: 5, availableBeds: 2 }
      ],
      ratePackages: [
        { department: 'Internal Medicine', serviceName: 'General Consultation', minPrice: 200000, maxPrice: 400000 } // Paisa
      ],
      isActive: true
    });
    console.log('Created Hospital 2 (ziauddin@carebridge.local / password123)');

    // Ensure platform configs exist
    await PlatformSettings.findOneAndUpdate({}, {}, { upsert: true, new: true, setDefaultsOnInsert: true });
    await ScoringConfig.findOneAndUpdate({}, {}, { upsert: true, new: true, setDefaultsOnInsert: true });
    
    // Seed default departments if missing
    const depts = await DepartmentCatalog.countDocuments();
    if (depts === 0) {
      await DepartmentCatalog.insertMany([
        { name: 'Internal Medicine', keywords: ['fever', 'cough', 'pain', 'infection'] },
        { name: 'Cardiology', keywords: ['heart', 'chest pain', 'bp', 'blood pressure'] }
      ]);
    }

    console.log('Seeding complete! You can now log in.');
    process.exit(0);
  } catch (err) {
    console.error('Seeding error:', err);
    process.exit(1);
  }
};

run();
