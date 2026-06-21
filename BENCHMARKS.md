# Benchmarks

This project includes a benchmark suite for measuring rate-limiter throughput, latency, and multi-client behavior.

## Prerequisites

1. Redis and MongoDB running locally
2. Backend started with benchmark mode enabled:

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

## Configuration

Edit `benchmarks/config.json` to tune:

- `seed.clientCount` — number of clients to create (default: 500)
- `stress.targetRps` — autocannon target RPS (default: 1500)
- `stress.connections` / `stress.pipelining` — concurrency tuning
- `simulator.pattern` — traffic pattern (`stress`, `steady`, `spike`, etc.)
- `simulator.concurrency` — concurrent workers per client burst

Environment overrides:

| Variable | Purpose |
|----------|---------|
| `BENCHMARK_BASE_URL` | Backend base URL |
| `BENCHMARK_API_KEY` | API key for single-client stress |
| `SEED_CLIENT_COUNT` | Override seed count |
| `STRESS_TARGET_RPS` | Override autocannon RPS |
| `STRESS_DURATION` | Stress test duration (seconds) |

## Running Benchmarks

### Seed 500+ clients

```bash
cd benchmarks
npm run seed
```

Creates clients via `POST /api/clients` with high limits and writes `results/seeded-clients.json`.

### Single-client stress (1000+ RPS)

```bash
npm run stress
```

Uses [autocannon](https://github.com/mcollina/autocannon) against `/api/data` with the seeded API key.

### Full suite

```bash
npm run suite
```

Runs seed → stress → Python simulator → report generation.

### Generate report only

```bash
npm run report
```

Writes `results/latest.md` from the most recent JSON artifacts.

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

Tests cover:

- Redis client-config cache (`clientConfigCache.test.js`)
- Rate limiter middleware (`rateLimiter.test.js`)
- API integration with Supertest (`api.integration.test.js`)

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

## Recommended Workflow

1. Set `BENCHMARK_MODE=true` in backend `.env`
2. Start Redis, MongoDB, and backend
3. `cd benchmarks && npm run suite`
4. Review `results/latest.md`
5. Compare against `results/sample-latest.md` baseline
