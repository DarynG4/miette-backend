import "dotenv/config";
import pg from "pg";

const isLocal = process.env.DATABASE_URL?.includes("localhost");

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

pool.on("error", (error) => {
  console.error("Unexpected database error:", error);
  process.exit(-1);
});

export default pool;
