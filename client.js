(async () => {
  const canvas = document.getElementById("canvas");
  const context = canvas.getContext("2d");
  const resizedPane = document.getElementById("resized");
  const html = document.documentElement; // Apply class here to affect the entire page

  // === Canvas Dimension Management ===
  // Handles window resizing and scale updates
  // Dependencies: None
  // Used by: D3 zoom handling, window resize events
  // Suggestion: Group with d3 scale updates since they're tightly coupled
  const canvasDimensions = {
    update: (canvas) => {
      // Suggestion: This pure calculation could be separated from canvas mutation
      const dimensions = {
        width: window.innerWidth,
        height: window.innerHeight,
      };

      // Necessary mutation - keep this separate from pure calculation
      canvas.width = dimensions.width;
      canvas.height = dimensions.height;

      return dimensions;
    },

    // Suggestion: Could return new scale instances instead of mutating
    // But needs careful coordination with d3 zoom behavior
    updateScales: (xScale, yScale, { width, height }, margin) => {
      xScale.range([margin, width - margin]);
      yScale.range([height - margin, margin]);
      return { width, height, margin };
    },
  };

  let dimensions = canvasDimensions.update(canvas);

  // === Image Loading Utilities ===
  // Handles all image loading operations
  // Dependencies: None
  // Used by: Initial point setup, artist display
  // Note: Must maintain point mutation pattern as other modules depend on it
  const loadImages = {
    single: async (filename, isResized = false) => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = `http://localhost:3001/${
          isResized ? "resized" : "thumbnails"
        }/${filename}`;
        img.onload = () => resolve(img);
        img.onerror = (err) => reject(`Failed to load ${filename}: ${err}`);
      });
    },

    forPoints: async (points) => {
      const thumbnails = await Promise.all(
        points.map((p) => loadImages.single(p.filename))
      );
      points.forEach((point, i) => {
        point.thumb = thumbnails[i];
      });
      return points;
    },
  };

  try {
    const response = await fetch("/api/points");
    if (!response.ok) throw new Error(response.statusText);

    const points = await response.json();
    console.log(`Total points received: ${points.length}`);

    await loadImages.forPoints(points);

    const margin = 40;
    // Suggestion: Group these d3 scale initializations with zoom handling
    const xScale = d3
      .scaleLinear()
      .domain(d3.extent(points, (d) => d.x))
      .range([margin, dimensions.width - margin]);
    const yScale = d3
      .scaleLinear()
      .domain(d3.extent(points, (d) => d.y))
      .range([dimensions.height - margin, margin]);

    // Suggestion: This transform state could be managed alongside other d3 state
    let currentTransform = d3.zoomIdentity;

    // === Canvas Drawing Functions ===
    // Core rendering logic for points and images
    // Dependencies: Canvas context, scales, point data
    // Used by: Zoom handler, window resize
    // Note: Coordinate and bounds calculations can be pure, but drawing must mutate canvas
    // These pure functions are working well - could be model for other calculations
    const getPointCoords = (point, xScale, yScale) => {
      const [cx, cy] = [xScale(point.x), yScale(point.y)];
      const [imgW, imgH] = [80, 80];
      return { cx, cy, imgW, imgH };
    };

    const getPointBounds = (cx, cy, imgW, imgH) => ({
      x: cx - imgW / 2,
      y: cy - imgH / 2,
      width: imgW,
      height: imgH,
    });

    // Suggestion: Drawing function could be split into pure calculation and canvas mutation
    const drawPoint = (context, point, xScale, yScale) => {
      const { cx, cy, imgW, imgH } = getPointCoords(point, xScale, yScale);

      // Canvas mutations must stay together
      context.drawImage(point.thumb, cx - imgW / 2, cy - imgH / 2, imgW, imgH);
      context.beginPath();
      context.arc(cx, cy, 2, 0, 2 * Math.PI);
      context.fillStyle = "red";
      context.fill();

      return getPointBounds(cx, cy, imgW, imgH);
    };

    // Suggestion: Draw function could separate transform calculations from canvas operations
    function draw(transform = d3.zoomIdentity) {
      const { x, y, k } = transform;

      // Canvas context operations must stay sequential
      context.save();
      context.clearRect(0, 0, dimensions.width, dimensions.height);
      context.translate(x, y);
      context.scale(k, k);

      // Point drawing could be made more functional
      points.forEach((point) => {
        point.bounds = drawPoint(context, point, xScale, yScale);
      });

      context.restore();
    }

    // === D3 Zoom Handling ===
    // Manages zoom behavior and transform updates
    // Dependencies: Canvas context, draw function, currentTransform
    // Used by: Canvas initialization, point rendering
    // Suggestion: Could group with scale initialization since they're both d3 setup
    // Suggestion: These d3 zoom handlers could be grouped with scale initialization
    const zoomHandler = {
      init: (canvas, onZoom) => {
        const zoom = d3.zoom().scaleExtent([0.5, 20]).on("zoom", onZoom);
        d3.select(canvas).call(zoom);
        return zoom;
      },

      // Could return new transform instead of mutating global state
      handleZoom: ({ transform }) => {
        currentTransform = transform;
        draw(transform);
      },
    };

    const zoom = zoomHandler.init(canvas, zoomHandler.handleZoom);

    // === Event Handling: Click Detection ===
    // Manages click coordinates and point detection
    // Dependencies: Point bounds, currentTransform
    // Used by: Canvas click handler
    // Note: Pure calculations working well here, keep this pattern
    // These pure detection functions are a good pattern to follow
    const pointHitDetection = {
      getCoordinates: (clientX, clientY, transform, rect) => ({
        x: (clientX - rect.left - transform.x) / transform.k,
        y: (clientY - rect.top - transform.y) / transform.k,
      }),

      isInBounds: (x, y, bounds) =>
        x >= bounds.x &&
        x <= bounds.x + bounds.width &&
        y >= bounds.y &&
        y <= bounds.y + bounds.height,

      findClickedPoint: (points, coords) =>
        points.find((point) =>
          pointHitDetection.isInBounds(coords.x, coords.y, point.bounds)
        ),
    };

    // === Artist Data Display Handling ===
    // Manages artist information display and image loading
    // Dependencies: loadImages, DOM elements, point data
    // Used by: Point click handler
    // Note: DOM updates must be mutations, but field mapping can be pure
    // Suggestion: Artist display could separate data preparation from DOM updates
    const artistDisplay = {
      updateFields: (artist) => {
        const fields = [
          "bio",
          "genre",
          "name",
          "nationality",
          "paintings",
          "wikipedia",
          "years",
        ];

        // This field mapping is pure - good pattern
        const updates = fields.map((field) => ({
          element: document.getElementById(field),
          value: artist[field],
        }));

        // DOM updates must stay as mutations
        updates.forEach(({ element, value }) => (element.textContent = value));
      },

      async loadAndDisplay(clickedPoint) {
        const imageElement = document.getElementById("image");
        imageElement.innerHTML = "<p>Loading resized image...</p>";

        try {
          const [resizedImg, artists] = await Promise.all([
            loadImages.single(clickedPoint.filename, true),
            fetch("/api/artists").then((res) =>
              res.ok ? res.json() : Promise.reject(res.statusText)
            ),
          ]);

          imageElement.innerHTML = "";
          imageElement.appendChild(resizedImg);

          const artist = artists.find((a) => a.name === clickedPoint.artist);
          if (artist) {
            artistDisplay.updateFields(artist);
          }
        } catch (err) {
          console.error(err);
          imageElement.textContent = `Error loading ${clickedPoint.filename}: ${err}`;
        }
      },
    };

    canvas.addEventListener("click", async (e) => {
      const rect = canvas.getBoundingClientRect();
      const coords = pointHitDetection.getCoordinates(
        e.clientX,
        e.clientY,
        currentTransform,
        rect
      );

      const clickedPoint = pointHitDetection.findClickedPoint(points, coords);

      if (clickedPoint) {
        console.log("Splitting viewport...");
        html.classList.add("show-resized");
        await artistDisplay.loadAndDisplay(clickedPoint);
      }
    });

    resizedPane.addEventListener("click", ({ target }) => {
      if (target === resizedPane) {
        html.classList.remove("show-resized");
      }
    });

    draw(currentTransform);

    window.addEventListener("resize", () => {
      dimensions = canvasDimensions.update(canvas);
      canvasDimensions.updateScales(xScale, yScale, dimensions, margin);
      draw(currentTransform);
    });
  } catch (error) {
    console.error("Error loading data:", error);
  }
})();
