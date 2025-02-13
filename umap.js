import { UMAP } from "umap-js";
import { getEmbeddings } from "./db";

// Create a function to initialize UMAP with parameters
const performUMAP = (data) => {
  const umap = new UMAP();
  return umap.fit(data);
};

const main = () => {
  const data = getEmbeddings();
  const embeddings = data.map((item) => item.embedding);
  const umap = performUMAP(embeddings); // Call the initialization function
  console.log(umap);
};

main();

// works
// use main to fill db
