import { PCA } from "ml-pca";
import { getEmbeddings, updateProjections } from "./db.js";
// dimensionality reduction for batch of embeddings

const performPCA = (data) => {
  const pca = new PCA(data);
  return pca.predict(data, { nComponents: 2 });
};

const main = () => {
  const data = getEmbeddings();
  const embeddings = data.map((item) => item.embedding);
  const projections = performPCA(embeddings);

  const projArray = projections.toJSON();

  const projectedData = data.map((item, index) => ({
    id: item.id,
    filename: item.filename,
    projection: projArray[index],
  }));
  const updated = updateProjections(projectedData, "pca");
  console.log(updated);
};

main();
