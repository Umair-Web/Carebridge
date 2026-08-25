/**
 * HTML email templates — table layout + inline CSS for Gmail/Outlook compatibility.
 */

const BRAND = {
  name: 'CareBridge Health',
  primary: '#2563eb',
  primaryDark: '#1d4ed8',
  accent: '#0ea5e9',
  text: '#1e293b',
  muted: '#64748b',
  border: '#e2e8f0',
  bg: '#f1f5f9',
  card: '#ffffff',
  success: '#059669',
  warning: '#d97706',
  danger: '#dc2626',
};

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const frontendBase = () => process.env.FRONTEND_URL || 'http://localhost:5173';

const dashboardUrl = (role) => {
  const base = frontendBase();
  if (role === 'hospital') return `${base}/hospital/inbox`;
  if (role === 'admin') return `${base}/admin/settlements`;
  if (role === 'consultant') return `${base}/referrals`;
  return `${base}/login`;
};

const baseLayout = ({ preheader, bodyRows, footerNote }) => `
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>${BRAND.name}</title>
</head>
<body style="margin:0;padding:0;background-color:${BRAND.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(preheader)}</div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${BRAND.bg};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;">
          <tr>
            <td style="background-color:${BRAND.primary};border-radius:16px 16px 0 0;padding:28px 32px;text-align:center;">
              <div style="display:inline-block;width:48px;height:48px;background-color:rgba(255,255,255,0.2);border-radius:12px;line-height:48px;font-size:22px;font-weight:800;color:#ffffff;margin-bottom:12px;">CB</div>
              <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">${BRAND.name}</h1>
              <p style="margin:8px 0 0;font-size:13px;color:rgba(255,255,255,0.85);">Digital Referral Management Platform</p>
            </td>
          </tr>
          <tr>
            <td style="background-color:${BRAND.card};border-left:1px solid ${BRAND.border};border-right:1px solid ${BRAND.border};padding:36px 32px;">
              ${bodyRows}
            </td>
          </tr>
          <tr>
            <td style="background-color:#f8fafc;border:1px solid ${BRAND.border};border-top:none;border-radius:0 0 16px 16px;padding:24px 32px;text-align:center;">
              <p style="margin:0 0 8px;font-size:12px;color:${BRAND.muted};line-height:1.5;">
                ${footerNote || 'This is an automated message from CareBridge Health. Please do not reply to this email.'}
              </p>
              <p style="margin:0;font-size:11px;color:#94a3b8;">&copy; ${new Date().getFullYear()} ${BRAND.name} &middot; Pakistan</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

const ctaButton = (href, label) => `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:28px auto;">
  <tr>
    <td align="center" style="border-radius:10px;background-color:${BRAND.primary};">
      <a href="${href}" target="_blank" style="display:inline-block;padding:16px 36px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;background-color:${BRAND.primary};border:1px solid ${BRAND.primaryDark};">
        ${escapeHtml(label)}
      </a>
    </td>
  </tr>
</table>`;

const infoBox = (content, accent = BRAND.accent) => `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:24px;">
  <tr>
    <td style="background-color:#f8fafc;border:1px solid ${BRAND.border};border-left:4px solid ${accent};border-radius:8px;padding:16px 18px;">
      <p style="margin:0;font-size:13px;line-height:1.6;color:${BRAND.muted};">${content}</p>
    </td>
  </tr>
</table>`;

const linkFallback = (url) => `
<p style="margin:24px 0 0;font-size:13px;color:${BRAND.muted};line-height:1.5;">Or copy and paste this link into your browser:</p>
<p style="margin:8px 0 0;font-size:12px;word-break:break-all;">
  <a href="${url}" style="color:${BRAND.primary};text-decoration:underline;">${escapeHtml(url)}</a>
</p>`;

const detailsTable = (rows = []) => {
  if (!rows.length) return '';
  const items = rows
    .filter((r) => r.value != null && r.value !== '')
    .map(
      (r) => `
    <tr>
      <td style="padding:10px 14px;font-size:13px;color:${BRAND.muted};border-bottom:1px solid ${BRAND.border};width:38%;vertical-align:top;">${escapeHtml(r.label)}</td>
      <td style="padding:10px 14px;font-size:13px;font-weight:600;color:${BRAND.text};border-bottom:1px solid ${BRAND.border};vertical-align:top;">${escapeHtml(r.value)}</td>
    </tr>`
    )
    .join('');
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:20px 0 0;border:1px solid ${BRAND.border};border-radius:10px;overflow:hidden;">
  ${items}
</table>`;
};

