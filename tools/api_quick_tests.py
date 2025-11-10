#!/usr/bin/env python3
"""
CLI harness to run quick HTTP tests against a K1 device, handling 429 backoff.

Usage:
  python tools/api_quick_tests.py --host 192.168.4.1 --suite basic

Suites:
  - basic: health, device info, params get
  - audio: audio tempo, snapshot, metrics
  - wifi: wifi status, scan/results

Env:
  EXPORT K1_HOST or provide --host
"""
import argparse
import os
import sys
import time
import json
import urllib.request
import urllib.error

DEFAULT_BACKOFF_MS = 500
MAX_BACKOFF_MS = 5000

def fetch(url: str, method: str = "GET", body: dict | None = None) -> tuple[int, str]:
    data = None
    if body is not None:
        data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Accept", "application/json")
    if data:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            status = resp.getcode()
            text = resp.read().decode("utf-8")
            return status, text
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8")
    except Exception as e:
        return 0, str(e)

def run_with_backoff(host: str, path: str, method: str = "GET", body: dict | None = None):
    url = f"http://{host}{path}"
    backoff = DEFAULT_BACKOFF_MS
    for attempt in range(10):
        status, text = fetch(url, method, body)
        if status == 429:
            print(f"429 for {path}, backing off {backoff}ms...")
            time.sleep(backoff / 1000)
            backoff = min(backoff * 2, MAX_BACKOFF_MS)
            continue
        print(f"{method} {path} -> {status}")
        print(text)
        break

def run_suite(host: str, suite: str):
    if suite == "basic":
        for p in ["/api/health", "/api/device/info", "/api/params"]:
            run_with_backoff(host, p)
    elif suite == "audio":
        for p in ["/api/audio/tempo", "/api/audio/snapshot", "/api/audio/metrics"]:
            run_with_backoff(host, p)
    elif suite == "wifi":
        run_with_backoff(host, "/api/wifi/status")
        run_with_backoff(host, "/api/wifi/scan", method="POST", body={})
        time.sleep(0.5)
        run_with_backoff(host, "/api/wifi/scan/results")
    else:
        print(f"Unknown suite: {suite}")
        sys.exit(1)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default=os.environ.get("K1_HOST", "192.168.4.1"))
    parser.add_argument("--suite", default="basic")
    args = parser.parse_args()
    run_suite(args.host, args.suite)

if __name__ == "__main__":
    main()

