require('dotenv').config();
const { sendVerificationEmail } = require('../src/utils/emailService');

async function test() {
  console.log('Testing Email Service with current SMTP settings...');
  console.log('Host:', process.env.EMAIL_HOST);
  console.log('User:', process.env.EMAIL_USER);

  const mockUser = {
    name: 'Test User',
    email: '2143rehman@gmail.com' // Replace with your email to receive a real test
  };
  const mockToken = 'test-token-123';

  try {
    await sendVerificationEmail(mockUser, mockToken);
    console.log('SUCCESS: Test email triggered successfully.');
    console.log('Check your SMTP provider dashboard (or inbox if using real credentials).');
  } catch (error) {
    console.error('FAILED: could not send test email.');
    console.error(error.message);
  }
}

test();
