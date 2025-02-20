// Update canvas dimensions to match the window.
export const updateDimensions = (canvas) => {
  const dims = { width: window.innerWidth, height: window.innerHeight };
  canvas.width = dims.width;
  canvas.height = dims.height;
  return dims;
};

// Update D3 scale ranges based on new dimensions.
export const updateScales = (xScale, yScale, dims, margin) => {
  xScale.range([margin, dims.width - margin]);
  yScale.range([dims.height - margin, margin]);
  return dims;
};

// Initialize scales from point data and attach D3 zoom behavior.
export const initScalesAndZoom = (canvas, points, margin, dims, onZoom) => {
  const xScale = d3
    .scaleLinear()
    .domain(d3.extent(points, (p) => p.projection[0]))
    .range([margin, dims.width - margin]);

  const yScale = d3
    .scaleLinear()
    .domain(d3.extent(points, (p) => p.projection[1]))
    .range([dims.height - margin, margin]);

  d3.select(canvas).call(
    d3
      .zoom()
      .scaleExtent([0.5, 20])
      .on("zoom", (event) => onZoom(event.transform))
  );

  return { xScale, yScale };
};

// Draw a point's image (80px square) and return its bounding box.
const drawPoint = (ctx, point, xScale, yScale, size = 80) => {
  const cx = xScale(point.projection[0]),
    cy = yScale(point.projection[1]);
  ctx.drawImage(point.thumb, cx - size / 2, cy - size / 2, size, size);
  return { x: cx - size / 2, y: cy - size / 2, width: size, height: size };
};

// Clear the canvas, apply the zoom transform, and draw all points.
export const drawAllPoints = (
  ctx,
  points,
  xScale,
  yScale,
  dims,
  transform = d3.zoomIdentity
) => {
  ctx.save();
  ctx.clearRect(0, 0, dims.width, dims.height);
  ctx.translate(transform.x, transform.y);
  ctx.scale(transform.k, transform.k);
  points.forEach(
    (point) => (point.bounds = drawPoint(ctx, point, xScale, yScale))
  );
  ctx.restore();
};