const statusBadge = (label, color = BRAND.primary) => `
<span style="display:inline-block;padding:4px 10px;border-radius:999px;background-color:${color}18;color:${color};font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;">${escapeHtml(label)}</span>`;

/**
 * Generic professional action email.
 */
const buildActionEmail = ({
  preheader,
  category,
  title,
  name,
  paragraphs = [],
  details = [],
  cta,
  footnote,
  linkUrl,
  accent = BRAND.accent,
}) => {
  const greeting = name
    ? `<p style="margin:0 0 12px;font-size:15px;line-height:1.65;color:${BRAND.text};">Hello <strong>${escapeHtml(name)}</strong>,</p>`
    : '';

  const bodyParagraphs = paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 12px;font-size:15px;line-height:1.65;color:${BRAND.muted};">${p}</p>`
    )
    .join('');

  const bodyRows = `
    <p style="margin:0 0 8px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:${accent || BRAND.accent};">${escapeHtml(category)}</p>
    <h2 style="margin:0 0 16px;font-size:24px;font-weight:700;color:${BRAND.text};letter-spacing:-0.02em;line-height:1.3;">${escapeHtml(title)}</h2>
    ${greeting}
    ${bodyParagraphs}
    ${detailsTable(details)}
    ${cta?.href ? ctaButton(cta.href, cta.label || 'Open dashboard') : ''}
    ${linkUrl ? linkFallback(linkUrl) : ''}
    ${footnote ? infoBox(footnote, accent) : ''}
  `;

  return baseLayout({ preheader: preheader || title, bodyRows });
};

const buildActionEmailText = ({ title, name, paragraphs = [], details = [], cta, footnote }) => {
  const lines = [
    BRAND.name,
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    title,
    '',
    name ? `Hello ${name},` : '',
    '',
    ...paragraphs.map((p) => p.replace(/<[^>]+>/g, '')),
    '',
  ];
  if (details.length) {
    lines.push('Details:');
    details.forEach((d) => lines.push(`  ${d.label}: ${d.value}`));
    lines.push('');
  }
  if (cta?.href) lines.push(`Open: ${cta.href}`, '');
  if (footnote) lines.push(footnote.replace(/<[^>]+>/g, ''), '');
  lines.push(`— ${BRAND.name}`);
  return lines.filter(Boolean).join('\n');
};

const pkTime = () =>
  new Date().toLocaleString('en-PK', { timeZone: 'Asia/Karachi', dateStyle: 'medium', timeStyle: 'short' });

