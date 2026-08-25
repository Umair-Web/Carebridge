const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const User = require('../models/User');
const Hospital = require('../models/Hospital');
const Consultant = require('../models/Consultant');
const HospitalDoctor = require('../models/HospitalDoctor');
const Referral = require('../models/Referral');
const Admission = require('../models/Admission');
const Payout = require('../models/Payout');
const AuditLog = require('../models/AuditLog');
const WeeklySettlement = require('../models/WeeklySettlement');
const Invoice = require('../models/Invoice');
const PlatformSettings = require('../models/PlatformSettings');
const ScoringConfig = require('../models/ScoringConfig');
const DepartmentCatalog = require('../models/DepartmentCatalog');
const Counter = require('../models/Counter');

const { ensurePlatformData } = require('../bootstrap/ensurePlatformData');

const ALLOWED_WARDS = ['General', 'Private', 'ICU', 'NICU', 'PICU', 'HDU', 'Burns', 'Maternity', 'Psychiatric', 'Cardiac'];

const seedBeds = () => {
  return ALLOWED_WARDS.map(w => ({
    ward: w,
    totalBeds: 10,
    occupiedBeds: 2,
    availableBeds: 8
  }));
};

async function run() {
  try {
    const mongoUri = process.env.MONGO_URI;
    console.log(`Connecting to MongoDB at: ${mongoUri}`);
    await mongoose.connect(mongoUri, { family: 4 });
    console.log('Connected.');

    // 1. Wipe everything
    console.log('Purging database...');
    await User.deleteMany({});
    await Hospital.deleteMany({});
    await Consultant.deleteMany({});
    await HospitalDoctor.deleteMany({});
    await Referral.deleteMany({});
    await Admission.deleteMany({});
    await Payout.deleteMany({});
    await AuditLog.deleteMany({});
    await WeeklySettlement.deleteMany({});
    await Invoice.deleteMany({});
    await PlatformSettings.deleteMany({});
    await ScoringConfig.deleteMany({});
    await DepartmentCatalog.deleteMany({});
    await Counter.deleteMany({});
    console.log('Database wiped clean.');

    // 2. Bootstrap platform settings & Admin
    console.log('Bootstrapping default configurations and admin account...');
    await ensurePlatformData();

    const passwordHash = await bcrypt.hash('CareBridge123!', 12);

    // 3. Seed 3 Dummy Hospitals
    console.log('Seeding 3 dummy hospitals...');
    const hospitalData = [
      {
        name: 'Ali Memorial Hospital',
        email: 'hospital1@carebridge.local',
        phone: '+923001111111',
        regNum: 'HOSP-001',
        cnic: '42101-1111111-1',
        address: 'Main Boulevard, Gulberg, Lahore',
        departments: ['Internal Medicine', 'Cardiology', 'Pediatrics'],
        lat: 31.5204,
        lng: 74.3587
      },
      {
        name: 'Care Hospital Karachi',
        email: 'hospital2@carebridge.local',
        phone: '+923002222222',
        regNum: 'HOSP-002',
        cnic: '42101-2222222-2',
        address: 'Clifton Block 5, Karachi',
        departments: ['Internal Medicine', 'Cardiology', 'Orthopedics', 'General Surgery'],
        lat: 24.8138,
        lng: 67.0319
      },
      {
        name: 'National Medical Center',
        email: 'hospital3@carebridge.local',
        phone: '+923003333333',
        regNum: 'HOSP-003',
        cnic: '42101-3333333-3',
        address: 'Korangi Road, DHA Phase 1, Karachi',
        departments: ['Internal Medicine', 'Orthopedics', 'General Surgery'],
        lat: 24.8361,
        lng: 67.0694
      }
    ];

    for (const h of hospitalData) {
      const u = await User.create({
        name: h.name,
        email: h.email,
        phone: h.phone,
        passwordHash,
        role: 'hospital',
        status: 'active',
        isPhoneVerified: true,
        isEmailVerified: true
      });

      const hospital = await Hospital.create({
        userId: u._id,
        hospitalName: h.name,
        registrationNumber: h.regNum,
        representativeCnic: h.cnic,
        address: h.address,
        departments: h.departments,
        bedsInventory: seedBeds(),
        location: { type: 'Point', coordinates: [h.lng, h.lat] },
        isActive: true,
        isRegistrationVerified: true,
        branding: { primaryColor: '#0f172a' }
      });

      // Seed a few doctors for this hospital so users can start admissions
      await HospitalDoctor.create({
        name: 'Dr. John Doe',
        specialty: 'Internal Medicine',
        pmdcNumber: `PMDC-DOC-${hospital.registrationNumber}-1`,
        hospitalId: hospital._id,
        isAvailable: true,
        consultationFee: 150000
      });

      await HospitalDoctor.create({
        name: 'Dr. Jane Smith',
        specialty: 'Cardiology',
        pmdcNumber: `PMDC-DOC-${hospital.registrationNumber}-2`,
        hospitalId: hospital._id,
        isAvailable: true,
        consultationFee: 250000
      });
    }

    // 4. Seed 2 Dummy Consultants
    console.log('Seeding 2 dummy consultants...');
    const consultantData = [
      {
        name: 'Dr. Muhammad Ali',
        email: 'doctor1@carebridge.local',
        phone: '+923331111111',
        pmdc: 'PMDC-12345-D',
        cnic: '42101-4444444-4',
        specialty: 'Cardiology',
        clinic: 'Lahore Cardiac Clinic',
        clinicAddress: 'Gulberg Lahore'
      },
      {
        name: 'Dr. Fatima Zahra',
        email: 'doctor2@carebridge.local',
        phone: '+923332222222',
        pmdc: 'PMDC-67890-D',
        cnic: '42101-5555555-5',
        specialty: 'Internal Medicine',
        clinic: 'Karachi General Clinic',
        clinicAddress: 'Clifton Karachi'
      }
    ];

    for (const c of consultantData) {
      const u = await User.create({
        name: c.name,
        email: c.email,
        phone: c.phone,
        passwordHash,
        role: 'consultant',
        status: 'active',
        isPhoneVerified: true,
        isEmailVerified: true
      });

      await Consultant.create({
        userId: u._id,
        pmdcNumber: c.pmdc,
        cnic: c.cnic,
        specialty: c.specialty,
        clinicName: c.clinic,
        clinicAddress: c.clinicAddress,
        isVerified: true,
        commissionPercentage: 60,
        verificationDocuments: [
          { name: 'PMDC Certificate', url: 'https://placehold.co/600x400' },
          { name: 'CNIC', url: 'https://placehold.co/600x400' }
        ]
      });
    }

    console.log('\n--- Seed Finished Successfully! ---');
    console.log('Credentials for Testing:');
    console.log('Admin Account:');
    console.log('  Email: admin@carebridge.local');
    console.log('  Password: Admin123! (or env password)');
    console.log('\nHospitals (Password: CareBridge123!):');
    hospitalData.forEach(h => console.log(`  - ${h.name}: ${h.email}`));
    console.log('\nConsultants (Password: CareBridge123!):');
    consultantData.forEach(c => console.log(`  - ${c.name}: ${c.email}`));

    process.exit(0);
  } catch (err) {
    console.error('Seeding failed:', err);
    process.exit(1);
  }
}

run();
