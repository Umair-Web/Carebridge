/**
 * Team Controller — lets facility owners/staff and admins add extra login
 * accounts that share a portal.
 *
 *  • Hospital team  → Users with role 'hospital' + hospitalId set (NO Hospital doc)
 *  • Lab team       → Users with role 'laboratory' + labId set (NO Laboratory doc)
 *  • Admin team     → Users with role 'admin'
 *
 * Sub-users own no facility document, so they are never treated as a separate
 * hospital/lab anywhere in the system. They resolve their facility through the
 * hospitalId/labId link (see utils/resolveOrg.js) and receive the same emails /
 * WhatsApp / in-app notifications as the owner (see the team fan-out in
 * notificationService + the referral/settlement controllers).
 */

const bcrypt = require('bcrypt');
const User = require('../models/User');
const { getHospitalForUser, getLabForUser } = require('../utils/resolveOrg');
const { sendEmail } = require('../utils/emailService');
const { normalisePhone } = require('../utils/whatsappService');
const { logAction } = require('../utils/logger');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^((\+92)|(0092)|0)?(3\d{9}|(21|42|51|91|81|61|22|71)\d{7})$/;

/** Validate the shared create-user payload. Returns { error } or a clean object. */
function validateNewUserPayload(body) {
  const name = String(body.name || '').trim();
  const email = String(body.email || '').toLowerCase().trim();
  const phoneRaw = String(body.phone || '').trim();
  const password = body.password;

  if (!name || !email || !phoneRaw || !password) {
    return { error: 'Name, email, phone, and password are required' };
  }
  if (!EMAIL_RE.test(email)) return { error: 'Invalid email format' };

  const phoneClean = phoneRaw.replace(/[\s\-()]/g, '');
  if (!PHONE_RE.test(phoneClean)) return { error: 'Invalid phone number format' };
  if (String(password).length < 8) {
    return { error: 'Password must be at least 8 characters long' };
  }
  return { name, email, phone: normalisePhone(phoneClean) || phoneClean, password };
}

