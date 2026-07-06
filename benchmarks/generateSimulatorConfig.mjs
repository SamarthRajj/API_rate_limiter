import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { getOutputDir, loadConfig } from "./helpers.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const config = await loadConfig();
const outputDir = getOutputDir(config);

const seedFile = path.join(outputDir, "seeded-clients.json");
const rpsPerClient = Number(process.env.MULTI_CLIENT_RPS || config.multiClient.rpsPerClient);
const maxClients = Number(process.env.MULTI_CLIENT_COUNT || config.multiClient.clientCount);

let seeded;
try {
  seeded = JSON.parse(await fs.readFile(seedFile, "utf8"));
} catch {
  console.error(`Missing ${seedFile}. Run npm run seed first.`);
  process.exit(1);
}

const clients = seeded.slice(0, maxClients).map((client, index) => ({
  name: client.name || `BenchClient-${index + 1}`,
  key: client.apiKey,
  rps: rpsPerClient,
  description: "Generated from seeded-clients.json for multi-tenant benchmark",
}));

const outputFile = path.join(outputDir, config.multiClient.configFileName);
await fs.writeFile(outputFile, JSON.stringify(clients, null, 2));

console.log(`Generated simulator config with ${clients.length} clients at ${rpsPerClient} RPS each.`);
console.log(`Output: ${outputFile}`);
console.log(`Expected aggregate RPS: ~${clients.length * rpsPerClient}`);

export { outputFile, clients };
