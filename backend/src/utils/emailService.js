const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const { sendViaResend, isResendConfigured } = require('./resendEmail');
const { getFrontendBase } = require('./frontendUrl');

/** Fixed inbox for all admin detail-access password reset links. */
const ADMIN_DETAIL_ACCESS_RESET_EMAIL =
  process.env.ADMIN_DETAIL_ACCESS_RESET_EMAIL || 'infocarebridgesystem@gmail.com';

const {
  verificationEmailHtml,
  verificationOtpEmailHtml,
  verificationOtpEmailText,
  resetPasswordEmailHtml,
  verificationEmailText,
  resetPasswordEmailText,
  adminLabAccessResetEmailHtml,
  adminLabAccessResetEmailText,
  adminReferralAccessResetEmailHtml,
  adminReferralAccessResetEmailText,
  adminConsultantAccessResetEmailHtml,
  adminConsultantAccessResetEmailText,
  adminHospitalAccessResetEmailHtml,
  adminHospitalAccessResetEmailText,
  buildNotificationEmail,
  buildNotificationEmailText,
  notificationEmailSubject,
  buildActionEmail,
  buildActionEmailText,
  referralSubmittedConsultantEmail,
  referralReceivedHospitalEmail,
  referralReceivedDoctorEmail,
  referralStatusUpdateEmail,
  clinicalNoteEmail,
} = require('./emailTemplates');

/**
 * Email routing:
 * - EMAIL_PROVIDER=resend  → Resend API (recommended for production)
 * - EMAIL_PROVIDER=smtp    → Legacy nodemailer (EMAIL_LEGACY_SMTP_ENABLED=true)
 * - default: Resend if RESEND_API_KEY is set, else legacy SMTP if enabled, else mock file
 *
 * Legacy SMTP is kept in code but off when EMAIL_LEGACY_SMTP_ENABLED is not "true".
 */

const useResend = () => {
  if (process.env.EMAIL_PROVIDER === 'smtp') return false;
  if (process.env.EMAIL_PROVIDER === 'resend') return true;
  if (process.env.EMAIL_LEGACY_SMTP_ENABLED === 'true') return false;
  return isResendConfigured();
};

const useLegacySmtp = () => {
  if (process.env.EMAIL_PROVIDER === 'resend') return false;
  if (process.env.EMAIL_PROVIDER === 'smtp') return true;
  return process.env.EMAIL_LEGACY_SMTP_ENABLED === 'true';
};

const getLegacyTransporter = () =>
  nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT, 10),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

