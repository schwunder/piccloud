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

const getPoints = (artist) =>
  db
    .query(
      `SELECT filename, artist, projection_batch_x x, projection_batch_y y 
       FROM embeddings 
       WHERE filename GLOB '${artist}_[1-5].avif'
       `
    )
    .all();

const getArtists = () =>
  artists
    .query(
      `SELECT name, years, genre, nationality, bio, wikipedia, paintings  FROM artists`
    )
    .all();

export { getPoints, getArtists };
