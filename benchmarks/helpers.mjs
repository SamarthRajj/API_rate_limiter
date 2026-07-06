import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function loadBackendEnv() {
  try {
    const envPath = path.resolve(__dirname, "../backend/.env");
    const content = await fs.readFile(envPath, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const [key, ...rest] = trimmed.split("=");
      if (key && !(key in process.env)) {
        process.env[key] = rest.join("=").trim();
      }
    }
  } catch {
    // ignore missing env file
  }
}

export async function loadConfig() {
  const configPath = path.join(__dirname, "config.json");
  return JSON.parse(await fs.readFile(configPath, "utf8"));
}

export function getOutputDir(config) {
  return path.resolve(__dirname, config.outputDir);
}

export async function ensureThroughputClient(baseUrl, limits) {
  const response = await fetch(`${baseUrl}/api/clients`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "BenchmarkThroughputClient",
      perMinuteLimit: limits.perMinuteLimit,
      perDayLimit: limits.perDayLimit,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to create throughput client: ${response.status} ${text}`);
  }

  return response.json();
}

export async function resolveThroughputApiKey(baseUrl, config) {
  if (process.env.BENCHMARK_THROUGHPUT_API_KEY) {
    return process.env.BENCHMARK_THROUGHPUT_API_KEY;
  }

  const keyFile = path.join(getOutputDir(config), "throughput-client.json");
  try {
    const saved = JSON.parse(await fs.readFile(keyFile, "utf8"));
    if (saved.apiKey) {
      return saved.apiKey;
    }
  } catch {
    // create below
  }

  const client = await ensureThroughputClient(baseUrl, config.throughputClient);
  await fs.mkdir(getOutputDir(config), { recursive: true });
  await fs.writeFile(keyFile, JSON.stringify(client, null, 2));
  return client.apiKey;
}

export function percentile(sortedValues, pct) {
  if (!sortedValues.length) {
    return 0;
  }
  const index = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.ceil(sortedValues.length * pct) - 1)
  );
  return sortedValues[index];
}

export function median(values) {
  if (!values.length) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export async function captureEnvironment() {
  await loadBackendEnv();
  let gitCommit = "unknown";
  try {
    const { execSync } = await import("child_process");
    gitCommit = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    // ignore
  }

  return {
    nodeVersion: process.version,
    platform: `${process.platform} ${process.arch}`,
    benchmarkMode: process.env.BENCHMARK_MODE || "unknown",
    redisUrl: process.env.REDIS_URL ? redactUrl(process.env.REDIS_URL) : "not set",
    mongoUri: process.env.MONGO_URI ? "configured" : "not set",
    gitCommit,
    capturedAt: new Date().toISOString(),
  };
}

function redactUrl(url) {
  return url.replace(/:[^:@/]+@/, ":***@");
}
