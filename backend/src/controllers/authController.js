const User = require('../models/User');
const Consultant = require('../models/Consultant');
const Hospital = require('../models/Hospital');
const Laboratory = require('../models/Laboratory');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendVerificationEmail, sendEmailOtp, sendResetPasswordEmail } = require('../utils/emailService');
const { normalisePhone } = require('../utils/whatsappService');
const { generateOtp, verifyOtp } = require('../utils/otpService');
const notificationService = require('../services/notificationService');

const ALLOWED_WARDS = ['General', 'Private', 'ICU', 'NICU', 'PICU', 'HDU', 'Burns', 'Maternity', 'Psychiatric', 'Cardiac'];

const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id.toString(),
      role: user.role,
      name: user.name,
      createdBy: user.createdBy ? user.createdBy.toString() : null,
    },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
};

const generateRefreshToken = (user) => {
  return jwt.sign({ id: user._id.toString() }, process.env.JWT_REFRESH_SECRET, { expiresIn: '30d' });
};

function parseHospitalRegistration(body) {
  const departments = body.departments;
  if (!Array.isArray(departments) || departments.length === 0) {
    return { error: 'Select at least one department' };
  }
  const cleanedDepts = [...new Set(departments.map((d) => String(d).trim()).filter(Boolean))];
  if (cleanedDepts.length === 0) {
    return { error: 'Select at least one department' };
  }

  const lat = parseFloat(body.location?.lat ?? body.lat);
  const lng = parseFloat(body.location?.lng ?? body.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { error: 'Valid location latitude and longitude are required' };
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { error: 'Latitude or longitude out of range' };
  }

  const rows = body.bedsInventory || body.beds;
  if (!Array.isArray(rows) || rows.length === 0) {
    return { error: 'Bed inventory is required for all wards' };
  }

  const inventory = [];
  for (const row of rows) {
    const ward = row.ward;
    if (!ALLOWED_WARDS.includes(ward)) {
      continue;
    }
    const totalBeds = Number(row.totalBeds);
    const availableBeds = Number(row.availableBeds);
    if (!Number.isFinite(totalBeds) || totalBeds < 0) {
      return { error: `Invalid total beds for ${ward}` };
    }
    if (!Number.isFinite(availableBeds) || availableBeds < 0 || availableBeds > totalBeds) {
      return { error: `Invalid available beds for ${ward}` };
    }
    inventory.push({
      ward,
      totalBeds,
      availableBeds,
      occupiedBeds: Math.max(0, totalBeds - availableBeds),
    });
  }

  const wardsPresent = new Set(inventory.map((i) => i.ward));
  for (const w of ALLOWED_WARDS) {
    if (!wardsPresent.has(w)) {
      return { error: `Bed row required for ward: ${w}` };
    }
  }

  const general = inventory.find((i) => i.ward === 'General');
  if (!general || general.availableBeds < 1) {
    return { error: 'General ward must have at least 1 available bed' };
  }

  return {
    departments: cleanedDepts,
    location: { type: 'Point', coordinates: [lng, lat] },
    bedsInventory: inventory,
  };
}

