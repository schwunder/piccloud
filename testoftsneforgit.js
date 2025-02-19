// ====================================================================
// TSNE Test File - Advanced Debug, Quality Metrics & CLI Options
// Filename: tsne.test.js
// ====================================================================

/*
Usage Examples:
--------------
1. Default:
   bun test tsne.test.js

2. Lower perplexity and learning rate:
   PERPLEXITY=10 LEARNING_RATE=50 bun test tsne.test.js

3. Higher perplexity and early exaggeration:
   PERPLEXITY=50 EARLY_EXAGGERATION=8 bun test tsne.test.js

4. Reduce iterations:
   N_ITER=500 bun test tsne.test.js

5. Increase iterations:
   N_ITER=2000 bun test tsne.test.js

6. Change metric to "euclidean":
   METRIC=euclidean bun test tsne.test.js

7. Use z-score standardization:
   PREPROCESS=zs bun test tsne.test.js

8. Enable verbose debugging:
   DEBUG_MODE=1 bun test tsne.test.js

9. Custom hyperparameters:
   PERPLEXITY=8 EARLY_EXAGGERATION=2 LEARNING_RATE=40 N_ITER=500 bun test tsne.test.js

10. All overrides with verbose logging:
    PERPLEXITY=10 EARLY_EXAGGERATION=2 LEARNING_RATE=50 N_ITER=500 METRIC=euclidean PREPROCESS=zs DEBUG_MODE=1 bun test tsne.test.js
*/

// ====================================================================
// Import Statements
// ====================================================================

import { describe, test, expect } from "bun:test";
import TSNE from "tsne-js";
import { getEmbeddings } from "./db.js";

// ====================================================================
// Configuration & Environment Variables
// ====================================================================

const HYPER = {
  perplexity: process.env.PERPLEXITY ? Number(process.env.PERPLEXITY) : 30,
  earlyExaggeration: process.env.EARLY_EXAGGERATION
    ? Number(process.env.EARLY_EXAGGERATION)
    : 4.0,
  learningRate: process.env.LEARNING_RATE
    ? Number(process.env.LEARNING_RATE)
    : 100,
  nIter: process.env.N_ITER ? Number(process.env.N_ITER) : 1000,
  metric: process.env.METRIC || "euclidean",
};

const PREPROCESS = process.env.PREPROCESS || "minmax"; // "minmax" (default) or "zs"
const DEBUG_MODE = process.env.DEBUG_MODE === "1";

// ====================================================================
// Test Timeout Helper
// ====================================================================

const DEFAULT_TIMEOUT = 30000; // 30 seconds default timeout

const timedTest = (title, fn, timeout = DEFAULT_TIMEOUT) =>
  test(title, fn, timeout);

// ====================================================================
// Utility Functions
// ====================================================================

const measureTime = async (fn) => {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;
  return { result, duration };
};

/**
 * loadSubsetOfEmbeddings
 *
 * Now also handles blobs from SQLite:
 * - If the embedding is not already a Float32Array, we check if it’s a Buffer (or ArrayBuffer)
 *   and convert it appropriately.
 */
const loadSubsetOfEmbeddings = async (count) => {
  const data = await getEmbeddings();

  const validEmbeddings = data
    .slice(0, count)
    .map((item) => {
      if (!item || !item.embedding) return null;
      let emb = item.embedding;
      // Convert from Buffer if needed (Bun supports Buffer)
      if (!(emb instanceof Float32Array)) {
        if (Buffer.isBuffer(emb)) {
          emb = new Float32Array(
            emb.buffer,
            emb.byteOffset,
            emb.byteLength / Float32Array.BYTES_PER_ELEMENT
          );
        } else if (emb instanceof ArrayBuffer) {
          emb = new Float32Array(emb);
        } else if (typeof emb === "string") {
          // Optionally try to parse JSON string if your blob is stored that way
          try {
            emb = new Float32Array(JSON.parse(emb));
          } catch (err) {
            return null;
          }
        } else {
          return null;
        }
      }
      // Validate embedding
      const arr = Array.from(emb);
      if (
        emb.length > 0 &&
        arr.every((n) => typeof n === "number" && !Number.isNaN(n))
      ) {
        return arr;
      }
      return null;
    })
    .filter((x) => x !== null);

  if (validEmbeddings.length === 0) {
    throw new Error("No valid embeddings found in the dataset");
  }

  if (validEmbeddings.length < count) {
    console.warn(
      `Warning: Only ${validEmbeddings.length} valid embeddings found out of ${count} requested`
    );
  }

  return validEmbeddings;
};

// Legacy dimension reduction – kept for backward compatibility.
function reduceDimensions(embeddings, targetDim) {
  if (!targetDim) return embeddings;
  const inputDim = embeddings[0].length;
  const groupSize = inputDim / targetDim;
  if (!Number.isInteger(groupSize)) {
    throw new Error(
      `Input dimension ${inputDim} is not divisible by target dimension ${targetDim}`
    );
  }
  return embeddings.map((vec) => {
    let reduced = [];
    for (let i = 0; i < targetDim; i++) {
      let sum = 0;
      for (let j = 0; j < groupSize; j++) {
        sum += vec[i * groupSize + j];
      }
      reduced.push(sum / groupSize);
    }
    return reduced;
  });
}

