import { UMAP } from "umap-js";
import { getEmbeddings, updateProjections } from "./db";

// Create a function to initialize UMAP with parameters
const performUMAP = (data) => {
  const umap = new UMAP();
  return umap.fit(data);
};

const main = () => {
  const data = getEmbeddings();
  const embeddings = data.map((item) => item.embedding);
  const projections = performUMAP(embeddings); // Call the initialization function
  console.log(projections);
  const projectedData = data.map((item, index) => ({
    id: item.id,
    filename: item.filename,
    projection: projections[index],
  }));
  const updated = updateProjections(projectedData, "umap");
  console.log(updated);
};

main();
