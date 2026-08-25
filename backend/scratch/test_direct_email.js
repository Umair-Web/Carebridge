const nodemailer = require('nodemailer');
require('dotenv').config();

async function test(port, secure) {
  console.log(`\nTesting SMTP on Port: ${port}, Secure: ${secure}...`);
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: port,
    secure: secure,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    // Add connection timeout
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
  });

  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || '"CareBridge Health" <no-reply@carebridge.com>',
      to: process.env.EMAIL_USER, // send to self
      subject: `CareBridge SMTP test - Port ${port}`,
      text: `Hello, this is a test from CareBridge on port ${port} secure=${secure}!`,
    });
    console.log(`✅ SUCCESS! Message sent: ${info.messageId}`);
    return true;
  } catch (err) {
    console.error(`❌ FAILED: ${err.message}`);
    if (err.code === 'ETIMEOUT') {
      console.log('💡 Note: Connection timed out. This usually means the port is BLOCKED by your internet provider or firewall.');
    }
    return false;
  }
}

async function run() {
  console.log('Active Credentials:');
  console.log(`USER: ${process.env.EMAIL_USER}`);
  console.log(`PASS: ${process.env.EMAIL_PASS}`);
  
  // Test Port 465 Secure (current settings)
  const ok465 = await test(465, true);
  
  // Test Port 587 StartTLS (standard fallback)
  if (!ok465) {
    await test(587, false);
  }
}

run();