exports.register = async (req, res) => {
  try {
    const { name, email, phone, password, role } = req.body;

    if (!['consultant', 'hospital', 'laboratory'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role for registration' });
    }

    if (!name?.trim() || !email?.trim() || !phone?.trim() || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, phone, and password are required' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email format' });
    }
    const phoneClean = phone.replace(/[\s\-()]/g, '');
    const phoneRegex = /^((\+92)|(0092)|0)?(3\d{9}|(21|42|51|91|81|61|22|71)\d{7})$/;
    if (!phoneRegex.test(phoneClean)) {
      return res.status(400).json({ success: false, message: 'Invalid phone number format' });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long' });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const e164Phone = normalisePhone(phoneClean);

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: e164Phone || phoneClean,
      passwordHash,
      role,
      status: 'pending',
      // Phone (WhatsApp) verification is not used — email is the only verification
      // channel, so the phone flag is left true and the email flag starts false.
      isPhoneVerified: true,
      isEmailVerified: false,
    });

    if (role === 'consultant') {
      const pmdc = String(req.body.pmdcNumber || '').trim();
      if (!pmdc || /^pending-/i.test(pmdc)) {
        await User.deleteOne({ _id: user._id });
        return res.status(400).json({ success: false, message: 'Valid PMDC number is required' });
      }

      const cnic = String(req.body.cnic || '').trim();
      const cnicRegex = /^\d{5}-\d{7}-\d{1}$/;
      if (!cnicRegex.test(cnic)) {
        await User.deleteOne({ _id: user._id });
        return res.status(400).json({ success: false, message: 'CNIC must be in the format XXXXX-XXXXXXX-X' });
      }

      const verificationDocuments = req.body.verificationDocuments || [];
      if (!verificationDocuments.some((d) => d.name === 'PMDC Certificate' && d.url)) {
        await User.deleteOne({ _id: user._id });
        return res.status(400).json({ success: false, message: 'PMDC Certificate upload is required' });
      }
      if (!verificationDocuments.some((d) => d.name === 'CNIC' && d.url)) {
        await User.deleteOne({ _id: user._id });
        return res.status(400).json({ success: false, message: 'CNIC document upload is required' });
      }

      const dupPmdc = await Consultant.findOne({ pmdcNumber: pmdc });
      if (dupPmdc) {
        await User.deleteOne({ _id: user._id });
        return res.status(400).json({ success: false, message: 'PMDC number already registered' });
      }

      // Optional geo (auto-detected location)
      const cLat = parseFloat(req.body.lat);
      const cLng = parseFloat(req.body.lng);
      const cLocation =
        Number.isFinite(cLat) && Number.isFinite(cLng)
          ? { type: 'Point', coordinates: [cLng, cLat] }
          : undefined;

      await Consultant.create({
        userId: user._id,
        pmdcNumber: pmdc,
        cnic,
        specialty: (req.body.specialty || 'General').trim(),
        clinicName: req.body.clinicName?.trim(),
        clinicAddress: req.body.clinicAddress?.trim(),
        ...(cLocation ? { location: cLocation } : {}),
        verificationDocuments,
      });
    } else if (role === 'hospital') {
      const regNum = String(req.body.registrationNumber || '').trim();
      if (!regNum) {
        await User.deleteOne({ _id: user._id });
        return res.status(400).json({ success: false, message: 'Hospital registration number is required' });
      }

      const parsed = parseHospitalRegistration(req.body);
      if (parsed.error) {
        await User.deleteOne({ _id: user._id });
        return res.status(400).json({ success: false, message: parsed.error });
      }

      const representativeCnic = String(req.body.representativeCnic || req.body.cnic || '').trim();
      const cnicRegex = /^\d{5}-\d{7}-\d{1}$/;
      if (!cnicRegex.test(representativeCnic)) {
        await User.deleteOne({ _id: user._id });
        return res.status(400).json({
          success: false,
          message: 'Representative CNIC must be in the format XXXXX-XXXXXXX-X',
        });
      }

      const registrationDocuments = req.body.registrationDocuments || [];
      if (!registrationDocuments.some((d) => d.name === 'CNIC' && d.url)) {
        await User.deleteOne({ _id: user._id });
        return res.status(400).json({ success: false, message: 'CNIC document upload is required' });
      }
      if (!registrationDocuments.some((d) => d.name === 'SHCC License' && d.url)) {
        await User.deleteOne({ _id: user._id });
        return res.status(400).json({ success: false, message: 'SHCC License upload is required' });
      }

      await Hospital.create({
        userId: user._id,
        hospitalName: (req.body.hospitalName || name).trim(),
        registrationNumber: regNum,
        representativeCnic,
        address: req.body.address?.trim(),
        departments: parsed.departments,
        location: parsed.location,
        bedsInventory: parsed.bedsInventory,
        ratePackages: Array.isArray(req.body.ratePackages) ? req.body.ratePackages : [],
        registrationDocuments,
        isActive: false,
      });
    } else if (role === 'laboratory') {
      const regNum = String(req.body.registrationNumber || '').trim();
      if (!regNum) {
        await User.deleteOne({ _id: user._id });
        return res.status(400).json({ success: false, message: 'Laboratory registration number is required' });
      }

      const representativeCnic = String(req.body.representativeCnic || req.body.cnic || '').trim();
      const cnicRegex = /^\d{5}-\d{7}-\d{1}$/;
      if (!cnicRegex.test(representativeCnic)) {
        await User.deleteOne({ _id: user._id });
        return res.status(400).json({
          success: false,
          message: 'Representative CNIC must be in the format XXXXX-XXXXXXX-X',
        });
      }

      const registrationDocuments = req.body.registrationDocuments || [];
      if (!registrationDocuments.some((d) => d.name === 'CNIC' && d.url)) {
        await User.deleteOne({ _id: user._id });
        return res.status(400).json({ success: false, message: 'CNIC document upload is required' });
      }
      if (!registrationDocuments.some((d) => d.name === 'Lab License' && d.url)) {
        await User.deleteOne({ _id: user._id });
        return res.status(400).json({ success: false, message: 'Lab License upload is required' });
      }

      // Optional geo + initial test catalog
      const lat = parseFloat(req.body.lat);
      const lng = parseFloat(req.body.lng);
      const location =
        Number.isFinite(lat) && Number.isFinite(lng)
          ? { type: 'Point', coordinates: [lng, lat] }
          : undefined;
      const testCatalog = Array.isArray(req.body.testCatalog)
        ? req.body.testCatalog
            .filter((t) => t && t.testName && Number(t.price) >= 0)
            .map((t) => ({
              testName: String(t.testName).trim(),
              price: Math.max(0, Number(t.price) || 0),
              turnaroundHours: Math.max(0, Number(t.turnaroundHours) || 24),
            }))
        : [];

      await Laboratory.create({
        userId: user._id,
        labName: (req.body.labName || name).trim(),
        registrationNumber: regNum,
        representativeCnic,
        city: req.body.city?.trim(),
        area: req.body.area?.trim(),
        address: req.body.address?.trim(),
        ...(location ? { location } : {}),
        testCatalog,
        registrationDocuments,
        isActive: false,
      });
    }

    // Send a 6-digit email verification OTP (keyed by the user's email).
    const emailOtp = generateOtp(user.email);
    sendEmailOtp(user, emailOtp).then((r) => {
      if (!r.success) console.error('[REG] Email OTP send failed:', r.error);
    }).catch((err) => console.error('[REG] Email OTP send error:', err.message || err));

    // Alert admins so the pending approval surfaces in real time.
    notificationService.notifyNewRegistration(user).catch((err) =>
      console.error('New registration admin notification failed:', err.message)
    );

    res.status(201).json({
      success: true,
      message: 'Registration successful. We sent a 6-digit verification code to your email.',
      data: { userId: user._id, role: user.role, status: user.status, email: user.email },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, message: 'Server error during registration' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email: email?.toLowerCase()?.trim() });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Email verification is required before login. Phone (WhatsApp) verification
    // is no longer used.
    if (!user.isEmailVerified) {
      return res.status(403).json({
        success: false,
        message: 'Please verify your email address before logging in.',
        needsEmailVerification: true,
        email: user.email,
      });
    }

    if (user.status === 'pending') {
      return res.status(403).json({ success: false, message: 'Account is pending approval' });
    }
    if (user.status === 'suspended') {
      return res.status(403).json({ success: false, message: 'Account is suspended' });
    }

    const accessToken = generateToken(user);
    const refreshToken = generateRefreshToken(user);

    // Send login notification via WhatsApp + email (async, non-blocking)
    notificationService.notifyLoginAlert(user).catch((e) =>
      console.error('Login notification error:', e.message)
    );

    res.status(200).json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          createdBy: user.createdBy,
        },
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error during login' });
  }
};

exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).json({ success: false, message: 'Verification token is required' });
    }
    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: new Date() },
    });
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired verification token' });
    }
    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();
    res.status(200).json({ success: true, message: 'Email verified successfully.' });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ success: false, message: 'Server error during email verification' });
  }
};

/**
 * Verify email with a 6-digit OTP.
 * POST /auth/verify-email-otp   { email, otp }
 */
exports.verifyEmailOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP are required' });
    }

    const emailKey = String(email).toLowerCase().trim();
    const result = verifyOtp(emailKey, otp);
    if (!result.valid) {
      return res.status(400).json({ success: false, message: result.reason });
    }

    const user = await User.findOne({ email: emailKey });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found for this email' });
    }

    user.isEmailVerified = true;
    await user.save();

    res.status(200).json({ success: true, message: 'Email verified successfully. You can now log in.' });
  } catch (error) {
    console.error('Email OTP verification error:', error);
    res.status(500).json({ success: false, message: 'Server error during email verification' });
  }
};

/**
 * Resend the email verification OTP.
 * POST /auth/resend-email-otp   { email }
 */
exports.resendEmailOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const emailKey = String(email).toLowerCase().trim();
    const user = await User.findOne({ email: emailKey });
    if (!user) {
      return res.status(404).json({ success: false, message: 'No account found for this email' });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({ success: false, message: 'Email is already verified' });
    }

    const otp = generateOtp(emailKey);
    const sent = await sendEmailOtp(user, otp);
    if (!sent.success) {
      return res.status(502).json({
        success: false,
        message: 'Could not send the verification code. Please try again in a moment.',
      });
    }

    res.status(200).json({
      success: true,
      message: sent.mocked
        ? 'Verification code generated (dev mock — see server console / uploads/emails).'
        : 'A new verification code has been sent to your email.',
      mocked: Boolean(sent.mocked),
    });
  } catch (error) {
    console.error('Resend email OTP error:', error);
    res.status(500).json({ success: false, message: 'Server error during OTP resend' });
  }
};

