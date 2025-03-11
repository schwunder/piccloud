const fields = (artist) => {
  [
    "bio",
    "genre",
    "name",
    "nationality",
    "paintings",
    "wikipedia",
    "years",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = artist[id] || "";
  });
};

const show = async (point, loadResized, loadArtist) => {
  const el = document.getElementById("image");
  el.innerHTML = "<p>Loading resized image...</p>";

  // Display original coordinates (before normalization)
  const coordsEl = document.createElement("div");
  coordsEl.className = "coordinates";
  coordsEl.innerHTML = `<strong>Original Coordinates:</strong> [${point.projection[0].toFixed(
    2
  )}, ${point.projection[1].toFixed(2)}]`;

  try {
    const [resImg, art] = await Promise.all([
      loadResized(point.filename),
      loadArtist(point.artist),
    ]);
    el.innerHTML = "";
    el.appendChild(coordsEl); // Add coordinates first
    el.appendChild(resImg);
    if (art) fields(art);

    // No need to dispatch an event - the bitmap is already created
  } catch (e) {
    el.textContent = `Error loading ${point.filename}: ${e}`;
  }
};

const within = (x, y, box, tolerance = 20) => {
  if (!box) return false;

  const expandedBox = {
    x: box.x - tolerance,
    y: box.y - tolerance,
    width: box.width + 2 * tolerance,
    height: box.height + 2 * tolerance,
  };

  return (
    x >= expandedBox.x &&
    x <= expandedBox.x + expandedBox.width &&
    y >= expandedBox.y &&
    y <= expandedBox.y + expandedBox.height
  );
};

// Transform screen coordinates to data coordinates
const coords = (x, y, t, rect) => ({
  x: (x - rect.left - t.x) / t.k,
  y: (y - rect.top - t.y) / t.k,
});

// This is the key function that needs to be fixed
const hit = (pts, t, rect, xx, yy) => {
  // Convert screen coordinates to data coordinates
  const c = coords(xx, yy, t, rect);

  // Try with increasing tolerance
  for (let tolerance = 20; tolerance <= 100; tolerance += 20) {
    for (const p of pts) {
      if (!p.bounds) continue;

      if (within(c.x, c.y, p.bounds, tolerance)) {
        return p;
      }
    }
  }

  // If no hit was found, find the closest point within a reasonable distance
  let closestPoint = null;
  let minDistance = Infinity;

  for (const p of pts) {
    if (!p.bounds) continue;

    const centerX = p.bounds.x + p.bounds.width / 2;
    const centerY = p.bounds.y + p.bounds.height / 2;
    const distance = Math.sqrt(
      Math.pow(c.x - centerX, 2) + Math.pow(c.y - centerY, 2)
    );

    if (distance < minDistance) {
      minDistance = distance;
      closestPoint = p;
    }
  }

  // Return the closest point if it's within a reasonable distance
  if (closestPoint && minDistance < 150) {
    return closestPoint;
  }

  return undefined;
};

export { show, hit };
