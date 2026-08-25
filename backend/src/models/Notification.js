const mongoose = require('mongoose');

/**
 * In-app notification. One document per delivered alert, keyed to the
 * recipient User. Drives the notification bell + unread counter and is
 * pushed to the browser in real time via the `user:<id>` socket room.
 */
const NotificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    role: { type: String },
    type: { type: String, required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    // Lightweight context (referralCode, amount, status…) — never PII like email/phone.
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Fast unread lookups + newest-first listing per user.
NotificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', NotificationSchema);