// Preprocessing functions
const minMaxNormalize = (embeddings) =>
  embeddings.map((vec) => {
    const min = Math.min(...vec);
    const max = Math.max(...vec);
    if (min === max) return vec.map(() => 0);
    return vec.map((v) => ((v - min) / (max - min)) * 2 - 1);
  });

const zScoreStandardize = (embeddings) =>
  embeddings.map((vec) => {
    const mean = vec.reduce((acc, v) => acc + v, 0) / vec.length;
    const std = Math.sqrt(
      vec.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / vec.length
    );
    return vec.map((v) => (std ? (v - mean) / std : 0));
  });

// Choose preprocessing based on the PREPROCESS flag.
const preprocessEmbeddings = (embeddings) =>
  PREPROCESS === "zs"
    ? zScoreStandardize(embeddings)
    : minMaxNormalize(embeddings);

// Smart logging: log only summary info from an array.
function logArraySummary(label, arr) {
  if (!Array.isArray(arr) || arr.length === 0) {
    console.log(`${label}: [empty]`);
    return;
  }
  const min = Math.min(...arr);
  const max = Math.max(...arr);
  const first = arr[0];
  console.log(`${label} summary - first: ${first}, min: ${min}, max: ${max}`);
}

// Euclidean distance helper.
function euclideanDistance(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) {
    throw new TypeError(
      `Invalid input types: Expected arrays, got ${typeof a} and ${typeof b}`
    );
  }

  if (a.length !== b.length) {
    throw new Error(`Vector length mismatch: ${a.length} vs ${b.length}`);
  }

  if (a.length === 0) {
    throw new Error("Vectors cannot be empty");
  }

  return Math.sqrt(
    a.reduce((sum, v, i) => {
      if (typeof v !== "number" || typeof b[i] !== "number") {
        throw new TypeError(`Non-numeric values found at index ${i}`);
      }
      return sum + Math.pow(v - b[i], 2);
    }, 0)
  );
}

// Helper function to check for NaN values in input data
function containsNaN(data, label = "") {
  if (!Array.isArray(data)) {
    console.warn(`[${label}] Input is not an array`);
    return true;
  }

  if (data.length === 0) {
    console.warn(`[${label}] Input array is empty`);
    return true;
  }

  const expectedLength = data[0].length;

  for (let i = 0; i < data.length; i++) {
    if (!Array.isArray(data[i])) {
      console.warn(`[${label}] Element at index ${i} is not an array`);
      return true;
    }

    if (data[i].length !== expectedLength) {
      console.warn(
        `[${label}] Inconsistent vector length at index ${i}: expected ${expectedLength}, got ${data[i].length}`
      );
      return true;
    }

    for (let j = 0; j < data[i].length; j++) {
      if (typeof data[i][j] !== "number" || Number.isNaN(data[i][j])) {
        console.warn(
          `[${label}] Invalid number found at position [${i}][${j}]: ${data[i][j]}`
        );
        return true;
      }
    }
  }

  return false;
}

// ====================================================================
// TSNE Run Wrappers
// ====================================================================

// runTSNE wraps a full TSNE run.
async function runTSNE(data, config) {
  if (containsNaN(data, "TSNE Input"))
    return { error: NaN, iter: 0, output: [] };
  const tsne = new TSNE({ ...config, dim: 2 });
  tsne.init({ data, type: "dense" });
  if (DEBUG_MODE) {
    console.log("DEBUG: Starting TSNE run...");
  }
  const [error, iter] = tsne.run();
  const output = tsne.getOutput();
  if (!Number.isFinite(error))
    console.warn("[WARNING] TSNE returned NaN error!");
  return { error, iter, output };
}

// runTSNEOnSample is a helper for quality metric tests.
async function runTSNEOnSample(sampleData) {
  return runTSNE(sampleData, {
    perplexity: HYPER.perplexity,
    earlyExaggeration: HYPER.earlyExaggeration,
    learningRate: HYPER.learningRate,
    nIter: HYPER.nIter,
    metric: HYPER.metric,
  });
}

// ====================================================================
// Quality Metric Functions
// ====================================================================

function trustworthiness(X, Y, k = 10) {
  const n = X.length;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    let distsX = [];
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      distsX.push({ index: j, dist: euclideanDistance(X[i], X[j]) });
    }
    distsX.sort((a, b) => a.dist - b.dist);
    const NN_X = distsX.slice(0, k).map((obj) => obj.index);
    let distsY = [];
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      distsY.push({ index: j, dist: euclideanDistance(Y[i], Y[j]) });
    }
    distsY.sort((a, b) => a.dist - b.dist);
    const rankY = {};
    distsY.forEach((obj, rank) => (rankY[obj.index] = rank + 1));
    let localSum = 0;
    for (let j = 0; j < k; j++) {
      const point = distsY[j].index;
      if (!NN_X.includes(point)) {
        localSum += rankY[point] - k;
      }
    }
    sum += localSum;
  }
  const factor = 2 / (n * k * (2 * n - 3 * k - 1));
  return 1 - factor * sum;
}

