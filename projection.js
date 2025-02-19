import { PCA } from "ml-pca";
import TSNE from "tsne-js";
import { UMAP } from "umap-js";
import { getEmbeddings, updateProjections } from "./db.js";

const methods = {
  pca: (data) => new PCA(data).predict(data, { nComponents: 2 }).toJSON(),
  tsne: (data) =>
    data.flatMap((_, i) => {
      if (i % 100) return [];
      const t = new TSNE();
      t.init({ data: data.slice(i, i + 100).map((e) => [...e]) });
      t.run();
      return t.getOutputScaled();
    }),
  umap: (data) => new UMAP().fit(data),
};

const main = (method) => {
  const data = getEmbeddings(),
    embeddings = data.map((d) => d.embedding),
    projections = methods[method](embeddings);

  console.log(
    updateProjections(
      data.map((d, i) => ({ ...d, projection: projections[i] })),
      method
    )
  );
};

main("tsne");
