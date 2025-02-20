import { points, artists } from "./db.js";

Bun.serve({
  port: 3000,
  fetch: (req) => {
    const path = new URL(req.url).pathname;

    if (!path.startsWith("/api/")) {
      return new Response(
        Bun.file("public" + ((path === "/" && "/index.html") || path))
      );
    }

    const handlers = {
      points: () => points("Albrecht Durer", "umap", 5),
      artists,
    };
    const key = path.slice(5);

    return new Response(JSON.stringify(handlers[key]()), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  },
});