function neighborhoodPreservation(X, Y, k = 10) {
  const n = X.length;
  let totalPreserved = 0;
  for (let i = 0; i < n; i++) {
    let distsX = [];
    let distsY = [];
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      distsX.push({ index: j, dist: euclideanDistance(X[i], X[j]) });
      distsY.push({ index: j, dist: euclideanDistance(Y[i], Y[j]) });
    }
    distsX.sort((a, b) => a.dist - b.dist);
    distsY.sort((a, b) => a.dist - b.dist);
    const NN_X = distsX.slice(0, k).map((obj) => obj.index);
    const NN_Y = distsY.slice(0, k).map((obj) => obj.index);
    const preserved = NN_X.filter((x) => NN_Y.includes(x)).length;
    totalPreserved += preserved;
  }
  return totalPreserved / (n * k);
}

function meanRankError(X, Y) {
  const n = X.length;
  let totalError = 0;
  for (let i = 0; i < n; i++) {
    let distsX = [];
    let distsY = [];
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      distsX.push({ index: j, dist: euclideanDistance(X[i], X[j]) });
      distsY.push({ index: j, dist: euclideanDistance(Y[i], Y[j]) });
    }
    distsX.sort((a, b) => a.dist - b.dist);
    distsY.sort((a, b) => a.dist - b.dist);
    let rankX = {};
    let rankY = {};
    distsX.forEach((obj, idx) => (rankX[obj.index] = idx + 1));
    distsY.forEach((obj, idx) => (rankY[obj.index] = idx + 1));
    let errorSum = 0;
    for (let j = 0; j < distsX.length; j++) {
      const idx = distsX[j].index;
      errorSum += Math.abs(rankX[idx] - rankY[idx]);
    }
    totalError += errorSum / (n - 1);
  }
  return totalError / n;
}

function varianceRatio(embedding) {
  const dims = embedding[0].length;
  let variances = [];
  for (let d = 0; d < dims; d++) {
    const vals = embedding.map((vec) => vec[d]);
    const mean = vals.reduce((acc, v) => acc + v, 0) / vals.length;
    const var_d =
      vals.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / vals.length;
    variances.push(var_d);
  }
  if (Math.min(...variances) === 0) return NaN;
  return Math.max(...variances) / Math.min(...variances);
}

// ====================================================================
// Benchmark Configuration
// ====================================================================

const BASE_VARIANTS = [
  {
    name: "Fast Preview",
    config: {
      perplexity: 5,
      earlyExaggeration: 1.5,
      learningRate: 150,
      nIter: 100,
      barneshut: false,
      metric: "manhattan",
    },
  },
  {
    name: "Optimized",
    config: {
      perplexity: 20,
      earlyExaggeration: 2.0,
      learningRate: 100,
      nIter: 300,
      barneshut: true,
      theta: 0.5,
      metric: "manhattan",
    },
  },
];

const createBenchmarkConfigs = () => {
  const batchSizes = [50, 100, 150];
  const dimReductions = [null]; // No dimension reduction
  return BASE_VARIANTS.flatMap((variant) =>
    batchSizes.flatMap((batchSize) =>
      dimReductions.map((reduceDim) => ({
        name: `${variant.name} (batch=${batchSize})`,
        batchSize,
        reduceDim,
        tsneConfig: { ...variant.config, dim: 2 },
      }))
    )
  );
};
const BENCHMARK_CONFIGS = createBenchmarkConfigs();

// ====================================================================
// Main Benchmark Runner
// ====================================================================

async function runConfigOnSubset(config, embeddings, timeoutMs = 90000) {
  console.log(`\n[${config.name}] Processing ${embeddings.length} embeddings`);
  const { result: reduced, duration: reductionTime } = await measureTime(() =>
    reduceDimensions(embeddings, config.reduceDim)
  );
  console.log(
    `Reduced from ${embeddings[0].length}D to ${
      config.reduceDim || "original"
    } in ${reductionTime.toFixed(2)}ms`
  );

  const batches = Array.from(
    { length: Math.ceil(reduced.length / config.batchSize) },
    (_, i) =>
      reduced.slice(
        i * config.batchSize,
        Math.min((i + 1) * config.batchSize, reduced.length)
      )
  );
  console.log(
    `Processing ${batches.length} batches of size ${config.batchSize}`
  );

  let stats = {
    totalTime: 0,
    minBatchTime: Infinity,
    maxBatchTime: -Infinity,
    completedBatches: 0,
    nanErrors: 0,
    invalidInputs: 0,
  };

  for (const batch of batches) {
    const { result: tsneResult, duration: runTime } = await measureTime(() =>
      runTSNE(batch, { ...config.tsneConfig, dim: 2 })
    );

    stats.totalTime += runTime;
    stats.minBatchTime = Math.min(stats.minBatchTime, runTime);
    stats.maxBatchTime = Math.max(stats.maxBatchTime, runTime);
    stats.completedBatches++;

    if (!Number.isFinite(tsneResult.error)) {
      stats.nanErrors++;
    }
    if (containsNaN(batch, "TSNE Input")) {
      stats.invalidInputs++;
    }
  }

  console.log("\nFinal Batch Statistics:");
  console.log(`Total batches processed: ${stats.completedBatches}`);
  console.log(
    `Avg time/batch: ${(
      stats.totalTime /
      stats.completedBatches /
      1000
    ).toFixed(2)}s`
  );
  console.log(
    `Time range: ${(stats.minBatchTime / 1000).toFixed(2)}s - ${(
      stats.maxBatchTime / 1000
    ).toFixed(2)}s`
  );
  if (stats.nanErrors > 0) {
    console.log(`NaN errors: ${stats.nanErrors}`);
  }
  if (stats.invalidInputs > 0) {
    console.log(`Invalid inputs: ${stats.invalidInputs}`);
  }

  return { totalTime: reductionTime + stats.totalTime };
}

