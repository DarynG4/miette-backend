import { verifyToken } from "../utils/jwt.js";

// attempts to verify a jwt if one is present but does not block the request if absent or invalid
// if a valid token is found req.user is set exactly as authenticate does
// if no token is present or the token is invalid req.user remains undefined and the request continues
// used on public routes that behave differently for authenticated vs unauthenticated users:
const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // no header present — continue as unauthenticated, req.user stays undefined
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next();
    }

    const token = authHeader.split(" ")[1];

    // header present but empty — continue as unauthenticated
    if (!token) {
      return next();
    }

    // verifyToken throws if invalid or expired — caught below in catch block
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch {
    // token was present but invalid or expired — treat as unauthenticated
    // do not send a 401 — the request is allowed to continue
    next();
  }
};

export default optionalAuth;
