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

    // Dispatch an event to signal the resized pane is ready
    const event = new CustomEvent("resizedPaneReady");
    document.dispatchEvent(event);
  } catch (e) {
    el.textContent = `Error loading ${point.filename}: ${e}`;
  }
};

const within = (x, y, box) =>
  x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height;

const coords = (x, y, t, rect) => ({
  x: (x - rect.left - t.x) / t.k,
  y: (y - rect.top - t.y) / t.k,
});

const hit = (pts, t, rect, xx, yy) => {
  const c = coords(xx, yy, t, rect);
  return pts.find((p) => within(c.x, c.y, p.bounds));
};

export { show, hit };
