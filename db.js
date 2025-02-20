import { Database } from "bun:sqlite";

// Initialize the database (creating tables if needed)
const art = new Database("art.sqlite", { create: true });

art
  .query(
    `
  CREATE TABLE IF NOT EXISTS embeddings (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    filename TEXT UNIQUE, 
    artist TEXT,
    embedding BLOB
  )
`
  )
  .run();

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
 */
const points = (artist, projectionType, limit = null) => {
  const count = art.query("SELECT COUNT(*) as count FROM projections").get();
  console.log(`Total records in projections: ${count.count}`);

  // Convert spaces to underscores for filename matching
  const artistInFilename = artist.replace(" ", "_");
  const limitClause = limit ? " LIMIT ?" : "";
  const params = [artist];
  if (limit) params.push(limit);

  const points = art
    .query(
      `
      SELECT filename, artist, ${projectionType}_projection 
      FROM projections 
      WHERE artist = ?
      ORDER BY CAST(REPLACE(REPLACE(filename, '${artistInFilename}_', ''), '.avif', '') AS INTEGER) ASC
      ${limitClause}
    `
    )
    .all(...params);

  console.log(`Found ${points.length} points for artist ${artist}`);

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

/**
 * Retrieves embeddings from the database and converts BLOB data to a Float32Array.
 */
const getEmbeddings = () => {
  const rows = art
    .query(
      `
    SELECT filename, embedding 
    FROM embeddings
  `
    )
    .all();

  return rows.map(({ filename, embedding: buffer }) => ({
    filename,
    embedding: new Float32Array(
      buffer.buffer,
      buffer.byteOffset,
      buffer.length / Float32Array.BYTES_PER_ELEMENT
    ),
  }));
};

/**
 * Updates projection data in the database.
 * Each projection is serialized to JSON before being stored.
 */
const updateProjections = (dataArray, projectionType) => {
  const query = `
    UPDATE projections 
    SET ${projectionType}_projection = ? 
    WHERE filename = ?
  `;
  try {
    art.transaction(() => {
      const stmt = art.prepare(query);
      for (const { filename, projection } of dataArray) {
        if (!filename || !projection) {
          throw new Error(`Invalid data: missing filename or projection`);
        }
        const serialized = JSON.stringify(projection);
        stmt.run(serialized, filename);
      }
    })();
    return true;
  } catch (error) {
    console.error(`Error updating ${projectionType} projections:`, error);
    return false;
  }
};

export { points, artists, getEmbeddings, updateProjections };
