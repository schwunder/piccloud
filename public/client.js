import {
  updateDimensions,
  updateScales,
  initScalesAndZoom,
  drawAllPoints,
} from "./d3.js";
import {
  loadImagesForPoints,
  getCoordinates,
  findClickedPoint,
  loadAndDisplayArtist,
} from "./load.js";

document.addEventListener("DOMContentLoaded", async () => {
  // Get DOM elements and set parameters.
  const canvas = document.getElementById("canvas"),
    ctx = canvas.getContext("2d"),
    resizedPane = document.getElementById("resized"),
    html = document.documentElement,
    margin = 40;

  // Set canvas dimensions.
  let dims = updateDimensions(canvas);

  // Fetch point data.
  const res = await fetch("/api/points");
  console.log("Response:", res);
  if (!res.ok) throw new Error(res.statusText);
  const points = await res.json();
  console.log(`Total points received: ${points.length}`);

  // Load thumbnails for each point.
  await loadImagesForPoints(points);

  // Set up zoom handling.
  let currentTransform = d3.zoomIdentity;
  const onZoom = (t) => {
    currentTransform = t;
    drawAllPoints(ctx, points, scales.x, scales.y, dims, t);
  };

  // Initialize scales and attach zoom behavior.
  const { xScale, yScale } = initScalesAndZoom(
    canvas,
    points.map((p) => ({ ...p, x: p.projection[0], y: p.projection[1] })),
    margin,
    dims,
    onZoom
  );
  const scales = { x: xScale, y: yScale };

  // Initial drawing.
  drawAllPoints(ctx, points, scales.x, scales.y, dims, currentTransform);

  // Handle canvas clicks: convert click coordinates, detect hit, and load artist details.
  canvas.addEventListener("click", async (e) => {
    const rect = canvas.getBoundingClientRect(),
      coords = getCoordinates(e.clientX, e.clientY, currentTransform, rect),
      pt = findClickedPoint(points, coords);
    if (pt) {
      html.classList.add("show-resized");
      await loadAndDisplayArtist(pt);
    }
  });

  // Hide artist info when clicking outside the image.
  resizedPane.addEventListener("click", (e) => {
    if (e.target === resizedPane) html.classList.remove("show-resized");
  });

  // Update canvas and redraw on window resize.
  window.addEventListener("resize", () => {
    dims = updateDimensions(canvas);
    updateScales(scales.x, scales.y, dims, margin);
    drawAllPoints(ctx, points, scales.x, scales.y, dims, currentTransform);
  });
});
