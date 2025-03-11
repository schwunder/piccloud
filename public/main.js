import {
  dimensions,
  range,
  scales,
  zoom,
  draw,
  rerender,
  point,
  resetLastTransform,
  resetZoom,
} from "./d3.js";
import { thumbnails, resized, artists } from "./load.js";
import { show, hit } from "./ui.js";

// Define the image size as a constant at the top of the file
const IMAGE_SIZE = 75;

document.addEventListener("DOMContentLoaded", async () => {
  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");
  const resizedPane = document.getElementById("resized");
  const html = document.documentElement;
  const margin = 40;
  let cachedBitmap = null;
  let halfWidthBitmap = null;

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
    // Use the appropriate bitmap based on whether resized pane is visible
    updateBitmapBasedOnState();
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
  const halfWidthDims = { width: 16384 / 2, height: 16384 }; // Half width dimensions

  // Full-width bitmap creation
  canvas.width = fullDims.width;
  canvas.height = fullDims.height;

  // Create new scales for the high-res canvas
  const hiResScales = scales(
    mapped,
    margin * (fullDims.width / dims.width),
    fullDims
  );

  // Create scales for half-width bitmap
  const halfWidthMargin = margin * (halfWidthDims.width / dims.width);
  const halfWidthScales = scales(mapped, halfWidthMargin, halfWidthDims);

  // Draw using high-res scales
  draw(ctx, pts, hiResScales.x, hiResScales.y, fullDims);
  cachedBitmap = await createImageBitmap(canvas);

  // Create half-width bitmap
  canvas.width = halfWidthDims.width;
  canvas.height = halfWidthDims.height;

  // Draw using half-width scales
  draw(ctx, pts, halfWidthScales.x, halfWidthScales.y, halfWidthDims);
  halfWidthBitmap = await createImageBitmap(canvas);

  // Reset to viewport size
  canvas.width = dims.width;
  canvas.height = dims.height;

  // Calculate initial transform to fit everything
  const fullScale = Math.min(
    dims.width / fullDims.width,
    dims.height / fullDims.height
  );
  const halfWidthScale = Math.min(
    dims.width / halfWidthDims.width,
    dims.height / halfWidthDims.height
  );

  currentT = d3.zoomIdentity.scale(fullScale);
  const halfWidthT = d3.zoomIdentity.scale(halfWidthScale);

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
  canvas.addEventListener("click", (e) => {
    const rect = canvas.getBoundingClientRect();
    console.log("Canvas rect:", rect);
    console.log("Current transform:", currentT);

    // Calculate canvas-relative coordinates
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;
    console.log("Canvas-relative coordinates:", canvasX, canvasY);

    // Calculate transformed coordinates
    const transformedX = (canvasX - currentT.x) / currentT.k;
    const transformedY = (canvasY - currentT.y) / currentT.k;
    console.log("Transformed coordinates:", transformedX, transformedY);

    // Check if any points are near these coordinates
    const nearbyPoints = pts.filter((p) => {
      if (!p.bounds) {
        console.log("Point missing bounds:", p);
        return false;
      }

      const distance = Math.sqrt(
        Math.pow(transformedX - (p.bounds.x + p.bounds.width / 2), 2) +
          Math.pow(transformedY - (p.bounds.y + p.bounds.height / 2), 2)
      );

      return distance < 100; // Check points within 100 pixels
    });

    console.log("Nearby points:", nearbyPoints.length);
    if (nearbyPoints.length > 0) {
      console.log("First nearby point:", nearbyPoints[0]);
    }

    const p = hit(pts, currentT, rect, e.clientX, e.clientY);
    console.log("Hit result:", p);

    if (p) {
      html.classList.add("show-resized");

      // Update dimensions and scales if needed
      dims = dimensions(canvas);
      range(s.x, s.y, dims, margin);

      // Reset canvas to viewport size
      canvas.width = dims.width;
      canvas.height = dims.height;

      // Update scale factors for half-width view
      const halfWidthScale = Math.min(
        dims.width / halfWidthDims.width,
        dims.height / halfWidthDims.height
      );

      // Adjust current transform if necessary
      if (Math.abs(currentT.k - halfWidthScale) > 0.1) {
        currentT = d3.zoomIdentity.scale(halfWidthScale);
      }

      // Update bitmap immediately when showing the resized pane
      updateBitmapBasedOnState();

      // Then load the content asynchronously
      show(p, resized, artists);
    }
  });

  // Close enlarged view
  resizedPane.addEventListener("click", (e) => {
    if (e.target === resizedPane) {
      html.classList.remove("show-resized");

      // Update dimensions and scales if needed
      dims = dimensions(canvas);
      range(s.x, s.y, dims, margin);

      // Reset canvas to viewport size
      canvas.width = dims.width;
      canvas.height = dims.height;

      // Update scale factors for full-width view
      const fullScale = Math.min(
        dims.width / fullDims.width,
        dims.height / fullDims.height
      );

      // Adjust current transform if necessary
      if (Math.abs(currentT.k - fullScale) > 0.1) {
        currentT = d3.zoomIdentity.scale(fullScale);
      }

      updateBitmapBasedOnState();
    }
  });

  // Function to switch between full and half-width bitmaps
  function updateBitmapBasedOnState() {
    const isResizedVisible = html.classList.contains("show-resized");

    // Reset the last transform to force a redraw
    resetLastTransform();

    if (isResizedVisible) {
      // Use half-width bitmap
      rerender(ctx, dims, currentT, halfWidthBitmap);
    } else {
      // Use full-width bitmap
      rerender(ctx, dims, currentT, cachedBitmap);
    }
  }

  // Function to reset zoom to initial scale
  const resetZoomToInitial = () => {
    // Calculate initial transform to fit everything
    const fullScale = Math.min(
      dims.width / fullDims.width,
      dims.height / fullDims.height
    );

    // Use the resetZoom function from d3.js
    currentT = resetZoom(canvas, fullScale);

    // Update the display
    updateBitmapBasedOnState();

    return fullScale;
  };

  // Add keyboard shortcut (Escape key) to reset zoom
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      resetZoomToInitial();

      // Also close the resized pane if it's open
      if (html.classList.contains("show-resized")) {
        html.classList.remove("show-resized");
        updateBitmapBasedOnState();
      }
    }
  });

  // Expose the reset function globally for debugging
  window.resetZoom = resetZoomToInitial;
});
