import TSNE from "tsne-js";
import { getEmbeddings } from "./db.js";

/**
 * Quickly reduce embeddings from 256D to a lower dimension by averaging groups.
 * Returns plain arrays instead of typed arrays.
 * @param {Float32Array[]} embeddings - List of embeddings
 * @param {number} outDim - Target dimension (e.g., 64 or 16)
 * @returns {number[][]} - Reduced embeddings as plain arrays
 */
function reduceEmbeddings(embeddings, outDim = 64) {
  const groupSize = embeddings[0].length / outDim; // 256/64=4
  console.log(
    `Reducing embeddings: ${embeddings.length} x ${embeddings[0].length} → ${embeddings.length} x ${outDim}`
  );

  return embeddings.map((vec) => {
    const reduced = [];
    for (let i = 0; i < outDim; i++) {
      let sum = 0;
      for (let j = 0; j < groupSize; j++) {
        sum += vec[i * groupSize + j];
      }
      reduced.push(sum / groupSize);
    }
    return reduced;
  });
}

/**
 * Run t-SNE in dense mode on reduced embeddings.
 * @param {Float32Array[]} embeddings - list of embeddings, e.g. 5000x256
 * @returns {number[][]} - 2D projections, same length as input
 */
function runTSNE(embeddings) {
  // Log before reduction
  console.log(
    "Before reduction: Type =",
    embeddings[0].constructor.name,
    ", Shape =",
    embeddings.length,
    "x",
    embeddings[0].length
  );

  // Step 1: Reduce dimensions from 256 → 64 (or whatever you choose)
  const reduced = reduceEmbeddings(embeddings, 64);

  // Log after reduction
  console.log(
    "After reduction: Type = Array, Shape =",
    reduced.length,
    "x",
    reduced[0].length
  );

  // Step 2: Create and configure t-SNE
  const tsne = new TSNE({
    maxPoints: 8500,
    dim: 2, // 2D output
    perplexity: 2, // Low perplexity for testing, adjust as needed
    earlyExaggeration: 1.0,
    learningRate: 10000,
    nIter: 1, // Very few steps for a quick test; increase for better results
    metric: "euclidean",
    barneshut: true,
    theta: 0.5,
  });

  // Step 3: Initialize with dense data
  tsne.init({
    data: reduced,
    type: "dense",
  });

  // Step 4: Run the pipeline
  const [error, iterations] = tsne.run();
  console.log("Finished t-SNE:", { error, iterations });

  // Step 5: Get 2D coords
  return tsne.getOutput();
}

export const main = () => {
  // Load and slice data
  const data = getEmbeddings();
  console.log(`Loaded and sliced to ${data.length} embeddings from database`);

  if (data[0]) {
    console.log("First embedding type:", data[0].embedding.constructor.name);
    console.log("First embedding length:", data[0].embedding.length);
  }

  // Extract just the Float32Array embeddings
  const embeddings = data.map((item) => item.embedding);

  // Run t-SNE
  console.log("Running t-SNE on embeddings (dense mode)...");
  const projections = runTSNE(embeddings);

  // Combine results
  const projectedData = data.map((item, index) => ({
    id: item.id,
    filename: item.filename,
    projection: projections[index],
  }));

  // Log sample
  console.log(`Generated ${projections.length} 2D projections`);
  console.log("Sample projection:", projections[0]);
  updateTsneProjections(projectedData);
};

main();
