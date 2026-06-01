import express from "express";
import { protect } from "../middlewares/auth.js";
import {
  deleteNotification,
  getNotifications,
  markAllAsRead,
  markAsRead
} from "../controllers/notificationController.js";

const router = express.Router();

router.get("/", protect, getNotifications);
router.put("/read-all", protect, markAllAsRead);
router.put("/:id/read", protect, markAsRead);
router.delete("/:id", protect, deleteNotification);

export default router;
