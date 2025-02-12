import { PCA } from "ml-pca";

export const dimensionalityReductionBatch = (data, pcaModel = null) => {
  // Basic validation
  if (!data?.length) {
    throw new TypeError("EmbeddingsWithIdArray must be a non-empty array.");
  }
  for (const item of data) {
    if (
      !item.id ||
      !item.embedding ||
      !(item.embedding instanceof Uint8Array)
    ) {
      throw new TypeError(
        "Each item must have 'id' and a Uint8Array 'embedding'."
      );
    }
  }

  // Flatten each embedding into rows of length 32 for PCA
  const matrix = data.flatMap(({ embedding }) => {
    const arr = [...new Float32Array(embedding)];
    return Array.from({ length: Math.ceil(arr.length / 32) }, (_, i) =>
      arr.slice(i * 32, i * 32 + 32)
    );
  });

  // Perform PCA
  const pca = pcaModel || new PCA(matrix, { center: true, scale: true });
  const proj = pca.predict(matrix, { nComponents: 2 });
  const points = Array.isArray(proj) ? proj : proj.to2DArray();

  // Return each item's 2D projection
  return data.map((item, i) => ({ id: item.id, projection: points[i] }));
};
