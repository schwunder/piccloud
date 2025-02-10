(async function () {
  const canvas = document.getElementById("canvas");
  const context = canvas.getContext("2d");
  const resizedPane = document.getElementById("resized");
  const html = document.documentElement; // Apply class here to affect the entire page

  let width = (canvas.width = window.innerWidth);
  let height = (canvas.height = window.innerHeight);

  // Load an image from Caddy
  async function loadImage(filename, isResized = false) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = `http://localhost:3001/${
        isResized ? "resized" : "thumbnails"
      }/${filename}`;
      img.onload = () => resolve(img);
      img.onerror = (err) => reject(`Failed to load ${filename}: ${err}`);
    });
  }

  try {
    const response = await fetch("/api/points");
    if (!response.ok) throw new Error(response.statusText);
    const points = await response.json();
    console.log(`Total points received: ${points.length}`);

    const thumbnails = await Promise.all(
      points.map((p) => loadImage(p.filename))
    );
    points.forEach((point, i) => {
      point.thumb = thumbnails[i];
    });

    const margin = 40;
    const xExtent = d3.extent(points, (d) => d.x);
    const yExtent = d3.extent(points, (d) => d.y);
    const xScale = d3
      .scaleLinear()
      .domain(xExtent)
      .range([margin, width - margin]);
    const yScale = d3
      .scaleLinear()
      .domain(yExtent)
      .range([height - margin, margin]);

    let currentTransform = d3.zoomIdentity;

    function draw(transform = d3.zoomIdentity) {
      context.save();
      context.clearRect(0, 0, width, height);
      context.translate(transform.x, transform.y);
      context.scale(transform.k, transform.k);

      points.forEach((point) => {
        const cx = xScale(point.x);
        const cy = yScale(point.y);
        const imgW = 80;
        const imgH = 80;

        context.drawImage(
          point.thumb,
          cx - imgW / 2,
          cy - imgH / 2,
          imgW,
          imgH
        );

        context.beginPath();
        context.arc(cx, cy, 2, 0, 2 * Math.PI);
        context.fillStyle = "red";
        context.fill();

        point.bounds = {
          x: cx - imgW / 2,
          y: cy - imgH / 2,
          width: imgW,
          height: imgH,
        };
      });

      context.restore();
    }

    const zoom = d3
      .zoom()
      .scaleExtent([0.5, 20])
      .on("zoom", (event) => {
        currentTransform = event.transform;
        draw(currentTransform);
      });

    d3.select(canvas).call(zoom);

    canvas.addEventListener("click", async (e) => {
      const rect = canvas.getBoundingClientRect();
      const clickX =
        (e.clientX - rect.left - currentTransform.x) / currentTransform.k;
      const clickY =
        (e.clientY - rect.top - currentTransform.y) / currentTransform.k;

      for (const point of points) {
        const { x, y, width: w, height: h } = point.bounds;
        if (clickX >= x && clickX <= x + w && clickY >= y && clickY <= y + h) {
          console.log("Splitting viewport...");
          html.classList.add("show-resized");

          // Clear previous content
          document.getElementById("image").innerHTML =
            "<p>Loading resized image...</p>";

          try {
            const resizedImg = await loadImage(point.filename, true);
            document.getElementById("image").innerHTML = "";
            document.getElementById("image").appendChild(resizedImg);

            const artistResponse = await fetch("/api/artists");
            if (!artistResponse.ok) throw new Error(artistResponse.statusText);
            const artists = await artistResponse.json();

            // Find the matching artist
            const artist = artists.find((a) => a.name === point.artist);

            if (artist) {
              // Update all the fields with artist data
              document.getElementById("bio").textContent = artist.bio;
              document.getElementById("genre").textContent = artist.genre;
              document.getElementById("name").textContent = artist.name;
              document.getElementById("nationality").textContent =
                artist.nationality;
              document.getElementById("paintings").textContent =
                artist.paintings;
              document.getElementById("wikipedia").textContent =
                artist.wikipedia;
              document.getElementById("years").textContent = artist.years;
            } else {
              console.error("Artist not found:", point.artist);
            }
          } catch (err) {
            console.error(err);
            document.getElementById(
              "image"
            ).textContent = `Error loading ${point.filename}: ${err}`;
          }
          break;
        }
      }
    });

    resizedPane.addEventListener("click", (e) => {
      if (e.target === resizedPane) {
        html.classList.remove("show-resized"); // Collapse the pane
      }
    });

    draw(currentTransform);

    window.addEventListener("resize", () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      xScale.range([margin, width - margin]);
      yScale.range([height - margin, margin]);
      draw(currentTransform);
    });
  } catch (error) {
    console.error("Error loading data:", error);
  }
})();