/** Map notification type → formatted email */
const buildNotificationEmail = (type, data = {}, message = '', role = 'consultant') => {
  const name = data.name || '';
  const cta = { href: dashboardUrl(role), label: 'Open dashboard' };

  const configs = {
    LOGIN_ALERT: {
      category: 'Security alert',
      title: 'New login detected',
      preheader: 'A new login was detected on your CareBridge account.',
      paragraphs: [
        `A sign-in to your ${BRAND.name} account was detected on <strong>${pkTime()}</strong> (PKT).`,
        'If this was you, no action is needed. If you did not log in, reset your password immediately.',
      ],
      footnote: '<strong style="color:#475569;">Security tip:</strong> Never share your password or verification codes with anyone.',
      accent: BRAND.warning,
    },
    PASSWORD_CHANGED: {
      category: 'Security update',
      title: 'Password changed successfully',
      preheader: 'Your CareBridge password was updated.',
      paragraphs: [
        'Your account password was changed successfully.',
        'If you did not make this change, contact platform support immediately.',
      ],
      accent: BRAND.success,
    },
    NEW_REFERRAL: {
      category: 'New referral',
      title: 'Referral received',
      preheader: `New referral ${data.referralCode || ''} requires your review.`,
      paragraphs: [
        `A new referral has been routed to your facility with <strong>${escapeHtml(data.urgency || 'routine')}</strong> priority.`,
        'Please log in to review the case and respond within the SLA deadline.',
      ],
      details: [
        { label: 'Referral code', value: data.referralCode },
        { label: 'Urgency', value: data.urgency },
        { label: 'Patient', value: data.patientName },
      ],
      cta: { href: `${frontendBase()}/hospital/inbox`, label: 'Review referral inbox' },
    },
    REFERRAL_ACCEPTED: {
      category: 'Referral update',
      title: 'Referral accepted',
      preheader: `Referral ${data.referralCode || ''} was accepted.`,
      paragraphs: [
        `Your referral has been accepted by <strong>${escapeHtml(data.hospitalName || 'the hospital')}</strong>.`,
        'The patient transfer can now proceed. Track progress from your dashboard.',
      ],
      details: [
        { label: 'Referral code', value: data.referralCode },
        { label: 'Hospital', value: data.hospitalName },
      ],
      accent: BRAND.success,
    },
    REFERRAL_REJECTED: {
      category: 'Referral update',
      title: 'Referral declined',
      preheader: `Referral ${data.referralCode || ''} was declined.`,
      paragraphs: [
        `Your referral was declined by the hospital.`,
        data.reason ? `Reason: <strong>${escapeHtml(data.reason)}</strong>` : '',
        'Please review and consider alternative options.',
      ].filter(Boolean),
      details: [{ label: 'Referral code', value: data.referralCode }],
      accent: BRAND.danger,
    },
    REFERRAL_ESCALATED: {
      category: 'Urgent referral',
      title: 'Referral escalated',
      preheader: 'A referral has been escalated and needs attention.',
      paragraphs: [
        `Referral <strong>${escapeHtml(data.referralCode || '')}</strong> has been escalated due to inactivity.`,
        'Immediate attention is required.',
      ],
      accent: BRAND.warning,
    },
    ADMISSION_CREATED: {
      category: 'Admission',
      title: 'Patient admitted',
      preheader: 'A patient has been admitted under your referral.',
      paragraphs: ['A patient has been admitted. Admission tracking is now active on your dashboard.'],
      details: [{ label: 'Referral code', value: data.referralCode }],
      accent: BRAND.success,
    },
    BILL_GENERATED: {
      category: 'Billing',
      title: 'Bill generated',
      preheader: 'A new bill has been generated.',
      paragraphs: ['A bill has been generated for an admission. Please review it in your dashboard.'],
      details: [
        { label: 'Amount (PKR)', value: data.amount },
        { label: 'Admission', value: data.admissionId },
      ],
    },
    SETTLEMENT_CREATED: {
      category: 'Settlement',
      title: 'Weekly settlement submitted',
      preheader: 'A hospital submitted a weekly settlement for review.',
      paragraphs: [
        `<strong>${escapeHtml(data.hospitalName || 'A hospital')}</strong> submitted a weekly settlement summary.`,
        'Please review bills and payment details in the admin settlements queue.',
      ],
      details: [
        { label: 'Hospital', value: data.hospitalName },
        { label: 'Gross amount (PKR)', value: data.grossAmount },
        { label: 'Platform share (PKR)', value: data.platformCut },
      ],
      cta: { href: `${frontendBase()}/admin/settlements`, label: 'Review settlement' },
    },
    HOSPITAL_RECEIPT_UPLOADED: {
      category: 'Settlement',
      title: 'Payment receipt uploaded',
      preheader: 'A hospital uploaded a settlement payment receipt.',
      paragraphs: [
        `<strong>${escapeHtml(data.hospitalName || 'A hospital')}</strong> uploaded a payment receipt for verification.`,
        'Please verify the receipt in the admin settlements dashboard.',
      ],
      cta: { href: `${frontendBase()}/admin/settlements`, label: 'Verify receipt' },
    },
    SETTLEMENT_VERIFIED: {
      category: 'Settlement',
      title: 'Payment receipt verified',
      preheader: 'Your settlement payment was verified by admin.',
      paragraphs: [
        'Your payment receipt has been verified by the platform admin.',
        'Consultant payouts will be processed shortly.',
      ],
      cta: { href: `${frontendBase()}/hospital/settlements`, label: 'View settlements' },
      accent: BRAND.success,
    },
    SETTLEMENT_REJECTED: {
      category: 'Settlement',
      title: 'Payment receipt rejected',
      preheader: 'Your settlement receipt needs to be re-uploaded.',
      paragraphs: [
        'Your payment receipt was rejected by admin.',
        data.reason ? `Reason: <strong>${escapeHtml(data.reason)}</strong>` : '',
        'Please upload a valid receipt in the Settlements dashboard.',
      ].filter(Boolean),
      cta: { href: `${frontendBase()}/hospital/settlements`, label: 'Re-upload receipt' },
      accent: BRAND.danger,
    },
    CONSULTANT_PAYOUT_UPLOADED: {
      category: 'Payout',
      title: 'Payout processed',
      preheader: 'Your consultant payout has been sent.',
      paragraphs: [
        `A payout of <strong>PKR ${escapeHtml(data.amount || '')}</strong> has been processed by admin.`,
        'Please confirm receipt in your Earnings dashboard once received.',
      ],
      details: [{ label: 'Amount (PKR)', value: data.amount }],
      cta: { href: `${frontendBase()}/earnings`, label: 'View earnings' },
      accent: BRAND.success,
    },
    PAYOUT_VERIFIED: {
      category: 'Payout',
      title: 'Payout confirmed',
      preheader: 'Consultant confirmed payout receipt.',
      paragraphs: ['A consultant payout has been confirmed. The settlement cycle is complete.'],
      details: [{ label: 'Amount (PKR)', value: data.amount }],
      accent: BRAND.success,
    },
    ACCOUNT_APPROVED: {
      category: 'Account status',
      title: 'Account approved',
      preheader: 'Your CareBridge account has been approved.',
      paragraphs: [
        'Congratulations! Your account has been approved by the platform admin.',
        'You can now log in and access all platform features.',
      ],
      cta: { href: `${frontendBase()}/login`, label: 'Log in to CareBridge' },
      accent: BRAND.success,
    },
    ACCOUNT_SUSPENDED: {
      category: 'Account status',
      title: 'Account suspended',
      preheader: 'Your CareBridge account has been suspended.',
      paragraphs: [
        'Your account has been suspended by the platform admin.',
        'Please contact platform support for more information.',
      ],
      accent: BRAND.danger,
    },
    ADMIN_BROADCAST: {
      category: 'Platform notice',
      title: 'Message from CareBridge',
      preheader: message?.slice(0, 80) || 'Platform announcement',
      paragraphs: [escapeHtml(message)],
    },
  };

  const cfg = configs[type];
  if (cfg) {
    return buildActionEmail({ ...cfg, name, cta: cfg.cta || cta });
  }

  return buildActionEmail({
    category: 'Notification',
    title: type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    name,
    preheader: message,
    paragraphs: [escapeHtml(message)],
    cta,
  });
};

