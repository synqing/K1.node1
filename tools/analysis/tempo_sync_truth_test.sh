#!/usr/bin/env bash
set -euo pipefail
f="firmware/src/audio/goertzel.cpp"
if grep -q "memset(\s*audio_back\.tempo_magnitude" "$f"; then
  exit 1
fi
if grep -q "memset(\s*audio_back\.tempo_phase" "$f"; then
  exit 1
fi
exit 0
