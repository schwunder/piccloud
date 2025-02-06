import { getAllEmbeddings } from "./db.js";

// Start the API server
Bun.serve({
  port: 3000,
  async fetch(request) {
    const pathname = new URL(request.url).pathname;

    // Handle /api/points endpoint
    if (pathname === "/api/points") {
      return new Response(JSON.stringify(getAllEmbeddings()), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // Serve essential static files
    const staticFiles = {
      "/": "./index.html",
      "/client.js": "./client.js",
      "/sw.js": "./sw.js",
      "/favicon.ico": "./favicon.ico",
    };

    const filePath = staticFiles[pathname];
    if (filePath) {
      try {
        const file = Bun.file(filePath);
        if (await file.exists()) {
          return new Response(file);
        }
      } catch (err) {
        console.error(`Error serving ${pathname}:`, err);
      }
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log("API server running at http://localhost:3000");
