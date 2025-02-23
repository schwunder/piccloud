const image = (filename, isResized = false) =>
  new Promise((res, rej) => {
    const img = new Image();
    // Required for canvas operations to prevent tainted canvas security errors
    img.crossOrigin = "anonymous";

    img.onerror = (e) => {
      console.error(`Failed to load ${filename}:`, e);
      rej(`Failed to load ${filename}: ${e}`);
    };

    img.onload = () => {
      console.log(`Successfully loaded ${filename}`);
      res(img);
    };

    const path = `http://localhost:3001/${
      isResized ? "resized" : "thumbnails"
    }/${filename}`;
    console.log(`Attempting to load: ${path}`);
    img.src = path;
  });

const thumbnails = async (pts) => {
  const imgs = await Promise.all(pts.map((p) => image(p.filename)));
  pts.forEach((p, i) => (p.thumb = imgs[i]));
  return pts;
};

const resized = (filename) => image(filename, true);

const artists = async (name) => {
  try {
    const r = await fetch("/api/artists");
    if (!r.ok) throw new Error(r.statusText);
    const data = await r.json();
    return data.find((a) => a.name === name);
  } catch {
    return null;
  }
};

export { thumbnails, resized, artists };