const buildNotificationEmailText = (type, data = {}, message = '', role = 'consultant') => {
  const subject = notificationEmailSubject(type, data);
  return buildActionEmailText({
    title: subject.replace(/^CareBridge — /, ''),
    name: data.name,
    paragraphs: [message],
    details: Object.entries(data)
      .filter(([k, v]) => !['email', 'phone', 'name'].includes(k) && v != null && v !== '')
      .map(([k, v]) => ({ label: k.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()), value: String(v) })),
    cta: { href: dashboardUrl(role) },
  });
};

const notificationEmailSubject = (type, data = {}) => {
  const subjects = {
    LOGIN_ALERT: 'Security alert — new login detected',
    PASSWORD_CHANGED: 'Your password was changed',
    NEW_REFERRAL: `New referral — ${data.referralCode || 'review required'}`,
    REFERRAL_ACCEPTED: `Referral accepted — ${data.referralCode || ''}`,
    REFERRAL_REJECTED: `Referral declined — ${data.referralCode || ''}`,
    REFERRAL_ESCALATED: `Referral escalated — ${data.referralCode || ''}`,
    ADMISSION_CREATED: `Patient admitted — ${data.referralCode || ''}`,
    BILL_GENERATED: 'Bill generated for admission',
    SETTLEMENT_CREATED: `Settlement submitted — ${data.hospitalName || ''}`,
    HOSPITAL_RECEIPT_UPLOADED: `Receipt uploaded — ${data.hospitalName || ''}`,
    SETTLEMENT_VERIFIED: 'Settlement payment verified',
    SETTLEMENT_REJECTED: 'Settlement receipt rejected',
    CONSULTANT_PAYOUT_UPLOADED: `Payout sent — PKR ${data.amount || ''}`,
    PAYOUT_VERIFIED: 'Payout confirmed',
    ACCOUNT_APPROVED: 'Your account has been approved',
    ACCOUNT_SUSPENDED: 'Your account has been suspended',
    ADMIN_BROADCAST: 'Message from CareBridge Health',
  };
  return subjects[type] || `CareBridge — ${type.replace(/_/g, ' ').toLowerCase()}`;
};

