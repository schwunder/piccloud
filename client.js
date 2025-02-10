import {
  updateDimensions,
  updateScales,
  initScalesAndZoom,
  getPointCoords,
  getPointBounds,
  drawPoint,
  drawAllPoints,
} from "./d3.js";

(async () => {
  /* ============================================================
   * PART B: IMAGE LOADING & EVENT HANDLING PIPELINE
   * ============================================================
   * This section handles:
   *  - Loading images and attaching thumbnails (mutating the points).
   *  - Converting raw mouse events into canvas coordinates.
   *  - Hit detection and, if a point is clicked, loading & displaying
   *    a resized image and updating artist info in the DOM.
   * ============================================================
   */

  // Load a single image (either a thumbnail or a resized version).
  const loadImage = (filename, isResized = false) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.src = `http://localhost:3001/${
        isResized ? "resized" : "thumbnails"
      }/${filename}`;
      img.onload = () => resolve(img);
      img.onerror = (err) => reject(`Failed to load ${filename}: ${err}`);
    });

  // Load thumbnail images for all points and attach them.
  // (This function mutates the points by adding a `thumb` property.)
  const loadImagesForPoints = async (points) => {
    const thumbnails = await Promise.all(
      points.map((p) => loadImage(p.filename))
    );
    points.forEach((point, i) => {
      point.thumb = thumbnails[i];
    });
    return points;
  };

  // Convert client (mouse) coordinates into untransformed canvas coordinates.
  const getCoordinates = (clientX, clientY, transform, rect) => ({
    x: (clientX - rect.left - transform.x) / transform.k,
    y: (clientY - rect.top - transform.y) / transform.k,
  });

  // Check if (x, y) is within a given bounding box.
  const isInBounds = (x, y, bounds) =>
    x >= bounds.x &&
    x <= bounds.x + bounds.width &&
    y >= bounds.y &&
    y <= bounds.y + bounds.height;

  // Find the first point whose bounds contain the given coordinates.
  const findClickedPoint = (points, coords) =>
    points.find((point) => isInBounds(coords.x, coords.y, point.bounds));

  // Update DOM fields with the artist's data.
  const updateArtistFields = (artist) => {
    const fields = [
      "bio",
      "genre",
      "name",
      "nationality",
      "paintings",
      "wikipedia",
      "years",
    ];
    fields.forEach((field) => {
      const el = document.getElementById(field);
      if (el) {
        el.textContent = artist[field] || "";
      }
    });
  };

  // Load a resized image and artist data, then update the artist display.
  const loadAndDisplayArtist = async (clickedPoint) => {
    const imageElement = document.getElementById("image");
    imageElement.innerHTML = "<p>Loading resized image...</p>";
    try {
      const [resizedImg, artists] = await Promise.all([
        loadImage(clickedPoint.filename, true),
        fetch("/api/artists").then((res) => {
          if (res.ok) return res.json();
          throw new Error(res.statusText);
        }),
      ]);
      imageElement.innerHTML = "";
      imageElement.appendChild(resizedImg);
      const artist = artists.find((a) => a.name === clickedPoint.artist);
      if (artist) {
        updateArtistFields(artist);
      }
    } catch (err) {
      console.error(err);
      imageElement.textContent = `Error loading ${clickedPoint.filename}: ${err}`;
    }
  };

  /* ============================================================
   * MAIN COMPOSITION: ASSEMBLE THE PIPELINES
   * ============================================================
   * This section ties together the two pipelines.
   * It sets up the canvas and D3 zoom, loads the images,
   * draws the points, and installs the event listeners.
   * ============================================================
   */

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
