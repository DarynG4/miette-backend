import express from "express";
import pool from "../db/index.js";

const router = express.Router();

router.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.status(200).json({
      message: "Miette API is alive!",
      db: "connected",
    });
  } catch (error) {
    console.error("Health check failed:", error);
    res.status(500).json({
      message: "Miette API is alive",
      db: "disconnected",
      error: error.message,
    });
  }
});

export default router;
