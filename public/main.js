import {
  dimensions,
  createScales,
  setupZoom,
  drawToBitmap,
  renderView,
  getFitScale,
  resetZoom,
  MAX_BITMAP_SIZE,
} from "./d3.js";

import { hitTest, showArtistInfo } from "./ui.js";
import { thumbnails, resized, artists } from "./load.js";

document.addEventListener("DOMContentLoaded", async () => {
  // DOM elements
  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");
  const html = document.documentElement;
  const resizedPane = document.getElementById("resized");

  // Application state
  let points = [];
  let fullBitmap = null;
  let halfBitmap = null;
  let currentTransform = d3.zoomIdentity;
  let isResizedView = false;

  // 1. Load data and images
  try {
    // Fetch points data
    const response = await fetch("/api/points");
    if (!response.ok) throw new Error(response.statusText);

    points = (await response.json()).slice(0, 8446).map((p) => ({
      ...p,
      x: p.projection[0],
      y: p.projection[1],
    }));

    // Load thumbnails
    await thumbnails(points);
  } catch (error) {
    console.error("Failed to load data:", error);
    return;
  }

  // 2. Create bitmaps
  try {
    const dims = dimensions(canvas);

    // Create full-width bitmap
    canvas.width = MAX_BITMAP_SIZE;
    canvas.height = MAX_BITMAP_SIZE;
    const fullScales = createScales(points, 40, {
      width: MAX_BITMAP_SIZE,
      height: MAX_BITMAP_SIZE,
    });
    drawToBitmap(
      ctx,
      points,
      fullScales,
      { width: MAX_BITMAP_SIZE, height: MAX_BITMAP_SIZE },
      "fullBounds"
    );
    fullBitmap = await createImageBitmap(canvas);

    // Create half-width bitmap
    canvas.width = MAX_BITMAP_SIZE / 2;
    canvas.height = MAX_BITMAP_SIZE;
    const halfScales = createScales(points, 40, {
      width: MAX_BITMAP_SIZE / 2,
      height: MAX_BITMAP_SIZE,
    });
    drawToBitmap(
      ctx,
      points,
      halfScales,
      { width: MAX_BITMAP_SIZE / 2, height: MAX_BITMAP_SIZE },
      "halfBounds"
    );
    halfBitmap = await createImageBitmap(canvas);

    // Reset canvas to viewport size
    canvas.width = dims.width;
    canvas.height = dims.height;
  } catch (error) {
    console.error("Failed to create bitmaps:", error);
    return;
  }

  // 3. Set up interactions

  // Zoom handler
  const onZoom = (transform) => {
    currentTransform = transform;
    updateView();
  };

  // Set up zoom behavior
  const zoomBehavior = setupZoom(canvas, onZoom);

  // Calculate initial scale to fit everything
  const dims = dimensions(canvas);
  const initialScale = getFitScale(dims, MAX_BITMAP_SIZE, MAX_BITMAP_SIZE);

  // Set initial transform
  currentTransform = d3.zoomIdentity.scale(initialScale);
  d3.select(canvas).call(zoomBehavior.transform, currentTransform);

  // 4. Set up event handlers

  // Canvas click - hit detection and detail view
  canvas.addEventListener("click", (e) => {
    const rect = canvas.getBoundingClientRect();
    // Use appropriate bounds based on current view
    const boundsKey = isResizedView ? "halfBounds" : "fullBounds";
    const point = hitTest(
      points,
      e.clientX,
      e.clientY,
      rect,
      currentTransform,
      boundsKey
    );

    if (point) {
      // Show detail view
      isResizedView = true;
      html.classList.add("show-resized");
      updateView();

      // Show artist info
      showArtistInfo(point, resized, artists);
    }
  });

  // Close detail view
  resizedPane.addEventListener("click", (e) => {
    if (e.target === resizedPane) {
      isResizedView = false;
      html.classList.remove("show-resized");
      updateView();
    }
  });

  // Escape key to reset zoom and close detail
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      // Close detail view if open
      if (isResizedView) {
        isResizedView = false;
        html.classList.remove("show-resized");
      }

      // Reset zoom
      currentTransform = resetZoom(
        canvas,
        getFitScale(dimensions(canvas), MAX_BITMAP_SIZE, MAX_BITMAP_SIZE)
      );

      updateView();
    }
  });

  // 5. Initial render
  updateView();

  // Update the view based on current state
  function updateView() {
    const currentBitmap = isResizedView ? halfBitmap : fullBitmap;
    const dims = dimensions(canvas);
    renderView(ctx, dims, currentTransform, currentBitmap);
  }
});
