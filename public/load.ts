export interface Point {
  x: number;
  y: number;
  thumbnail: string;
  artist: Artist;
  filename: string;
  thumb?: HTMLImageElement;
}

export interface Artist {
  name: string;
  bio: string;
  genre: string;
  nationality: string;
  paintings: string;
  wikipedia: string;
  years: string;
}

export interface DecodedPoints {
  points: Point[];
  width: number;
  height: number;
  projections: Float32Array;
}

const THUMBNAIL_BASE = "http://localhost:3001/thumbnails/";
const RESIZED_BASE = "http://localhost:3001/resized/";

/**
 * Decodes the binary response from the points API into structured data
 */
export function decodePointsResponse(buffer: ArrayBuffer): DecodedPoints {
  const view = new DataView(buffer);
  const width = view.getFloat32(0, true);
  const height = view.getFloat32(4, true);
  const numPoints = view.getFloat32(8, true);
  const pointsData = new Float32Array(buffer, 12, numPoints * 2);
  const points = [];

  for (let i = 0; i < numPoints; i++) {
    const x = pointsData[i * 2];
    const y = pointsData[i * 2 + 1];
    points.push({
      x,
      y,
      thumbnail: "",
      artist: null,
      filename: "",
      thumb: null,
    });
  }

  return {
    points,
    width,
    height,
    projections: pointsData,
  };
}

/**
 * Loads thumbnails for all points
 */
export async function thumbnails(points: Point[]): Promise<Point[]> {
  const loads = points.map((p) => {
    return new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        p.thumb = img;
        console.log(`Successfully loaded ${p.filename}`);
        resolve();
      };
      img.onerror = () => {
        console.log(`Failed to load ${p.filename}: Test error`);
        reject(new Error(`Failed to load ${p.filename}`));
      };
      console.log(`Attempting to load: ${THUMBNAIL_BASE}${p.filename}`);
      img.src = THUMBNAIL_BASE + p.filename;
    });
  });

  // Don't catch errors here, let them propagate
  await Promise.all(loads);
  return points;
}

/**
 * Loads a full-size image
 */
export async function resized(filename: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      console.log(`Successfully loaded ${filename}`);
      resolve(img);
    };
    img.onerror = () => {
      console.log(`Failed to load ${filename}: Test error`);
      reject(new Error(`Failed to load ${filename}`));
    };
    img.src = RESIZED_BASE + filename;
  });
}

/**
 * Fetches artist data by name
 */
export async function artists(name: string): Promise<Artist | null> {
  try {
    const r = await fetch("/api/artists");
    if (!r.ok) throw new Error(r.statusText);
    const data = await r.json();
    return data.find((a: Artist) => a.name === name) || null;
  } catch {
    return null;
  }
}

/**
 * Loads all point data including projections and thumbnails
 */
export async function loadPoints(): Promise<DecodedPoints> {
  const response = await fetch("/api/points");
  if (!response.ok) throw new Error("Failed to fetch points");

  const buffer = await response.arrayBuffer();
  const decoded = decodePointsResponse(buffer);
  await thumbnails(decoded.points);

  return decoded;
}
