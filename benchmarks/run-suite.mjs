import fs from "fs/promises";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { captureEnvironment, getOutputDir, loadConfig } from "./helpers.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const config = await loadConfig();
const outputDir = getOutputDir(config);

await fs.mkdir(outputDir, { recursive: true });

const suiteStartedAt = new Date().toISOString();
const suiteResults = {
  startedAt: suiteStartedAt,
  environment: await captureEnvironment(),
  steps: [],
};

function runNodeScript(scriptName) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, scriptName);
    const child = spawn(process.execPath, [scriptPath], {
      stdio: "inherit",
      env: process.env,
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

function runSimulator(configFile, stepConfig) {
  return new Promise((resolve, reject) => {
    const simulatorPath = path.resolve(__dirname, "../simulator/simulator_load.py");
    const outputFile = path.join(outputDir, `simulator-${Date.now()}.json`);
    const args = [
      simulatorPath,
      "--config-file",
      path.resolve(outputDir, configFile),
      "--duration",
      String(stepConfig.durationSeconds),
      "--pattern",
      stepConfig.pattern,
      "--concurrency",
      String(stepConfig.concurrency),
      "--output",
      outputFile,
      "--scenario",
      stepConfig.scenario || "multi-client",
    ];

    const child = spawn("python", args, {
      stdio: "inherit",
      env: {
        ...process.env,
        PYTHONIOENCODING: "utf-8",
        PYTHONUTF8: "1",
      },
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
  console.log("Step 1/5: Seeding clients...");
  await runNodeScript("seedClients.mjs");
  suiteResults.steps.push({ name: "seedClients", status: "completed" });

  console.log("\nStep 2/5: Running throughput benchmark (autocannon)...");
  await runNodeScript("stress.mjs");
  suiteResults.steps.push({ name: "throughput", status: "completed" });

  console.log("\nStep 3/5: Running latency benchmark (200-only)...");
  await runNodeScript("latency.mjs");
  suiteResults.steps.push({ name: "latency", status: "completed" });

  console.log("\nStep 4/5: Generating 500-client simulator config...");
  await runNodeScript("generateSimulatorConfig.mjs");
  suiteResults.steps.push({ name: "generateSimulatorConfig", status: "completed" });

  console.log("\nStep 5/5: Running 500-client multi-tenant simulator...");
  const simulatorOutput = await runSimulator(config.multiClient.configFileName, {
    ...config.multiClient,
    scenario: "multi-tenant-500",
  });
  suiteResults.steps.push({
    name: "multiClientSimulator",
    status: "completed",
    output: simulatorOutput,
    clientCount: config.multiClient.clientCount,
  });
} catch (error) {
  suiteResults.error = error.message;
  console.error(`\nBenchmark suite failed: ${error.message}`);
}

suiteResults.completedAt = new Date().toISOString();
const suiteFile = path.join(outputDir, `suite-${Date.now()}.json`);
await fs.writeFile(suiteFile, JSON.stringify(suiteResults, null, 2));

console.log(`\nSuite metadata saved to ${suiteFile}`);
console.log("Generating report...");
try {
  await runNodeScript("generateReport.mjs");
} catch (error) {
  console.error(`Report generation failed: ${error.message}`);
  process.exitCode = 1;
}
