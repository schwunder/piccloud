// Update the canvas dimensions to match the window.
export const updateDimensions = (canvas) => {
  const dimensions = {
    width: window.innerWidth,
    height: window.innerHeight,
  };
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;
  return dimensions;
};

// Update the range of D3 scales based on new dimensions.
export const updateScales = (xScale, yScale, dimensions, margin) => {
  xScale.range([margin, dimensions.width - margin]);
  yScale.range([dimensions.height - margin, margin]);
  return dimensions;
};

// Initialize D3 scales and attach zoom behavior.
// onZoom is a callback that will be used to update the current transform and re-draw.
export const initScalesAndZoom = (
  canvas,
  points,
  margin,
  dimensions,
  onZoom
) => {
  const xScale = d3
    .scaleLinear()
    .domain(d3.extent(points, (d) => d.x))
    .range([margin, dimensions.width - margin]);

  const yScale = d3
    .scaleLinear()
    .domain(d3.extent(points, (d) => d.y))
    .range([dimensions.height - margin, margin]);

  const zoom = d3
    .zoom()
    .scaleExtent([0.5, 20])
    .on("zoom", (event) => onZoom(event.transform));

  d3.select(canvas).call(zoom);
  return { xScale, yScale };
};

// Pure function: Compute the drawing coordinates and image size for a point.
export const getPointCoords = (point, xScale, yScale) => {
  const cx = xScale(point.x);
  const cy = yScale(point.y);
  const imgW = 80;
  const imgH = 80;
  return { cx, cy, imgW, imgH };
};

// Pure function: Compute the bounding box for a point's image.
export const getPointBounds = (cx, cy, imgW, imgH) => ({
  x: cx - imgW / 2,
  y: cy - imgH / 2,
  width: imgW,
  height: imgH,
});

// Draw a single point (thumbnail plus a red dot) on the canvas.
// Returns the computed bounds.
export const drawPoint = (context, point, xScale, yScale) => {
  const { cx, cy, imgW, imgH } = getPointCoords(point, xScale, yScale);
  context.drawImage(point.thumb, cx - imgW / 2, cy - imgH / 2, imgW, imgH);
  context.beginPath();
  context.arc(cx, cy, 2, 0, 2 * Math.PI);
  context.fillStyle = "red";
  context.fill();
  return getPointBounds(cx, cy, imgW, imgH);
};

// Clear the canvas, apply the current transform, and draw all points.
// This function mutates the canvas context and updates each point's bounds.
export const drawAllPoints = (
  context,
  points,
  xScale,
  yScale,
  dimensions,
  transform = d3.zoomIdentity
) => {
  context.save();
  context.clearRect(0, 0, dimensions.width, dimensions.height);
  context.translate(transform.x, transform.y);
  context.scale(transform.k, transform.k);
  points.forEach((point) => {
    point.bounds = drawPoint(context, point, xScale, yScale);
  });
  context.restore();
};
