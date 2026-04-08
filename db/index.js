import "dotenv/config";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

pool.on("error", (error) => {
  console.error("Unexpected database error:", error);
  process.exit(-1);
});

export default pool;