const verificationEmailHtml = (user, verificationUrl) =>
  buildActionEmail({
    preheader: `Verify your ${BRAND.name} account — one click to complete registration.`,
    category: 'Account verification',
    title: 'Verify your email address',
    name: user.name,
    paragraphs: [
      `Thank you for registering with <strong style="color:${BRAND.text};">${BRAND.name}</strong>. To activate your account, please confirm this email belongs to you.`,
      'This link expires in <strong>24 hours</strong>.',
    ],
    cta: { href: verificationUrl, label: 'Verify email address' },
    linkUrl: verificationUrl,
    footnote:
      '<strong style="color:#475569;">Security tip:</strong> If you did not create a CareBridge account, you can safely ignore this message.',
  });

const otpCodeBlock = (otp) => `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:28px auto;">
  <tr>
    <td align="center" style="background-color:#f8fafc;border:1px solid ${BRAND.border};border-radius:12px;padding:20px 40px;">
      <span style="font-size:34px;font-weight:800;letter-spacing:0.4em;color:${BRAND.text};font-family:'Courier New',monospace;">${escapeHtml(otp)}</span>
    </td>
  </tr>
</table>`;

const verificationOtpEmailHtml = (user, otp) =>
  buildActionEmail({
    preheader: `Your ${BRAND.name} email verification code is ${otp}.`,
    category: 'Email verification',
    title: 'Verify your email address',
    name: user.name,
    paragraphs: [
      `Thank you for registering with <strong style="color:${BRAND.text};">${BRAND.name}</strong>. Enter the 6-digit code below to confirm your email address and activate your account.`,
      otpCodeBlock(otp),
      'This code expires in <strong>10 minutes</strong>. Do not share it with anyone.',
    ],
    footnote:
      '<strong style="color:#475569;">Security tip:</strong> If you did not create a CareBridge account, you can safely ignore this message.',
  });

const verificationOtpEmailText = (user, otp) =>
  buildActionEmailText({
    title: 'Verify your email address',
    name: user.name,
    paragraphs: [
      `Your CareBridge email verification code is: ${otp}`,
      'This code expires in 10 minutes. Do not share it with anyone.',
    ],
  });

const resetPasswordEmailHtml = (user, resetUrl) =>
  buildActionEmail({
    preheader: `Reset your ${BRAND.name} password securely.`,
    category: 'Password reset',
    title: 'Reset your password',
    name: user.name,
    paragraphs: [
      'We received a request to reset your account password. Use the button below to choose a new password.',
      'This link expires in <strong>1 hour</strong> for your security.',
    ],
    cta: { href: resetUrl, label: 'Reset password' },
    linkUrl: resetUrl,
    footnote:
      '<strong style="color:#475569;">Did not request this?</strong> Ignore this email and your password will remain unchanged.',
  });

const referralSubmittedConsultantEmail = ({ consultantName, patientName, hospitalName, referralCode, urgency }) =>
  buildActionEmail({
    category: 'Referral submitted',
    title: 'Referral sent successfully',
    preheader: `Referral ${referralCode} submitted to ${hospitalName}.`,
    name: consultantName,
    paragraphs: [
      `Your referral for patient <strong>${escapeHtml(patientName)}</strong> has been submitted to <strong>${escapeHtml(hospitalName)}</strong>.`,
      'You will be notified when the hospital reviews and updates the status.',
    ],
    details: [
      { label: 'Referral code', value: referralCode },
      { label: 'Patient', value: patientName },
      { label: 'Hospital', value: hospitalName },
      { label: 'Urgency', value: urgency },
    ],
    cta: { href: `${frontendBase()}/referrals`, label: 'View my referrals' },
    accent: BRAND.success,
  });

const referralReceivedHospitalEmail = ({ hospitalName, patientName, referralCode, urgency }) =>
  buildActionEmail({
    category: 'New referral',
    title: 'New referral received',
    preheader: `Referral ${referralCode} — ${urgency} priority.`,
    name: hospitalName,
    paragraphs: [
      `A new referral has been routed to your facility with <strong>${escapeHtml(urgency)}</strong> urgency.`,
      'Please review the case and respond within the SLA deadline.',
    ],
    details: [
      { label: 'Referral code', value: referralCode },
      { label: 'Patient', value: patientName },
      { label: 'Urgency', value: urgency },
    ],
    cta: { href: `${frontendBase()}/hospital/inbox`, label: 'Open referral inbox' },
  });

