# Benchmarks

This project includes a benchmark suite for measuring rate-limiter throughput, latency, and multi-client behavior.

## Prerequisites

1. **Local Redis** for benchmarks (recommended — much lower latency than Upstash/cloud Redis)

```bash
docker run -p 6379:6379 --name redis -d redis:7
```

In `backend/.env`, point at local Redis:

```env
REDIS_URL=redis://127.0.0.1:6379
BENCHMARK_MODE=true
```

Use your Upstash `rediss://...` URL for normal development or production; switch to local Redis only when running benchmarks.

2. MongoDB running (local or Atlas)
3. Backend started with benchmark mode enabled:

```bash
cd backend
cp .env.example .env
# Set BENCHMARK_MODE=true in .env
npm run dev
```

3. Install benchmark dependencies:

```bash
cd benchmarks
npm install
```

4. Optional: Python simulator dependencies for multi-client runs:

```bash
cd ../simulator
pip install -r requirements.txt
```

## Three Benchmark Scenarios

Each scenario produces separate JSON artifacts and report sections. See [`METRICS.md`](../METRICS.md) for resume-ready numbers after a run.

| Scenario | Script | What it measures |
|----------|--------|------------------|
| **A: Peak throughput** | `npm run stress` | Single-tenant max RPS (median of 3 runs, high-limit key) |
| **B: Normal-load latency** | `npm run latency` | p50/p99 on **200 responses only** at ~80 RPS |
| **C: Multi-tenant scale** | `npm run suite` (step 5) | 500 concurrent API keys at 1 RPS each |

**Important:** Do not cite autocannon latency under saturation as normal request latency. Use Scenario B for p50/p99 on a resume.

## Configuration

Edit `benchmarks/config.json` to tune:

- `seed.clientCount` — number of clients to create (default: 500)
- `throughputClient` — high limits for throughput/latency keys
- `stress.targetRps` — autocannon target RPS (default: 1500)
- `stress.runs` — median runs for throughput (default: 3)
- `latency.targetRps` — steady load for latency test (default: 80)
- `multiClient.clientCount` — concurrent tenants (default: 500)
- `multiClient.rpsPerClient` — RPS per tenant (default: 1)

Environment overrides:

| Variable | Purpose |
|----------|---------|
| `BENCHMARK_BASE_URL` | Backend base URL |
| `BENCHMARK_THROUGHPUT_API_KEY` | Reuse throughput benchmark key |
| `SEED_CLIENT_COUNT` | Override seed count |
| `STRESS_TARGET_RPS` | Override autocannon RPS |
| `STRESS_DURATION` | Stress test duration (seconds) |
| `LATENCY_RPS` | Override latency benchmark RPS |
| `MULTI_CLIENT_COUNT` | Override multi-tenant client count |

## Running Benchmarks

### Seed 500 clients

```bash
cd benchmarks
npm run seed
```

Creates clients via `POST /api/clients` and writes `results/seeded-clients.json`.

### Scenario A: Peak throughput

```bash
npm run stress
```

Uses autocannon with a dedicated high-limit API key. Reports median RPS and 200 vs 429 split.

### Scenario B: Normal-load latency

```bash
npm run latency
```

Sends ~80 RPS for 60s and computes p50/p95/p99 on **HTTP 200 only**.

### Scenario C: 500 concurrent tenants

```bash
npm run gen-config   # builds results/simulator-500-config.json from seed
# then run simulator manually, or use full suite:
npm run suite
```

### Full suite (all scenarios)

```bash
npm run suite
```

Runs seed → throughput → latency → generate 500-client config → 500-client simulator → report.

### Generate report only

```bash
npm run report
```

Writes `results/latest.md` and updates root `METRICS.md`.

## Python Simulator Enhancements

The simulator now supports:

- **P50** latency per client and aggregate P50/P95/P99
- **`stress` pattern** — sustained high load (5× base RPS)
- **`--concurrency N`** — concurrent request workers per burst

Example:

```bash
cd simulator
python simulator_load.py \
  --config-file clients_config.json \
  --pattern stress \
  --concurrency 20 \
  --duration 60 \
  --output results.json
```

## Backend Test Suite

```bash
cd backend
npm install
npm test
```

Tests cover (24 total):

- Redis client-config cache (`clientConfigCache.test.js`)
- Rate limiter middleware — minute/day limits, boundaries, blocked counters (`rateLimiter.test.js`)
- API integration — day limits, toggle, regenerate, concurrency (`api.integration.test.js`)

## Interpreting Results

| Metric | What it tells you |
|--------|-------------------|
| Average RPS | Peak single-client throughput under stress |
| P50 / P95 / P99 | Latency distribution; watch P99 for tail latency |
| Blocked count | Rate limiter enforcement under multi-client load |
| Errors / timeouts | Infrastructure or connection saturation |

## Results Directory

- `benchmarks/results/*.json` — raw run artifacts (gitignored)
- `benchmarks/results/latest.md` — generated report (gitignored)
- `benchmarks/results/sample-latest.md` — committed example report
- [`METRICS.md`](../METRICS.md) — resume source of truth (updated by `npm run report`)

## Recommended Workflow

1. Set `BENCHMARK_MODE=true` and `REDIS_URL=redis://127.0.0.1:6379` in backend `.env`
2. Start Redis, MongoDB, and backend
3. `cd benchmarks && npm run suite`
4. Review `results/latest.md` and `METRICS.md`
5. Copy resume bullets from `METRICS.md` only after verifying numbers
