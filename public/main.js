import { dimensions, range, scales, zoom, draw } from "./d3.js";
import { thumbnails, resized, artists } from "./load.js";
import { show, hit } from "./ui.js";

document.addEventListener("DOMContentLoaded", async () => {
  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");
  const resizedPane = document.getElementById("resized");
  const html = document.documentElement;
  const margin = 40;

  let dims = dimensions(canvas);

  const r = await fetch("/api/points");
  if (!r.ok) throw new Error(r.statusText);
  const pts = await r.json();

  await thumbnails(pts);

  let currentT = d3.zoomIdentity;
  const onZoom = (tr) => {
    currentT = tr;
    draw(ctx, pts, s.x, s.y, dims, tr);
  };

  const mapped = pts.map((p) => ({
    ...p,
    x: p.projection[0],
    y: p.projection[1],
  }));
  const s = scales(mapped, margin, dims);
  zoom(canvas, onZoom);
  draw(ctx, pts, s.x, s.y, dims, currentT);

  canvas.addEventListener("click", async (e) => {
    const rect = canvas.getBoundingClientRect();
    const p = hit(pts, currentT, rect, e.clientX, e.clientY);
    if (p) {
      html.classList.add("show-resized");
      await show(p, resized, artists);
    }
  });

  resizedPane.addEventListener("click", (e) => {
    if (e.target === resizedPane) html.classList.remove("show-resized");
  });

  window.addEventListener("resize", () => {
    dims = dimensions(canvas);
    range(s.x, s.y, dims, margin);
    draw(ctx, pts, s.x, s.y, dims, currentT);
  });
});