/** Notify the hospital doctor selected as the referral target. */
const referralReceivedDoctorEmail = ({
  doctorName,
  consultantName,
  consultantSpecialty,
  patientName,
  hospitalName,
  referralCode,
  urgency,
  department,
}) =>
  buildActionEmail({
    category: 'New referral',
    title: 'You have been selected for a referral',
    preheader: `${consultantName} referred ${patientName} to you — ${referralCode}.`,
    name: doctorName,
    paragraphs: [
      `<strong>${escapeHtml(consultantName)}</strong>${
        consultantSpecialty ? ` (${escapeHtml(consultantSpecialty)})` : ''
      } has referred patient <strong>${escapeHtml(patientName)}</strong> to you at <strong>${escapeHtml(hospitalName)}</strong>.`,
      'Please coordinate with your hospital team to review and accept this referral.',
    ],
    details: [
      { label: 'Referral code', value: referralCode },
      { label: 'Patient', value: patientName },
      { label: 'Referring consultant', value: consultantName },
      ...(consultantSpecialty ? [{ label: 'Consultant specialty', value: consultantSpecialty }] : []),
      { label: 'Hospital', value: hospitalName },
      ...(department ? [{ label: 'Department', value: department }] : []),
      { label: 'Urgency', value: urgency },
    ],
    cta: { href: `${frontendBase()}/hospital/inbox`, label: 'Open referral inbox' },
  });

const referralStatusUpdateEmail = ({
  recipientName,
  patientName,
  referralCode,
  hospitalName,
  status,
  rejectionReason,
  recipientRole,
}) =>
  buildActionEmail({
    category: 'Referral update',
    title: `Referral ${status}`,
    preheader: `Referral ${referralCode} status updated to ${status}.`,
    name: recipientName,
    paragraphs: [
      `The status of referral for patient <strong>${escapeHtml(patientName)}</strong> (${escapeHtml(referralCode)}) has been updated.`,
      rejectionReason && status === 'rejected'
        ? `Reason: <strong>${escapeHtml(rejectionReason)}</strong>`
        : '',
      'Log in to your dashboard for full details.',
    ].filter(Boolean),
    details: [
      { label: 'Referral code', value: referralCode },
      { label: 'Patient', value: patientName },
      { label: 'Hospital', value: hospitalName },
      { label: 'New status', value: status.toUpperCase() },
    ],
    cta: {
      href: recipientRole === 'hospital' ? `${frontendBase()}/hospital/referrals` : `${frontendBase()}/referrals`,
      label: 'View referral',
    },
    accent: status === 'rejected' ? BRAND.danger : status === 'accepted' ? BRAND.success : BRAND.accent,
  });

const clinicalNoteEmail = ({ recipientName, authorName, patientName, referralCode, content, recipientRole }) =>
  buildActionEmail({
    category: 'Clinical note',
    title: 'New clinical note added',
    preheader: `New note on referral ${referralCode} for ${patientName}.`,
    name: recipientName,
    paragraphs: [
      `<strong>${escapeHtml(authorName)}</strong> added a clinical note to the referral for patient <strong>${escapeHtml(patientName)}</strong>.`,
    ],
    details: [
      { label: 'Referral code', value: referralCode },
      { label: 'Patient', value: patientName },
      { label: 'Note', value: content },
    ],
    cta: {
      href: recipientRole === 'hospital' ? `${frontendBase()}/hospital/inbox` : `${frontendBase()}/referrals`,
      label: 'View referral',
    },
  });

const verificationEmailText = (user, verificationUrl) =>
  buildActionEmailText({
    title: 'Verify your email address',
    name: user.name,
    paragraphs: [`Verify your email (expires in 24 hours): ${verificationUrl}`],
    cta: { href: verificationUrl },
  });

const resetPasswordEmailText = (user, resetUrl) =>
  buildActionEmailText({
    title: 'Reset your password',
    name: user.name,
    paragraphs: [`Reset your password (expires in 1 hour): ${resetUrl}`],
    cta: { href: resetUrl },
  });

module.exports = {
  buildActionEmail,
  buildActionEmailText,
  buildNotificationEmail,
  buildNotificationEmailText,
  notificationEmailSubject,
  verificationEmailHtml,
  verificationOtpEmailHtml,
  verificationOtpEmailText,
  resetPasswordEmailHtml,
  verificationEmailText,
  resetPasswordEmailText,
  referralSubmittedConsultantEmail,
  referralReceivedHospitalEmail,
  referralReceivedDoctorEmail,
  referralStatusUpdateEmail,
  clinicalNoteEmail,
};
