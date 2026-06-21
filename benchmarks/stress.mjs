import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import autocannon from "autocannon";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.join(__dirname, "config.json");
const config = JSON.parse(await fs.readFile(configPath, "utf8"));

const baseUrl = process.env.BENCHMARK_BASE_URL || config.baseUrl;
let apiKey = process.env[config.stress.apiKeyEnv] || process.env.BENCHMARK_API_KEY;

if (!apiKey) {
  try {
    const seeded = JSON.parse(
      await fs.readFile(path.join(__dirname, config.outputDir, "seeded-clients.json"), "utf8")
    );
    apiKey = seeded[0]?.apiKey;
  } catch {
    // seeded clients file not found
  }
}

if (!apiKey) {
  console.error("No API key found. Run seedClients.mjs first or set BENCHMARK_API_KEY.");
  process.exit(1);
}

const targetUrl = `${baseUrl}${config.apiPath}`;
const duration = Number(process.env.STRESS_DURATION || config.stress.durationSeconds);
const connections = Number(process.env.STRESS_CONNECTIONS || config.stress.connections);
const pipelining = Number(process.env.STRESS_PIPELINING || config.stress.pipelining);
const targetRps = Number(process.env.STRESS_TARGET_RPS || config.stress.targetRps);

console.log(`Running autocannon stress test against ${targetUrl}`);
console.log(`Target RPS: ${targetRps}, connections: ${connections}, duration: ${duration}s`);

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

const output = {
  type: "autocannon-stress",
  timestamp: new Date().toISOString(),
  targetUrl,
  config: {
    connections,
    duration,
    pipelining,
    targetRps,
  },
  results: {
    requests: result.requests,
    throughput: result.throughput,
    latency: result.latency,
    errors: result.errors,
    timeouts: result.timeouts,
    statusCodeStats: result.statusCodeStats,
  },
};

const outputDir = path.resolve(__dirname, config.outputDir);
await fs.mkdir(outputDir, { recursive: true });
const outputFile = path.join(outputDir, `stress-${Date.now()}.json`);
await fs.writeFile(outputFile, JSON.stringify(output, null, 2));

console.log("\nStress test complete.");
console.log(`Average RPS: ${result.requests.average}`);
console.log(`P50 latency: ${result.latency.p50}ms`);
console.log(`P99 latency: ${result.latency.p99}ms`);
console.log(`Results saved to ${outputFile}`);

export default output;
