interface Artist {
  bio: string;
  genre: string;
  name: string;
  nationality: string;
  paintings: string;
  wikipedia: string;
  years: string;
}

interface Point {
  filename: string;
  artist: string;
  bounds?: Box;
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Transform {
  x: number;
  y: number;
  k: number;
}

interface Rect {
  left: number;
  top: number;
}

type LoadResizedFn = (filename: string) => Promise<HTMLImageElement>;
type LoadArtistFn = (artist: string) => Promise<Artist | null>;

const fields = (artist: Artist): void => {
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
    if (el) el.textContent = artist[id as keyof Artist] || "";
  });
};

const show = async (
  point: Point,
  loadResized: LoadResizedFn,
  loadArtist: LoadArtistFn
): Promise<void> => {
  const el = document.getElementById("image");
  if (!el) return;

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

const within = (x: number, y: number, box: Box): boolean =>
  x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height;

const coords = (x: number, y: number, t: Transform, rect: Rect) => ({
  x: (x - rect.left - t.x) / t.k,
  y: (y - rect.top - t.y) / t.k,
});

const hit = (
  pts: Point[],
  t: Transform,
  rect: Rect,
  xx: number,
  yy: number
): Point | undefined => {
  const c = coords(xx, yy, t, rect);
  return pts.find((p) => p.bounds && within(c.x, c.y, p.bounds));
};

export {
  show,
  hit,
  type Artist,
  type Point,
  type Transform,
  type Box,
  type Rect,
};
