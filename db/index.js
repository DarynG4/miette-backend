import "dotenv/config";

/*
Client is a single database connection. With a single Client if two requests hit the database at the exact same moment, one gets queued. Additionally, if that single connection drops — a network hiccup, a Postgres timeout, anything — your entire server loses database access until you manually reconnect.

Pool maintains multiple database connections simultaneously — by default up to 10. This means multiple requests can hit the database simultaneously without waiting for each other. If one connection drops, the pool creates a replacement automatically. This is why the pool.on('error') handler exists — it catches errors on idle connections without crashing the whole server.

Also, Client requires you to call db.connect() before running any query and db.end() when you're done — managing the connection lifecycle manually.Pool handles this for you automatically. You just call pool.query() and the pool manages borrowing and returning connections internally.
*/

// pg package is CommonJS under the hood so it doesn't have individual named exports
// you have to import the whole package and access what you need from it
// hence pg.Pool rather than importing Pool directly
import pg from "pg";

// ssl is required for remote databases (render) but not for local postgresql
// checking the connection string for localhost avoids needing a separate environment variable
// checking the connection string is also more reliable because it reflects exactly where the connection is
const isLocal = process.env.DATABASE_URL?.includes("localhost");

// constructing a new Pool instance. the object passed in is the configuration
// connectionString tells pg where the Postgres database lives
// new keyword is required because pg.Pool is a class
// rejectUnauthorized: false because node ssl implementation automatically rejects self-signed certificates — which is what Render uses — so setting it to false tells the pg client to accept the certificate anyway
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

// registers an event listener on the pool
// pools maintain multiple connections simultaneously, and occasionally a connection that's sitting idle can encounter an unexpected error
// without this listener, that error would be an unhandled rejection
// with this listener, you catch the error, log it clearly so you know what happened, and call process.exit(-1)
// the -1 is a non-zero exit code, which signals to any process manager (including Render) that the server crashed rather than shut down intentionally — this is important for automatic restart behavior.
pool.on("error", (error) => {
  console.error("Unexpected database error:", error);
  process.exit(-1);
});

// exporting the pool instance as the default export of this module
// any file that imports db/index.js receives this pool directly and can immediately call pool.query() on it
// only ever one pool — this file creates it once when first imported, and Node's module system caches it so every subsequent import receives the same instance
// this is called the singleton pattern — one shared instance across the entire application
export default pool;
