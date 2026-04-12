import express from "express";
import { protect } from "../middlewares/auth.js";
import {
  getNotifications,
  markAsRead
} from "../controllers/notificationController.js";

const router = express.Router();

router.get("/", protect, getNotifications);
router.put("/:id/read", protect, markAsRead);

export default router;