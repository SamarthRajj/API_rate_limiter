import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { captureEnvironment, getOutputDir, loadConfig } from "./helpers.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const config = await loadConfig();
const outputDir = getOutputDir(config);

async function readLatestJson(prefix, filterFn = () => true) {
  const files = await fs.readdir(outputDir);
  const matches = files
    .filter((file) => file.startsWith(prefix) && file.endsWith(".json"))
    .sort();

  for (let i = matches.length - 1; i >= 0; i -= 1) {
    const content = JSON.parse(await fs.readFile(path.join(outputDir, matches[i]), "utf8"));
    if (!content || typeof content !== "object" || Array.isArray(content)) {
      continue;
    }
    if (filterFn(content)) {
      return { file: matches[i], content };
    }
  }

  return null;
}

const environment = await captureEnvironment();
const throughput = await readLatestJson("throughput-", (c) => c.type === "autocannon-throughput")
  || await readLatestJson("stress-", (c) => c.type === "autocannon-stress");
const latency = await readLatestJson("latency-", (c) => c.type === "latency-benchmark");
const multiClient = await readLatestJson("simulator-", (c) => c.scenario === "multi-tenant-500")
  || await readLatestJson("simulator-", (c) => c.activeClientCount >= 100);

const lines = [
  "# Benchmark Report",
  "",
  `Generated: ${new Date().toISOString()}`,
  "",
  "## Environment",
  "",
  `- Node: ${environment.nodeVersion}`,
  `- Platform: ${environment.platform}`,
  `- BENCHMARK_MODE: ${environment.benchmarkMode}`,
  `- Redis: ${environment.redisUrl}`,
  `- MongoDB: ${environment.mongoUri}`,
  `- Git commit: ${environment.gitCommit}`,
  "",
  "## Scenario A: Peak Throughput (single tenant)",
  "",
];

if (throughput?.content?.results?.medianAverageRps !== undefined) {
  const run = throughput.content.results.representativeRun || {};
  lines.push(
    `- Target URL: ${throughput.content.targetUrl}`,
    `- Median average RPS: ${throughput.content.results.medianAverageRps.toFixed(2)}`,
    `- Median 200 RPS: ${throughput.content.results.medianRps200.toFixed(2)}`,
    `- 200 responses (representative run): ${run.count200 ?? "n/a"}`,
    `- 429 responses (representative run): ${run.count429 ?? "n/a"}`,
    `- P50 latency: ${run.latency?.p50 ?? "n/a"} ms`,
    `- P99 latency: ${run.latency?.p99 ?? "n/a"} ms`,
    `- Runs: ${throughput.content.config?.runs ?? 1}`,
    ""
  );
} else if (throughput?.content) {
  lines.push(
    `- Average RPS: ${throughput.content.results?.requests?.average ?? "n/a"}`,
    `- P99 latency: ${throughput.content.results?.latency?.p99 ?? "n/a"} ms`,
    ""
  );
} else {
  lines.push("_No throughput results found. Run `npm run stress` first._", "");
}

lines.push("## Scenario B: Latency Under Normal Load (200-only)", "");

if (latency?.content) {
  lines.push(
    `- Target URL: ${latency.content.targetUrl}`,
    `- Target RPS: ${latency.content.config.targetRps}`,
    `- Achieved 200 RPS: ${latency.content.results.achievedRps200.toFixed(2)}`,
    `- 200 responses: ${latency.content.results.count200}`,
    `- 429 responses: ${latency.content.results.count429}`,
    `- P50: ${latency.content.results.latencyMs.p50.toFixed(1)} ms`,
    `- P95: ${latency.content.results.latencyMs.p95.toFixed(1)} ms`,
    `- P99: ${latency.content.results.latencyMs.p99.toFixed(1)} ms`,
    ""
  );
} else {
  lines.push("_No latency results found. Run `npm run latency` first._", "");
}

lines.push("## Scenario C: Multi-Tenant (concurrent API keys)", "");

if (multiClient?.content) {
  const aggregate = multiClient.content.aggregateAllowed || multiClient.content.aggregate;
  lines.push(
    `- Scenario: ${multiClient.content.scenario ?? "simulator"}`,
    `- Active clients: ${multiClient.content.activeClientCount ?? multiClient.content.clients?.length ?? "n/a"}`,
    `- Duration: ${multiClient.content.duration}s`,
    `- Total requests: ${multiClient.content.summary.total}`,
    `- Allowed: ${multiClient.content.summary.allowed}`,
    `- Blocked: ${multiClient.content.summary.blocked}`,
    `- Aggregate P50 (200-only): ${aggregate?.p50_latency?.toFixed?.(1) ?? "n/a"} ms`,
    `- Aggregate P95 (200-only): ${aggregate?.p95_latency?.toFixed?.(1) ?? "n/a"} ms`,
    `- Aggregate P99 (200-only): ${aggregate?.p99_latency?.toFixed?.(1) ?? "n/a"} ms`,
    ""
  );
} else {
  lines.push("_No multi-client results found. Run `npm run suite` after seeding._", "");
}