/** Fire-and-forget welcome email with the credentials the creator set. */
function sendWelcomeEmail({ name, email, password, portalLabel }) {
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#1f2937">
      <h2 style="color:#2980b9">Welcome to CareBridge Health</h2>
      <p>Hello <strong>${name}</strong>,</p>
      <p>An account has been created for you to access the <strong>${portalLabel}</strong>.</p>
      <table style="border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:4px 12px;color:#6b7280">Email</td><td style="padding:4px 12px"><strong>${email}</strong></td></tr>
        <tr><td style="padding:4px 12px;color:#6b7280">Password</td><td style="padding:4px 12px"><strong>${password}</strong></td></tr>
      </table>
      <p>You can log in right away. For your security, please change your password after your first login.</p>
      <p style="color:#6b7280;font-size:13px">— CareBridge Health</p>
    </div>`;
  sendEmail({
    to: email,
    subject: 'Your CareBridge Health account is ready',
    html,
    text: `Welcome to CareBridge Health.\n\nAccount for the ${portalLabel}:\nEmail: ${email}\nPassword: ${password}\n\nPlease change your password after your first login.`,
  }).catch((err) => console.error('[TEAM] Welcome email failed:', err.message || err));
}

/** Shared creation routine for a linked sub-user (hospital or lab). */
async function createFacilitySubUser({ req, res, role, link, portalLabel }) {
  const parsed = validateNewUserPayload(req.body);
  if (parsed.error) {
    return res.status(400).json({ success: false, message: parsed.error });
  }

  const exists = await User.findOne({ email: parsed.email });
  if (exists) {
    return res.status(400).json({ success: false, message: 'Email already exists' });
  }

  const passwordHash = await bcrypt.hash(parsed.password, 12);
  const user = await User.create({
    role,
    name: parsed.name,
    email: parsed.email,
    phone: parsed.phone,
    passwordHash,
    status: 'active',
    isEmailVerified: true,
    isPhoneVerified: true,
    createdBy: req.user.id,
    ...link, // { hospitalId } or { labId }
  });

  sendWelcomeEmail({ name: parsed.name, email: parsed.email, password: parsed.password, portalLabel });

  await logAction({
    req,
    action: 'TEAM_MEMBER_ADDED',
    entityId: user._id,
    entityModel: 'User',
    details: { email: user.email, role, ...link },
  }).catch(() => {});

  const safe = user.toObject();
  delete safe.passwordHash;
  return res.status(201).json({ success: true, message: 'Team member added', data: safe });
}

// ─────────────────────────── Hospital team ───────────────────────────

exports.listHospitalUsers = async (req, res) => {
  try {
    const hospital = await getHospitalForUser(req.user);
    if (!hospital) return res.status(404).json({ success: false, message: 'Hospital profile not found' });

    const users = await User.find({ hospitalId: hospital._id })
      .select('-passwordHash')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, data: users });
  } catch (e) {
    console.error('[TEAM] listHospitalUsers:', e);
    res.status(500).json({ success: false, message: 'Failed to list team members' });
  }
};

exports.addHospitalUser = async (req, res) => {
  try {
    const hospital = await getHospitalForUser(req.user);
    if (!hospital) return res.status(404).json({ success: false, message: 'Hospital profile not found' });
    return createFacilitySubUser({
      req,
      res,
      role: 'hospital',
      link: { hospitalId: hospital._id },
      portalLabel: `${hospital.hospitalName} hospital portal`,
    });
  } catch (e) {
    console.error('[TEAM] addHospitalUser:', e);
    res.status(500).json({ success: false, message: 'Failed to add team member' });
  }
};

exports.removeHospitalUser = async (req, res) => {
  try {
    const hospital = await getHospitalForUser(req.user);
    if (!hospital) return res.status(404).json({ success: false, message: 'Hospital profile not found' });

    if (String(req.params.id) === String(req.user.id)) {
      return res.status(400).json({ success: false, message: 'You cannot remove your own account' });
    }
    // Scoped to THIS hospital's sub-users only — the owner (no hospitalId) can never be removed here.
    const target = await User.findOne({ _id: req.params.id, hospitalId: hospital._id });
    if (!target) return res.status(404).json({ success: false, message: 'Team member not found' });

    if (!target.createdBy) {
      return res.status(400).json({ success: false, message: 'You cannot remove the main/primary user account' });
    }

    if (await target.isAncestorOf(req.user.id)) {
      return res.status(400).json({
        success: false,
        message: 'You cannot remove a user who is the creator (or ancestor creator) of your account',
      });
    }

    await User.deleteOne({ _id: target._id });
    await logAction({
      req,
      action: 'TEAM_MEMBER_REMOVED',
      entityId: target._id,
      entityModel: 'User',
      details: { email: target.email, hospitalId: hospital._id },
    }).catch(() => {});
    res.json({ success: true, message: 'Team member removed' });
  } catch (e) {
    console.error('[TEAM] removeHospitalUser:', e);
    res.status(500).json({ success: false, message: 'Failed to remove team member' });
  }
};

// ─────────────────────────── Lab team ───────────────────────────

exports.listLabUsers = async (req, res) => {
  try {
    const lab = await getLabForUser(req.user);
    if (!lab) return res.status(404).json({ success: false, message: 'Laboratory profile not found' });

    const users = await User.find({ labId: lab._id })
      .select('-passwordHash')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, data: users });
  } catch (e) {
    console.error('[TEAM] listLabUsers:', e);
    res.status(500).json({ success: false, message: 'Failed to list team members' });
  }
};

exports.addLabUser = async (req, res) => {
  try {
    const lab = await getLabForUser(req.user);
    if (!lab) return res.status(404).json({ success: false, message: 'Laboratory profile not found' });
    return createFacilitySubUser({
      req,
      res,
      role: 'laboratory',
      link: { labId: lab._id },
      portalLabel: `${lab.labName} laboratory portal`,
    });
  } catch (e) {
    console.error('[TEAM] addLabUser:', e);
    res.status(500).json({ success: false, message: 'Failed to add team member' });
  }
};

exports.removeLabUser = async (req, res) => {
  try {
    const lab = await getLabForUser(req.user);
    if (!lab) return res.status(404).json({ success: false, message: 'Laboratory profile not found' });

    if (String(req.params.id) === String(req.user.id)) {
      return res.status(400).json({ success: false, message: 'You cannot remove your own account' });
    }
    const target = await User.findOne({ _id: req.params.id, labId: lab._id });
    if (!target) return res.status(404).json({ success: false, message: 'Team member not found' });

    if (!target.createdBy) {
      return res.status(400).json({ success: false, message: 'You cannot remove the main/primary user account' });
    }

    if (await target.isAncestorOf(req.user.id)) {
      return res.status(400).json({
        success: false,
        message: 'You cannot remove a user who is the creator (or ancestor creator) of your account',
      });
    }

    await User.deleteOne({ _id: target._id });
    await logAction({
      req,
      action: 'TEAM_MEMBER_REMOVED',
      entityId: target._id,
      entityModel: 'User',
      details: { email: target.email, labId: lab._id },
    }).catch(() => {});
    res.json({ success: true, message: 'Team member removed' });
  } catch (e) {
    console.error('[TEAM] removeLabUser:', e);
    res.status(500).json({ success: false, message: 'Failed to remove team member' });
  }
};

// ─────────────────────────── Admin team ───────────────────────────

exports.listAdmins = async (req, res) => {
  try {
    const admins = await User.find({ role: 'admin' })
      .select('-passwordHash')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, data: admins });
  } catch (e) {
    console.error('[TEAM] listAdmins:', e);
    res.status(500).json({ success: false, message: 'Failed to list admins' });
  }
};

exports.addAdmin = async (req, res) => {
  try {
    const parsed = validateNewUserPayload(req.body);
    if (parsed.error) return res.status(400).json({ success: false, message: parsed.error });

    const exists = await User.findOne({ email: parsed.email });
    if (exists) return res.status(400).json({ success: false, message: 'Email already exists' });

    const passwordHash = await bcrypt.hash(parsed.password, 12);
    const user = await User.create({
      role: 'admin',
      name: parsed.name,
      email: parsed.email,
      phone: parsed.phone,
      passwordHash,
      status: 'active',
      isEmailVerified: true,
      isPhoneVerified: true,
      createdBy: req.user.id,
    });

    sendWelcomeEmail({
      name: parsed.name,
      email: parsed.email,
      password: parsed.password,
      portalLabel: 'CareBridge admin portal',
    });

    await logAction({
      req,
      action: 'ADMIN_ADDED',
      entityId: user._id,
      entityModel: 'User',
      details: { email: user.email },
    }).catch(() => {});

    const safe = user.toObject();
    delete safe.passwordHash;
    res.status(201).json({ success: true, message: 'Admin added', data: safe });
  } catch (e) {
    console.error('[TEAM] addAdmin:', e);
    res.status(500).json({ success: false, message: 'Failed to add admin' });
  }
};

exports.removeAdmin = async (req, res) => {
  try {
    if (String(req.params.id) === String(req.user.id)) {
      return res.status(400).json({ success: false, message: 'You cannot remove your own admin account' });
    }
    const target = await User.findOne({ _id: req.params.id, role: 'admin' });
    if (!target) return res.status(404).json({ success: false, message: 'Admin not found' });

    if (!target.createdBy) {
      return res.status(400).json({ success: false, message: 'You cannot remove the main/primary user account' });
    }

    if (await target.isAncestorOf(req.user.id)) {
      return res.status(400).json({
        success: false,
        message: 'You cannot remove a user who is the creator (or ancestor creator) of your account',
      });
    }

    // Never allow removing the last admin.
    const adminCount = await User.countDocuments({ role: 'admin' });
    if (adminCount <= 1) {
      return res.status(400).json({ success: false, message: 'Cannot remove the last remaining admin' });
    }

    await User.deleteOne({ _id: target._id });
    await logAction({
      req,
      action: 'ADMIN_REMOVED',
      entityId: target._id,
      entityModel: 'User',
      details: { email: target.email },
    }).catch(() => {});
    res.json({ success: true, message: 'Admin removed' });
  } catch (e) {
    console.error('[TEAM] removeAdmin:', e);
    res.status(500).json({ success: false, message: 'Failed to remove admin' });
  }
};
