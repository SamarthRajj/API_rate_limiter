#!/usr/bin/env python3
"""
Rate Limiter Load Simulator
============================
A sophisticated load testing tool for the Rate Limiter API with multiple traffic patterns,
detailed statistics, and flexible configuration options.

Usage:
    python simulator_load.py --duration 120 --pattern steady
    python simulator_load.py --config-file clients_config.json --output results.csv
"""

import requests
import threading
import time
import random
import argparse
import json
import os
import sys
import math
from collections import defaultdict
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed

# Try to import colorama for colored output
try:
    from colorama import init, Fore, Style
    init(autoreset=True)
    HAS_COLOR = True
except ImportError:
    HAS_COLOR = False
    # Fallback if colorama not available
    class Fore:
        GREEN = RED = YELLOW = CYAN = MAGENTA = BLUE = WHITE = RESET = ''
    class Style:
        BRIGHT = RESET_ALL = ''


class ClientSimulator(threading.Thread):
    """Simulates a client making requests with configurable traffic patterns"""
    
    def __init__(self, config, base_url, pattern='steady', verbose=False, concurrency=1):
        super().__init__()
        self.config = config
        self.base_url = base_url
        self.pattern = pattern
        self.verbose = verbose
        self.concurrency = max(1, concurrency)
        self.allowed = 0
        self.blocked = 0
        self.total = 0
        self.latencies = []
        self.stop_event = threading.Event()
        self.start_time = None
        
    def run(self):
        self.start_time = time.time()
        duration = self.config.get('duration', 120)
        
        while time.time() - self.start_time < duration and not self.stop_event.is_set():
            rps = self.calculate_rps()
            self.send_burst(rps)
            time.sleep(1)
        
        if self.verbose:
            print(f"{Fore.CYAN}[{self.config['name']}] Finished. Total={self.total}, Allowed={self.allowed}, Blocked={self.blocked}")
    
    def calculate_rps(self):
        """Calculate requests per second based on traffic pattern"""
        elapsed = time.time() - self.start_time
        base_rps = self.config.get('rps', 2)
        
        if self.pattern == 'steady':
            return base_rps
        
        elif self.pattern == 'ramp-up':
            # Gradually increase from base to 3x base
            max_rps = base_rps * 3
            progress = min(elapsed / 60.0, 1.0)  # Ramp over 60 seconds
            return int(base_rps + (max_rps - base_rps) * progress)
        
        elif self.pattern == 'spike':
            # Random spikes
            if random.random() < 0.1:  # 10% chance of spike
                return base_rps * random.randint(3, 6)
            return base_rps
        
        elif self.pattern == 'wave':
            # Sinusoidal pattern
            wave = math.sin(elapsed / 10.0)  # Period of ~63 seconds
            return int(base_rps + base_rps * wave)

        elif self.pattern == 'stress':
            # Sustained high load for stress testing
            return max(base_rps * 5, 10)
        
        else:
            return base_rps
    
    def send_burst(self, rps):
        """Send a burst of requests for this second"""
        if rps <= 0:
            return

        if self.concurrency > 1:
            with ThreadPoolExecutor(max_workers=self.concurrency) as executor:
                futures = [executor.submit(self.send_request) for _ in range(rps)]
                for future in as_completed(futures):
                    future.result()
            return
        
        interval = 1.0 / rps
        # Add jitter (±20%)
        jitter = random.uniform(0.8, 1.2)
        interval *= jitter
        
        for _ in range(rps):
            if self.stop_event.is_set():
                break
            self.send_request()
            time.sleep(interval)
    
    def send_request(self):
        """Send a single request and record statistics"""
        headers = {"x-api-key": self.config["key"]}
        
        try:
            start = time.time()
            r = requests.get(self.base_url, headers=headers, timeout=5)
            latency = (time.time() - start) * 1000  # Convert to ms
            
            self.total += 1
            self.latencies.append(latency)
            
            if r.status_code == 200:
                self.allowed += 1
                if self.verbose:
                    print(f"{Fore.GREEN}[{self.config['name']}] ✓ Allowed ({latency:.1f}ms)")
            elif r.status_code == 429:
                self.blocked += 1
                if self.verbose:
                    print(f"{Fore.RED}[{self.config['name']}] ✗ Blocked ({latency:.1f}ms)")
            else:
                if self.verbose:
                    print(f"{Fore.YELLOW}[{self.config['name']}] ? Unexpected status {r.status_code}")
        
        except requests.exceptions.Timeout:
            self.total += 1
            if self.verbose:
                print(f"{Fore.RED}[{self.config['name']}] ⏱ Timeout")
        
        except Exception as e:
            self.total += 1
            if self.verbose:
                print(f"{Fore.RED}[{self.config['name']}] ✗ Error: {e}")
    
    def stop(self):
        """Signal the thread to stop"""
        self.stop_event.set()

    @staticmethod
    def percentile(sorted_values, pct):
        if not sorted_values:
            return 0.0
        index = int(len(sorted_values) * pct)
        index = min(index, len(sorted_values) - 1)
        return sorted_values[index]
    
    def get_stats(self):
        """Calculate and return statistics"""
        if not self.latencies:
            return {
                'name': self.config['name'],
                'total': self.total,
                'allowed': self.allowed,
                'blocked': self.blocked,
                'success_rate': 0.0,
                'avg_latency': 0.0,
                'min_latency': 0.0,
                'max_latency': 0.0,
                'p50_latency': 0.0,
                'p95_latency': 0.0,
                'p99_latency': 0.0,
            }
        
        sorted_latencies = sorted(self.latencies)
        n = len(sorted_latencies)
        
        return {
            'name': self.config['name'],
            'total': self.total,
            'allowed': self.allowed,
            'blocked': self.blocked,
            'success_rate': (self.allowed / self.total * 100) if self.total > 0 else 0.0,
            'avg_latency': sum(sorted_latencies) / n,
            'min_latency': sorted_latencies[0],
            'max_latency': sorted_latencies[-1],
            'p50_latency': self.percentile(sorted_latencies, 0.50),
            'p95_latency': self.percentile(sorted_latencies, 0.95),
            'p99_latency': self.percentile(sorted_latencies, 0.99),
        }