lines.push(
  "## Notes",
  "",
  "- Throughput uses a dedicated high-limit API key.",
  "- Latency percentiles exclude non-200 responses.",
  "- Multi-tenant scenario uses generated `simulator-500-config.json`.",
  ""
);

const reportPath = path.join(outputDir, "latest.md");
await fs.writeFile(reportPath, lines.join("\n"));
console.log(`Report written to ${reportPath}`);

const metricsLines = [
  "# Metrics (Resume Source of Truth)",
  "",
  `Last updated: ${new Date().toISOString()}`,
  "",
  "## Automated Tests",
  "",
  "| Metric | Value | Command |",
  "|--------|-------|---------|",
  "| Backend Jest tests | 24 | `cd backend && npm test` |",
  "| Frontend smoke test | 1 | `cd frontend && npm test -- --watchAll=false` |",
  "",
  "## Benchmark Scenarios",
  "",
  "| Scenario | Command | Key metrics |",
  "|----------|---------|-------------|",
];

if (throughput?.content?.results?.medianAverageRps !== undefined) {
  metricsLines.push(
    `| Peak throughput | \`npm run stress\` | ${throughput.content.results.medianAverageRps.toFixed(0)} req/s median (${throughput.content.results.medianRps200.toFixed(0)} req/s 200-only) |`
  );
} else {
  metricsLines.push("| Peak throughput | `npm run stress` | _not run_ |");
}

if (latency?.content) {
  metricsLines.push(
    `| Normal-load latency | \`npm run latency\` | p50 ${latency.content.results.latencyMs.p50.toFixed(1)} ms, p99 ${latency.content.results.latencyMs.p99.toFixed(1)} ms at ${latency.content.results.achievedRps200.toFixed(0)} RPS (200-only) |`
  );
} else {
  metricsLines.push("| Normal-load latency | `npm run latency` | _not run_ |");
}

if (multiClient?.content) {
  const agg = multiClient.content.aggregateAllowed || multiClient.content.aggregate;
  const successRate =
    multiClient.content.summary.total > 0
      ? (
          (multiClient.content.summary.allowed / multiClient.content.summary.total) *
          100
        ).toFixed(1)
      : "n/a";
  metricsLines.push(
    `| Multi-tenant scale | \`npm run suite\` | ${multiClient.content.activeClientCount} concurrent clients, ${successRate}% 200 rate, p50 ${agg?.p50_latency?.toFixed?.(1) ?? "n/a"} ms / p95 ${agg?.p95_latency?.toFixed?.(1) ?? "n/a"} ms (200-only) |`
  );
} else {
  metricsLines.push("| Multi-tenant scale | `npm run suite` | _not run_ |");
}

metricsLines.push(
  "",
  "## Environment",
  "",
  `- Node ${environment.nodeVersion} on ${environment.platform}`,
  `- Redis: ${environment.redisUrl}`,
  `- BENCHMARK_MODE: ${environment.benchmarkMode}`,
  `- Git: ${environment.gitCommit}`,
  "",
  "## Resume Bullets (copy after verifying numbers)",
  "",
  "- Built a Redis-backed API rate limiter with **24 automated Jest/Supertest tests** covering limit enforcement, cache invalidation, and auth flows.",
);

if (throughput?.content?.results?.medianAverageRps !== undefined) {
  metricsLines.push(
    `- Achieved **~${throughput.content.results.medianAverageRps.toFixed(0)} req/s** peak throughput on a single API key (autocannon, local Redis, median of ${throughput.content.config?.runs ?? 3} runs).`
  );
}

if (latency?.content) {
  metricsLines.push(
    `- **p50 ${latency.content.results.latencyMs.p50.toFixed(1)} ms / p99 ${latency.content.results.latencyMs.p99.toFixed(1)} ms** for successful requests at ~${latency.content.results.achievedRps200.toFixed(0)} req/s steady load.`
  );
}

if (multiClient?.content) {
  const agg = multiClient.content.aggregateAllowed || multiClient.content.aggregate;
  const aggregateRps = (
    multiClient.content.summary.total / multiClient.content.duration
  ).toFixed(0);
  metricsLines.push(
    `- Load-tested **${multiClient.content.activeClientCount} concurrent API tenants** (~${aggregateRps} aggregate req/s) with p50 **${agg?.p50_latency?.toFixed?.(1) ?? "n/a"} ms** / p95 **${agg?.p95_latency?.toFixed?.(1) ?? "n/a"} ms** on successful requests.`
  );
}

metricsLines.push(
  "",
  "## Do / Don't",
  "",
  "- Do name the scenario (throughput vs latency vs multi-tenant).",
  "- Do cite 200-only latency separately from saturation tests.",
  "- Don't claim 500 concurrent clients unless the multi-tenant simulator step completed.",
  "- Don't mix autocannon saturation latency with normal-load latency.",
  ""
);

const metricsPath = path.resolve(__dirname, "..", "METRICS.md");
await fs.writeFile(metricsPath, metricsLines.join("\n"));
console.log(`Metrics written to ${metricsPath}`);

export { throughput, latency, multiClient, environment };
