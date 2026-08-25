const AuditLog = require('../models/AuditLog');

const logAction = async ({ req, actorId, action, entityId, entityModel, details }) => {
  try {
    await AuditLog.create({
      actorId: actorId || req?.user?.id || req?.user?._id,
      action,
      entityId,
      entityModel,
      details,
      ipAddress: req?.ip || req?.headers['x-forwarded-for'] || req?.connection?.remoteAddress,
      userAgent: req?.headers['user-agent'],
    });
  } catch (err) {
    console.error('Audit Log Error:', err);
  }
};

module.exports = { logAction };
