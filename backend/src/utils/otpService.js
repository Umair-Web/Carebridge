/**
 * OTP Service
 * Generates 6-digit numeric OTPs for verification. The store key is any stable
 * identifier — an E.164 phone number or a lowercased email address.
 * Stores them in memory with a 10-minute TTL.
 * In production, replace the in-memory store with Redis.
 */

const crypto = require('crypto');

// In-memory store: Map<key, { otp, expiresAt, attempts }>  (key = phone or email)
const otpStore = new Map();

const OTP_TTL_MS = 10 * 60 * 1000;    // 10 minutes
const MAX_ATTEMPTS = 5;

/**
 * Generate a 6-digit OTP and store it for the given phone number.
 * Calling this again for the same phone invalidates the previous OTP.
 * @param {string} phone - E.164 normalised phone
 * @returns {string} otp
 */
const generateOtp = (phone) => {
  const otp = crypto.randomInt(100000, 999999).toString();
  otpStore.set(phone, {
    otp,
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0,
  });
  return otp;
};

/**
 * Verify an OTP for a given phone number.
 * @param {string} phone
 * @param {string} submittedOtp
 * @returns {{ valid: boolean, reason?: string }}
 */
const verifyOtp = (phone, submittedOtp) => {
  const record = otpStore.get(phone);

  if (!record) {
    return { valid: false, reason: 'No OTP found for this number. Please request a new code.' };
  }

  if (Date.now() > record.expiresAt) {
    otpStore.delete(phone);
    return { valid: false, reason: 'OTP has expired. Please request a new code.' };
  }

  record.attempts += 1;

  if (record.attempts > MAX_ATTEMPTS) {
    otpStore.delete(phone);
    return { valid: false, reason: 'Too many incorrect attempts. Please request a new code.' };
  }

  if (record.otp !== String(submittedOtp).trim()) {
    return { valid: false, reason: `Incorrect code. ${MAX_ATTEMPTS - record.attempts} attempt(s) remaining.` };
  }

  // Valid — remove from store
  otpStore.delete(phone);
  return { valid: true };
};

/**
 * Check whether a phone number has a live (non-expired) OTP pending.
 * Useful to rate-limit resend requests.
 */
const hasLiveOtp = (phone) => {
  const record = otpStore.get(phone);
  if (!record) return false;
  if (Date.now() > record.expiresAt) {
    otpStore.delete(phone);
    return false;
  }
  return true;
};

/**
 * Delete OTP for a phone (e.g. after user is marked verified server-side).
 */
const clearOtp = (phone) => otpStore.delete(phone);

module.exports = { generateOtp, verifyOtp, hasLiveOtp, clearOtp };
