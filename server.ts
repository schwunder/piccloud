import { type Serve } from "bun";
import {
  points,
  artists,
  type ProjectionResult,
  type Artist,
  type ProjectionType,
} from "./db";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
} as const;

interface PointMetadata {
  filename: string;
  artist: string;
}

type PointsResponse = ReturnType<typeof points>;
type ArtistsResponse = ReturnType<typeof artists>;
type PointsMetadataResponse = PointMetadata[];

interface Handlers {
  points: typeof points;
  artists: typeof artists;
  points_metadata: () => PointsMetadataResponse;
}

const handlers: Handlers = {
  points,
  artists,
  points_metadata: () => {
    const data = points();
    return data.metadata.filenames.map((filename, i) => ({
      filename,
      artist: data.metadata.artists[i],
    }));
  },
};

export default {
  port: 3000,
  fetch: async (req: Request): Promise<Response> => {
    try {
      const path = new URL(req.url).pathname;

      if (!path.startsWith("/api/")) {
        const filePath = "public" + ((path === "/" && "/index.html") || path);
        try {
          // Handle JavaScript requests by mapping to TypeScript files
          if (filePath.endsWith(".js")) {
            const tsPath = filePath.replace(/\.js$/, ".ts");
            console.log("TypeScript path:", tsPath);
            const tsFile = Bun.file(tsPath);
            if (await tsFile.exists()) {
              console.log("Building TypeScript file:", tsPath);
              const transpiled = await Bun.build({
                entrypoints: [tsPath],
                target: "browser",
                format: "esm",
                minify: false,
                sourcemap: "inline",
              });

              if (!transpiled.success) {
                console.error("Failed to transpile:", transpiled.logs);
                return new Response("Build Error", {
                  status: 500,
                  headers: corsHeaders,
                });
              }

              console.log("Successfully transpiled:", tsPath);
              const output = await transpiled.outputs[0].text();
              return new Response(output, {
                headers: {
                  ...corsHeaders,
                  "Content-Type": "application/javascript",
                },
              });
            }
          }

          // Handle other files
          const file = Bun.file(filePath);
          const exists = await file.exists();
          if (!exists) {
            return new Response("Not Found", {
              status: 404,
              headers: corsHeaders,
            });
          }
          return new Response(file, { headers: corsHeaders });
        } catch (err) {
          console.error("Error serving file:", err);
          return new Response("Not Found", {
            status: 404,
            headers: corsHeaders,
          });
        }
      }

      const key = path.slice(5) as keyof Handlers;
      const handler = handlers[key];

      if (!handler) {
        return new Response("Not Found", { status: 404, headers: corsHeaders });
      }

      if (key === "points") {
        const data = handler() as PointsResponse;
        const header = new Float32Array([
          1.0,
          1.0,
          data.projections.length / 2,
        ]);
        return new Response(
          new Blob([
            new Uint8Array(header.buffer),
            new Uint8Array(data.projections.buffer),
          ]),
          {
            status: 200,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/octet-stream",
            },
          }
        );
      }

      return new Response(JSON.stringify(handler()), {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    } catch (err) {
      console.error("Error handling request:", err);
      return new Response("Internal Server Error", {
        status: 500,
        headers: corsHeaders,
      });
    }
  },
} satisfies Serve;
