const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ['consultant', 'hospital', 'admin', 'laboratory'],
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    phone: {
      type: String,
      required: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    // ── Sub-user linkage (team members added from inside a portal) ──
    // A hospital/lab staff account carries its parent facility id here and owns
    // NO Hospital/Laboratory document of its own — so it is never treated as a
    // separate facility. Owner accounts leave these unset and resolve via their
    // profile's userId, exactly as before.
    hospitalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hospital',
      default: null,
      index: true,
    },
    labId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Laboratory',
      default: null,
      index: true,
    },
    // Who created this account (owner/admin who added the sub-user). Optional.
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    status: {
      type: String,
      enum: ['pending', 'active', 'suspended'],
      default: 'pending',
    },
    // Email verification (kept for backward compat; not required during new reg flow)
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: String,
    emailVerificationExpires: Date,
    // Phone (WhatsApp) verification
    isPhoneVerified: {
      type: Boolean,
      default: false,
    },
    resetPasswordToken: String,
    resetPasswordExpires: Date,
  },
  { timestamps: true }
);

UserSchema.methods.isAncestorOf = async function (otherUserId) {
  if (!otherUserId) return false;
  let currentId = otherUserId;
  while (currentId) {
    const user = await this.constructor.findById(currentId).select('createdBy');
    if (!user) break;
    if (user.createdBy && user.createdBy.toString() === this._id.toString()) {
      return true;
    }
    currentId = user.createdBy;
  }
  return false;
};

module.exports = mongoose.model('User', UserSchema);
