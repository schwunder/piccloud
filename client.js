const loadImage = async (filename, isResized = false) => {
  try {
    const img = Object.assign(new Image(), {
      src: `http://localhost:3001/${
        isResized ? "resized" : "thumbnails"
      }/${filename}`,
    });
    await img.decode();
    return img;
  } catch (error) {
    console.error(`Failed to load image ${filename}:`, error);
  }
};

export async function init() {
  try {
    const thumbnailsContainer = document.getElementById("thumbnails");
    const resizedContainer = document.getElementById("resized");
    const container = document.querySelector(".container");

    thumbnailsContainer.innerHTML = "Loading...";

    const [entries, points] = await Promise.all([
      fetch("http://localhost:3001/thumbnails/", {
        headers: { Accept: "application/json" },
      }).then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(r.statusText))
      ),
      fetch("http://localhost:3000/api/points").then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(r.statusText))
      ),
    ]);

    thumbnailsContainer.innerHTML = "";

    const imageMap = new Map(points.map((p) => [p.filename, p]));
    const files = entries.filter((e) => !e.is_dir).map((e) => e.name);
    let count = 0;

    // Load all thumbnails at once
    const thumbnails = await Promise.all(files.map(loadImage));
    thumbnails.forEach((img, idx) => {
      if (img && imageMap.has(files[idx])) {
        const { x, y } = imageMap.get(files[idx]);
        const container = document.createElement("div");
        container.className = "thumbnail-container";

        // Add click handler to load resized image
        container.addEventListener("click", async () => {
          const resizedImg = await loadImage(files[idx], true);
          if (resizedImg) {
            resizedContainer.innerHTML = "";
            resizedContainer.appendChild(resizedImg);
            document.querySelector(".container").classList.add("show-resized");
          }
        });

        container.appendChild(img);
        container.appendChild(
          Object.assign(document.createElement("p"), {
            textContent: `x: ${x}, y: ${y}`,
          })
        );
        thumbnailsContainer.appendChild(container);
        count++;
      }
    });

    if (!count) thumbnailsContainer.innerHTML = "No images found";

    // Add click handler to hide resized pane when clicking outside an image
    resizedContainer.addEventListener("click", (event) => {
      if (event.target === resizedContainer) {
        document.querySelector(".container").classList.remove("show-resized");
      }
    });
  } catch (error) {
    console.error("Failed to initialize:", error);
    const thumbnailsContainer = document.getElementById("thumbnails");
    thumbnailsContainer.innerHTML = `Error: ${error.message}`;
  }
}

addEventListener("load", () => init().catch(console.error));
