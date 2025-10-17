# simulate_multi.py
# Usage: python simulate_multi.py
# Requires: requests
# pip install requests

import requests
import threading
import time
import random

BASE_URL = "http://localhost:5000/api/data"   # change if needed
# Replace these with real apiKeys created via POST /api/clients
# Example: [{"name":"AppA","key":"abc123","rps":2,"burst_seconds":5,"burst_rps":10}, ...]
clients = [
    {"name": "8", "key": "a0fb564017e357d1ac5d0be097b3d2e8", "rps": 2, "burst_every": 30, "burst_rps": 8, "burst_duration": 5},
    {"name": "9", "key": "a061a9cac58d1858499e458a8f029ebc", "rps": 1, "burst_every": 45, "burst_rps": 5, "burst_duration": 8},
]

RUN_SECONDS = 120  # total simulation duration

class ClientSimulator(threading.Thread):
    def __init__(self, cfg):
        super().__init__()
        self.cfg = cfg
        self.allowed = 0
        self.blocked = 0
        self.total = 0
        self.stop_event = threading.Event()

    def run(self):
        start = time.time()
        next_burst = start + self.cfg.get("burst_every", 999999)
        in_burst_until = 0

        while time.time() - start < RUN_SECONDS and not self.stop_event.is_set():
            now = time.time()
            # determine current rps
            if now < in_burst_until:
                rps = self.cfg.get("burst_rps", self.cfg["rps"])
            elif now >= next_burst:
                # start burst
                in_burst_until = now + self.cfg.get("burst_duration", 5)
                next_burst = now + self.cfg.get("burst_every", 999999)
                rps = self.cfg.get("burst_rps", self.cfg["rps"])
            else:
                rps = self.cfg["rps"]

            # send rps requests in this second (simple approach)
            interval = 1.0 / max(rps, 1)
            send_until = time.time() + 1.0
            while time.time() < send_until and not self.stop_event.is_set():
                self.send_request()
                time.sleep(interval)

        print(f"[{self.cfg['name']}] finished. total={self.total} allowed={self.allowed} blocked={self.blocked}")

    def send_request(self):
        headers = {"x-api-key": self.cfg["key"]}
        params = {"key": self.cfg["key"]}
        try:
            r = requests.get(BASE_URL, headers=headers, params=params,  timeout=5)
            self.total += 1
            if r.status_code == 200:
                self.allowed += 1
            elif r.status_code == 429:
                self.blocked += 1
            else:
                # treat other codes as blocked-ish, but print for debugging
                print(f"[{self.cfg['name']}] unexpected status {r.status_code}: {r.text}")
        except Exception as e:
            print(f"[{self.cfg['name']}] request error: {e}")

    def stop(self):
        self.stop_event.set()

class Reporter(threading.Thread):
    def __init__(self, threads, start_time):
        super().__init__()
        self.threads = threads
        self.start_time = start_time
        self.stop_event = threading.Event()

    def run(self):
        while not self.stop_event.is_set():
            elapsed = time.time() - self.start_time
            pct = min(int((elapsed / RUN_SECONDS) * 100), 100)
            total = sum(t.total for t in self.threads)
            allowed = sum(t.allowed for t in self.threads)
            blocked = sum(t.blocked for t in self.threads)
            line = f"Progress: {pct:3d}% | total={total} allowed={allowed} blocked={blocked}"
            print("\r" + line, end="", flush=True)
            if elapsed >= RUN_SECONDS:
                break
            time.sleep(1)

    def stop(self):
        self.stop_event.set()

def main():
    threads = []
    for c in clients:
        t = ClientSimulator(c)
        t.start()
        threads.append(t)

    start_time = time.time()
    reporter = Reporter(threads, start_time)
    reporter.start()

    try:
        for t in threads:
            t.join()
    except KeyboardInterrupt:
        for t in threads:
            t.stop()
        for t in threads:
            t.join()
    finally:
        reporter.stop()
        reporter.join()
        print()  # move to next line after progress

    # final summary
    for t in threads:
        print(f"{t.cfg['name']}: total={t.total}, allowed={t.allowed}, blocked={t.blocked}")

if __name__ == "__main__":
    main()
