import { Database } from "bun:sqlite";

const art = new Database("art.sqlite", { create: true });

art
  .query(
    `CREATE TABLE IF NOT EXISTS embeddings (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    filename TEXT UNIQUE, 
    artist TEXT,
    embedding BLOB
  )`
  )
  .run();

art
  .query(
    `CREATE TABLE IF NOT EXISTS artists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE, years TEXT, genre TEXT,
    nationality TEXT, bio TEXT,
    wikipedia TEXT, paintings INTEGER
  )`
  )
  .run();

art
  .query(
    `CREATE TABLE IF NOT EXISTS projections (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    filename TEXT UNIQUE, 
    artist TEXT,
    pca_projection BLOB,
    umap_projection BLOB,
    tsne_projection BLOB
  )`
  )
  .run();

// get points for server
const getPoints = (artist) => {
  const points = art
    .query(
      `SELECT filename, artist, pca_projection 
       FROM projections 
       WHERE artist = ?
       `
    )
    .all(artist);

  // Parse the JSON stored PCA projections
  return points.map((point) => ({
    ...point,
    pca_projection: point.pca_projection
      ? JSON.parse(point.pca_projection)
      : null,
  }));
};

// get artists for server
const getArtists = () => {
  return art
    .query(
      `SELECT name, years, genre, nationality, bio, wikipedia, paintings  FROM artists`
    )
    .all();
};

// get embeddings for dimensionality reduction
const getEmbeddings = () => {
  const rows = art
    .query(
      `
    SELECT id, filename, embedding 
    FROM embeddings 
  `
    )
    .all();

  return rows
    .map((row) => {
      // Convert BLOB to Float32Array
      const buffer = row.embedding;
      if (!buffer) {
        console.error(`No embedding found for ${row.filename}`);
        return null;
      }

      try {
        // SQLite BLOB to Float32Array
        const embedding = new Float32Array(
          buffer.buffer,
          buffer.byteOffset,
          buffer.length / Float32Array.BYTES_PER_ELEMENT
        );

        return {
          id: row.id,
          filename: row.filename,
          embedding,
        };
      } catch (e) {
        console.error(`Error converting embedding for ${row.filename}:`, e);
        return null;
      }
    })
    .filter(Boolean); // Remove null entries
};

const updatePcaProjections = (idsandfilenamesandprojections) => {
  const query = `
  UPDATE projections 
  SET pca_projection = ? 
  WHERE filename = ?
  `;

  try {
    art.transaction(() => {
      const stmt = art.prepare(query);
      for (const {
        id,
        filename,
        projection,
      } of idsandfilenamesandprojections) {
        if (!filename || !projection) {
          throw new Error(`Invalid data: missing filename or projection`);
        }
        // Serialize the projection array to JSON before storing
        const serializedProjection = JSON.stringify(projection);
        stmt.run(serializedProjection, filename);
      }
    })();
    return true;
  } catch (error) {
    console.error("Error updating PCA projections:", error);
    return false;
  }
};

const updateUmapProjections = (idsandfilenamesandprojections) => {
  const query = `
  UPDATE projections 
  SET umap_projection = ? 
  WHERE filename = ?
  `;
  try {
    art.transaction(() => {
      const stmt = art.prepare(query);
      for (const {
        id,
        filename,
        projection,
      } of idsandfilenamesandprojections) {
        if (!filename || !projection) {
          throw new Error(`Invalid data: missing filename or projection`);
        }
        // Serialize the projection array to JSON before storing
        const serializedProjection = JSON.stringify(projection);
        stmt.run(serializedProjection, filename);
      }
    })();
    return true;
  } catch (error) {
    console.error("Error updating UMAP projections:", error);
    return false;
  }
};

export {
  getPoints,
  getArtists,
  getEmbeddings,
  updatePcaProjections,
  updateUmapProjections,
};
