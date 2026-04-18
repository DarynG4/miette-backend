import "dotenv/config";
import express from "express";
import cors from "cors";
import healthRouter from "./routes/health.js";
import errorHandler from "./middleware/errorHandler.js";

const app = express();

// allow requests from the frontend origin defined in environment variables
// credentials: true is required for JWT authorization headers to be accepted
app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  }),
);

// parse incoming request bodies with Content-Type: application/json
// makes parsed data available as req.body in route handlers
// must be registered before routes — middleware runs in order
// without this, req.body is undefined in all route handlers
app.use(express.json());

// all routes in healthRouter are prefixed with /api
// separates frontend and backend (if on same domain) + adds clarity in network responses
// e.g. GET /health inside the router becomes GET /api/health externally
app.use("/api", healthRouter);

// catch-all handler for any request that didn't match a defined route
// every response the api sends (success or failure) should be JSON
app.use((req, res) => {
  res.status(404).json({ error: "Route not found." });
});

// global error handler — must be last, four parameters required
// no path prefix because errors can originate from any route
app.use(errorHandler);

export default app;
