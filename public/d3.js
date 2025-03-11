// d3.js

const dimensions = (canvas) => {
  const d = { width: window.innerWidth, height: window.innerHeight };
  canvas.width = d.width;
  canvas.height = d.height;
  return d;
};

const range = (x, y, dims, m) => {
  x.range([m, dims.width - m]);
  y.range([dims.height - m, m]);
  return dims;
};

const scales = (pts, m, d) => {
  // Get data extents
  const xExtent = d3.extent(pts, (p) => p.x);
  const yExtent = d3.extent(pts, (p) => p.y);

  // Calculate data aspect ratio
  const dataWidth = xExtent[1] - xExtent[0];
  const dataHeight = yExtent[1] - yExtent[0];
  const dataAspect = dataWidth / dataHeight;

  // Use the smaller dimension to maintain aspect ratio
  const size = Math.min(d.width, d.height) - 2 * m;

  const x = d3
    .scaleLinear()
    .domain(xExtent)
    .range([m, m + size * dataAspect]);

  const y = d3
    .scaleLinear()
    .domain(yExtent)
    .range([m + size, m]); // Flip Y axis

  return { x, y };
};

const zoom = (canvas, onZoom) => {
  const zoomBehavior = d3
    .zoom()
    .scaleExtent([0.5, 20])
    .on("zoom", (ev) => onZoom(ev.transform));

  d3.select(canvas).call(zoomBehavior);
  return zoomBehavior;
};

const draw = (ctx, pts, x, y, d, t = d3.zoomIdentity) => {
  ctx.save();
  ctx.clearRect(0, 0, d.width, d.height);
  ctx.translate(t.x, t.y);
  ctx.scale(t.k, t.k);
  pts.forEach((p) => (p.bounds = point(ctx, p, x, y)));
  ctx.restore();
};

let lastTransform;
const rerender = (ctx, d, t = d3.zoomIdentity, bitmap) => {
  // Skip if transform hasn't changed significantly
  if (!lastTransform) {
    lastTransform = t;
  } else {
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
  ctx.setTransform(t.k, 0, 0, t.k, t.x, t.y);
  ctx.drawImage(bitmap, 0, 0);
  ctx.restore();
};

const point = (ctx, p, x, y, s = 75) => {
  const cx = x(p.projection[0]);
  const cy = y(p.projection[1]);
  ctx.drawImage(p.thumb, cx - s / 2, cy - s / 2, s, s);

  // Store normalized coordinates and dimensions for hit detection
  p.bounds = {
    x: cx - s / 2,
    y: cy - s / 2,
    width: s,
    height: s,
  };

  return p.bounds;
};

// Function to reset lastTransform for testing, if needed
const resetTransform = () => {
  lastTransform = undefined;
};

// Add a new function to handle bitmap switching
const resetLastTransform = () => {
  lastTransform = null;
};

// Function to reset the zoom transform
const resetZoom = (canvas, initialScale) => {
  const resetTransform = d3.zoomIdentity.scale(initialScale);
  d3.select(canvas).call(d3.zoom().transform, resetTransform);
  return resetTransform;
};

export {
  dimensions,
  range,
  scales,
  zoom,
  draw,
  rerender,
  point,
  resetTransform,
  resetLastTransform,
  resetZoom,
};
