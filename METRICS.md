# Metrics (Resume Source of Truth)

Last updated: 2026-06-21T10:39:16.830Z

## Automated Tests

| Metric | Value | Command |
|--------|-------|---------|
| Backend Jest tests | 24 | `cd backend && npm test` |
| Frontend smoke test | 1 | `cd frontend && npm test -- --watchAll=false` |

## Benchmark Scenarios

| Scenario | Command | Key metrics |
|----------|---------|-------------|
| Peak throughput | `npm run stress` | 1500 req/s median (1500 req/s 200-only) |
| Normal-load latency | `npm run latency` | p50 12.8 ms, p99 43.6 ms at 51 RPS (200-only) |
| Multi-tenant scale | `npm run suite` | 500 concurrent clients, 39.8% 200 rate, p50 17.4 ms / p95 33.4 ms (200-only) |

## Environment

- Node v22.16.0 on win32 x64
- Redis: redis://127.0.0.1:6379
- BENCHMARK_MODE: true
- Git: 37fb37c

## Resume Bullets (copy after verifying numbers)

- Built a Redis-backed API rate limiter with **24 automated Jest/Supertest tests** covering limit enforcement, cache invalidation, and auth flows.
- Achieved **~1500 req/s** peak throughput on a single API key (autocannon, local Redis, median of 3 runs).
- **p50 12.8 ms / p99 43.6 ms** for successful requests at ~51 req/s steady load.
- Load-tested **500 concurrent API tenants** (~322 aggregate req/s) with p50 **17.4 ms** / p95 **33.4 ms** on successful requests.

## Do / Don't

- Do name the scenario (throughput vs latency vs multi-tenant).
- Do cite 200-only latency separately from saturation tests.
- Don't claim 500 concurrent clients unless the multi-tenant simulator step completed.
- Don't mix autocannon saturation latency with normal-load latency.
