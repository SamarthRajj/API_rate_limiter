import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.join(__dirname, "config.json");
const config = JSON.parse(await fs.readFile(configPath, "utf8"));

const baseUrl = process.env.BENCHMARK_BASE_URL || config.baseUrl;
const clientCount = Number(process.env.SEED_CLIENT_COUNT || config.seed.clientCount);
const batchSize = config.seed.batchSize;

console.log(`Seeding ${clientCount} clients at ${baseUrl}...`);

const seeded = [];
let created = 0;

while (created < clientCount) {
  const batch = [];
  const remaining = clientCount - created;
  const currentBatchSize = Math.min(batchSize, remaining);

  for (let i = 0; i < currentBatchSize; i += 1) {
    const index = created + i + 1;
    batch.push(
      fetch(`${baseUrl}/api/clients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `BenchClient-${index}`,
          perMinuteLimit: config.seed.perMinuteLimit,
          perDayLimit: config.seed.perDayLimit,
        }),
      }).then(async (response) => {
        if (!response.ok) {
          const text = await response.text();
          throw new Error(`Failed to create client ${index}: ${response.status} ${text}`);
        }
        return response.json();
      })
    );
  }

  const results = await Promise.all(batch);
  seeded.push(...results);
  created += results.length;
  process.stdout.write(`\rCreated ${created}/${clientCount} clients`);
}

console.log("\nSeed complete.");

const outputDir = path.resolve(__dirname, config.outputDir);
await fs.mkdir(outputDir, { recursive: true });

const seedFile = path.join(outputDir, "seeded-clients.json");
await fs.writeFile(seedFile, JSON.stringify(seeded, null, 2));

const primaryKey = seeded[0]?.apiKey;
if (primaryKey) {
  console.log(`Primary benchmark API key: ${primaryKey}`);
  console.log(`Set BENCHMARK_API_KEY=${primaryKey} for stress tests`);
}

export { seeded, primaryKey };
