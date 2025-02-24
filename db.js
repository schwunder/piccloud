import { Database } from "bun:sqlite";

// Initialize the database (creating tables if needed)
const art = new Database("art.sqlite", { create: true });

art
  .query(
    `
  CREATE TABLE IF NOT EXISTS artists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE, 
    years TEXT, 
    genre TEXT,
    nationality TEXT, 
    bio TEXT,
    wikipedia TEXT, 
    paintings INTEGER
  )
`
  )
  .run();

art
  .query(
    `
  CREATE TABLE IF NOT EXISTS projections (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    filename TEXT UNIQUE, 
    artist TEXT,
    pca_projection BLOB,
    umap_projection BLOB,
    tsne_projection BLOB
  )
`
  )
  .run();

/**
 * Retrieves points for a given artist using the specified projection type.
 * JSON-encoded projection data is safely parsed into JavaScript objects.
 * todo return float32array
 */
const points = (projectionType, limit = null) => {
  const count = art.query("SELECT COUNT(*) as count FROM projections").get();
  console.log(`Total records in projections: ${count.count}`);

  const limitClause = limit ? " LIMIT ?" : "";
  const params = [];
  if (limit) params.push(limit);

  const points = art
    .query(
      `
      SELECT filename, artist, ${projectionType}_projection 
      FROM projections 
      ${limitClause}
    `
    )
    .all(...params);

  console.log(`Found ${points.length} points`);

  const mappedPoints = points.map((point) => ({
    ...point,
    projection: point[projectionType + "_projection"]
      ? (() => {
          try {
            return JSON.parse(point[projectionType + "_projection"]);
          } catch (e) {
            console.error(`Error parsing projection for ${point.filename}:`, e);
            return null;
          }
        })()
      : null,
  }));

  return mappedPoints;
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
