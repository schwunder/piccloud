// Load an image from Caddy, either from /thumbnails or /resized:
const loadImage = async (filename, isResized = false) => {
  const src = `http://localhost:3001/${
    isResized ? "resized" : "thumbnails"
  }/${filename}`;
  const img = new Image();
  img.src = src;
  try {
    await img.decode();
    return img;
  } catch (e) {
    console.error(`Failed to load image ${filename}:`, e);
    return null;
  }
};

// Initialize the page:
export async function init() {
  const thumbsEl = document.getElementById("thumbnails");
  const resizedEl = document.getElementById("resized");
  const containerEl = document.querySelector(".container");
  thumbsEl.textContent = "Loading...";

  try {
    // Only fetch points from Bun server
    const points = await fetch("http://localhost:3000/api/points").then((r) =>
      r.ok ? r.json() : Promise.reject(new Error(r.statusText))
    );

    thumbsEl.textContent = "";

    // Load all thumbnails concurrently
    await Promise.all(
      points.map(async ({ filename, x, y }) => {
        const img = await loadImage(filename);
        if (!img) return;

        const thumbContainer = document.createElement("div");
        thumbContainer.className = "thumbnail-container";

        // On thumbnail click: load the 'resized' version
        thumbContainer.onclick = async () => {
          const resizedImg = await loadImage(filename, true);
          if (resizedImg) {
            resizedEl.innerHTML = "";
            resizedEl.appendChild(resizedImg);
            containerEl.classList.add("show-resized");
          }
        };

        const labelEl = document.createElement("p");
        labelEl.textContent = `x: ${x}, y: ${y}`;

        thumbContainer.append(img, labelEl);
        thumbsEl.appendChild(thumbContainer);
      })
    );

    if (!thumbsEl.children.length) {
      thumbsEl.textContent = "No images found";
    }

    // Close the resized pane when clicking on empty space
    resizedEl.onclick = (e) => {
      if (e.target === resizedEl) {
        containerEl.classList.remove("show-resized");
      }
    };
  } catch (e) {
    console.error("Initialization failed:", e);
    thumbsEl.textContent = `Error: ${e.message}`;
  }
}

window.addEventListener("load", () => init().catch(console.error));
