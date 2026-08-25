/**
 * Quick Resend test: node scripts/test-resend-email.js your@email.com
 */
require('dotenv').config();
const { sendVerificationEmail } = require('../src/utils/emailService');

const to = process.argv[2];
if (!to) {
  console.error('Usage: node scripts/test-resend-email.js recipient@email.com');
  process.exit(1);
}

(async () => {
  const result = await sendVerificationEmail(
    { name: 'Test User', email: to },
    'test-token-' + Date.now()
  );
  console.log('Result:', result);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
