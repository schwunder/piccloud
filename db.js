import { Database } from "bun:sqlite";

const db = new Database("db.sqlite", { create: true });
const artists = new Database("artists.sqlite", { create: true });

// Create tables

db.query(
  `CREATE TABLE IF NOT EXISTS embeddings (
      id INTEGER PRIMARY KEY AUTOINCREMENT, 
      filename TEXT UNIQUE, 
      artist TEXT,
      projection_batch_x REAL, 
      projection_batch_y REAL
    )`
).run();

artists
  .query(
    `CREATE TABLE IF NOT EXISTS artists (
      id INTEGER PRIMARY KEY,
      name TEXT, years TEXT, genre TEXT,
      nationality TEXT, bio TEXT,
      wikipedia TEXT, paintings INTEGER
    )`
  )
  .run();

// get points for server
const getPoints = (artist) =>
  db
    .query(
      `SELECT filename, artist, projection_batch_x x, projection_batch_y y 
       FROM embeddings 
       WHERE artist = ?
       `
    )
    .all(artist);

// get artists for server
const getArtists = () =>
  artists
    .query(
      `SELECT name, years, genre, nationality, bio, wikipedia, paintings  FROM artists`
    )
    .all();

// get embeddings for dimensionality reduction
const getEmbeddings = () => {
  const db = new Database("db.sqlite", { readonly: true });
  const rows = db
    .query(
      `
    SELECT id, embedding 
    FROM embeddings 
    LIMIT 8000
  `
    )
    .all();
  db.close();
  return rows;
};

export { getPoints, getArtists, getEmbeddings };
