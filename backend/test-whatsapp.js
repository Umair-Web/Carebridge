require('dotenv').config();
const { sendAlert } = require('./src/services/notificationService');

const testPhone = process.argv[2];

if (!testPhone) {
  console.error("Please provide a phone number to test. Example:");
  console.error("node test-whatsapp.js +923001234567");
  process.exit(1);
}

const testNotifications = async () => {
  console.log(`Starting WhatsApp notification tests for ${testPhone}...`);

  // Test 1: Login Alert
  console.log("\n--- Testing: LOGIN_ALERT ---");
  const result1 = await sendAlert({
    userId: 'test_user_id',
    role: 'consultant',
    type: 'LOGIN_ALERT',
    message: 'Test login alert',
    data: {
      phone: testPhone,
      name: 'Test User'
    }
  });
  console.log('Result:', result1);

  // Test 2: New Referral
  console.log("\n--- Testing: NEW_REFERRAL ---");
  await sendAlert({
    userId: 'test_user_id',
    role: 'consultant',
    type: 'NEW_REFERRAL',
    message: 'Test new referral',
    data: {
      phone: testPhone,
      name: 'Test User',
      referralCode: 'REF-12345',
      urgency: 'High'
    }
  });

  // Test 3: Account Approved
  console.log("\n--- Testing: ACCOUNT_APPROVED ---");
  await sendAlert({
    userId: 'test_user_id',
    role: 'consultant',
    type: 'ACCOUNT_APPROVED',
    message: 'Test account approved',
    data: {
      phone: testPhone,
      name: 'Test User'
    }
  });

  console.log("\nTests complete. Check the console output above to see if there were any errors.");
  console.log("Note: Ensure META_WA_PHONE_NUMBER_ID and META_WA_ACCESS_TOKEN are set in your .env file.");
  console.log("      Get them from Meta Business Manager → WhatsApp → API Setup.");

};

testNotifications();
