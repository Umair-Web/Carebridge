const Notification = require('../models/Notification');

/**
 * GET /v1/notifications
 * Latest notifications for the logged-in user + current unread count.
 */
exports.list = async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 30, 100);
    const [items, unreadCount] = await Promise.all([
      Notification.find({ userId: req.user.id })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),
      Notification.countDocuments({ userId: req.user.id, read: false }),
    ]);
    res.json({ success: true, data: { items, unreadCount } });
  } catch (error) {
    console.error('List notifications error:', error);
    res.status(500).json({ success: false, message: 'Error fetching notifications' });
  }
};

/**
 * GET /v1/notifications/unread-count
 */
exports.unreadCount = async (req, res) => {
  try {
    const unreadCount = await Notification.countDocuments({ userId: req.user.id, read: false });
    res.json({ success: true, data: { unreadCount } });
  } catch (error) {
    console.error('Unread count error:', error);
    res.status(500).json({ success: false, message: 'Error fetching unread count' });
  }
};

/**
 * PATCH /v1/notifications/:id/read
 */
exports.markRead = async (req, res) => {
  try {
    await Notification.updateOne(
      { _id: req.params.id, userId: req.user.id },
      { $set: { read: true } }
    );
    const unreadCount = await Notification.countDocuments({ userId: req.user.id, read: false });
    res.json({ success: true, data: { unreadCount } });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ success: false, message: 'Error updating notification' });
  }
};

/**
 * PATCH /v1/notifications/read-all
 */
exports.markAllRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user.id, read: false },
      { $set: { read: true } }
    );
    res.json({ success: true, data: { unreadCount: 0 } });
  } catch (error) {
    console.error('Mark all read error:', error);
    res.status(500).json({ success: false, message: 'Error updating notifications' });
  }
};
