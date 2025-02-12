// load.js

/**
 * Load a single image (either a thumbnail or a resized version).
 * @param {string} filename - The filename of the image.
 * @param {boolean} [isResized=false] - Whether to load the resized version.
 * @returns {Promise<HTMLImageElement>} A promise that resolves with the loaded image.
 */
export const loadImage = (filename, isResized = false) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.src = `http://localhost:3001/${
      isResized ? "resized" : "thumbnails"
    }/${filename}`;
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(`Failed to load ${filename}: ${err}`);
  });

/**
 * Load thumbnail images for all points and attach them.
 * (This function mutates the points by adding a `thumb` property.)
 * @param {Array} points - Array of point objects.
 * @returns {Promise<Array>} A promise that resolves with the same points array.
 */
export const loadImagesForPoints = async (points) => {
  const thumbnails = await Promise.all(
    points.map((p) => loadImage(p.filename))
  );
  points.forEach((point, i) => {
    point.thumb = thumbnails[i];
  });
  return points;
};

/**
 * Convert client (mouse) coordinates into untransformed canvas coordinates.
 * @param {number} clientX - The mouse event's clientX.
 * @param {number} clientY - The mouse event's clientY.
 * @param {d3.ZoomTransform} transform - The current D3 transform.
 * @param {DOMRect} rect - The bounding rectangle of the canvas.
 * @returns {{x: number, y: number}} The converted coordinates.
 */
export const getCoordinates = (clientX, clientY, transform, rect) => ({
  x: (clientX - rect.left - transform.x) / transform.k,
  y: (clientY - rect.top - transform.y) / transform.k,
});

/**
 * Check if the given (x, y) coordinate is within a bounding box.
 * @param {number} x - The x-coordinate.
 * @param {number} y - The y-coordinate.
 * @param {{x: number, y: number, width: number, height: number}} bounds - The bounding box.
 * @returns {boolean} True if the coordinate is inside the bounds.
 */
export const isInBounds = (x, y, bounds) =>
  x >= bounds.x &&
  x <= bounds.x + bounds.width &&
  y >= bounds.y &&
  y <= bounds.y + bounds.height;

/**
 * Find the first point whose bounds contain the given coordinates.
 * @param {Array} points - Array of point objects.
 * @param {{x: number, y: number}} coords - The canvas coordinates.
 * @returns {Object|undefined} The clicked point or undefined if none is found.
 */
export const findClickedPoint = (points, coords) =>
  points.find((point) => isInBounds(coords.x, coords.y, point.bounds));

/**
 * Update DOM fields with the artist's data.
 * @param {Object} artist - The artist object containing data fields.
 */
export const updateArtistFields = (artist) => {
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

/**
 * Load a resized image and artist data, then update the artist display.
 * @param {Object} clickedPoint - The point that was clicked.
 */
export const loadAndDisplayArtist = async (clickedPoint) => {
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
