import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.join(__dirname, "config.json");
const config = JSON.parse(await fs.readFile(configPath, "utf8"));
const outputDir = path.resolve(__dirname, config.outputDir);

async function readJsonFiles(prefix) {
  const files = await fs.readdir(outputDir);
  const matches = files.filter((file) => file.startsWith(prefix) && file.endsWith(".json"));
  const payloads = [];

  for (const file of matches) {
    const content = JSON.parse(await fs.readFile(path.join(outputDir, file), "utf8"));
    payloads.push({ file, content });
  }

  return payloads.sort((a, b) => a.file.localeCompare(b.file));
}

const stressRuns = await readJsonFiles("stress-");
const simulatorRuns = (await readJsonFiles("simulator-")).filter((entry) => entry.content.clients);
const latestStress = stressRuns.at(-1)?.content;
const latestSimulator = simulatorRuns.at(-1)?.content;

const lines = [
  "# Benchmark Report",
  "",
  `Generated: ${new Date().toISOString()}`,
  "",
  "## Autocannon Stress (single client)",
  "",
];

if (latestStress) {
  lines.push(
    `- Target URL: ${latestStress.targetUrl}`,
    `- Average RPS: ${latestStress.results.requests.average}`,
    `- P50 latency: ${latestStress.results.latency.p50} ms`,
    `- P97.5 latency: ${latestStress.results.latency.p97_5} ms`,
    `- P99 latency: ${latestStress.results.latency.p99} ms`,
    `- 2xx responses: ${latestStress.results.requests.total - (latestStress.results.errors || 0)}`,
    `- Errors: ${latestStress.results.errors || 0}`,
    ""
  );
} else {
  lines.push("_No stress results found. Run `npm run stress` first._", "");
}

lines.push("## Python Simulator (multi-client)", "");

if (latestSimulator) {
  lines.push(
    `- Duration: ${latestSimulator.duration}s`,
    `- Total requests: ${latestSimulator.summary.total}`,
    `- Allowed: ${latestSimulator.summary.allowed}`,
    `- Blocked: ${latestSimulator.summary.blocked}`,
    `- Aggregate P50: ${latestSimulator.aggregate?.p50_latency?.toFixed?.(1) ?? "n/a"} ms`,
    `- Aggregate P95: ${latestSimulator.aggregate?.p95_latency?.toFixed?.(1) ?? "n/a"} ms`,
    `- Aggregate P99: ${latestSimulator.aggregate?.p99_latency?.toFixed?.(1) ?? "n/a"} ms`,
    ""
  );
} else {
  lines.push("_No simulator results found._", "");
}

lines.push(
  "## Notes",
  "",
  "- Start backend with `BENCHMARK_MODE=true` for best throughput numbers.",
  "- Seed clients before stress tests: `npm run seed`.",
  "- Full suite: `npm run suite`.",
  ""
);

const reportPath = path.join(outputDir, "latest.md");
await fs.writeFile(reportPath, lines.join("\n"));
console.log(`Report written to ${reportPath}`);
