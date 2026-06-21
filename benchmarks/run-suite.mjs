import fs from "fs/promises";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.join(__dirname, "config.json");
const config = JSON.parse(await fs.readFile(configPath, "utf8"));
const outputDir = path.resolve(__dirname, config.outputDir);

await fs.mkdir(outputDir, { recursive: true });

const suiteStartedAt = new Date().toISOString();
const suiteResults = {
  startedAt: suiteStartedAt,
  steps: [],
};

function runNodeScript(scriptName) {
  return new Promise((resolve, reject) => {
    const child = spawn("node", [path.join(__dirname, scriptName)], {
      stdio: "inherit",
      env: process.env,
      shell: process.platform === "win32",
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${scriptName} exited with code ${code}`));
      }
    });
  });
}

function runSimulator() {
  return new Promise((resolve, reject) => {
    const simulatorPath = path.resolve(__dirname, "../simulator/simulator_load.py");
    const outputFile = path.join(outputDir, `simulator-${Date.now()}.json`);
    const args = [
      simulatorPath,
      "--config-file",
      path.resolve(__dirname, config.simulator.configFile),
      "--duration",
      String(config.simulator.durationSeconds),
      "--pattern",
      config.simulator.pattern,
      "--concurrency",
      String(config.simulator.concurrency),
      "--output",
      outputFile,
    ];

    const child = spawn("python", args, {
      stdio: "inherit",
      shell: process.platform === "win32",
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve(outputFile);
      } else {
        reject(new Error(`simulator_load.py exited with code ${code}`));
      }
    });
  });
}

console.log("=== Rate Limiter Benchmark Suite ===\n");

try {
  console.log("Step 1/3: Seeding clients...");
  await runNodeScript("seedClients.mjs");
  suiteResults.steps.push({ name: "seedClients", status: "completed" });

  console.log("\nStep 2/3: Running autocannon stress test...");
  await runNodeScript("stress.mjs");
  suiteResults.steps.push({ name: "stress", status: "completed" });

  console.log("\nStep 3/3: Running Python simulator...");
  const simulatorOutput = await runSimulator();
  suiteResults.steps.push({ name: "simulator", status: "completed", output: simulatorOutput });
} catch (error) {
  suiteResults.error = error.message;
  console.error(`\nBenchmark suite failed: ${error.message}`);
}

suiteResults.completedAt = new Date().toISOString();
const suiteFile = path.join(outputDir, `suite-${Date.now()}.json`);
await fs.writeFile(suiteFile, JSON.stringify(suiteResults, null, 2));

console.log(`\nSuite metadata saved to ${suiteFile}`);
console.log("Generating report...");
await runNodeScript("generateReport.mjs");