class ProgressReporter(threading.Thread):
    """Reports progress in real-time"""
    
    def __init__(self, threads, duration):
        super().__init__()
        self.threads = threads
        self.duration = duration
        self.start_time = time.time()
        self.stop_event = threading.Event()
    
    def run(self):
        while not self.stop_event.is_set():
            elapsed = time.time() - self.start_time
            percent = min(int((elapsed / self.duration) * 100), 100)
            
            total = sum(t.total for t in self.threads)
            allowed = sum(t.allowed for t in self.threads)
            blocked = sum(t.blocked for t in self.threads)
            
            # Calculate average RPS
            rps = total / elapsed if elapsed > 0 else 0
            
            # Progress bar
            bar_length = 40
            filled = int(bar_length * percent / 100)
            bar = '█' * filled + '░' * (bar_length - filled)
            
            # Print progress
            line = (f"{Fore.CYAN}{bar} {Style.BRIGHT}{percent:3d}%{Style.RESET_ALL} | "
                   f"Time: {elapsed:.1f}s | Total: {Fore.WHITE}{total}{Fore.RESET} | "
                   f"Allowed: {Fore.GREEN}{allowed}{Fore.RESET} | "
                   f"Blocked: {Fore.RED}{blocked}{Fore.RESET} | "
                   f"RPS: {Fore.MAGENTA}{rps:.1f}{Fore.RESET}")
            
            print(f"\r{line}", end="", flush=True)
            
            if elapsed >= self.duration:
                break
            
            time.sleep(0.5)
    
    def stop(self):
        self.stop_event.set()


def aggregate_percentiles(threads):
    """Compute aggregate latency percentiles across all clients"""
    all_latencies = []
    for thread in threads:
        all_latencies.extend(thread.latencies)

    if not all_latencies:
        return {
            'p50_latency': 0.0,
            'p95_latency': 0.0,
            'p99_latency': 0.0,
            'avg_latency': 0.0,
            'min_latency': 0.0,
            'max_latency': 0.0,
        }

    sorted_latencies = sorted(all_latencies)
    return {
        'p50_latency': ClientSimulator.percentile(sorted_latencies, 0.50),
        'p95_latency': ClientSimulator.percentile(sorted_latencies, 0.95),
        'p99_latency': ClientSimulator.percentile(sorted_latencies, 0.99),
        'avg_latency': sum(sorted_latencies) / len(sorted_latencies),
        'min_latency': sorted_latencies[0],
        'max_latency': sorted_latencies[-1],
    }


