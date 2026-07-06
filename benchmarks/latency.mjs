import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import {
  captureEnvironment,
  getOutputDir,
  loadConfig,
  percentile,
  resolveThroughputApiKey,
} from "./helpers.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const config = await loadConfig();
const baseUrl = process.env.BENCHMARK_BASE_URL || config.baseUrl;
const targetUrl = `${baseUrl}${config.apiPath}`;
const durationSeconds = Number(process.env.LATENCY_DURATION || config.latency.durationSeconds);
const targetRps = Number(process.env.LATENCY_RPS || config.latency.targetRps);
const intervalMs = 1000 / targetRps;

console.log(`Running latency benchmark against ${targetUrl}`);
console.log(`Target RPS: ${targetRps}, duration: ${durationSeconds}s (200 responses only)`);

const apiKey = await resolveThroughputApiKey(baseUrl, config);
const latencies200 = [];
let totalRequests = 0;
let count200 = 0;
let count429 = 0;
let errors = 0;

const endAt = Date.now() + durationSeconds * 1000;

while (Date.now() < endAt) {
  const batchStart = Date.now();

  try {
    const started = performance.now();
    const response = await fetch(targetUrl, {
      headers: { "x-api-key": apiKey },
    });
    const elapsed = performance.now() - started;
    totalRequests += 1;

    if (response.status === 200) {
      count200 += 1;
      latencies200.push(elapsed);
    } else if (response.status === 429) {
      count429 += 1;
    } else {
      errors += 1;
    }
  } catch {
    errors += 1;
    totalRequests += 1;
  }

  const elapsedBatch = Date.now() - batchStart;
  const sleepMs = Math.max(0, intervalMs - elapsedBatch);
  if (sleepMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, sleepMs));
  }
}

const sorted = [...latencies200].sort((a, b) => a - b);
const output = {
  type: "latency-benchmark",
  timestamp: new Date().toISOString(),
  targetUrl,
  environment: await captureEnvironment(),
  config: {
    durationSeconds,
    targetRps,
    statusFilter: 200,
  },
  results: {
    totalRequests,
    count200,
    count429,
    errors,
    achievedRps200: count200 / durationSeconds,
    latencyMs: {
      avg: sorted.length ? sorted.reduce((a, b) => a + b, 0) / sorted.length : 0,
      p50: percentile(sorted, 0.5),
      p95: percentile(sorted, 0.95),
      p99: percentile(sorted, 0.99),
      min: sorted[0] || 0,
      max: sorted[sorted.length - 1] || 0,
    },
  },
};

const outputDir = getOutputDir(config);
await fs.mkdir(outputDir, { recursive: true });
const outputFile = path.join(outputDir, `latency-${Date.now()}.json`);
await fs.writeFile(outputFile, JSON.stringify(output, null, 2));

console.log("\nLatency benchmark complete.");
console.log(`200 responses: ${count200} (${output.results.achievedRps200.toFixed(1)} RPS)`);
console.log(`P50: ${output.results.latencyMs.p50.toFixed(1)} ms`);
console.log(`P99: ${output.results.latencyMs.p99.toFixed(1)} ms`);
console.log(`Results saved to ${outputFile}`);

export default output;
