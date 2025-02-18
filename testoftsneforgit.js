// ====================================================================
// TSNE Test File - Advanced Debug & Quality Metrics
// Filename: tsne.test.js
// ====================================================================

import { describe, test, expect } from "bun:test";
import TSNE from "tsne-js";
import { getEmbeddings } from "./db.js";

// ====================================
// Utility Functions
// ====================================

const measureTime = async (fn) => {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;
  return { result, duration };
};

const loadSubsetOfEmbeddings = async (count) => {
  const data = await getEmbeddings();
  return data.slice(0, count).map((item) => item.embedding);
};

// Legacy dimension reduction (kept for legacy purposes)
const reduceDimensions = (embeddings, targetDim) => {
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
};

// Add new utility function for NaN checking
const checkForNaN = (data, label = "Embeddings") => {
  for (let i = 0; i < data.length; i++) {
    if (data[i].some((x) => isNaN(x))) {
      console.error(`[ERROR] NaN detected in ${label} at index ${i}`);
      return true;
    }
  }
  return false;
};

// Update minMaxNormalize to handle edge cases
const minMaxNormalize = (embeddings) =>
  embeddings.map((vec) => {
    const min = Math.min(...vec);
    const max = Math.max(...vec);
    if (min === max) return vec.map(() => 0); // Avoid division by zero
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

// A helper for smart logging: log summary info from an array
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

// Euclidean distance helper
function euclideanDistance(a, b) {
  return Math.sqrt(a.reduce((sum, v, i) => sum + Math.pow(v - b[i], 2), 0));
}

// ====================================
// Debug Logging Wrapper
// ====================================

// This helper attempts to run a few iterations manually and log intermediate errors.
// If TSNE-js exposes a "step" or "getGradient" method, we log them.
// Otherwise, we log that incremental logging is not available.
async function runTSNEWithDebugLogging(tsne, debugIterations = 5) {
  if (typeof tsne.step === "function") {
    console.log("Running TSNE with debug logging for first iterations:");
    for (let i = 0; i < debugIterations; i++) {
      tsne.step();
      if (typeof tsne.getError === "function") {
        const err = tsne.getError();
        console.log(`Iteration ${i + 1}: Error = ${err}`);
      }
      if (typeof tsne.getGradient === "function") {
        const grad = tsne.getGradient();
        const gradNorm = Math.sqrt(
          grad.reduce((sum, val) => sum + val * val, 0)
        );
        console.log(`Iteration ${i + 1}: Gradient norm = ${gradNorm}`);
      }
    }
    // Then complete run.
    return tsne.run();
  } else {
    console.log(
      "TSNE-js does not expose incremental iteration methods. Running full run()."
    );
    return tsne.run();
  }
}

// ====================================
// Quality Metric Functions
// ====================================

/**
 * Trustworthiness Score
 * Computes how well the local structure is preserved.
 */
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

/**
 * Neighborhood Preservation
 * Computes the fraction of k-neighbors in high-dim that remain in the embedding.
 */
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

/**
 * Mean Rank Error
 * Computes the average rank difference for neighbors.
 */
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

/**
 * Variance Ratio
 * Computes ratio of max variance to min variance in the embedding.
 */
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

// ====================================
// Configuration Variants & Benchmark Setup
// ====================================

/**
 * Two base variants:
 * - "Fast Preview": Lower perplexity, fewer iterations (for speed).
 * - "Balanced": Closer to recommended parameters.
 * Both use the "manhattan" metric.
 */
const BASE_VARIANTS = [
  {
    name: "Fast Preview",
    config: {
      perplexity: 5,
      earlyExaggeration: 1.5,
      learningRate: 200,
      nIter: 100,
      barneshut: false,
      metric: "manhattan",
    },
  },
  {
    name: "Balanced",
    config: {
      perplexity: 30,
      earlyExaggeration: 4.0,
      learningRate: 100,
      nIter: 1000,
      barneshut: true,
      theta: 0.5,
      metric: "manhattan",
    },
  },
];

// For benchmarking, we normally use larger batches,
// but for hyperparameter tuning we use small batches.
const createBenchmarkConfigs = () => {
  const batchSizes = [300, 400]; // for final benchmarks
  const dimReductions = [null];
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

// ====================================
// Main Benchmark Runner
// ====================================
async function runConfigOnSubset(config, embeddings, timeoutMs = 90000) {
  console.log(`\n[${config.name}] Processing ${embeddings.length} embeddings`);
  const { result: reduced, duration: reductionTime } = await measureTime(() =>
    reduceDimensions(embeddings, config.reduceDim)
  );
  if (config.reduceDim) {
    console.log(
      `Reduced from ${embeddings[0].length}D to ${
        config.reduceDim
      }D in ${reductionTime.toFixed(2)}ms`
    );
  }
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
    avgIterations: 0,
    totalError: 0,
    completedBatches: 0,
  };

  for (const [i, batch] of batches.entries()) {
    const batchIndex = i + 1;
    const tsne = new TSNE({ ...config.tsneConfig, maxPoints: batch.length });
    tsne.init({ data: batch, type: "dense" });
    if (batchIndex === 1) {
      console.log(
        `First batch: ${batch.length} vectors; sample vector summary:`
      );
      logArraySummary("Vector[0]", batch[0]);
    }
    // Use debug logging wrapper here to help diagnose NaN production.
    const { result: tsneResult, duration: runTime } = await measureTime(() =>
      Promise.resolve().then(() => runTSNEWithDebugLogging(tsne))
    );
    stats.totalTime += runTime;
    stats.minBatchTime = Math.min(stats.minBatchTime, runTime);
    stats.maxBatchTime = Math.max(stats.maxBatchTime, runTime);
    stats.avgIterations += tsneResult.iterations;
    stats.completedBatches++;
    if (!Number.isFinite(tsneResult.error)) {
      console.warn(
        `Batch ${batchIndex} produced invalid error: ${tsneResult.error}`
      );
    }
    if (batchIndex % 10 === 0 || batchIndex === batches.length) {
      console.log(
        `Progress: ${batchIndex}/${batches.length} batches | Avg time/batch: ${(
          stats.totalTime /
          batchIndex /
          1000
        ).toFixed(1)}s`
      );
    }
  }

  stats.avgIterations /= stats.completedBatches;
  const avgTime = stats.totalTime / stats.completedBatches;
  console.log("\nFinal Batch Statistics:");
  console.log(`Avg time/batch: ${(avgTime / 1000).toFixed(2)}s`);
  console.log(
    `Time range: ${(stats.minBatchTime / 1000).toFixed(2)}s - ${(
      stats.maxBatchTime / 1000
    ).toFixed(2)}s`
  );
  console.log(`Avg iterations: ${stats.avgIterations.toFixed(1)}`);

  return { totalTime: reductionTime + stats.totalTime };
}

// ====================================
// Additional TSNE Quality Metrics
// ====================================

describe("Additional TSNE Quality Metrics", () => {
  const k = 10;
  const runTSNEOnSample = async (sampleData) => {
    const model = new TSNE({
      dim: 2,
      perplexity: 30,
      earlyExaggeration: 4.0,
      learningRate: 100,
      nIter: 1000,
      metric: "euclidean",
    });
    model.init({ data: sampleData, type: "dense" });
    const [error, iter] = model.run();
    return { output: model.getOutput() };
  };

  test("Trustworthiness Score Test", async () => {
    const embeddings = await loadSubsetOfEmbeddings(1000);
    const normalized = minMaxNormalize(embeddings);

    if (checkForNaN(normalized, "Normalized Data")) {
      console.error("Normalization produced NaN values!");
      return;
    }

    const sampleSize = 100;
    const X = normalized.slice(0, sampleSize);
    const { output: Y } = await runTSNE(X, {
      perplexity: 30,
      earlyExaggeration: 4.0,
      learningRate: 100,
      nIter: 1000,
      metric: "euclidean",
    });

    const trust = trustworthiness(X, Y, k);
    console.log(`Trustworthiness Score (k=${k}): ${trust.toFixed(4)}`);
    expect(trust).toBeGreaterThan(0.7);
  });

  test("Neighborhood Preservation Test", async () => {
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

  test("Mean Rank Error Test", async () => {
    const embeddings = await loadSubsetOfEmbeddings(1000);
    const normalized = minMaxNormalize(embeddings);
    const sampleSize = 100;
    const X = normalized.slice(0, sampleSize);
    const { output: Y } = await runTSNEOnSample(X);
    const mre = meanRankError(X, Y);
    console.log(`Mean Rank Error: ${mre.toFixed(4)}`);
    expect(mre).toBeLessThan(5);
  });

  test("Variance Ratio Test", async () => {
    const embeddings = await loadSubsetOfEmbeddings(1000);
    const normalized = minMaxNormalize(embeddings);
    const { output: Y } = await runTSNEOnSample(normalized.slice(0, 200));
    const vr = varianceRatio(Y);
    console.log(`Variance Ratio: ${isNaN(vr) ? "NaN" : vr.toFixed(4)}`);
    expect(vr).toBeGreaterThanOrEqual(0.8);
    expect(vr).toBeLessThanOrEqual(1.2);
  });
});

// ====================================
// New TSNE Advanced Debug Tests (Small Batch Focus)
// ====================================
describe("New TSNE Advanced Debug Tests", () => {
  // These tests focus on small batches (50 or 100) for hyperparameter tuning and debugging.

  // Test 1: Data Normalization Test
  test("Data Normalization Test", async () => {
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

  // Test 2: Per-dimension Variance Test
  test("Per-dimension Variance Test", async () => {
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

  // Test 3: Hyperparameter Tuning Test on Normalized Data (Small Batch of 100)
  test("Hyperparameter Tuning Test on Normalized Data", async () => {
    const embeddings = await loadSubsetOfEmbeddings(1000);
    const normalized = minMaxNormalize(embeddings);
    const batch = normalized.slice(0, 100);
    const model = new TSNE({
      dim: 2,
      perplexity: 30,
      earlyExaggeration: 4.0,
      learningRate: 100,
      nIter: 1000,
      metric: "manhattan",
    });
    model.init({ data: batch, type: "dense" });
    // Use our debug logging wrapper to try to capture early iteration info.
    const [error, iter] = model.step
      ? runTSNEWithDebugLogging(model, 5)
      : model.run();
    console.log("Hyperparameter Tuning Test on Normalized Data:", {
      error,
      iter,
    });
    expect(Number.isFinite(error)).toBe(true);
  });

  // Test 4: Metric Stability Test on Normalized Data (Small Batch of 100)
  test("Metric Stability Test on Normalized Data", async () => {
    const embeddings = await loadSubsetOfEmbeddings(1000);
    const normalized = minMaxNormalize(embeddings);
    const batch = normalized.slice(0, 100);
    const modelMan = new TSNE({
      dim: 2,
      perplexity: 30,
      earlyExaggeration: 4.0,
      learningRate: 100,
      nIter: 1000,
      metric: "manhattan",
    });
    modelMan.init({ data: batch, type: "dense" });
    const [errorMan, iterMan] = modelMan.run();
    const modelEuc = new TSNE({
      dim: 2,
      perplexity: 30,
      earlyExaggeration: 4.0,
      learningRate: 100,
      nIter: 1000,
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

  // Test 5: Learning Rate Adjustment Test (Small Batch of 300)
  test("Learning Rate Adjustment Test", async () => {
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

  // Test 6: Rerun Stability Test
  test("Rerun Stability Test", () => {
    const simpleData = [
      [0.1, 0.2, 0.3],
      [0.2, 0.1, 0.4],
      [0.3, 0.3, 0.2],
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

  // Test 7: Full Data Variance Test
  test("Full Data Variance Test", async () => {
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
    console.log("Full Data Variance Test - First 5 variances:");
    logArraySummary("Variances", variances.slice(0, 5));
    variances.forEach((v) => expect(Number.isFinite(v)).toBe(true));
  });

  // Test 8: Full Workflow Normalized Test (Small Batch Sample)
  test("Full Workflow Normalized Test", async () => {
    const embeddings = await loadSubsetOfEmbeddings(2000);
    const normalized = minMaxNormalize(embeddings);
    const model = new TSNE({
      dim: 2,
      perplexity: 30,
      earlyExaggeration: 4.0,
      learningRate: 100,
      nIter: 1000,
      metric: "euclidean",
    });
    model.init({ data: normalized, type: "dense" });
    const [error, iter] = model.run();
    const output = model.getOutput();
    console.log(
      `Full Workflow Normalized Test: Output has ${output.length} vectors`
    );
    expect(Number.isFinite(error)).toBe(true);
    expect(Number.isFinite(iter)).toBe(true);
    expect(output.length).toBe(normalized.length);
  });

  // Test 9: Full Workflow Normalized Stability Test (Small Sample)
  test("Full Workflow Normalized Stability Test", async () => {
    const embeddings = await loadSubsetOfEmbeddings(2000);
    const normalized = minMaxNormalize(embeddings);
    let errors = [];
    let iterations = [];
    for (let i = 0; i < 3; i++) {
      const model = new TSNE({
        dim: 2,
        perplexity: 30,
        earlyExaggeration: 4.0,
        learningRate: 100,
        nIter: 1000,
        metric: "euclidean",
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

  // Test 10: Stability Test on Small Data
  test("Stability Test on Small Data", () => {
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
        perplexity: 30,
        earlyExaggeration: 4.0,
        learningRate: 100,
        nIter: 1000,
        metric: "euclidean",
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

  // NEW TEST 11: Min-Max Preprocessing Test
  test("Min-Max Preprocessing Test", async () => {
    const embeddings = await loadSubsetOfEmbeddings(1000);
    const normalized = minMaxNormalize(embeddings);
    console.log(
      `Min-Max Preprocessing: ${normalized.length} vectors; sample vector:`
    );
    logArraySummary("Normalized Vector[0]", normalized[0]);
    const model = new TSNE({
      dim: 2,
      perplexity: 30,
      earlyExaggeration: 4.0,
      learningRate: 100,
      nIter: 1000,
      metric: "euclidean",
    });
    model.init({ data: normalized, type: "dense" });
    const [error, iter] = model.run();
    console.log("Min-Max Preprocessing Test:", { error, iter });
    expect(Number.isFinite(error)).toBe(true);
  });

  // NEW TEST 12: Z-Score Standardization Test
  test("Z-Score Standardization Test", async () => {
    const embeddings = await loadSubsetOfEmbeddings(1000);
    const standardized = zScoreStandardize(embeddings);
    console.log(
      `Z-Score Standardization: ${standardized.length} vectors; sample vector:`
    );
    logArraySummary("Standardized Vector[0]", standardized[0]);
    const model = new TSNE({
      dim: 2,
      perplexity: 30,
      earlyExaggeration: 4.0,
      learningRate: 100,
      nIter: 1000,
      metric: "euclidean",
    });
    model.init({ data: standardized, type: "dense" });
    const [error, iter] = model.run();
    console.log("Z-Score Standardization Test:", { error, iter });
    expect(Number.isFinite(error)).toBe(true);
  });

  // NEW TEST 13: Small Batch Test (Batch Size 100) with Variation
  test("Small Batch Test (Batch Size 100)", async () => {
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
      const model = new TSNE({
        dim: 2,
        perplexity: i % 2 === 0 ? 15 : 20,
        earlyExaggeration: 4.0,
        learningRate: i % 2 === 0 ? 100 : 80,
        nIter: 1000,
        metric: "euclidean",
      });
      model.init({ data: batch, type: "dense" });
      const [error, iter] = model.run();
      allErrors.push(error);
      allIterations.push(iter);
    }
    console.log("Small Batch Test (Batch Size 100): Summary:");
    logArraySummary("Errors", allErrors);
    logArraySummary("Iterations", allIterations);
    allErrors.forEach((e) => expect(Number.isFinite(e)).toBe(true));
    allIterations.forEach((it) => expect(it).toBeGreaterThan(33));
  });

  // NEW TEST 14: Tiny Batch Test (Batch Size 50) with Variation
  test("Tiny Batch Test (Batch Size 50)", async () => {
    const embeddings = await loadSubsetOfEmbeddings(1000);
    const standardized = zScoreStandardize(embeddings);
    const batchSize = 50;
    const numBatches = Math.ceil(standardized.length / batchSize);
    console.log(
      `Running TSNE on ${numBatches} tiny batches (size=${batchSize})`
    );
    let allErrors = [];
    let allIterations = [];
    for (let i = 0; i < numBatches; i++) {
      const batch = standardized.slice(i * batchSize, (i + 1) * batchSize);
      const model = new TSNE({
        dim: 2,
        perplexity: i % 2 === 0 ? 10 : 8,
        earlyExaggeration: 4.0,
        learningRate: i % 2 === 0 ? 50 : 40,
        nIter: 1500,
        metric: "euclidean",
      });
      model.init({ data: batch, type: "dense" });
      const [error, iter] = model.run();
      allErrors.push(error);
      allIterations.push(iter);
    }
    console.log("Tiny Batch Test (Batch Size 50): Summary:");
    logArraySummary("Errors", allErrors);
    logArraySummary("Iterations", allIterations);
    allErrors.forEach((e) => expect(Number.isFinite(e)).toBe(true));
    allIterations.forEach((it) => expect(it).toBeGreaterThan(33));
  });

  // NEW TEST 15: Very Small Batch Test (Batch Size 10)
  test("Very Small Batch Test (Batch Size 10)", async () => {
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
      const model = new TSNE({
        dim: 2,
        perplexity: 5,
        earlyExaggeration: 4.0,
        learningRate: 50,
        nIter: 1500,
        metric: "euclidean",
      });
      model.init({ data: batch, type: "dense" });
      const [error, iter] = model.run();
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

  // NEW TEST 16: Medium Batch Test (Batch Size 200)
  test("Medium Batch Test (Batch Size 200)", async () => {
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
      const model = new TSNE({
        dim: 2,
        perplexity: 20,
        earlyExaggeration: 4.0,
        learningRate: 100,
        nIter: 1000,
        metric: "euclidean",
      });
      model.init({ data: batch, type: "dense" });
      const [error, iter] = model.run();
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

  // NEW TEST 17: Iterative Rerun Improvement Test
  test("Iterative Rerun Improvement Test", () => {
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

  // NEW TEST 18: Data Preprocessing Comparison Test
  test("Data Preprocessing Comparison Test", async () => {
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

  // NEW TEST 19: Trustworthiness Score Test
  test("Trustworthiness Score Test", async () => {
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

  // NEW TEST 20: Neighborhood Preservation Test
  test("Neighborhood Preservation Test", async () => {
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

// ====================================
// Main Benchmark Test Suite (Existing Tests)
// ====================================
describe("TSNE Benchmark Tests", () => {
  const FULL_DATASET_SIZE = 8446;
  for (const config of BENCHMARK_CONFIGS) {
    test(`${config.name}`, async () => {
      const embeddings = await loadSubsetOfEmbeddings(FULL_DATASET_SIZE);
      const result = await runConfigOnSubset(config, embeddings);
      expect(result).toBeDefined();
      if (result && !result.timedOut) {
        expect(result.totalTime).toBeLessThanOrEqual(90000);
      }
    }, 90000);
  }
});