// ====================================================================
// Additional TSNE Quality Metrics Tests
// ====================================================================

describe("Additional TSNE Quality Metrics", () => {
  const k = 10;
  timedTest("Trustworthiness Score Test", async () => {
    const embeddings = await loadSubsetOfEmbeddings(1000);
    const normalized = minMaxNormalize(embeddings);
    const sampleSize = 100;
    const X = normalized.slice(0, sampleSize);
    const { output: Y } = await runTSNEOnSample(X);
    const trust = trustworthiness(X, Y, k);
    console.log(`Trustworthiness Score (k=${k}): ${trust.toFixed(4)}`);
    expect(trust).toBeGreaterThan(0.7);
  });

  timedTest("Neighborhood Preservation Test", async () => {
    const embeddings = await loadSubsetOfEmbeddings(1000);
    const normalized = minMaxNormalize(embeddings);
    const sampleSize = 100;
    const X = normalized.slice(0, sampleSize);
    const { output: Y } = await runTSNEOnSample(X);
    const np = neighborhoodPreservation(X, Y, k);
    console.log(
      `Neighborhood Preservation (k=${k}): ${(np * 100).toFixed(2)}%`
    );
    expect(np).toBeGreaterThan(0.6);
  });

  timedTest("Mean Rank Error Test", async () => {
    const embeddings = await loadSubsetOfEmbeddings(1000);
    const normalized = minMaxNormalize(embeddings);
    const sampleSize = 100;
    const X = normalized.slice(0, sampleSize);
    const { output: Y } = await runTSNEOnSample(X);
    const mre = meanRankError(X, Y);
    console.log(`Mean Rank Error: ${mre.toFixed(4)}`);
    expect(mre).toBeLessThan(5);
  });

  timedTest("Variance Ratio Test", async () => {
    const embeddings = await loadSubsetOfEmbeddings(1000);
    const normalized = minMaxNormalize(embeddings);
    const { output: Y } = await runTSNEOnSample(normalized.slice(0, 200));
    const vr = varianceRatio(Y);
    console.log(`Variance Ratio: ${isNaN(vr) ? "NaN" : vr.toFixed(4)}`);
    expect(vr).toBeGreaterThanOrEqual(0.8);
    expect(vr).toBeLessThanOrEqual(1.2);
  });
});

// ====================================================================
// New TSNE Advanced Debug Tests (Small Batch Focus)
// ====================================================================

