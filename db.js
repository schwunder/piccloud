import { Database } from "bun:sqlite";

// Initialize the database in read-only mode
const art = new Database("art.sqlite", { readonly: true });

/**
 * Retrieves points for a given artist using the specified projection type.
 * JSON-encoded projection data is safely parsed into JavaScript objects.
 * @param {string} [projectionType="umap"] - The type of projection to retrieve
 * todo return float32array
 */
const points = (projectionType = "umap") => {
  const count = art.query("SELECT COUNT(*) as count FROM projections").get();
  console.log(`Total records in projections: ${count.count}`);

  const rows = art
    .query(
      `SELECT filename, artist, ${projectionType}_projection 
      FROM projections 
      LIMIT 1000`
    )
    .values();

  console.log(`Found ${rows.length} points`);

  return rows.map(([filename, artist, projection_str]) => ({
    filename,
    artist,
    projection: projection_str
      ? (() => {
          try {
            return JSON.parse(projection_str);
          } catch (e) {
            console.error(`Error parsing projection for ${filename}:`, e);
            return null;
          }
        })()
      : null,
  }));
};

/**
 * Retrieves all artists from the database.
 */
const artists = () => {
  return art
    .query(
      `
      SELECT name, years, genre, nationality, bio, wikipedia, paintings
      FROM artists
    `
    )
    .all();
};

export { points, artists };
