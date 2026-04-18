import { getPgError } from "../utils/pgErrorMap.js";

// four parameters are required — this signature is how express identifies error handling middleware
// when any route calls next(error), express skips regular middleware and jumps here
// must be registered in app.js after all routes
const errorHandler = (err, req, res, next) => {
  // always log the full error server-side (only appears in terminal and Render deployment logs)
  // stack trace is logged in development only — never exposed to clients
  console.error(err);

  // handle postgresql errors — postgresql error codes are always exactly 5 characters
  // checking err.code exists first prevents a TypeError if err.code is undefined
  //  method here isn't perfect as some non-pg errors could have a 5-character code
  if (err.code && err.code.length === 5) {
    const { status, message } = getPgError(err);
    return res.status(status).json({ error: message });
  }

  // handle jwt errors from verifyToken
  // jsonwebtoken library throws typed errors with specific name properties so checking err.name lets you handle them distinctly
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({ error: "Invalid token." });
  }
  if (err.name === "TokenExpiredError") {
    return res
      .status(401)
      .json({ error: "Token has expired. Please log in again." });
  }

  // handle errors thrown manually in route handlers with an attached status property
  // error handler picks up err.status and err.message and uses them directly
  // gives a clean way to throw specific HTTP errors from any route without importing anything special
  // example 1: const error = new Error("Not allowed"); error.status = 403; throw error;
  // example 2: const error = new Error("Not allowed"); error.status = 403; return next(error);
  if (err.status) {
    return res.status(err.status).json({ error: err.message });
  }

  // fallback for anything unrecognized
  res.status(500).json({ error: "Something went wrong." });
};

export default errorHandler;
