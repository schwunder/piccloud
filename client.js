import {
  updateDimensions,
  updateScales,
  initScalesAndZoom,
  getPointCoords,
  getPointBounds,
  drawPoint,
  drawAllPoints,
} from "./d3.js"; // Your D3 & canvas drawing functions

import {
  loadImage,
  loadImagesForPoints,
  getCoordinates,
  isInBounds,
  findClickedPoint,
  updateArtistFields,
  loadAndDisplayArtist,
} from "./load.js"; // The extracted image/event-handling functions

(async () => {
  // Grab required DOM elements.
  const canvas = document.getElementById("canvas");
  const context = canvas.getContext("2d");
  const resizedPane = document.getElementById("resized");
  const html = document.documentElement;

  // 1. Set up the canvas dimensions.
  let dimensions = updateDimensions(canvas);

  // 2. Fetch point data.
  const pointsResponse = await fetch("/api/points");
  if (!pointsResponse.ok) throw new Error(pointsResponse.statusText);
  const points = await pointsResponse.json();
  console.log(`Total points received: ${points.length}`);

  // 3. Load thumbnail images and attach them (mutates the points).
  await loadImagesForPoints(points);

  // 4. Set up and maintain the current D3 zoom transform.
  let currentTransform = d3.zoomIdentity;
  const onZoom = (transform) => {
    currentTransform = transform;
    drawAllPoints(
      context,
      points,
      xScale,
      yScale,
      dimensions,
      currentTransform
    );
  };

  // 5. Initialize D3 scales and zoom behavior.
  const margin = 40;
  const { xScale, yScale } = initScalesAndZoom(
    canvas,
    points,
    margin,
    dimensions,
    onZoom
  );

  // 6. Perform the initial drawing of all points.
  drawAllPoints(context, points, xScale, yScale, dimensions, currentTransform);

  // 7. Install event listener on the canvas for hit detection.
  canvas.addEventListener("click", async (e) => {
    const rect = canvas.getBoundingClientRect();
    const coords = getCoordinates(e.clientX, e.clientY, currentTransform, rect);
    const clickedPoint = findClickedPoint(points, coords);
    if (clickedPoint) {
      console.log("Splitting viewport...");
      html.classList.add("show-resized");
      await loadAndDisplayArtist(clickedPoint);
    }
  });

  // 8. Install event listener on the resized pane to hide the artist display.
  resizedPane.addEventListener("click", ({ target }) => {
    if (target === resizedPane) {
      html.classList.remove("show-resized");
    }
  });

  // 9. On window resize, update dimensions, scales, and redraw the canvas.
  window.addEventListener("resize", () => {
    dimensions = updateDimensions(canvas);
    updateScales(xScale, yScale, dimensions, margin);
    drawAllPoints(
      context,
      points,
      xScale,
      yScale,
      dimensions,
      currentTransform
    );
  });
})();