def print_summary(threads, duration):
    """Print detailed summary statistics"""
    print("\n\n" + "="*80)
    print(f"{Fore.CYAN}{Style.BRIGHT}LOAD TEST SUMMARY{Style.RESET_ALL}")
    print("="*80)
    
    # Overall statistics
    total = sum(t.total for t in threads)
    allowed = sum(t.allowed for t in threads)
    blocked = sum(t.blocked for t in threads)
    overall_rps = total / duration if duration > 0 else 0
    success_rate = (allowed / total * 100) if total > 0 else 0
    
    print(f"\n{Fore.WHITE}{Style.BRIGHT}Overall Statistics:{Style.RESET_ALL}")
    print(f"  Duration:      {duration:.1f}s")
    print(f"  Total Requests: {total}")
    print(f"  Allowed:       {Fore.GREEN}{allowed}{Fore.RESET} ({success_rate:.1f}%)")
    print(f"  Blocked:       {Fore.RED}{blocked}{Fore.RESET} ({100-success_rate:.1f}%)")
    print(f"  Avg RPS:       {overall_rps:.2f}")

    aggregate = aggregate_percentiles(threads)
    print(f"\n{Fore.WHITE}{Style.BRIGHT}Aggregate Latency (all clients):{Style.RESET_ALL}")
    print(f"  Avg:  {aggregate['avg_latency']:.1f}ms")
    print(f"  P50:  {aggregate['p50_latency']:.1f}ms")
    print(f"  P95:  {aggregate['p95_latency']:.1f}ms")
    print(f"  P99:  {aggregate['p99_latency']:.1f}ms")
    
    # Per-client statistics
    print(f"\n{Fore.WHITE}{Style.BRIGHT}Per-Client Statistics:{Style.RESET_ALL}")
    print(f"{'Client':<15} {'Total':>8} {'Allowed':>8} {'Blocked':>8} {'Success':>8} {'Avg(ms)':>8} {'P50(ms)':>8} {'P95(ms)':>8} {'P99(ms)':>8}")
    print("-" * 96)
    
    for thread in threads:
        stats = thread.get_stats()
        print(f"{stats['name']:<15} "
              f"{stats['total']:>8} "
              f"{Fore.GREEN}{stats['allowed']:>8}{Fore.RESET} "
              f"{Fore.RED}{stats['blocked']:>8}{Fore.RESET} "
              f"{stats['success_rate']:>7.1f}% "
              f"{stats['avg_latency']:>8.1f} "
              f"{stats['p50_latency']:>8.1f} "
              f"{stats['p95_latency']:>8.1f} "
              f"{stats['p99_latency']:>8.1f}")
    
    print("="*80)


def export_results(threads, duration, output_file, format='csv'):
    """Export results to file"""
    aggregate = aggregate_percentiles(threads)

    if format == 'csv':
        with open(output_file, 'w') as f:
            # Header
            f.write("Client,Total,Allowed,Blocked,Success_Rate,Avg_Latency_ms,Min_Latency_ms,Max_Latency_ms,P50_Latency_ms,P95_Latency_ms,P99_Latency_ms\n")
            
            # Data
            for thread in threads:
                stats = thread.get_stats()
                f.write(f"{stats['name']},{stats['total']},{stats['allowed']},{stats['blocked']},"
                       f"{stats['success_rate']:.2f},{stats['avg_latency']:.2f},"
                       f"{stats['min_latency']:.2f},{stats['max_latency']:.2f},"
                       f"{stats['p50_latency']:.2f},{stats['p95_latency']:.2f},{stats['p99_latency']:.2f}\n")

            f.write(f"AGGREGATE,{sum(t.total for t in threads)},{sum(t.allowed for t in threads)},{sum(t.blocked for t in threads)},,,"
                    f"{aggregate['avg_latency']:.2f},{aggregate['min_latency']:.2f},{aggregate['max_latency']:.2f},"
                    f"{aggregate['p50_latency']:.2f},{aggregate['p95_latency']:.2f},{aggregate['p99_latency']:.2f}\n")
        
        print(f"\n{Fore.GREEN}✓ Results exported to: {output_file}{Fore.RESET}")
    
    elif format == 'json':
        results = {
            'duration': duration,
            'timestamp': datetime.now().isoformat(),
            'clients': [thread.get_stats() for thread in threads],
            'aggregate': aggregate,
            'summary': {
                'total': sum(t.total for t in threads),
                'allowed': sum(t.allowed for t in threads),
                'blocked': sum(t.blocked for t in threads),
            }
        }
        
        with open(output_file, 'w') as f:
            json.dump(results, f, indent=2)
        
        print(f"\n{Fore.GREEN}✓ Results exported to: {output_file}{Fore.RESET}")


def load_config_file(file_path):
    """Load client configuration from JSON file"""
    with open(file_path, 'r') as f:
        return json.load(f)


