import TSNE from "tsne-js";
import { getEmbeddings } from "./db.js";

export function reduceEmbeddings(embeddings, outDim) {
  if (!outDim) throw new Error("outDim is required");
  const startTime = performance.now();

  const inputDim = embeddings[0].length;
  const groupSize = inputDim / outDim;

  if (!Number.isInteger(groupSize)) {
    throw new Error(
      `Input dimension ${inputDim} is not divisible by target dimension ${outDim}`
    );
  }

  console.log(
    `Reducing embeddings: ${embeddings.length} x ${inputDim} → ${embeddings.length} x ${outDim}`
  );

  const reduced = embeddings.map((vec) => {
    const reduced = new Array(outDim);
    for (let i = 0; i < outDim; i++) {
      let sum = 0;
      for (let j = 0; j < groupSize; j++) {
        sum += vec[i * groupSize + j];
      }
      reduced[i] = sum / groupSize;
    }
    return reduced;
  });

  const endTime = performance.now();
  console.log(
    `Dimension reduction to ${outDim}D completed in ${(
      endTime - startTime
    ).toFixed(2)}ms`
  );

  return reduced;
}

export function runTSNE(embeddings) {
  // Log before reduction
  console.log(
    "Before reduction: Type =",
    embeddings[0].constructor.name,
    ", Shape =",
    embeddings.length,
    "x",
    embeddings[0].length
  );

  // Step 1: Create and configure t-SNE
  const tsne = new TSNE({
    maxPoints: 8500,
    dim: 2, // 2D output
    perplexity: 2, // Low perplexity for testing, adjust as needed
    earlyExaggeration: 1.0,
    learningRate: 10000,
    nIter: 1, // Very few steps for a quick test; increase for better results
    metric: "euclidean",
    barneshut: true,
    theta: 0.8,
  });

  // Add event listeners for progress
  tsne.on("progressStatus", (status) => {
    console.log(`Status: ${status}`);
  });

  tsne.on("progressIter", ([iter, error, gradNorm]) => {
    console.log(
      `Iteration ${iter}: error=${error.toFixed(
        2
      )}, gradNorm=${gradNorm.toFixed(2)}`
    );
  });

  // Step 2: Initialize with dense data
  tsne.init({
    data: embeddings,
    type: "dense",
  });

  // Step 3: Run the pipeline
  const [error, iterations] = tsne.run();
  console.log("Finished t-SNE:", { error, iterations });

  // Step 4: Get 2D coords
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

  // First reduce dimensions
  const reduced = reduceEmbeddings(embeddings, 64);

  // Then run t-SNE
  console.log("Running t-SNE on embeddings (dense mode)...");
  const projections = runTSNE(reduced);

  // Combine results
  const projectedData = data.map((item, index) => ({
    id: item.id,
    filename: item.filename,
    projection: projections[index],
  }));

  // Log sample
  console.log(`Generated ${projections.length} 2D projections`);
  console.log("Sample projection:", projections[0]);
  return projectedData;
};
