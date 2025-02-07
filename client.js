async function init() {
  const points = await fetch("http://localhost:3000/api/points").then((r) =>
    r.json()
  );
  points.forEach((p) => {
    const img = document.createElement("img");
    img.src = `http://localhost:3001/${p.filename}`;
    document.body.appendChild(img);
  });
}

addEventListener("load", () => init().catch(console.error));
