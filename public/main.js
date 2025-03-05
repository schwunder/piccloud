import { dimensions, range, scales, zoom, draw } from "./d3.js";
import { thumbnails, resized, artists } from "./load.js";
import { show, hit } from "./ui.js";

document.addEventListener("DOMContentLoaded", async () => {
  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");
  const resizedPane = document.getElementById("resized");
  const html = document.documentElement;
  const margin = 40;

  // Set initial canvas dimensions
  let dims = dimensions(canvas);

  // Fetch your data
  const r = await fetch("/api/points");
  if (!r.ok) throw new Error(r.statusText);
  const tempPts = await r.json();
  const pts = tempPts.slice(0, 1000);

  // Load thumbnails (must finish loading images before drawing)
  await thumbnails(pts);

  // We'll maintain the same zoom/pan pattern
  let currentT = d3.zoomIdentity;
  const onZoom = (tr) => {
    currentT = tr;
    draw(ctx, pts, s.x, s.y, dims, tr);
  };

  // Map coordinates from projection into x,y for each point
  const mapped = pts.map((p) => ({
    ...p,
    x: p.projection[0],
    y: p.projection[1],
  }));

  // Create D3 scales for x and y
  const s = scales(mapped, margin, dims);

  // Enable zoom
  zoom(canvas, onZoom);

  // Draw initial view
  draw(ctx, pts, s.x, s.y, dims, currentT);

  // Clicking logic for resizing or showing a larger pane
  canvas.addEventListener("click", async (e) => {
    const rect = canvas.getBoundingClientRect();
    const p = hit(pts, currentT, rect, e.clientX, e.clientY);
    if (p) {
      html.classList.add("show-resized");
      await show(p, resized, artists);
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
    draw(ctx, pts, s.x, s.y, dims, currentT);
  });
});
