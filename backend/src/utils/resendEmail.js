const { Resend } = require('resend');

let resendClient = null;

const getResend = () => {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not configured');
  }
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
};

/**
 * Send email via Resend API.
 * @see https://resend.com/docs/send-with-nodejs
 */
const sendViaResend = async ({ to, subject, html, text }) => {
  const from =
    process.env.RESEND_FROM ||
    process.env.EMAIL_FROM ||
    'CareBridge Health <onboarding@resend.dev>';

  const resend = getResend();
  const { data, error } = await resend.emails.send({
    from,
    to: Array.isArray(to) ? to : [to],
    subject,
    html: html || undefined,
    text: text || undefined,
  });

  if (error) {
    throw new Error(error.message || JSON.stringify(error));
  }

  console.log(`[RESEND] Email sent to ${to} — id: ${data?.id}`);
  return { success: true, messageId: data?.id, provider: 'resend' };
};

const isResendConfigured = () => Boolean(process.env.RESEND_API_KEY);

module.exports = { sendViaResend, isResendConfigured };
