const image = (filename, isResized = false) =>
  new Promise((res, rej) => {
    const img = new Image();
    img.src = `http://localhost:3001/${
      isResized ? "resized" : "thumbnails"
    }/${filename}`;
    img.onload = () => res(img);
    img.onerror = (e) => rej(`Failed to load ${filename}: ${e}`);
  });

export const thumbnails = async (pts) => {
  const imgs = await Promise.all(pts.map((p) => image(p.filename)));
  pts.forEach((p, i) => (p.thumb = imgs[i]));
  return pts;
};

export const resized = (filename) => image(filename, true);

export const artists = async (name) => {
  try {
    const r = await fetch("/api/artists");
    if (!r.ok) throw new Error(r.statusText);
    const data = await r.json();
    return data.find((a) => a.name === name);
  } catch {
    return null;
  }
};