def parse_arguments():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(
        description='Rate Limiter Load Simulator - Advanced load testing tool',
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    
    parser.add_argument('--duration', type=int, default=120,
                       help='Test duration in seconds (default: 120)')
    
    parser.add_argument('--base-url', type=str, default='http://localhost:5000/api/data',
                       help='Base URL for API requests (default: http://localhost:5000/api/data)')
    
    parser.add_argument('--config-file', type=str,
                       help='Path to JSON configuration file with client definitions')
    
    parser.add_argument('--api-keys', type=str,
                       help='Comma-separated list of API keys to test')
    
    parser.add_argument('--pattern', type=str, default='steady',
                       choices=['steady', 'ramp-up', 'spike', 'wave', 'stress'],
                       help='Traffic pattern to use (default: steady)')

    parser.add_argument('--concurrency', type=int, default=1,
                       help='Concurrent workers per client burst (default: 1)')
    
    parser.add_argument('--output', type=str,
                       help='Output file path for results (CSV or JSON based on extension)')
    
    parser.add_argument('--verbose', action='store_true',
                       help='Enable verbose output with per-request logging')
    
    return parser.parse_args()


def main():
    args = parse_arguments()
    
    # Print header
    print(f"\n{Fore.CYAN}{Style.BRIGHT}╔════════════════════════════════════════════════════════════════╗")
    print(f"║           Rate Limiter Load Simulator v2.0                    ║")
    print(f"╚════════════════════════════════════════════════════════════════╝{Style.RESET_ALL}\n")
    
    # Load client configuration
    if args.config_file:
        print(f"Loading configuration from: {args.config_file}")
        clients = load_config_file(args.config_file)
    elif args.api_keys:
        print(f"Using API keys from command line")
        keys = args.api_keys.split(',')
        clients = [
            {
                'name': f'Client-{i+1}',
                'key': key.strip(),
                'rps': 2,
                'duration': args.duration
            }
            for i, key in enumerate(keys)
        ]
    else:
        # Default configuration (fallback)
        print(f"{Fore.YELLOW}Warning: No configuration provided. Using default test clients.{Fore.RESET}")
        print(f"{Fore.YELLOW}Create clients via POST /api/clients and use --api-keys or --config-file{Fore.RESET}\n")
        clients = [
            {"name": "TestClient1", "key": "test_key_1", "rps": 2, "duration": args.duration},
            {"name": "TestClient2", "key": "test_key_2", "rps": 3, "duration": args.duration},
        ]
    
    # Add duration to all clients
    for client in clients:
        client['duration'] = args.duration
    
    # Print test configuration
    print(f"\n{Fore.WHITE}{Style.BRIGHT}Test Configuration:{Style.RESET_ALL}")
    print(f"  Duration:     {args.duration}s")
    print(f"  Base URL:     {args.base_url}")
    print(f"  Pattern:      {args.pattern}")
    print(f"  Concurrency:  {args.concurrency}")
    print(f"  Clients:      {len(clients)}")
    print(f"  Verbose:      {args.verbose}")
    if args.output:
        print(f"  Output File:  {args.output}")
    
    print(f"\n{Fore.YELLOW}Starting load test in 3 seconds...{Fore.RESET}")
    time.sleep(3)
    print()
    
    # Create and start client threads
    threads = []
    for client_config in clients:
        thread = ClientSimulator(client_config, args.base_url, args.pattern, args.verbose, args.concurrency)
        thread.start()
        threads.append(thread)
    
    # Start progress reporter
    reporter = ProgressReporter(threads, args.duration)
    reporter.start()
    
    # Wait for completion
    try:
        for thread in threads:
            thread.join()
        reporter.stop()
        reporter.join()
    except KeyboardInterrupt:
        print(f"\n\n{Fore.YELLOW}Interrupted by user. Stopping...{Fore.RESET}")
        for thread in threads:
            thread.stop()
        reporter.stop()
        for thread in threads:
            thread.join()
        reporter.join()
    
    # Print summary
    actual_duration = time.time() - threads[0].start_time if threads else args.duration
    print_summary(threads, actual_duration)
    
    # Export results if requested
    if args.output:
        output_format = 'json' if args.output.endswith('.json') else 'csv'
        export_results(threads, actual_duration, args.output, output_format)
    
    print(f"\n{Fore.GREEN}{Style.BRIGHT}✓ Load test completed successfully!{Style.RESET_ALL}\n")


if __name__ == "__main__":
    main()
