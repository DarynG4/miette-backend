import express from "express";
import pool from "../db/index.js";

// creates a new router instance
// essentially a mini Express app that handles its own routing
// exported and mounted in app.js at /api so the full external path becomes /api/health.
const router = express.Router();

router.get("/health", async (req, res) => {
  try {
    // SELECT 1 is the simplest valid SQL statement, it touches no tables and requires no schema
    // only purpose is to confirm that a database connection exists and is functional
    await pool.query("SELECT 1");
    // 200 is the status code for ok
    // JSON body tells the client both that the API server is running and that the database is connected
    res.status(200).json({
      message: "Miette API is alive!",
      db: "connected",
    });
  } catch (error) {
    // log the full error object — this goes to the terminal locally
    console.error("Health check failed:", error);
    // 500 is the status code for internal server error — it tells the client something went wrong on the server's side, not the client's side
    // 4xx codes mean the client did something wrong, 5xx codes mean the server did something wrong
    res.status(500).json({
      // response still confirms the API itself is alive but reports that the database is disconnected
      message: "Miette API is alive",
      db: "disconnected",
      // error.message is the human-readable error string from the caught error object
      error: error.message,
    });
  }
});

export default router;
