# Benchmark Report (Sample)

Generated: 2026-06-21T10:30:00.000Z

This is a committed sample report. Live runs write to `benchmarks/results/latest.md` (gitignored).

## Autocannon Stress (single client)

- Target URL: http://localhost:5000/api/data
- Average RPS: 1523
- P50 latency: 12 ms
- P97.5 latency: 28 ms
- P99 latency: 41 ms
- 2xx responses: 45690
- Errors: 0

## Python Simulator (multi-client)

- Duration: 60s
- Total requests: 8420
- Allowed: 8012
- Blocked: 408
- Aggregate P50: 18.4 ms
- Aggregate P95: 52.1 ms
- Aggregate P99: 89.7 ms

## Notes

- Start backend with `BENCHMARK_MODE=true` for best throughput numbers.
- Seed clients before stress tests: `npm run seed`.
- Full suite: `npm run suite`.