describe("New TSNE Advanced Debug Tests", () => {
  timedTest("Data Normalization Test", async () => {
    const embeddings = await loadSubsetOfEmbeddings(1000);
    const normalized = minMaxNormalize(embeddings);
    console.log(
      `Normalized data: ${normalized.length} vectors; sample vector summary:`
    );
    logArraySummary("Vector[0]", normalized[0]);
    normalized.forEach((vec) => {
      expect(Math.min(...vec)).toBeGreaterThanOrEqual(-1);
      expect(Math.max(...vec)).toBeLessThanOrEqual(1);
    });
  });

  timedTest("Per-dimension Variance Test", async () => {
    const embeddings = await loadSubsetOfEmbeddings(1000);
    const dim = embeddings[0].length;
    let variances = [];
    for (let i = 0; i < dim; i++) {
      const vals = embeddings.map((vec) => vec[i]);
      const mean = vals.reduce((sum, v) => sum + v, 0) / vals.length;
      const variance =
        vals.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / vals.length;
      variances.push(variance);
    }
    console.log("Per-dimension variances (first 5):");
    logArraySummary("Variances", variances.slice(0, 5));
    variances.forEach((v) => expect(Number.isFinite(v)).toBe(true));
  });

  timedTest("Hyperparameter Tuning Test on Normalized Data", async () => {
    const embeddings = await loadSubsetOfEmbeddings(1000);
    const normalized = minMaxNormalize(embeddings);
    const batch = normalized.slice(0, 100);
    const { error, iter } = await runTSNE(batch, {
      perplexity: HYPER.perplexity,
      earlyExaggeration: HYPER.earlyExaggeration,
      learningRate: HYPER.learningRate,
      nIter: HYPER.nIter,
      metric: HYPER.metric,
    });
    console.log("Hyperparameter Tuning Test on Normalized Data:", {
      error,
      iter,
    });
    expect(Number.isFinite(error)).toBe(true);
  });

  timedTest("Metric Stability Test on Normalized Data", async () => {
    const embeddings = await loadSubsetOfEmbeddings(1000);
    const normalized = minMaxNormalize(embeddings);
    const batch = normalized.slice(0, 100);
    const modelMan = new TSNE({
      dim: 2,
      perplexity: HYPER.perplexity,
      earlyExaggeration: HYPER.earlyExaggeration,
      learningRate: HYPER.learningRate,
      nIter: HYPER.nIter,
      metric: "manhattan",
    });
    modelMan.init({ data: batch, type: "dense" });
    const [errorMan, iterMan] = modelMan.run();
    const modelEuc = new TSNE({
      dim: 2,
      perplexity: HYPER.perplexity,
      earlyExaggeration: HYPER.earlyExaggeration,
      learningRate: HYPER.learningRate,
      nIter: HYPER.nIter,
      metric: "euclidean",
    });
    modelEuc.init({ data: batch, type: "dense" });
    const [errorEuc, iterEuc] = modelEuc.run();
    console.log("Metric Stability Test on Normalized Data:", {
      errorMan,
      iterMan,
      errorEuc,
      iterEuc,
    });
    expect(Number.isFinite(errorMan)).toBe(true);
    expect(Number.isFinite(errorEuc)).toBe(true);
  });

  timedTest("Learning Rate Adjustment Test", async () => {
    const embeddings = await loadSubsetOfEmbeddings(1000);
    const batch = embeddings.slice(0, 300);
    const modelOrig = new TSNE({
      dim: 2,
      perplexity: 5,
      earlyExaggeration: 1.5,
      learningRate: 200,
      nIter: 100,
      metric: "manhattan",
    });
    modelOrig.init({ data: batch, type: "dense" });
    const [errorOrig, iterOrig] = modelOrig.run();
    console.log("Learning Rate Adjustment - Original:", {
      errorOrig,
      iterOrig,
    });
    const modelLowerLR = new TSNE({
      dim: 2,
      perplexity: 5,
      earlyExaggeration: 1.5,
      learningRate: 50,
      nIter: 100,
      metric: "manhattan",
    });
    modelLowerLR.init({ data: batch, type: "dense" });
    const [errorLowerLR, iterLowerLR] = modelLowerLR.run();
    console.log("Learning Rate Adjustment - Lower LR:", {
      errorLowerLR,
      iterLowerLR,
    });
    expect(Number.isFinite(errorOrig) || Number.isFinite(errorLowerLR)).toBe(
      true
    );
  });

  timedTest("Rerun Stability Test", () => {
    const simpleData = [
      [0.1, 0.2, 0.3],
      [0.2, 0.3, 0.4],
      [0.3, 0.4, 0.5],
    ];
    const model = new TSNE({
      dim: 2,
      perplexity: 30,
      earlyExaggeration: 4.0,
      learningRate: 100,
      nIter: 1000,
      metric: "euclidean",
    });
    model.init({ data: simpleData, type: "dense" });
    const [error1, iter1] = model.run();
    const [error2, iter2] = model.rerun();
    console.log("Rerun Stability Test:", { error1, iter1, error2, iter2 });
    expect(Number.isFinite(error1)).toBe(true);
    expect(Number.isFinite(error2)).toBe(true);
  });

  timedTest("Full Data Variance Test", async () => {
    const embeddings = await loadSubsetOfEmbeddings(1000);
    const batchSize = 100;
    const batches = Array.from(
      { length: Math.ceil(embeddings.length / batchSize) },
      (_, i) =>
        embeddings.slice(
          i * batchSize,
          Math.min((i + 1) * batchSize, embeddings.length)
        )
    );
    console.log(`Processing ${batches.length} batches of size ${batchSize}`);

    let allVariances = [];
    for (const batch of batches) {
      const dim = batch[0].length;
      for (let i = 0; i < dim; i++) {
        const vals = batch.map((vec) => vec[i]);
        const mean = vals.reduce((sum, v) => sum + v, 0) / vals.length;
        const variance =
          vals.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / vals.length;
        allVariances.push(variance);
      }
    }
    console.log("Full Data Variance Test - First 5 variances:");
    logArraySummary("Variances", allVariances.slice(0, 5));
    allVariances.forEach((v) => expect(Number.isFinite(v)).toBe(true));
  });

  timedTest("Full Workflow Normalized Test", async () => {
    console.log("\n=== Full Workflow Normalized Test ===");
    console.log("Starting Full Workflow Test");
    console.log("Loading embeddings from database...");
    const embeddings = await loadSubsetOfEmbeddings(1000);
    console.log(`Loaded ${embeddings.length} embeddings`);

    console.log("Normalizing data...");
    const normalized = minMaxNormalize(embeddings);
    const batchSize = 50; // Increased batch size to better match perplexity
    const batches = Array.from(
      { length: Math.ceil(normalized.length / batchSize) },
      (_, i) =>
        normalized.slice(
          i * batchSize,
          Math.min((i + 1) * batchSize, normalized.length)
        )
    );
    console.log(`Created ${batches.length} batches of size ${batchSize}`);

    let errors = [];
    let iters = [];

    for (let i = 0; i < batches.length; i++) {
      console.log(`Processing batch ${i + 1}/${batches.length}`);
      const batch = batches[i];
      const model = new TSNE({
        dim: 2,
        perplexity: HYPER.perplexity,
        earlyExaggeration: HYPER.earlyExaggeration,
        learningRate: HYPER.learningRate,
        nIter: HYPER.nIter,
        metric: HYPER.metric,
      });
      model.init({ data: batch, type: "dense" });
      const [error, iter] = model.run();
      console.log(`Batch ${i + 1} complete: error=${error}, iter=${iter}`);
      errors.push(error);
      iters.push(iter);
    }

    const avgError = errors.reduce((a, b) => a + b, 0) / errors.length;
    console.log(`Test complete - Average error: ${avgError.toFixed(4)}`);
    console.log(`Total batches processed: ${batches.length}`);

    errors.forEach((e) => expect(Number.isFinite(e)).toBe(true));
    iters.forEach((it) => expect(Number.isFinite(it)).toBe(true));
  });

  timedTest("Full Workflow Normalized Stability Test", async () => {
    const embeddings = await loadSubsetOfEmbeddings(2000);
    const normalized = minMaxNormalize(embeddings);
    let errors = [];
    let iterations = [];
    for (let i = 0; i < 3; i++) {
      const model = new TSNE({
        dim: 2,
        perplexity: HYPER.perplexity,
        earlyExaggeration: HYPER.earlyExaggeration,
        learningRate: HYPER.learningRate,
        nIter: HYPER.nIter,
        metric: HYPER.metric,
      });
      model.init({ data: normalized, type: "dense" });
      const [error, iter] = model.run();
      errors.push(error);
      iterations.push(iter);
    }
    console.log("Full Workflow Normalized Stability Test:", {
      errors,
      iterations,
    });
    errors.forEach((e) => expect(Number.isFinite(e)).toBe(true));
    iterations.forEach((it) => expect(Number.isFinite(it)).toBe(true));
  });

  timedTest("Stability Test on Small Data", () => {
    const simpleData = [
      [0.1, 0.2, 0.3],
      [0.2, 0.1, 0.4],
      [0.3, 0.3, 0.2],
    ];
    let errors = [];
    let iterations = [];
    for (let i = 0; i < 5; i++) {
      const model = new TSNE({
        dim: 2,
        perplexity: HYPER.perplexity,
        earlyExaggeration: HYPER.earlyExaggeration,
        learningRate: HYPER.learningRate,
        nIter: HYPER.nIter,
        metric: HYPER.metric,
      });
      model.init({ data: simpleData, type: "dense" });
      const [error, iter] = model.run();
      errors.push(error);
      iterations.push(iter);
    }
    console.log("Stability Test on Small Data:", { errors, iterations });
    errors.forEach((e) => expect(Number.isFinite(e)).toBe(true));
    iterations.forEach((it) => expect(Number.isFinite(it)).toBe(true));
  });

  timedTest("Min-Max Preprocessing Test", async () => {
    const embeddings = await loadSubsetOfEmbeddings(1000);
    const normalized = minMaxNormalize(embeddings);
    console.log(
      `Min-Max Preprocessing: ${normalized.length} vectors; sample vector:`
    );
    logArraySummary("Normalized Vector[0]", normalized[0]);
    const { error, iter } = await runTSNE(normalized, {
      perplexity: HYPER.perplexity,
      earlyExaggeration: HYPER.earlyExaggeration,
      learningRate: HYPER.learningRate,
      nIter: HYPER.nIter,
      metric: "euclidean",
    });
    console.log("Min-Max Preprocessing Test:", { error, iter });
    expect(Number.isFinite(error)).toBe(true);
  });

  timedTest("Z-Score Standardization Test", async () => {
    const embeddings = await loadSubsetOfEmbeddings(1000);
    const standardized = zScoreStandardize(embeddings);
    console.log(
      `Z-Score Standardization: ${standardized.length} vectors; sample vector:`
    );
    logArraySummary("Standardized Vector[0]", standardized[0]);
    const { error, iter } = await runTSNE(standardized, {
      perplexity: HYPER.perplexity,
      earlyExaggeration: HYPER.earlyExaggeration,
      learningRate: HYPER.learningRate,
      nIter: HYPER.nIter,
      metric: "euclidean",
    });
    console.log("Z-Score Standardization Test:", { error, iter });
    expect(Number.isFinite(error)).toBe(true);
  });

  timedTest("Small Batch Test (Batch Size 100)", async () => {
    const embeddings = await loadSubsetOfEmbeddings(1000);
    const normalized = minMaxNormalize(embeddings);
    const batchSize = 100;
    const numBatches = Math.ceil(normalized.length / batchSize);
    console.log(
      `Running TSNE on ${numBatches} small batches (size=${batchSize})`
    );
    let allErrors = [];
    let allIterations = [];
    for (let i = 0; i < numBatches; i++) {
      const batch = normalized.slice(i * batchSize, (i + 1) * batchSize);
      const { error, iter } = await runTSNE(batch, {
        perplexity: i % 2 === 0 ? 15 : 20,
        earlyExaggeration: 4.0,
        learningRate: i % 2 === 0 ? 100 : 80,
        nIter: 1000,
        metric: "euclidean",
      });
      allErrors.push(error);
      allIterations.push(iter);
    }
    console.log("Small Batch Test (Batch Size 100): Summary:");
    logArraySummary("Errors", allErrors);
    logArraySummary("Iterations", allIterations);
    allErrors.forEach((e) => expect(Number.isFinite(e)).toBe(true));
    allIterations.forEach((it) => expect(it).toBeGreaterThan(33));
  });

  timedTest("Tiny Batch Test (Batch Size 50)", async () => {
    const embeddings = await loadSubsetOfEmbeddings(1000);
    const standardized = zScoreStandardize(embeddings);
    const batchSize = 50;
    const numBatches = Math.ceil(standardized.length / batchSize);
    console.log(
      `Running TSNE on ${numBatches} tiny batches (size=${batchSize})`
    );
    let stats = {
      errors: [],
      iterations: [],
      invalidInputs: 0,
      nanErrors: 0,
    };
    for (let i = 0; i < numBatches; i++) {
      const batch = standardized.slice(i * batchSize, (i + 1) * batchSize);
      if (containsNaN(batch, "TSNE Input")) stats.invalidInputs++;
      const { error, iter } = await runTSNE(batch, {
        perplexity: i % 2 === 0 ? 10 : 8,
        earlyExaggeration: 4.0,
        learningRate: i % 2 === 0 ? 50 : 40,
        nIter: 1500,
        metric: "euclidean",
      });
      stats.errors.push(error);
      stats.iterations.push(iter);
      if (!Number.isFinite(error)) stats.nanErrors++;
    }
    const avgError =
      stats.errors.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0) /
      numBatches;
    const avgIterations =
      stats.iterations.reduce((a, b) => a + b, 0) / numBatches;
    console.log("Tiny Batch Test Summary:");
    console.log(`Total batches: ${numBatches}`);
    console.log(`Invalid inputs: ${stats.invalidInputs}`);
    console.log(`NaN errors: ${stats.nanErrors}`);
    console.log(`Average error: ${avgError.toFixed(4)}`);
    console.log(`Average iterations: ${avgIterations.toFixed(2)}`);
    expect(stats.nanErrors).toBe(0);
    expect(stats.invalidInputs).toBe(0);
    stats.errors.forEach((e) => expect(Number.isFinite(e)).toBe(true));
  });

  timedTest("Very Small Batch Test (Batch Size 10)", async () => {
    const embeddings = await loadSubsetOfEmbeddings(1000);
    const normalized = minMaxNormalize(embeddings);
    const batchSize = 10;
    const numBatches = Math.ceil(normalized.length / batchSize);
    console.log(
      `Running TSNE on ${numBatches} very small batches (size=${batchSize})`
    );
    let allErrors = [];
    let allIterations = [];
    for (let i = 0; i < numBatches; i++) {
      const batch = normalized.slice(i * batchSize, (i + 1) * batchSize);
      const { error, iter } = await runTSNE(batch, {
        perplexity: 5,
        earlyExaggeration: 4.0,
        learningRate: 50,
        nIter: 1500,
        metric: "euclidean",
      });
      allErrors.push(error);
      allIterations.push(iter);
      if ((i + 1) % 50 === 0 || i === numBatches - 1) {
        console.log(`Progress: Batch ${i + 1}/${numBatches}`);
      }
    }
    console.log("Very Small Batch Test (Batch Size 10): Summary:");
    logArraySummary("Errors", allErrors);
    logArraySummary("Iterations", allIterations);
    allErrors.forEach((e) => expect(Number.isFinite(e)).toBe(true));
    allIterations.forEach((it) => expect(it).toBeGreaterThan(33));
  });

  timedTest("Medium Batch Test (Batch Size 200)", async () => {
    const embeddings = await loadSubsetOfEmbeddings(1000);
    const standardized = zScoreStandardize(embeddings);
    const batchSize = 200;
    const numBatches = Math.ceil(standardized.length / batchSize);
    console.log(
      `Running TSNE on ${numBatches} medium batches (size=${batchSize})`
    );
    let allErrors = [];
    let allIterations = [];
    for (let i = 0; i < numBatches; i++) {
      const batch = standardized.slice(i * batchSize, (i + 1) * batchSize);
      const { error, iter } = await runTSNE(batch, {
        perplexity: 20,
        earlyExaggeration: 4.0,
        learningRate: 100,
        nIter: 1000,
        metric: "euclidean",
      });
      allErrors.push(error);
      allIterations.push(iter);
      if ((i + 1) % 50 === 0 || i === numBatches - 1) {
        console.log(`Progress: Batch ${i + 1}/${numBatches}`);
      }
    }
    console.log("Medium Batch Test (Batch Size 200): Summary:");
    logArraySummary("Errors", allErrors);
    logArraySummary("Iterations", allIterations);
    allErrors.forEach((e) => expect(Number.isFinite(e)).toBe(true));
    allIterations.forEach((it) => expect(it).toBeGreaterThan(33));
  });

  timedTest("Iterative Rerun Improvement Test", () => {
    const simpleData = [
      [0.1, 0.2, 0.3],
      [0.2, 0.3, 0.4],
      [0.3, 0.4, 0.5],
      [0.4, 0.5, 0.6],
      [0.5, 0.6, 0.7],
    ];
    const model = new TSNE({
      dim: 2,
      perplexity: 30,
      earlyExaggeration: 4.0,
      learningRate: 100,
      nIter: 1000,
      metric: "euclidean",
    });
    model.init({ data: simpleData, type: "dense" });
    const [errorInitial, iterInitial] = model.run();
    let errors = [errorInitial];
    for (let i = 0; i < 3; i++) {
      const [errorRerun, iterRerun] = model.rerun();
      errors.push(errorRerun);
    }
    console.log("Iterative Rerun Improvement Test:", { errors });
    errors.forEach((e) => expect(Number.isFinite(e)).toBe(true));
  });

  timedTest("Data Preprocessing Comparison Test", async () => {
    const embeddings = await loadSubsetOfEmbeddings(1000);
    const normalized = minMaxNormalize(embeddings);
    const standardized = zScoreStandardize(embeddings);
    console.log(`Preprocessing Comparison: ${normalized.length} vectors`);
    const modelNorm = new TSNE({
      dim: 2,
      perplexity: 30,
      earlyExaggeration: 4.0,
      learningRate: 100,
      nIter: 1000,
      metric: "euclidean",
    });
    modelNorm.init({ data: normalized, type: "dense" });
    const [errorNorm, iterNorm] = modelNorm.run();
    const modelStd = new TSNE({
      dim: 2,
      perplexity: 30,
      earlyExaggeration: 4.0,
      learningRate: 100,
      nIter: 1000,
      metric: "euclidean",
    });
    modelStd.init({ data: standardized, type: "dense" });
    const [errorStd, iterStd] = modelStd.run();
    console.log("Data Preprocessing Comparison Test:", {
      errorNorm,
      iterNorm,
      errorStd,
      iterStd,
    });
    expect(Number.isFinite(errorNorm)).toBe(true);
    expect(Number.isFinite(errorStd)).toBe(true);
  });

  timedTest("Trustworthiness Score Test", async () => {
    const embeddings = await loadSubsetOfEmbeddings(1000);
    const normalized = minMaxNormalize(embeddings);
    const sampleSize = 100;
    const X = normalized.slice(0, sampleSize);
    const model = new TSNE({
      dim: 2,
      perplexity: 30,
      earlyExaggeration: 4.0,
      learningRate: 100,
      nIter: 1000,
      metric: "euclidean",
    });
    model.init({ data: X, type: "dense" });
    model.run();
    const Y = model.getOutput();
    const trust = trustworthiness(X, Y, 10);
    console.log(`Trustworthiness Score: ${trust.toFixed(4)}`);
    expect(trust).toBeGreaterThan(0.7);
  });

  timedTest("Neighborhood Preservation Test", async () => {
    const embeddings = await loadSubsetOfEmbeddings(1000);
    const normalized = minMaxNormalize(embeddings);
    const sampleSize = 100;
    const X = normalized.slice(0, sampleSize);
    const model = new TSNE({
      dim: 2,
      perplexity: 30,
      earlyExaggeration: 4.0,
      learningRate: 100,
      nIter: 1000,
      metric: "euclidean",
    });
    model.init({ data: X, type: "dense" });
    model.run();
    const Y = model.getOutput();
    const np = neighborhoodPreservation(X, Y, 10);
    console.log(`Neighborhood Preservation: ${(np * 100).toFixed(2)}%`);
    expect(np).toBeGreaterThan(0.6);
  });
});

// ====================================================================
// Main Benchmark Test Suite
// ====================================================================

describe("TSNE Benchmark Tests", () => {
  const FULL_DATASET_SIZE = 8446;
  for (const config of BENCHMARK_CONFIGS) {
    // You can adjust the timeout per benchmark test if needed.
    timedTest(
      `${config.name}`,
      async () => {
        const embeddings = await loadSubsetOfEmbeddings(FULL_DATASET_SIZE);
        const result = await runConfigOnSubset(config, embeddings);
        expect(result).toBeDefined();
        if (result && !result.timedOut) {
          expect(result.totalTime).toBeLessThanOrEqual(90000);
        }
      },
      90000 // benchmark tests must finish within 90 seconds
    );
  }
});
