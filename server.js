import { Database } from "bun:sqlite";

const db = new Database("db.sqlite", { create: true, readwrite: true });
db.query(
  `CREATE TABLE IF NOT EXISTS embeddings (
  id INTEGER PRIMARY KEY AUTOINCREMENT, filename TEXT UNIQUE,
  projection_batch_x REAL, projection_batch_y REAL
)`
).run();

const getPoints = () =>
  db
    .query(
      "SELECT filename, projection_batch_x x, projection_batch_y y FROM embeddings"
    )
    .all();

Bun.serve({
  port: 3000,
  async fetch(req) {
    if (new URL(req.url).pathname === "/api/points")
      return new Response(JSON.stringify(getPoints()), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });

    const files = {
      "/": "./index.html",
      "/client.js": "./client.js",
      "/favicon.ico": "./favicon.ico",
    };
    const file = files[new URL(req.url).pathname];
    return file
      ? new Response(Bun.file(file))
      : new Response("Not Found", { status: 404 });
  },
});
