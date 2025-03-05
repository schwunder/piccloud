import { Database } from "bun:sqlite";

const art = new Database("art.sqlite", { readonly: true });

const points = (projectionType = "umap") => {
  return art
    .query(
      `SELECT filename, artist, ${projectionType}_projection 
      FROM projections 
    `
    )
    .values()
    .map(([filename, artist, projection]) => ({
      filename,
      artist,
      projection: JSON.parse(projection),
    }));
};

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