exports.resendVerification = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({ success: false, message: 'Email is already verified' });
    }

    const emailToken = crypto.randomBytes(32).toString('hex');
    const emailTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    user.emailVerificationToken = emailToken;
    user.emailVerificationExpires = emailTokenExpires;
    await user.save();

    await sendVerificationEmail(user, emailToken);

    res.status(200).json({ success: true, message: 'A new verification email has been sent.' });
  } catch (error) {
    console.error('Resend email error:', error);
    res.status(500).json({ success: false, message: 'Server error during email resend' });
  }
};

exports.refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ success: false, message: 'refreshToken is required' });
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch {
      return res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
    }

    const user = await User.findById(decoded.id);
    if (!user || user.status !== 'active') {
      return res.status(401).json({ success: false, message: 'User not eligible for refresh' });
    }

    const accessToken = generateToken(user);
    // Rolling refresh token: issue a fresh one on every refresh so an active
    // user's session keeps sliding forward and never expires out from under them.
    const newRefreshToken = generateRefreshToken(user);
    res.status(200).json({
      success: true,
      data: { accessToken, refreshToken: newRefreshToken },
    });
  } catch (error) {
    console.error('Refresh error:', error);
    res.status(500).json({ success: false, message: 'Server error during refresh' });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(200).json({ success: true, message: 'If that email exists in our system, we have sent a reset link to it.' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = resetExpires;
    await user.save();

    await sendResetPasswordEmail(user, resetToken);

    res.status(200).json({
      success: true,
      message: 'Password reset link sent successfully. Please check your email.',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, message: 'Server error during forgot password process' });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ success: false, message: 'Token and new password are required' });
    }

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired password reset token' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    user.passwordHash = passwordHash;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    // Notify via WhatsApp + email
    notificationService.notifyPasswordChanged(user).catch((e) =>
      console.error('Password changed notification error:', e.message)
    );

    res.status(200).json({
      success: true,
      message: 'Password has been reset successfully. You can now log in with your new password.',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, message: 'Server error during password reset process' });
  }
};

exports.getPlatformBrandingSettings = async (req, res) => {
  try {
    const PlatformSettings = require('../models/PlatformSettings');
    let settings = await PlatformSettings.findOne().sort({ updatedAt: -1 });
    if (!settings) {
      settings = {
        platformName: 'CareBridge',
        logoUrl: '',
        primaryColor: '#4f46e5',
        accentColor: '#06b6d4',
        faviconUrl: '',
      };
    }
    res.json({
      success: true,
      data: {
        platformName: settings.platformName || 'CareBridge',
        logoUrl: settings.logoUrl || '',
        primaryColor: settings.primaryColor || '#4f46e5',
        accentColor: settings.accentColor || '#06b6d4',
        faviconUrl: settings.faviconUrl || '',
      }
    });
  } catch (error) {
    console.error('getPlatformBrandingSettings error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch platform branding settings' });
  }
};
