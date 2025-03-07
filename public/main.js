import { dimensions, range, scales, zoom, draw, rerender } from "./d3.js";
import { thumbnails, resized, artists } from "./load.js";
import { show, hit } from "./ui.js";

document.addEventListener("DOMContentLoaded", async () => {
  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");
  const resizedPane = document.getElementById("resized");
  const html = document.documentElement;
  const margin = 40;
  let cachedBitmap = null;

  // Set initial canvas dimensions
  let dims = dimensions(canvas);

  // Fetch your data
  const r = await fetch("/api/points");
  if (!r.ok) throw new Error(r.statusText);
  const tempPts = await r.json();
  const pts = tempPts.slice(0, 8446);

  // Load thumbnails (must finish loading images before drawing)
  console.time("⏳ Image Loading Time");
  await thumbnails(pts);
  console.timeEnd("⏳ Image Loading Time");

  // We'll maintain the same zoom/pan pattern
  let currentT = d3.zoomIdentity;
  const onZoom = (tr) => {
    currentT = tr;
    rerender(ctx, dims, tr, cachedBitmap);
  };

  // Map coordinates from projection into x,y for each point
  const mapped = pts.map((p) => ({
    ...p,
    x: p.projection[0],
    y: p.projection[1],
  }));

  // Create D3 scales for x and y
  const s = scales(mapped, margin, dims);

  // Initial draw and cache
  console.time("⏳ Initial Drawing Time");

  // Maximum resolution square bitmap (16384 is typical browser max)
  const fullDims = { width: 16384, height: 16384 };

  canvas.width = fullDims.width;
  canvas.height = fullDims.height;

  // Create new scales for the high-res canvas
  const hiResScales = scales(
    mapped,
    margin * (fullDims.width / dims.width),
    fullDims
  );

  // Draw using high-res scales
  draw(ctx, pts, hiResScales.x, hiResScales.y, fullDims);
  cachedBitmap = await createImageBitmap(canvas);

  // Reset to viewport size
  canvas.width = dims.width;
  canvas.height = dims.height;

  // Calculate initial transform to fit everything
  const scale = Math.min(
    dims.width / fullDims.width,
    dims.height / fullDims.height
  );
  currentT = d3.zoomIdentity.scale(scale);

  // Initial display with fit-to-view transform
  rerender(ctx, dims, currentT, cachedBitmap);

  console.timeEnd("⏳ Initial Drawing Time");
  console.log("✅ Bitmap cached successfully");

  // Test function for redraw
  window.testRedraw = function () {
    console.time("⏳ Bitmap Redraw Time");
    if (cachedBitmap) {
      ctx.clearRect(0, 0, dims.width, dims.height);
      ctx.drawImage(cachedBitmap, 0, 0);
    }
    console.timeEnd("⏳ Bitmap Redraw Time");
  };

  // Enable zoom
  zoom(canvas, onZoom);

  // Update the click event listener to use the hit detection function from ui.js
  canvas.addEventListener("click", async (e) => {
    const rect = canvas.getBoundingClientRect();
    const p = hit(pts, currentT, rect, e.clientX, e.clientY);
    if (p) {
      html.classList.add("show-resized");
      await show(p, resized, artists);
      console.log("Clicked on image at original coordinates:", p.projection);
    }
  });

  // Close enlarged view
  resizedPane.addEventListener("click", (e) => {
    if (e.target === resizedPane) {
      html.classList.remove("show-resized");
    }
  });

  // On window resize, re-measure and redraw
  window.addEventListener("resize", () => {
    dims = dimensions(canvas);
    range(s.x, s.y, dims, margin);

    // Maintain high-res drawing on resize
    canvas.width = fullDims.width;
    canvas.height = fullDims.height;
    draw(ctx, pts, s.x, s.y, fullDims);
    createImageBitmap(canvas).then((bitmap) => {
      cachedBitmap = bitmap;
      canvas.width = dims.width;
      canvas.height = dims.height;
      rerender(ctx, dims, currentT, bitmap);
    });
  });
});
