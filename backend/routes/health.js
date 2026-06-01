import express from "express";
import { getPostgresHealth } from "../controllers/healthController.js";

const router = express.Router();

router.get("/postgres", getPostgresHealth);

export default router;
