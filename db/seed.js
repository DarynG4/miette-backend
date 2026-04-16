import "dotenv/config";
import pool from "./index.js";
import bcrypt from "bcrypt";

/*
connect to database
  → insert users, collect their ids
  → insert categories using user ids, collect category ids
  → insert projects using user + category ids, collect project ids
  → insert status history using project ids
  → insert likes using user + project ids
  → insert follows using user ids
disconnect

 1. Étienne — active user, follows Noémie, multiple projects, categories, followers, likes
    2. Fossette — active user, follows Étienne and Cymbeline, has projects, no categories, followers, likes
    3. Cymbeline — active user, follows Étienne, multiple projects, categories, followers, likes
    4. Fianna —  registered but empty, no projects, no categories, follows Fossette, likes
    5. Cian — semi-active user, no projects, no categories, follows Étienne and Cymbeline and Fossette, no followers, likes
    6. Noémie — active user, follows Étienne and Cymbeline, has projects, has categories, Étienne is her only follower, likes
*/

async function seed() {
  try {
    // ============================================================
    // USERS
    // ============================================================

    const password = await bcrypt.hash("password4", 12);

    // a pool manages connections internally so you never call .connect() on the pool itself
    // you call pool.query() directly and the pool handles borrowing and returning a connection automatically
    // you simply call pool.query() inside the seed function and the pool handles everything

    // postgresql's parameterized query syntax allows a single parameter to be referenced multiple times in the same query
    // $1 always refers to the first element of the params array — [password] — regardless of how many times it appears
    // don't need $1, $2, $3, $4, $5 for five identical values

    // normalize accented characters out of usernames entirely but keep in first name,
    // last name, display names and bios

    // pool.query() returns an object with a rows array containing the returned rows
    // destructuring { rows: users } gives you the array directly with a meaningful name

    // returning id, username instead of returning * because you only need the id for the following inserts
    // username is included purely to make console logs readable during debugging

    // in sql, '' (two single quotes) inside a single-quoted string represents one literal apostrophe
    // without it postgresql sees 'I have to — it' as a complete string, then s in the blood... as unexpected syntax, and throws a syntax error
    const { rows: users } = await pool.query(
      `INSERT INTO users (username, email, password_hash, first_name, display_name, last_name, bio) VALUES 
      ('etienne.marchand', 'etienne@example.com', $1, 'Étienne', 'Étienne', 'Marchand', 'Womenswear designer based in Paris. I sew because I have to — it''s in the blood.'), 
      ('fossette.b', 'fossette@example.com', $1, 'Fossette', 'Fossy', 'Beaumont', 'Aspiring designer, chronic over-thinker, twin sister to @fianna.beaumont who refuses to learn how to sew but always has opinions about the fit. Currently studying fashion and documenting every step.'), 
      ('cymbeline', 'cymbeline@example.com', $1, 'Cymbeline', 'Cymbeline', null, 'Self-taught sewist of 14 years. No formal training, just a lot of unpicking and starting over. I make mostly womenswear and the occasional home piece. Slow fashion is the only fashion.'), 
      ('fianna.beaumont', 'fianna@example.com', $1, 'Fianna', 'Fifi', 'Beaumont', 'I don''t sew. I wear. Twin to @fossette.b — she makes it, I model it.'), 
      ('ciansews', 'cian@example.com', $1, 'Cian', 'Cian', null, null), 
      ('noemiem', 'noemie@example.com', $1, 'Noémie', 'Émie', 'Marchand', 'Hobby sewist and younger sister to @etienne.marchand, who will not stop giving me unsolicited construction notes. I sew for the joy of it — mostly dreamy, floaty things in natural fabrics.') 
      RETURNING id, username`,
      [password],
    );

    // destructures the five returned rows into named variables so downstream inserts read cleanly
    // example --> etienne.id instead of users[0].id
    const [etienne, fossette, cymbeline, fianna, cian, noemie] = users;

    console.log("✓ Users seeded");

    // ============================================================
    // CATEGORIES
    // ============================================================

    // each $ index refers to a different element in the params array by position. $1 is etienne.id, $2 is noemie.id, $3 is cymbeline.id
    // unlike the users insert where every row used the same password, categories need different user_id values per row so that each gets its own parameter reference

    // returning id, name, and user_id because you need id to assign projects to categories later
    // name and user_id are included for readability during debugging — if seeding fails partway through you can read the output and know exactly which categories were created
    const { rows: categories } = await pool.query(
      `INSERT INTO categories (user_id, name) VALUES 
        ($1, 'Womenswear'),
        ($1, 'Commissioned Pieces'),
        ($2, 'Dreamy Things'),
        ($2, 'Natural Fabrics'),
        ($3, 'For the Archive')
        RETURNING id, name, user_id`,
      [etienne.id, noemie.id, cymbeline.id],
    );

    // destructure categories into named variables so that when you assign projects to categories later you'll write etienneWomenswear.id rather than categories[0].id
    // named variables make it so you're not guessing which index corresponds to which category
    const [
      etienneWomenswear,
      etienneCommissioned,
      noemieDreamy,
      noemieNatural,
      cymbelineArchive,
    ] = categories;

    console.log("✓ Categories seeded");

    // ============================================================
    // PROJECTS
    // ============================================================

    console.log("🌱 Database successfully seeded!");
  } catch (error) {
    console.error("❌ Seeding failed:", error);
  } finally {
    // in a finally block so the pool closes cleanly whether the seed succeeds or throws an error
    await pool.end();
  }
}

// the call at the bottom is the right pattern for pg.Pool with try/catch/finally
// the pool opens connections automatically when queries run and pool.end() in finally closes them cleanly when everything is done or when an error is thrown
// there's no better or more explicit way to write it

seed();
