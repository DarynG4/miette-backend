import "dotenv/config";
import express from "express";
import cors from "cors";
import healthRouter from "./routes/health.js";
import errorHandler from "./middleware/errorHandler.js";

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

// global error handler — must be last, four parameters required
// no path prefix because errors can originate from any route
app.use(errorHandler);

export default app;
