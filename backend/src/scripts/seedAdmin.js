const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
const User = require('../models/User');

dotenv.config();

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, { family: 4 });
    const email = (process.env.ADMIN_EMAIL || 'admin@carebridge.local').toLowerCase().trim();
    const password = process.env.ADMIN_PASSWORD || 'Admin123!';
    const name = process.env.ADMIN_NAME || 'CareBridge Admin';

    const existing = await User.findOne({ email });
    if (existing) {
      console.log('Admin user already exists:', email);
      process.exit(0);
      return;
    }

    await User.create({
      name,
      email,
      phone: process.env.ADMIN_PHONE || '+920000000000',
      passwordHash: await bcrypt.hash(password, 12),
      role: 'admin',
      status: 'active',
    });

    console.log('Created admin user:', email);
    console.log('Use ADMIN_EMAIL / ADMIN_PASSWORD in .env to customize.');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();