const writeMockEmailFile = async ({ to, subject, html, text }) => {
  const emailDir = path.join(__dirname, '../../uploads/emails');
  if (!fs.existsSync(emailDir)) {
    fs.mkdirSync(emailDir, { recursive: true });
  }

  const fileName = `email_${Date.now()}_${to.replace(/[^a-zA-Z0-9]/g, '_')}.html`;
  const filePath = path.join(emailDir, fileName);

  const fileContent = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><title>[DEV MOCK] ${subject}</title></head>
    <body style="font-family: sans-serif; padding: 20px; background: #f8fafc;">
      <div style="max-width: 600px; margin: 0 auto; background: white; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0;">
        <div style="background: #eff6ff; color: #1e40af; padding: 12px; border-radius: 8px; font-weight: bold; margin-bottom: 20px; text-align: center;">
          DEVELOPMENT EMAIL MOCK
        </div>
        <p><strong>To:</strong> ${to}</p>
        <p><strong>Subject:</strong> ${subject}</p>
        <hr/>
        ${html || `<pre style="white-space: pre-wrap;">${text}</pre>`}
      </div>
    </body>
    </html>
  `;

  fs.writeFileSync(filePath, fileContent, 'utf8');
  console.log(`[EMAIL MOCK] TO: ${to} | SUBJECT: ${subject} | FILE: ${filePath}`);
  return { success: true, mocked: true, filePath };
};

/** Legacy nodemailer send (disabled unless EMAIL_LEGACY_SMTP_ENABLED=true) */
const sendEmailViaLegacySmtp = async ({ to, subject, html, text }) => {
  const transporter = getLegacyTransporter();
  const info = await transporter.sendMail({
    from: process.env.EMAIL_FROM || '"CareBridge Health" <no-reply@carebridge.com>',
    to,
    subject,
    text: text || '',
    html,
  });
  console.log(`[SMTP] Email sent: ${info.messageId}`);
  return { success: true, messageId: info.messageId, provider: 'smtp' };
};

/**
 * Generic email sender — routes to Resend, legacy SMTP, or dev mock.
 */
const sendEmail = async ({ to, subject, html, text }) => {
  if (!to) {
    return { success: false, error: 'Missing recipient' };
  }

  if (useResend()) {
    try {
      return await sendViaResend({ to, subject, html, text });
    } catch (error) {
      console.error('[RESEND] Send failed:', error.message);
      if (useLegacySmtp()) {
        console.log('[EMAIL] Falling back to legacy SMTP...');
        try {
          return await sendEmailViaLegacySmtp({ to, subject, html, text });
        } catch (smtpErr) {
          console.error('[SMTP] Fallback failed:', smtpErr.message);
        }
      }
      return writeMockEmailFile({ to, subject, html, text });
    }
  }

  if (useLegacySmtp()) {
    try {
      return await sendEmailViaLegacySmtp({ to, subject, html, text });
    } catch (error) {
      console.error('[SMTP] Email failed:', error.message);
      return writeMockEmailFile({ to, subject, html, text });
    }
  }

  console.log('[EMAIL] No provider enabled — writing mock file (set RESEND_API_KEY or EMAIL_LEGACY_SMTP_ENABLED=true)');
  return writeMockEmailFile({ to, subject, html, text });
};

const sendVerificationEmail = async (user, token, req) => {
  const verificationUrl = `${getFrontendBase(req)}/verify-email?token=${token}`;
  return sendEmail({
    to: user.email,
    subject: 'Verify your email — CareBridge Health',
    html: verificationEmailHtml(user, verificationUrl),
    text: verificationEmailText(user, verificationUrl),
  });
};

/** Send a 6-digit email-verification OTP to the user's email. */
const sendEmailOtp = async (user, otp) => {
  return sendEmail({
    to: user.email,
    subject: 'Your verification code — CareBridge Health',
    html: verificationOtpEmailHtml(user, otp),
    text: verificationOtpEmailText(user, otp),
  });
};

const sendResetPasswordEmail = async (user, token, req) => {
  const resetUrl = `${getFrontendBase(req)}/reset-password?token=${token}`;
  return sendEmail({
    to: user.email,
    subject: 'Reset your password — CareBridge Health',
    html: resetPasswordEmailHtml(user, resetUrl),
    text: resetPasswordEmailText(user, resetUrl),
  });
};

const sendAdminLabAccessResetEmail = async (user, token, req) => {
  const resetUrl = `${getFrontendBase(req)}/reset-lab-access?token=${token}`;
  const recipient = { name: user?.name || 'Admin', email: ADMIN_DETAIL_ACCESS_RESET_EMAIL };
  return sendEmail({
    to: ADMIN_DETAIL_ACCESS_RESET_EMAIL,
    subject: 'Reset laboratory access password — CareBridge Health',
    html: adminLabAccessResetEmailHtml(recipient, resetUrl),
    text: adminLabAccessResetEmailText(recipient, resetUrl),
  });
};

const sendAdminReferralAccessResetEmail = async (user, token, referralCode, req) => {
  const resetUrl = `${getFrontendBase(req)}/reset-referral-access?token=${encodeURIComponent(token)}`;
  const recipient = { name: user?.name || 'Admin', email: ADMIN_DETAIL_ACCESS_RESET_EMAIL };
  return sendEmail({
    to: ADMIN_DETAIL_ACCESS_RESET_EMAIL,
    subject: `Reset referral access password${referralCode ? ` (${referralCode})` : ''} — CareBridge Health`,
    html: adminReferralAccessResetEmailHtml(recipient, resetUrl, referralCode),
    text: adminReferralAccessResetEmailText(recipient, resetUrl, referralCode),
  });
};

const sendAdminConsultantAccessResetEmail = async (user, token, req) => {
  const resetUrl = `${getFrontendBase(req)}/reset-consultant-access?token=${encodeURIComponent(token)}`;
  const recipient = { name: user?.name || 'Admin', email: ADMIN_DETAIL_ACCESS_RESET_EMAIL };
  return sendEmail({
    to: ADMIN_DETAIL_ACCESS_RESET_EMAIL,
    subject: 'Reset consultant access password — CareBridge Health',
    html: adminConsultantAccessResetEmailHtml(recipient, resetUrl),
    text: adminConsultantAccessResetEmailText(recipient, resetUrl),
  });
};

const sendAdminHospitalAccessResetEmail = async (user, token, req) => {
  const resetUrl = `${getFrontendBase(req)}/reset-hospital-access?token=${encodeURIComponent(token)}`;
  const recipient = { name: user?.name || 'Admin', email: ADMIN_DETAIL_ACCESS_RESET_EMAIL };
  return sendEmail({
    to: ADMIN_DETAIL_ACCESS_RESET_EMAIL,
    subject: 'Reset hospital access password — CareBridge Health',
    html: adminHospitalAccessResetEmailHtml(recipient, resetUrl),
    text: adminHospitalAccessResetEmailText(recipient, resetUrl),
  });
};

/** Formatted email for notificationService alert types */
const sendNotificationEmail = async (type, role, data, message) => {
  if (!data?.email) return { success: false, error: 'Missing email' };
  return sendEmail({
    to: data.email,
    subject: `${notificationEmailSubject(type, data)} — CareBridge Health`,
    html: buildNotificationEmail(type, data, message, role),
    text: buildNotificationEmailText(type, data, message, role),
  });
};

/** Generic formatted action email */
const sendActionEmail = async ({ to, subject, ...templateArgs }) => {
  return sendEmail({
    to,
    subject,
    html: buildActionEmail(templateArgs),
    text: buildActionEmailText({ title: templateArgs.title, ...templateArgs }),
  });
};

module.exports = {
  ADMIN_DETAIL_ACCESS_RESET_EMAIL,
  sendEmail,
  sendVerificationEmail,
  sendEmailOtp,
  sendResetPasswordEmail,
  sendAdminLabAccessResetEmail,
  sendAdminReferralAccessResetEmail,
  sendAdminConsultantAccessResetEmail,
  sendAdminHospitalAccessResetEmail,
  sendNotificationEmail,
  sendActionEmail,
  useResend,
  useLegacySmtp,
  isResendConfigured,
  referralSubmittedConsultantEmail,
  referralReceivedHospitalEmail,
  referralReceivedDoctorEmail,
  referralStatusUpdateEmail,
  clinicalNoteEmail,
};
