#!/usr/bin/env node
/**
 * Test WhatsApp delivery to a real number (production templates).
 * Usage: node scripts/send-wa-test.js 03123740084
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const {
  sendOtpWhatsApp,
  sendWhatsApp,
  isWhatsAppConfigured,
  isProductionWhatsAppReady,
  USE_TEMPLATES,
} = require('../src/utils/whatsappService');

const phone = process.argv[2];
if (!phone) {
  console.error('Usage: node scripts/send-wa-test.js 03XXXXXXXXX');
  process.exit(1);
}

(async () => {
  console.log('Configured:', isWhatsAppConfigured());
  console.log('USE_TEMPLATES:', USE_TEMPLATES);
  console.log('Production ready:', isProductionWhatsAppReady());
  console.log('OTP template:', process.env.META_WA_TEMPLATE_OTP || '(not set)');
  console.log('Alert template:', process.env.META_WA_TEMPLATE_ALERT || '(not set)');
  console.log('---');

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  console.log('Sending OTP via template/text...');
  const r1 = await sendOtpWhatsApp(phone, otp, 'CareBridge User');
  console.log('OTP result:', JSON.stringify(r1, null, 2));

  console.log('Sending alert...');
  const r2 = await sendWhatsApp(
    phone,
    'CareBridge live test: if you receive this, production WhatsApp is working.'
  );
  console.log('Alert result:', JSON.stringify(r2, null, 2));
})();
