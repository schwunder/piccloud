import { Database } from "bun:sqlite";

const db = new Database("db.sqlite", { create: true });
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
  fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/api/points") {
      return new Response(JSON.stringify(getPoints()), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    if (url.pathname === "/") {
      return new Response(Bun.file("index.html"));
    }

    if (url.pathname === "/client.js") {
      return new Response(Bun.file("client.js"));
    }

    if (url.pathname === "/favicon.ico") {
      return new Response(Bun.file("favicon.ico"));
    }

    return new Response("Not Found", { status: 404 });
  },
});
