import { Database } from "bun:sqlite";

export enum ProjectionType {
  UMAP = "umap",
  PCA = "pca",
  TSNE = "tsne",
}

export interface Artist {
  name: string;
  years: string;
  genre: string;
  nationality: string;
  bio: string;
  wikipedia: string;
  paintings: number;
}

export interface ProjectionResult {
  filename: string;
  artist: string;
  projection: Float32Array;
}

interface Projection {
  id: number;
  filename: string;
  artist: string;
  pca_projection: Uint8Array;
  umap_projection: Uint8Array;
  tsne_projection: Uint8Array;
}

interface BinaryPointsResult {
  metadata: {
    filenames: string[];
    artists: string[];
  };
  projections: Float32Array;
}

interface ProjectionRow {
  filename: string;
  artist: string;
  umap_projection: string;
  pca_projection: string;
  tsne_projection: string;
}

// Initialize the database (creating tables if needed)
let db = new Database("art.sqlite", { create: true });

// Function to set test database
export const setTestDb = (testDb: Database) => {
  db = testDb;
};

db.query(
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
).run();

db.query(
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
).run();

/**
 * Retrieves points from the projections table with their coordinates as Float32Array.
 * @param projectionType - The type of projection to retrieve (UMAP, PCA, or TSNE)
 * @returns Structured data ready for binary serialization
 */
export const points = (
  projectionType: ProjectionType = ProjectionType.UMAP
): BinaryPointsResult => {
  const rows = db
    .query(
      `SELECT filename, artist, ${projectionType}_projection FROM projections LIMIT 1000`
    )
    .all() as ProjectionRow[];

  // Pre-allocate arrays for better performance
  const filenames: string[] = new Array(rows.length);
  const artists: string[] = new Array(rows.length);
  const projections = new Float32Array(rows.length * 2); // Assuming 2D projections

  // Fill arrays in a single pass
  rows.forEach((p, i) => {
    filenames[i] = p.filename;
    artists[i] = p.artist;
    const proj = JSON.parse(p[`${projectionType}_projection`] || "[]");
    projections[i * 2] = proj[0];
    projections[i * 2 + 1] = proj[1];
  });

  return {
    metadata: {
      filenames,
      artists,
    },
    projections,
  };
};

/**
 * Retrieves all artists from the database.
 */
export const artists = (): Artist[] => {
  return db
    .query(
      `
      SELECT name, years, genre, nationality, bio, wikipedia, paintings
      FROM artists
    `
    )
    .all() as Artist[];
};
