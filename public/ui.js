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

export const show = async (point, loadResized, loadArtist) => {
  const el = document.getElementById("image");
  el.innerHTML = "<p>Loading resized image...</p>";
  try {
    const [resImg, art] = await Promise.all([
      loadResized(point.filename),
      loadArtist(point.artist),
    ]);
    el.innerHTML = "";
    el.appendChild(resImg);
    if (art) fields(art);
  } catch (e) {
    el.textContent = `Error loading ${point.filename}: ${e}`;
  }
};

export const within = (x, y, box) =>
  x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height;
