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

// seed is wrapped in a single database transaction (BEGIN, COMMIT, ROLLBACK)
// this is so that if anything within the seed fails everything is rolled back automatically and no partial data is committed to the database
async function seed() {
  // pool.connect() checks out a dedicated client from the pool as transactions MUST happen on a single connection
  // if you use pool.query() for a transaction, different queries might land on different pool connections and then the transaction will break
  const client = await pool.connect();

  try {
    // BEGIN starts a new transaction block
    await client.query("BEGIN");

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
    const { rows: users } = await client.query(
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
    const { rows: categories } = await client.query(
      `INSERT INTO categories (user_id, name) VALUES 
        ($1, 'Womenswear'),
        ($1, 'Commissioned Pieces'),
        ($2, 'For the Archive'),
        ($3, 'Dreamy Things'),
        ($3, 'Natural Fabrics')
        RETURNING id, name, user_id`,
      [etienne.id, cymbeline.id, noemie.id],
    );

    // destructure categories into named variables so that when you assign projects to categories later you'll write etienneWomenswear.id rather than categories[0].id
    // named variables make it so you're not guessing which index corresponds to which category
    const [
      etienneWomenswear,
      etienneCommissioned,
      cymbelineArchive,
      noemieDreamy,
      noemieNatural,
    ] = categories;

    console.log("✓ Categories seeded");

    // ============================================================
    // PROJECTS
    // ============================================================

    // projects span all four statuses across four users
    // étienne's project 3 is private — tests visibility logic in queries
    // fossette and cymbeline have no category_id — tests uncategorized container

    // ARRAY['', ''] is postgresql's array literal syntax and is how you insert a value into a text[] column

    // is_self_drafted and uses_pattern are mutually exclusive in the UI but not enforced at the database level
    const { rows: projects } = await client.query(
      `INSERT INTO projects (user_id, category_id, title, status, is_public, description, notes, season, item_type, uses_pattern, pattern_name, pattern_size, pattern_link, pattern_adjustments, is_self_drafted, is_upcycled, previous_item_type, fabric, thread, haberdashery) 
      VALUES 
      -- étienne: complete womenswear project in Womenswear category
      ($1, $5, 'Atelier Dress', 'complete', true, 'A tailored dress made for the spring collection. Clean lines, minimal seaming.', null, ARRAY['spring', 'summer'], 'dress', true, 'Vogue Patterns V2153', 'US 10', 'https://simplicity.com/vogue-patterns/v2153', 'Full Bust Adjustment, lengthened bodice by 3cm, removed waist seam', false, false, null, 'Silk crepe de chine in ivory', 'Gutermann 800', 'invisible zip, hook and eyes, interfacing, shoulder pads, buckle'),

      -- étienne: in_progress commissioned piece
      ($1, $6, 'Wedding Guest Coat', 'in_progress', true, 'Commission for a client. Structured coat with contrast lining.', null, ARRAY['spring'], 'coat', true, '112 | Burda Style 06/23', 'Burda 36 (US 6)', null, 'Widened shoulders for shoulder pads, added welt pockets', false, false, null, 'Wool crepe in champagne', 'Gutermann 722', 'horn buttons, interfacing, shoulder pads'),

      -- étienne: planning project with no category, private
      ($1, null, 'Something Bias', 'planning', false, 'Not sure yet. A bias-cut something. Feeling my way through.', null, ARRAY['autumn', 'winter'], 'dress', false, null, null, null, null, true, false, null, null, null, null),
      
      -- fossette: complete project, no category
      ($2, null, 'First Completed Garment', 'complete', true, 'The first thing I ever finished. A disaster in the best way possible. I learned so much.', null, ARRAY['spring', 'summer', 'autumn', 'winter'], 'top', false, null, null, null, null, true, false, null, 'Cotton poplin in white', 'white cotton thread', null),
      
      -- fossette: in_progress project, no category
      ($2, null, 'Bias Slip Dress', 'in_progress', true, 'Currently obsessed with bias cut. This is the practice run before the real one.', null, ARRAY['spring', 'summer'], 'dress', true, 'Nelly Dress by VikiSews', 'Height 170-176, Size 38', 'https://vikisews.com/vykrojki/dresses/nelly-dress/', null, false, false, null, 'Silk satin in dusty rose', 'matching silk thread', null),
      
      -- cymbeline: altering project in For the Archive category
      ($3, $7, 'The Coat That Never Dies', 'altering', true, 'I''ve been altering this coat for six years. It''s lived many lives.', null, ARRAY['autumn', 'winter'], 'coat', false, null, null, null, null, true, true, 'Oversized wool coat', 'Boiled wool in charcoal', null, 'vintage buttons'),
      
      -- cymbeline: complete project, no category
      ($3, null, 'Linen Trousers', 'complete', true, 'Self-drafted wide leg trousers. Finally got the rise right after three toiles.', null, ARRAY['spring', 'summer'], 'trousers', false, null, null, null, null, true, false, null, 'Medium weight linen in sand', 'matching linen thread', 'Zip fly, waistband interfacing'),
      
      -- noémie: planning project in Dreamy Things category
      ($4, $8, 'Floaty Summer Dress', 'planning', true, 'I want something completely impractical and completely beautiful.', null, ARRAY['summer'], 'dress', false, null, null, null, null, false, false, null, null, null, null),
      
      -- noémie: complete project in Natural Fabrics category
      ($4, $9, 'Linen Shirt Dress', 'complete', true, 'Simple and wearable. Made this three times now in different fabrics.', null, ARRAY['spring', 'summer', 'autumn'], 'dress', true, 'TESSUTI • Tosca Tunic', 'Size 1', 'https://drapersdaughter.com/products/tessuti-tosca-tunic-sewing-pattern-6-22', 'Shortened hem by 8cm', false, false, null, 'Washed linen in sage green', 'Gutermann 553', null)
      RETURNING id, title, user_id`,
      [
        etienne.id, // $1
        fossette.id, // $2
        cymbeline.id, // $3
        noemie.id, // $4
        etienneWomenswear.id, // $5
        etienneCommissioned.id, // $6
        cymbelineArchive.id, // $7
        noemieDreamy.id, // $8
        noemieNatural.id, // $9
      ],
    );

    const [
      etienneAtelier,
      etienneCoat,
      etienneBias,
      fossetteFirst,
      fossetteSlip,
      cymbelineCoat,
      cymbelineTrousers,
      noemieSummer,
      noemieShirt,
    ] = projects;

    console.log("✓ Projects seeded");

    // ============================================================
    // PROJECTS STATUS HISTORY
    // ============================================================

    // snapshots capture project state at the moment a status transition occurred
    // status_from = the status being LEFT, not the status being entered
    // fields reflect what was filled in at that point in the project's journey
    // projects currently in their original status have no history rows

    // No RETURNING clause and no const { rows } = ... assignment because you don't need any ids from history rows since nothing else in the seed references them and the history rows have no children that depend on them
    // RETURNING is only needed when following inserts depend on the returned ids
    // pool.query() still executes correctly either way. The assignment (const { rows } = ...) and clause (RETURNING) is purely about whether you need what comes back
    await client.query(
      `INSERT INTO project_status_history (project_id, title, status_from, description, notes, season, item_type, uses_pattern, pattern_name, pattern_size, pattern_link, pattern_adjustments, is_self_drafted, is_upcycled, previous_item_type, fabric, thread, haberdashery) 
        VALUES
        -- atelier dress: was planning (no materials yet, pattern identified)
        ($1, 'Atelier Dress', 'planning', 'A tailored dress for the spring collection. Still sourcing fabric.', null, ARRAY['spring', 'summer'], 'dress', true, 'Vogue Patterns V2153', 'US 10', 'https://simplicity.com/vogue-patterns/v2153', null, false, false, null, null, null, null),
        
        -- atelier dress: was in_progress (materials acquired, adjustments noted)
        ($1, 'Atelier Dress', 'in_progress', 'A tailored dress made for the spring collection. Clean lines, minimal seaming.', null, ARRAY['spring', 'summer'], 'dress', true, 'Vogue Patterns V2153', 'US 10', 'https://simplicity.com/vogue-patterns/v2153', 'Full Bust Adjustment, lengthened bodice by 3cm, removed waist seam', false, false, null, 'Silk crepe de chine in ivory', 'Gutermann 800', 'invisible zip, hook and eyes, interfacing, shoulder pads, buckle'),
        
        -- wedding guest coat: was planning (commission received, pattern chosen)
        ($2, 'Wedding Guest Coat', 'planning', 'Commission for a client. Structured coat with contrast lining. Awaiting fabric swatches.', null, ARRAY['spring'], 'coat', true, '112 | Burda Style 06/23', 'Burda 36 (US 6)', null, null, false, false, null, null, null, null),
        
        -- first completed garment: was planning (very sparse)
        ($3, 'First Completed Garment', 'planning', 'Going to try making a top. No idea what I''m doing.', null, ARRAY['spring', 'summer', 'autumn', 'winter'], 'top', false, null, null, null, null, false, false, null, null, null, null),
        
        -- first completed garment: was in_progress (fabric chosen)
        ($3, 'First Completed Garment', 'in_progress', 'The first thing I ever finished. A disaster in the best way possible. I learned so much.', null, ARRAY['spring', 'summer', 'autumn', 'winter'], 'top', false, null, null, null, null, true, false, null, 'Cotton poplin in white', 'white cotton thread', null),
        
        -- bias slip dress: was planning (pattern chosen)
        ($4, 'Bias Slip Dress', 'planning', 'Want to make a bias slip dress. Starting with a pattern before I try self-drafting.', null, ARRAY['spring', 'summer'], 'dress', true, 'Nelly Dress by VikiSews', 'Height 170-176, Size 38', 'https://vikisews.com/vykrojki/dresses/nelly-dress/', null, false, false, null, null, null, null),
        
        -- the coat that never dies: was complete (first life — before the alterations began)
        ($5, 'The Coat', 'complete', 'Finished it. Wore it twice. Something about the shoulders isn''t right.', null, ARRAY['autumn', 'winter'], 'coat', false, null, null, null, null, true, false, null, 'Boiled wool in charcoal', null, 'vintage buttons'),
        
        -- the coat that never dies: was altering (second life — altered, declared complete again)
        ($5, 'The Coat (revised)', 'altering', 'Fixed the shoulders. Happy with it. Back to complete.', 'Let out side seams, rebuilt shoulder seams', ARRAY['autumn', 'winter'], 'coat', false, null, null, null, null, true, false, null, 'Boiled wool in charcoal', null, 'vintage buttons'),
        
        -- the coat that never dies: was complete again (second complete before current altering)
        ($5, 'The Coat That Never Dies', 'complete', 'I''ve been altering this coat for six years. It''s lived many lives.', 'Let out side seams, rebuilt shoulder seams, relined', ARRAY['autumn', 'winter'], 'coat', false, null, null, null, null, true, true, 'Oversized wool coat', 'Boiled wool in charcoal', null, 'vintage buttons'),
        
        -- linen trousers: was planning (self-drafted, third toile era)
        ($6, 'Linen Trousers', 'planning', 'Going to self-draft wide leg trousers. Have attempted this twice before.', null, ARRAY['spring', 'summer'], 'trousers', false, null, null, null, null, true, false, null, null, null, null),
        
        -- linen trousers: was in_progress (fabric cut, rise issues noted)
        ($6, 'Linen Trousers', 'in_progress', 'Self-drafted wide leg trousers. Finally got the rise right after three toiles.', null, ARRAY['spring', 'summer'], 'trousers', false, null, null, null, null, true, false, null, 'Medium weight linen in sand', 'matching linen thread', 'Zip fly, waistband interfacing'),
        
        -- linen shirt dress: was planning (pattern found, fabric undecided)   
        ($7, 'Linen Shirt Dress', 'planning', 'Want to make a wearable everyday dress. Found a pattern I love.', null, ARRAY['spring', 'summer', 'autumn'], 'dress', true, 'TESSUTI • Tosca Tunic', 'Size 1', 'https://drapersdaughter.com/products/tessuti-tosca-tunic-sewing-pattern-6-22', null, false, false, null, null, null, null),
        
        -- linen shirt dress: was in_progress (fabric chosen, hem adjustment noted)
        ($7, 'Linen Shirt Dress', 'in_progress', 'Simple and wearable. Made this three times now in different fabrics.', null, ARRAY['spring', 'summer', 'autumn'], 'dress', true, 'TESSUTI • Tosca Tunic', 'Size 1', 'https://drapersdaughter.com/products/tessuti-tosca-tunic-sewing-pattern-6-22', 'Shortened hem by 8cm', false, false, null, 'Washed linen in sage green', 'Gutermann 553', null)`,
      [
        etienneAtelier.id, //$1
        etienneCoat.id, //$2
        fossetteFirst.id, //$3
        fossetteSlip.id, //$4
        cymbelineCoat.id, //$5
        cymbelineTrousers.id, //$6
        noemieShirt.id, //$7
      ],
    );

    console.log("✓ Projects Status History seeded");

    // ============================================================
    // LIKES
    // ============================================================
    await client.query(
      `INSERT INTO likes (user_id, project_id) VALUES 
        ($1, $12), -- étienne likes noémie's linen shirt dress
        ($2, $7), -- fossette likes étienne's atelier dress
        ($2, $11), -- fossette likes cymbeline's linen trousers
        ($3, $7), -- cymbeline likes étienne's atelier dress
        ($3, $8), -- cymbeline likes fossette's first completed garment
        ($4, $8), -- fianna likes fossette's first completed garment
        ($4, $9), -- fianna likes fossette's bias slip dress
        ($5, $7), -- cian likes étienne's atelier dress
        ($5, $10),-- cian likes cymbeline's coat that never dies
        ($6, $7), -- noémie likes étienne's atelier dress
        ($6, $9) -- noémie likes fossette's bias slip dress`,
      [
        etienne.id, // $1
        fossette.id, // $2
        cymbeline.id, // $3
        fianna.id, // $4
        cian.id, // $5
        noemie.id, // $6
        etienneAtelier.id, // $7
        fossetteFirst.id, // $8
        fossetteSlip.id, // $9
        cymbelineCoat.id, // $10
        cymbelineTrousers.id, // $11
        noemieShirt.id, // $12
      ],
    );

    console.log("✓ Likes seeded");

    // ============================================================
    // FOLLOWS
    // ============================================================
    await client.query(
      `INSERT INTO follows (follower_id, following_id) VALUES 
      ($1, $6), -- étienne follows noémie
      ($2, $1), -- fossette follows étienne
      ($2, $3), -- fossette follows cymbeline
      ($3, $1), -- cymbeline follows étienne
      ($4, $2), -- fianna follows fossette
      ($5, $1), -- cian follows étienne
      ($5, $2), -- cian follows cymbeline
      ($5, $3), -- cian follows fossette
      ($6, $1), -- noémie follows étienne
      ($6, $3) -- noémie follows cymbeline`,
      [
        etienne.id, // $1
        fossette.id, // $2
        cymbeline.id, // $3
        fianna.id, // $4
        cian.id, // $5
        noemie.id, // $6
      ],
    );

    console.log("✓ Follows seeded");

    // COMMIT saves all changes made during the transaction to the database permanently
    await client.query("COMMIT");
    console.log("🌱 Database successfully seeded!");
  } catch (error) {
    // ROLLBACK cancels all changes made in the current transaction, reverting the data to its state before the transaction began
    await client.query("ROLLBACK");
    console.error("❌ Seeding failed, all changes rolled back:", error);
  } finally {
    // client.release() returns the dedicated connection back to the pool
    // must happen before pool.end() since ending the pool while a client is still checked out causes a warning
    client.release();

    // in a finally block so the pool closes cleanly whether the seed succeeds or throws an error
    await pool.end();
  }
}

// the call at the bottom is the right pattern for pg.Pool with try/catch/finally
// the pool opens connections automatically when queries run and pool.end() in finally closes them cleanly when everything is done or when an error is thrown
// there's no better or more explicit way to write it

seed();
