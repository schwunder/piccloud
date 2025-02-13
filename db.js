import { Database } from "bun:sqlite";

const embeddings = new Database("db.sqlite", { create: true });
const artists = new Database("artists.sqlite", { create: true });
const artistsNew = new Database("artistsnew.sqlite", { create: true });
const embeddingsNew = new Database("embeddings.sqlite", { create: true });
const projections = new Database("projections.sqlite", { create: true });
const art = new Database("art.sqlite", { create: true });

// Create tables

// art

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

embeddings
  .query(
    `CREATE TABLE IF NOT EXISTS embeddings (
      id INTEGER PRIMARY KEY AUTOINCREMENT, 
      filename TEXT UNIQUE, 
      artist TEXT,
      embedding BLOB
    )`
  )
  .run();

projections
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

artists
  .query(
    `CREATE TABLE IF NOT EXISTS artists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE, years TEXT, genre TEXT,
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

const movefromdbslitetoembeddingssqlite = () => {
  const db = new Database("db.sqlite");
  const rows = db
    .query(`SELECT filename, artist, embedding FROM embeddings`)
    .all();
  db.close();
  const embeddingsNew = new Database("embeddings.sqlite");

  // Drop the existing table if it exists
  embeddingsNew.query(`DROP TABLE IF EXISTS embeddings`).run();

  // Create the table fresh
  embeddingsNew
    .query(
      `CREATE TABLE IF NOT EXISTS embeddings (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        filename TEXT UNIQUE, 
        artist TEXT,
        embedding BLOB
      )`
    )
    .run();

  // Now insert the data
  for (const row of rows) {
    embeddingsNew
      .query(
        `INSERT INTO embeddings (filename, artist, embedding) VALUES (?, ?, ?)`
      )
      .run(row.filename, row.artist, row.embedding);
  }
  embeddingsNew.close();
};

const movefromArtistsToArtistsNew = () => {
  const db = new Database("artists.sqlite");
  const rows = db
    .query(
      `SELECT name, years, genre, nationality, bio, wikipedia, paintings FROM artists`
    )
    .all();
  db.close();
  const artistsNew = new Database("artistsnew.sqlite");

  // Create the table first
  artistsNew
    .query(
      `CREATE TABLE IF NOT EXISTS artists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE, years TEXT, genre TEXT,
        nationality TEXT, bio TEXT,
        wikipedia TEXT, paintings INTEGER
      )`
    )
    .run();

  // Now insert the data
  for (const row of rows) {
    artistsNew
      .query(
        `INSERT INTO artists (name, years, genre, nationality, bio, wikipedia, paintings) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        row.name,
        row.years,
        row.genre,
        row.nationality,
        row.bio,
        row.wikipedia,
        row.paintings
      );
  }
  artistsNew.close();
};

const movefromdbtoprojections = () => {
  const db = new Database("db.sqlite");
  const rows = db.query(`SELECT filename, artist FROM embeddings`).all();
  db.close();
  const projections = new Database("projections.sqlite");

  // Drop the existing table if it exists
  projections.query(`DROP TABLE IF EXISTS projections`).run();

  // Create the table fresh
  projections
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

  // Now insert the data
  for (const row of rows) {
    projections
      .query(`INSERT INTO projections (filename, artist) VALUES (?, ?)`)
      .run(row.filename, row.artist);
  }
  projections.close();
};

const consolidateTablesintoartsqlite = () => {
  // Get embeddings data
  const embeddings = new Database("embeddings.sqlite");
  const embeddingsRows = embeddings
    .query(`SELECT filename, artist, embedding FROM embeddings`)
    .all();
  embeddings.close();

  // Get artists data
  const artists = new Database("artistsnew.sqlite");
  const artistsRows = artists
    .query(
      `SELECT name, years, genre, nationality, bio, wikipedia, paintings FROM artists`
    )
    .all();
  artists.close();

  // Get projections data
  const projections = new Database("projections.sqlite");
  const projectionsRows = projections
    .query(
      `SELECT filename, artist, pca_projection, umap_projection, tsne_projection FROM projections`
    )
    .all();
  projections.close();

  // Open art database and create tables
  const art = new Database("art.sqlite", { create: true });

  // Drop existing tables if they exist
  art.query(`DROP TABLE IF EXISTS embeddings`).run();
  art.query(`DROP TABLE IF EXISTS artists`).run();
  art.query(`DROP TABLE IF EXISTS projections`).run();

  // Create tables
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
      name TEXT UNIQUE, years TEXT, genre TEXT,
      nationality TEXT, bio TEXT,
      wikipedia TEXT, paintings INTEGER
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

  // Insert data into the new tables
  for (const row of embeddingsRows) {
    art
      .query(
        `INSERT INTO embeddings (filename, artist, embedding) VALUES (?, ?, ?)`
      )
      .run(row.filename, row.artist, row.embedding);
  }

  for (const row of artistsRows) {
    art
      .query(
        `INSERT INTO artists (name, years, genre, nationality, bio, wikipedia, paintings) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        row.name,
        row.years,
        row.genre,
        row.nationality,
        row.bio,
        row.wikipedia,
        row.paintings
      );
  }

  for (const row of projectionsRows) {
    art
      .query(
        `INSERT INTO projections (filename, artist, pca_projection, umap_projection, tsne_projection) 
       VALUES (?, ?, ?, ?, ?)`
      )
      .run(
        row.filename,
        row.artist,
        row.pca_projection,
        row.umap_projection,
        row.tsne_projection
      );
  }

  art.close();
};

export { getPoints, getArtists, getEmbeddings };

consolidateTablesintoartsqlite();
