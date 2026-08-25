const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema(
  {
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true }, // e.g. 'REFERRAL_STATUS_CHANGE', 'USER_APPROVAL'
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true }, // ID of the referral, user, etc.
    entityModel: { type: String, required: true }, // e.g. 'Referral', 'User'
    details: { type: Object }, // Snapshot of changes or metadata
    ipAddress: { type: String },
    userAgent: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AuditLog', AuditLogSchema);
