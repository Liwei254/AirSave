import Notification from "../models/Notification.js";

// Get all notifications
export const getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({
      user: req.user._id
    }).sort({ createdAt: -1 });

    res.status(200).json(notifications);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Mark as read
export const markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    notification.read = true;
    await notification.save();

    res.status(200).json({ message: "Notification marked as read" });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};