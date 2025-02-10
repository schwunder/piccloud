(async () => {
  /* ============================================================
   * PART A: D3 & CANVAS DRAWING PIPELINE
   * ============================================================
   * This section handles:
   *  - Updating the canvas dimensions and D3 scale ranges.
   *  - Initializing D3 scales and attaching zoom behavior.
   *  - Pure coordinate and bounds calculations.
   *  - Drawing points on the canvas (including mutation of each point’s bounds).
   * ============================================================ */

  // Update the canvas dimensions to match the window.
  const updateDimensions = (canvas) => {
    const dimensions = {
      width: window.innerWidth,
      height: window.innerHeight,
    };
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    return dimensions;
  };

  // Update the range of D3 scales based on new dimensions.
  const updateScales = (xScale, yScale, dimensions, margin) => {
    xScale.range([margin, dimensions.width - margin]);
    yScale.range([dimensions.height - margin, margin]);
    return dimensions;
  };

  // Initialize D3 scales and attach zoom behavior.
  // onZoom is a callback that will be used to update the current transform and re-draw.
  const initScalesAndZoom = (canvas, points, margin, dimensions, onZoom) => {
    const xScale = d3
      .scaleLinear()
      .domain(d3.extent(points, (d) => d.x))
      .range([margin, dimensions.width - margin]);

    const yScale = d3
      .scaleLinear()
      .domain(d3.extent(points, (d) => d.y))
      .range([dimensions.height - margin, margin]);

    const zoom = d3
      .zoom()
      .scaleExtent([0.5, 20])
      .on("zoom", (event) => onZoom(event.transform));

    d3.select(canvas).call(zoom);
    return { xScale, yScale };
  };

  // Pure function: Compute the drawing coordinates and image size for a point.
  const getPointCoords = (point, xScale, yScale) => {
    const cx = xScale(point.x);
    const cy = yScale(point.y);
    const imgW = 80;
    const imgH = 80;
    return { cx, cy, imgW, imgH };
  };

  // Pure function: Compute the bounding box for a point’s image.
  const getPointBounds = (cx, cy, imgW, imgH) => ({
    x: cx - imgW / 2,
    y: cy - imgH / 2,
    width: imgW,
    height: imgH,
  });

  // Draw a single point (thumbnail plus a red dot) on the canvas.
  // Returns the computed bounds.
  const drawPoint = (context, point, xScale, yScale) => {
    const { cx, cy, imgW, imgH } = getPointCoords(point, xScale, yScale);
    context.drawImage(point.thumb, cx - imgW / 2, cy - imgH / 2, imgW, imgH);
    context.beginPath();
    context.arc(cx, cy, 2, 0, 2 * Math.PI);
    context.fillStyle = "red";
    context.fill();
    return getPointBounds(cx, cy, imgW, imgH);
  };

  // Clear the canvas, apply the current transform, and draw all points.
  // This function mutates the canvas context and updates each point’s bounds.
  const drawAllPoints = (
    context,
    points,
    xScale,
    yScale,
    dimensions,
    transform = d3.zoomIdentity
  ) => {
    context.save();
    context.clearRect(0, 0, dimensions.width, dimensions.height);
    context.translate(transform.x, transform.y);
    context.scale(transform.k, transform.k);
    points.forEach((point) => {
      point.bounds = drawPoint(context, point, xScale, yScale);
    });
    context.restore();
  };

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
