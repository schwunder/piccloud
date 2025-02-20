import { getPoints, getArtists } from "./db.js";

const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

const serve = (input) =>
  typeof input === "string"
    ? () => new Response(Bun.file(input))
    : () =>
        new Response(JSON.stringify(input), {
          headers: { "Content-Type": "application/json" },
        });

const routes = {
  "/api/points": serve(getPoints("Albrecht_Durer", "umap")),
  "/api/artists": serve(getArtists()),
  "/": serve("public/index.html"),
  "/client.js": serve("public/client.js"),
  "/d3.js": serve("public/d3.js"),
  "/load.js": serve("public/load.js"),
  "/favicon.ico": serve("public/favicon.ico"),
};

Bun.serve({
  port: 3000,
  fetch: (req) =>
    routes[new URL(req.url).pathname]?.() ||
    new Response("Not Found", {
      status: 404,
      headers: req.url.includes("/api/") ? corsHeaders : {},
    }),
});
