// Load an image (thumbnail or resized).
export const loadImage = (filename, isResized = false) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.src = `http://localhost:3001/${
      isResized ? "resized" : "thumbnails"
    }/${filename}`;
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(`Failed to load ${filename}: ${err}`);
  });

// Load thumbnails for all points.
export const loadImagesForPoints = async (points) => {
  const imgs = await Promise.all(points.map((p) => loadImage(p.filename)));
  points.forEach((p, i) => (p.thumb = imgs[i]));
  return points;
};

// Convert mouse coordinates to canvas coordinates.
export const getCoordinates = (clientX, clientY, transform, rect) => ({
  x: (clientX - rect.left - transform.x) / transform.k,
  y: (clientY - rect.top - transform.y) / transform.k,
});

// Check if a coordinate is within a bounding box.
export const isInBounds = (x, y, bounds) =>
  x >= bounds.x &&
  x <= bounds.x + bounds.width &&
  y >= bounds.y &&
  y <= bounds.y + bounds.height;

// Find the first point whose bounds contain the given coordinates.
export const findClickedPoint = (points, coords) =>
  points.find((p) =>
    isInBounds(coords.x, coords.y, {
      x: p.projection[0],
      y: p.projection[1],
      width: p.bounds.width,
      height: p.bounds.height,
    })
  );

// Update UI fields with artist data.
export const updateArtistFields = (artist) => {
  [
    "bio",
    "genre",
    "name",
    "nationality",
    "paintings",
    "wikipedia",
    "years",
  ].forEach((field) => {
    const el = document.getElementById(field);
    if (el) el.textContent = artist[field] || "";
  });
};

// Load the resized image and artist data for the clicked point, then update the UI.
export const loadAndDisplayArtist = async (point) => {
  const imgEl = document.getElementById("image");
  imgEl.innerHTML = "<p>Loading resized image...</p>";
  try {
    const [resizedImg, artists] = await Promise.all([
      loadImage(point.filename, true),
      fetch("/api/artists").then((r) =>
        r.ok ? r.json() : Promise.reject(r.statusText)
      ),
    ]);
    imgEl.innerHTML = "";
    imgEl.appendChild(resizedImg);
    const artist = artists.find((a) => a.name === point.artist);
    if (artist) updateArtistFields(artist);
  } catch (e) {
    console.error(e);
    imgEl.textContent = `Error loading ${point.filename}: ${e}`;
  }
};
