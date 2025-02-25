// d3 is loaded via CDN
declare const d3: any;

// Define interfaces for our point types
interface Point {
  x: number;
  y: number;
  projection: [number, number];
  thumb: HTMLImageElement;
  bounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

// d3.js
let lastTransform;
let _zoomBehavior: any | null = null; // For testing

const dimensions = (canvas: HTMLCanvasElement) => {
  const d = { width: window.innerWidth, height: window.innerHeight };
  canvas.width = d.width;
  canvas.height = d.height;
  return d;
};

const range = (
  x: any,
  y: any,
  dims: { width: number; height: number },
  m: number
) => {
  x.range([m, dims.width - m]);
  y.range([dims.height - m, m]);
  return dims;
};

const scales = (
  pts: Point[],
  m: number,
  d: { width: number; height: number }
) => {
  const x = d3
    .scaleLinear()
    .domain(d3.extent(pts, (p) => p.x))
    .range([m, d.width - m]);
  const y = d3
    .scaleLinear()
    .domain(d3.extent(pts, (p) => p.y))
    .range([d.height - m, m]);
  return { x, y };
};

const zoom = (canvas: HTMLCanvasElement, onZoom: (transform: any) => void) => {
  const zoomBehavior = d3
    .zoom()
    .scaleExtent([0.5, 20])
    .on("zoom", (ev: any) => onZoom(ev.transform));

  d3.select(canvas).call(zoomBehavior);
  _zoomBehavior = zoomBehavior;
  return zoomBehavior;
};

const draw = (
  ctx: CanvasRenderingContext2D,
  pts: Point[],
  x: any,
  y: any,
  d: { width: number; height: number },
  t: any = d3.zoomIdentity
) => {
  // Initialize lastTransform if not set
  if (!lastTransform) {
    lastTransform = t;
  } else {
    // Only skip redraw if not the first time and transformation hasn't changed significantly
    if (
      Math.abs(t.x - lastTransform.x) < 1 &&
      Math.abs(t.y - lastTransform.y) < 1 &&
      Math.abs(t.k - lastTransform.k) < 0.01
    ) {
      return;
    }
  }
  lastTransform = t;

  ctx.save();
  ctx.clearRect(0, 0, d.width, d.height);
  ctx.translate(t.x, t.y);
  ctx.scale(t.k, t.k);
  pts.forEach((p) => (p.bounds = point(ctx, p, x, y)));
  ctx.restore();
};

const point = (
  ctx: CanvasRenderingContext2D,
  p: Point,
  x: any,
  y: any,
  s: number = 80
) => {
  const cx = x(p.projection[0]);
  const cy = y(p.projection[1]);
  ctx.drawImage(p.thumb, cx - s / 2, cy - s / 2, s, s);
  return { x: cx - s / 2, y: cy - s / 2, width: s, height: s };
};

// Function to reset lastTransform for testing
const resetTransform = () => {
  lastTransform = undefined;
  _zoomBehavior = null;
};

export {
  dimensions,
  range,
  scales,
  zoom,
  draw,
  resetTransform,
  d3,
  _zoomBehavior,
};
