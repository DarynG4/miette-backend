import express from "express";
import bcrypt from "bcrypt";
import pool from "../db/index.js";
import { createToken } from "../utils/jwt.js";
import requireBody from "../middleware/requireBody.js";

const router = express.Router();
const SALT_ROUNDS = 12;

// POST /api/auth/register
// creates a new user account
// returns the new user (without password_hash) and a jwt
router.post("/auth/register", requireBody, async (req, res, next) => {
  try {
    const { username, email, password, first_name, last_name } = req.body;

    if (!username || !email || !password || !first_name) {
      return res.status(400).json({
        error: "Username, email, password, and first name are required.",
      });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // first_name and display_name receive the same parameter because display_name defaults to first_name on registration
    // returning excludes password_hash so there isn't a chance of accidentally sending it
    const { rows } = await pool.query(
      `INSERT INTO users (username, email, password_hash, first_name, display_name, last_name) VALUES ($1, $2, $3, $4, $4, $5) RETURNING id, username, email, first_name, display_name, last_name, bio, avatar_url, account_status, created_at`,
      // last name is optional so if client doesn't send it req.body.last_name is undefined
      // pg converts undefined to null automatically in some versions but using ?? null makes it explicit and consistent regardless of pg version
      [username, email, passwordHash, first_name, last_name ?? null],
    );

    const newUser = rows[0];
    const token = createToken({ id: newUser.id });

    // 201 created means a new resource was created
    res.status(201).json({ user: newUser, token });
  } catch (error) {
    // never create a custom error in the catch block — always call next(error) and let the global error handler decide what to send
    next(error);
  }
});

// POST /api/auth/login
// validates credentials and returns the user and a jwt
// returns the same 401 whether email is wrong or password is wrong (prevents attackers from knowing which field was incorrect)
router.post("/auth/login", requireBody, async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Email and password are required.",
      });
    }

    // look up user by email
    // password_hash selected as it's needed to compare against
    const { rows } = await pool.query(
      `SELECT id, username, email, password_hash, first_name, display_name, last_name, bio, avatar_url, account_status, created_at FROM users WHERE email = $1`,
      [email],
    );

    const user = rows[0];

    if (!user) {
      // deliberately vague — do not reveal whether email or password was wrong
      return res.status(401).json({ error: "Invalid credentials." });
    }

    // compare password entered by client against password_hash in the database
    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      // deliberately vague — do not reveal whether email or password was wrong
      return res.status(401).json({ error: "Invalid credentials." });
    }

    // destructure out password_hash after comparison — using the rest operator (...) — before sending the user object to the client
    // safeUser is a new object that contains all properties except password_hash
    const { password_hash, ...safeUser } = user;

    const token = createToken({ id: safeUser.id });

    // 200 ok means the request succeeded
    res.status(200).json({ user: safeUser, token });
  } catch (error) {
    // never create a custom error in the catch block — always call next(error) and let the global error handler decide what to send
    next(error);
  }
});

export default router;
