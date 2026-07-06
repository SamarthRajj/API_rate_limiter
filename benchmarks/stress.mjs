import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import autocannon from "autocannon";
import {
  captureEnvironment,
  getOutputDir,
  loadConfig,
  median,
  resolveThroughputApiKey,
} from "./helpers.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const config = await loadConfig();
const baseUrl = process.env.BENCHMARK_BASE_URL || config.baseUrl;
const targetUrl = `${baseUrl}${config.apiPath}`;
const duration = Number(process.env.STRESS_DURATION || config.stress.durationSeconds);
const connections = Number(process.env.STRESS_CONNECTIONS || config.stress.connections);
const pipelining = Number(process.env.STRESS_PIPELINING || config.stress.pipelining);
const targetRps = Number(process.env.STRESS_TARGET_RPS || config.stress.targetRps);
const runs = Number(process.env.STRESS_RUNS || config.stress.runs || 3);

console.log(`Running autocannon throughput test against ${targetUrl}`);
console.log(`Target RPS: ${targetRps}, connections: ${connections}, duration: ${duration}s, runs: ${runs}`);

const apiKey = await resolveThroughputApiKey(baseUrl, config);
const runResults = [];

for (let i = 0; i < runs; i += 1) {
  console.log(`\nRun ${i + 1}/${runs}...`);
  const result = await autocannon({
    url: targetUrl,
    connections,
    duration,
    pipelining,
    overallRate: targetRps,
    headers: {
      "x-api-key": apiKey,
    },
  });

  const count200 = result.statusCodeStats?.["200"]?.count || 0;
  const count429 = result.statusCodeStats?.["429"]?.count || 0;
  const total = result.requests.total || 0;
  const durationActual = duration;

  runResults.push({
    averageRps: result.requests.average,
    count200,
    count429,
    rps200: count200 / durationActual,
    rps429: count429 / durationActual,
    latency: result.latency,
    errors: result.errors,
    timeouts: result.timeouts,
    statusCodeStats: result.statusCodeStats,
  });
}

const averageRpsValues = runResults.map((run) => run.averageRps);
const rps200Values = runResults.map((run) => run.rps200);
const medianRun = runResults[Math.floor(runResults.length / 2)];

const output = {
  type: "autocannon-throughput",
  timestamp: new Date().toISOString(),
  targetUrl,
  environment: await captureEnvironment(),
  config: {
    connections,
    duration,
    pipelining,
    targetRps,
    runs,
    throughputClientLimits: config.throughputClient,
  },
  results: {
    medianAverageRps: median(averageRpsValues),
    medianRps200: median(rps200Values),
    runs: runResults,
    representativeRun: medianRun,
  },
};

const outputDir = getOutputDir(config);
await fs.mkdir(outputDir, { recursive: true });
const outputFile = path.join(outputDir, `throughput-${Date.now()}.json`);
await fs.writeFile(outputFile, JSON.stringify(output, null, 2));

console.log("\nThroughput benchmark complete.");
console.log(`Median average RPS: ${output.results.medianAverageRps.toFixed(2)}`);
console.log(`Median 200 RPS: ${output.results.medianRps200.toFixed(2)}`);
console.log(`Representative P50 latency: ${medianRun.latency.p50} ms`);
console.log(`Representative P99 latency: ${medianRun.latency.p99} ms`);
console.log(`200 responses: ${medianRun.count200}, 429 responses: ${medianRun.count429}`);
console.log(`Results saved to ${outputFile}`);

export default output;
