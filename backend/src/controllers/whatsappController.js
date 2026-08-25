/**
 * Admin WhatsApp Controller
 * Allows admin to send individual or bulk WhatsApp messages to users.
 */

const User = require('../models/User');
const {
  sendWhatsApp,
  normalisePhone,
  isWhatsAppConfigured,
  isProductionWhatsAppReady,
  USE_TEMPLATES,
} = require('../utils/whatsappService');
const { logAction } = require('../utils/logger');

/**
 * GET /admin/whatsapp/status
 */
exports.getWhatsAppStatus = async (req, res) => {
  const configured = isWhatsAppConfigured();
  const productionReady = isProductionWhatsAppReady();
  res.json({
    success: true,
    data: {
      configured,
      mockMode: !configured,
      useTemplates: USE_TEMPLATES,
      productionReady,
      templates: {
        otp: process.env.META_WA_TEMPLATE_OTP || null,
        alert: process.env.META_WA_TEMPLATE_ALERT || process.env.META_WA_TEMPLATE_UTILITY || null,
        language: process.env.META_WA_TEMPLATE_LANGUAGE || 'en',
      },
      message: !configured
        ? 'Set META_WA_PHONE_NUMBER_ID and META_WA_ACCESS_TOKEN in .env.'
        : productionReady
          ? 'Live mode: approved templates will be used for all users.'
          : USE_TEMPLATES
            ? 'Templates enabled but META_WA_TEMPLATE_OTP and META_WA_TEMPLATE_ALERT must both be set and approved in Meta.'
            : 'Dev mode: free-form text only reaches Meta test numbers. Set META_WA_USE_TEMPLATES=true for real users.',
    },
  });
};

/**
 * GET /admin/whatsapp/users
 * List all active users with phone numbers for the message composer.
 */
exports.listUsersForWhatsApp = async (req, res) => {
  try {
    const { role, search } = req.query;
    const filter = { status: 'active' };
    if (role && ['consultant', 'hospital'].includes(role)) {
      filter.role = role;
    }
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const users = await User.find(filter)
      .select('name email phone role isPhoneVerified')
      .sort({ name: 1 })
      .lean();

    res.json({ success: true, data: users });
  } catch (error) {
    console.error('[ADMIN_WA] listUsersForWhatsApp error:', error);
    res.status(500).json({ success: false, message: 'Failed to list users' });
  }
};

/**
 * POST /admin/whatsapp/send
 * Send a WhatsApp message to one or more users.
 * Body: { userIds: ['...'], message: '...' }  — send to selected users
 * OR:   { role: 'consultant'|'hospital'|'all', message: '...' } — broadcast
 */
exports.sendWhatsAppMessage = async (req, res) => {
  try {
    const { userIds, role, message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }
    if (message.trim().length > 1500) {
      return res.status(400).json({ success: false, message: 'Message too long (max 1500 characters)' });
    }

    let targetUsers = [];

    if (Array.isArray(userIds) && userIds.length > 0) {
      // Individual / selected users
      targetUsers = await User.find({ _id: { $in: userIds }, status: 'active' })
        .select('name phone email role')
        .lean();
    } else if (role) {
      // Broadcast by role
      const filter = { status: 'active' };
      if (role !== 'all') filter.role = role;
      targetUsers = await User.find(filter).select('name phone email role').lean();
    } else {
      return res.status(400).json({ success: false, message: 'Provide userIds or role for broadcast' });
    }

    if (targetUsers.length === 0) {
      return res.status(404).json({ success: false, message: 'No target users found' });
    }

    // Build the message with admin branding
    const body =
      `📢 *CareBridge Health* — Admin Message\n\n` +
      `${message.trim()}\n\n` +
      `— CareBridge Health Platform`;

    const results = await Promise.allSettled(
      targetUsers.map(async (u) => {
        if (!u.phone?.trim()) {
          return { userId: u._id, name: u.name, success: false, error: 'No phone on file' };
        }
        const result = await sendWhatsApp(u.phone, body);
        return { userId: u._id, name: u.name, phone: normalisePhone(u.phone), ...result };
      })
    );

    const fulfilled = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
    const sent = fulfilled.filter((v) => v.success).length;
    const mocked = fulfilled.filter((v) => v.mocked).length;
    const failed = results.length - sent;

    // Audit log
    await logAction({
      actorId: req.user._id || req.user.id,
      action: 'ADMIN_WHATSAPP_SENT',
      entityModel: 'User',
      details: { message: message.slice(0, 100), role: role || 'selected', sent, failed },
    });

    const mockNote = mocked > 0 ? ' (mock mode — check server console)' : '';
    res.json({
      success: true,
      message: `Message dispatched to ${sent} user(s).${failed > 0 ? ` ${failed} failed.` : ''}${mockNote}`,
      data: {
        total: results.length,
        sent,
        failed,
        mocked,
        mockMode: !isWhatsAppConfigured(),
      },
    });
  } catch (error) {
    console.error('[ADMIN_WA] sendWhatsAppMessage error:', error);
    res.status(500).json({ success: false, message: 'Failed to send WhatsApp messages' });
  }
};
