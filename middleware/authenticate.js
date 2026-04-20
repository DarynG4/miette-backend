import { verifyToken } from "../utils/jwt.js";

// verifies the jwt on every protected request
const authenticate = (req, res, next) => {
  try {
    // http headers are accessible on req.headers
    // authorization header name is lowercase because express normalizes all header names to lowercase
    const authHeader = req.headers.authorization;

    // 1st checks if the header exists at all
    // 2nd checks if it follows the expected format ('Bearer ' prefix is http standard for token authentication)
    // the space after 'Bearer ' matters! without a space a header will match incorrectly
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ error: "Authorization header is required." });
    }

    // 'Bearer dgjDheji' split on a space gives ['Bearer', 'dgjDheji' ]
    // index [1] is the token, index[0] is the word 'Bearer' which isn't needed anymore
    const token = authHeader.split(" ")[1];
    // defensive check in case someone sends an empty token
    // 'Bearer ' with nothing after the space .split(' ')[1] returns an empty string (which is falsy)
    if (!token) {
      return res.status(401).json({ error: "Token is required." });
    }

    // where verification happens
    // checks the signature against the secret variable and confirms token hasn't expired
    // if either check fails it throws, which the catch block handles
    const decoded = verifyToken(token);

    // decoded contains whatever was in the payload when it was created
    // typical example: { id: 7, iat: 1234567890, exp: 1234567890 }
    // iat = issued at timestamp, exp = expiry timestamp (both auto added by jsonwebtoken)
    // route handlers access the user's id via req.user.id
    req.user = decoded;

    // success path; next() with no argument tells express to proceed to the next middleware/route handler
    next();
  } catch (error) {
    // error path: next(error) passes the error to the global error handler which sends the appropriate response
    // jsonwebtoken error names are already handled in global error handler
    next(error);
  }
};

export default authenticate;
