#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8080}"
echo "[SMOKE] Target: $BASE_URL"

# Timeouts and retries
CONNECT_TIMEOUT="${CONNECT_TIMEOUT:-3}"
MAX_TIME="${MAX_TIME:-6}"
RETRIES="${RETRIES:-2}"
RETRY_DELAY="${RETRY_DELAY:-1}"

function check_json() {
  local path="$1"; local name="$2"
  local tmp
  tmp=$(mktemp)
  local code
  code=$(curl -sS \
    --connect-timeout "$CONNECT_TIMEOUT" --max-time "$MAX_TIME" \
    --retry "$RETRIES" --retry-delay "$RETRY_DELAY" \
    -w "%{http_code}" -o "$tmp" "$BASE_URL$path")
  if [[ "$code" != "200" ]]; then
    echo "[FAIL] $name ($path) HTTP $code"; cat "$tmp"; rm -f "$tmp"; exit 1
  fi
  rm -f "$tmp"
  echo "[PASS] $name ($path)"
}

function check_text() {
  local path="$1"; local name="$2"
  local code
  code=$(curl -sS \
    --connect-timeout "$CONNECT_TIMEOUT" --max-time "$MAX_TIME" \
    --retry "$RETRIES" --retry-delay "$RETRY_DELAY" \
    -w "%{http_code}" -o /dev/null "$BASE_URL$path")
  if [[ "$code" != "200" ]]; then echo "[FAIL] $name ($path) HTTP $code"; exit 1; fi
  echo "[PASS] $name ($path)"
}

function check_html_retry() {
  local path="$1"; local name="$2"
  local ok=0
  for i in $(seq 1 8); do
    local tmp
    tmp=$(mktemp)
    local code
    code=$(curl -sS \
      --connect-timeout "$CONNECT_TIMEOUT" --max-time "$MAX_TIME" \
      --retry "$RETRIES" --retry-delay "$RETRY_DELAY" \
      -w "%{http_code}" -o "$tmp" "$BASE_URL$path" || echo "ERR")
    if [[ "$code" == "200" ]] && grep -q "<html" "$tmp"; then
      ok=1
      rm -f "$tmp"
      break
    fi
    rm -f "$tmp"
    sleep 2
  done
  if [[ "$ok" == "1" ]]; then
    echo "[PASS] $name ($path)"
  else
    echo "[FAIL] $name ($path) could not load after retries"
    exit 1
  fi
}

check_json "/api/test-connection" "Test Connection"
check_json "/api/health" "Health"
check_json "/api/device/info" "Device Info"
check_json "/api/device/performance" "Device Performance"
check_json "/api/device-info" "Device Info Alias"
check_json "/api/device-performance" "Device Performance Alias"
check_json "/api/params" "Params GET"
curl -sS -X POST "$BASE_URL/api/params" -H 'Content-Type: application/json' -d '{"brightness":0.7}' >/dev/null && echo "[PASS] Params POST"
check_json "/api/palettes" "Palettes"
check_json "/api/params/bounds" "Params Bounds"
check_json "/api/audio-config" "Audio Config GET"
curl -sS -X POST "$BASE_URL/api/audio-config" -H 'Content-Type: application/json' -d '{"microphone_gain":1.2}' >/dev/null && echo "[PASS] Audio Config POST"
check_text "/api/metrics" "Metrics Alias"
check_html_retry "/ui/index.html" "UI Index"

# WiFi extended APIs
check_json "/api/wifi/ap-mode" "WiFi AP Mode"
curl -sS --connect-timeout "$CONNECT_TIMEOUT" --max-time "$MAX_TIME" --retry "$RETRIES" --retry-delay "$RETRY_DELAY" \
  -X POST "$BASE_URL/api/wifi/reassociate" -H 'Content-Type: application/json' -d '{"reason":"smoke"}' >/dev/null && echo "[PASS] WiFi Reassociate"
check_json "/api/wifi/scan/results/json" "WiFi Scan JSON"
curl -sS --connect-timeout "$CONNECT_TIMEOUT" --max-time "$MAX_TIME" --retry "$RETRIES" --retry-delay "$RETRY_DELAY" \
  -X POST "$BASE_URL/api/wifi/tx-power" -H 'Content-Type: application/json' -d '{"power_dbm":18.5}' >/dev/null && echo "[PASS] WiFi TX Power"
curl -sS --connect-timeout "$CONNECT_TIMEOUT" --max-time "$MAX_TIME" --retry "$RETRIES" --retry-delay "$RETRY_DELAY" \
  -X POST "$BASE_URL/api/wifi/power-save" -H 'Content-Type: application/json' -d '{"enable":true}' >/dev/null && echo "[PASS] WiFi Power Save"
check_json "/api/wifi/metrics" "WiFi Metrics"
curl -sS --connect-timeout "$CONNECT_TIMEOUT" --max-time "$MAX_TIME" --retry "$RETRIES" --retry-delay "$RETRY_DELAY" \
  -X POST "$BASE_URL/api/wifi/channel" -H 'Content-Type: application/json' -d '{"channel":11}' >/dev/null && echo "[PASS] WiFi Channel"
curl -sS --connect-timeout "$CONNECT_TIMEOUT" --max-time "$MAX_TIME" --retry "$RETRIES" --retry-delay "$RETRY_DELAY" \
  -X POST "$BASE_URL/api/wifi/band-steering" -H 'Content-Type: application/json' -d '{"enable":true}' >/dev/null && echo "[PASS] WiFi Band Steering"

echo "[SMOKE] Completed"