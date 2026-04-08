import "dotenv/config";
import express from "express";
import cors from "cors";
import healthRouter from "./routes/health.js";

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  }),
);

app.use(express.json());

app.use("/api", healthRouter);

app.use((req, res) => {
  res.status(404).json({ error: "Route not found." });
});

export default app;
