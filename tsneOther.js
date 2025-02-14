import TSNE from "tsne-js";
import { getEmbeddings } from "./db";

function normalizeOutput(output) {
  // Find global min/max, skipping NaN values
  const ranges = output.reduce(
    (acc, point) => {
      point.forEach((coord) => {
        if (!isNaN(coord)) {
          acc.min = Math.min(acc.min, coord);
          acc.max = Math.max(acc.max, coord);
        }
      });
      return acc;
    },
    { min: Infinity, max: -Infinity }
  );

  // Normalize to [-1, 1] range
  const maxAbs = Math.max(Math.abs(ranges.min), Math.abs(ranges.max)) || 1;
  return output.map((point) => point.map((coord) => coord / maxAbs));
}

async function runTSNEBatch(inputData, batchSize = 1000) {
  console.log(`Processing batch of ${inputData.length} embeddings...`);

  // Check for NaN in input
  const hasNaN = inputData.some((emb) =>
    Array.from(emb).some((val) => isNaN(val))
  );
  if (hasNaN) {
    throw new Error("Input data contains NaN values");
  }

  return new Promise((resolve, reject) => {
    // Pre-normalize input to [-1, 1]
    const maxAbs = Math.max(
      ...inputData.map((emb) => Math.max(...Array.from(emb).map(Math.abs)))
    );
    const normalizedInput = inputData.map((emb) =>
      Array.from(emb).map((val) => val / maxAbs)
    );

    const model = new TSNE({
      dim: 2,
      perplexity: Math.min(15.0, Math.floor(inputData.length / 6)), // Adjusted perplexity
      earlyExaggeration: 8.0,
      learningRate: 50.0,
      nIter: 500,
      metric: "euclidean",
    });

    model.on("progressStatus", (status) => {
      console.log("Progress:", status);
    });

    try {
      console.log("Initializing TSNE...");
      model.init({
        data: normalizedInput,
      });

      console.log("Running TSNE...");
      console.time("tsne-computation");
      const [error, iter] = model.run();
      console.timeEnd("tsne-computation");

      if (isNaN(error)) {
        throw new Error(
          "TSNE returned NaN error - possible numerical instability"
        );
      }

      console.log("TSNE completed:", { error, iter });

      // Get output and normalize it ourselves
      const output = model.getOutput();
      const normalizedOutput = normalizeOutput(output);

      // Verify output
      const hasNaNOutput = normalizedOutput.some((point) =>
        point.some((coord) => isNaN(coord))
      );
      if (hasNaNOutput) {
        throw new Error("TSNE produced NaN values in output");
      }

      console.log(
        "Output shape:",
        normalizedOutput.length,
        "x",
        normalizedOutput[0]?.length
      );

      resolve(normalizedOutput);
    } catch (e) {
      reject(e);
    }
  });
}

async function main() {
  try {
    console.log("Getting embeddings...");
    const rawData = await getEmbeddings();
    console.log("Total embeddings:", rawData.length);

    const inputData = rawData.map((item) => item.embedding);
    console.log("Embedding dimensions:", inputData[0]?.length);

    // Check input ranges
    const ranges = inputData.reduce(
      (acc, emb) => {
        const values = Array.from(emb);
        acc.min = Math.min(acc.min, ...values);
        acc.max = Math.max(acc.max, ...values);
        return acc;
      },
      { min: Infinity, max: -Infinity }
    );

    console.log("Input value ranges:", ranges);

    // Process in batches
    const BATCH_SIZE = 500; // Reduced batch size for better stability
    const results = [];

    for (let i = 0; i < inputData.length; i += BATCH_SIZE) {
      const batch = inputData.slice(i, i + BATCH_SIZE);
      console.log(
        `Processing batch ${i / BATCH_SIZE + 1}/${Math.ceil(
          inputData.length / BATCH_SIZE
        )}`
      );

      try {
        const batchResult = await runTSNEBatch(batch);
        results.push(...batchResult);
      } catch (e) {
        console.error(`Failed processing batch starting at index ${i}:`, e);
        // Continue with next batch
      }
    }

    console.log("All batches completed");
    console.log("Total results:", results.length);

    // Verify final output
    const outOfRange = results.some((point) =>
      point.some((coord) => isNaN(coord) || coord < -1 || coord > 1)
    );
    if (outOfRange) {
      console.warn(
        "Warning: Some output values are outside [-1, 1] range or NaN"
      );
    }

    return results;
  } catch (e) {
    console.error("Fatal error:", e);
    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}

export { runTSNEBatch, normalizeOutput };
