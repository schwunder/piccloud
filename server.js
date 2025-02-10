import { getPoints, getArtists } from "./db.js";

const ARTIST = "Albrecht_Durer";
const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

const serve = (input) =>
  typeof input === "string"
    ? () => Bun.file(input)
    : () => JSON.stringify(input);

const routes = {
  "/api/points": serve(getPoints(ARTIST)),
  "/api/artists": serve(getArtists()),
  "/": serve("index.html"),
  "/client.js": serve("client.js"),
  "/d3.js": serve("d3.js"),
  "/favicon.ico": serve("favicon.ico"),
};

Bun.serve({
  port: 3000,
  fetch: (req) =>
    new Response(routes[new URL(req.url).pathname]?.() || "Not Found", {
      status: routes[new URL(req.url).pathname] ? 200 : 404,
      headers: req.url.includes("/api/") ? corsHeaders : {},
    }),
});
