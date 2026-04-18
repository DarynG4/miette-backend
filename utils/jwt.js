import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET;
const EXPIRY = "7d";

// crash at startup if JWT_SECRET is not set
// a missing secret allows tokens to be signed with an empty string — trivially forgeable
// this error is thrown during server startup and only appears in 2 places — your terminal + Render deployment logs
if (!SECRET) {
  throw new Error("JWT_SECRET environment variable is not set");
}

// creates a signed JWT containing the given payload
// called in auth routes after successful registration or login
// returns a token string the client stores and sends with future requests
export const createToken = (payload) => {
  // payload = data to encode, secret = secret to sign with, {...} = options
  // payload is typically { id: user.id } — just the user's id
  // username and email are excluded since they can change; id never does
  // the client stores this token and sends it with every future request
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRY });
};

// verifies the token's signature and expiry
// returns the decoded payload if valid
// throws a JsonWebTokenError if the token is invalid or expired instead of returning null
// throwing gives a meaningful error with a specific message — returning null would lose that information
export const verifyToken = (token) => {
  return jwt.verify(token, SECRET);
};
