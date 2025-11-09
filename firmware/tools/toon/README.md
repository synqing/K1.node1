# TOON CLI for Firmware Workflows

This folder provides a thin wrapper around the official TOON CLI to convert between JSON and TOON for prompt-oriented workflows (analysis, pipelines, and regression checks) without embedding new format code into the microcontroller firmware.

- Runtime compatibility: the CLI ships as an ES module and targets Node 20+, aligning with our existing Node toolchains (e.g., .nvmrc, Orkes/webapp). No transpilation shims required.
- Package: `@toon-format/cli` (built with tsdown). You can run via `npx` or install globally.

## Quick Start

Use the wrapper from the repo root:

```bash
# Encode JSON to TOON (auto-detected) with token stats
tools/toon/toon.sh input.json --stats -o output.toon

# Decode TOON to JSON (auto-detected)
tools/toon/toon.sh data.toon -o output.json

# Output to stdout
tools/toon/toon.sh input.json

# Stdin pipelines (recommended for large data)
jq '.results' data.json | tools/toon/toon.sh --delimiter "\t" --length-marker > results.toon
cat data.toon | tools/toon/toon.sh --decode --no-strict > output.json
```

## Options (selected)

- `-o, --output <file>`: Output path (prints to stdout if omitted)
- `-e, --encode` / `-d, --decode`: Force mode (stdin defaults to encode)
- `--delimiter <char>`: `,` (comma), `\t` (tab), or `|` (pipe)
- `--indent <n>`: Indentation (default `2`)
- `--length-marker`: Add `#` to array lengths (e.g., `items[#3]`)
- `--stats`: Show token estimates (encode only)
- `--no-strict`: Lenient decoding (useful for uncertain human/LLM output)

## Prompt-Oriented Examples

```text
```toon
items[#3]: a,b,c
```

```toon
users[#2|]{"id","name"}:
1|alice
2|bob
```
```

Notes:
- `[#N]` enforces item counts. Append delimiter in brackets (`|` or `\t`).
- Use tab or pipe for better token efficiency in many models; CSV-sized data remains smaller but TOON adds guardrails.

## Pilot Checklist

1. Choose one uniform dataset (e.g., arrays of simple objects) and run with `--stats` to baseline savings.
2. Integrate conversions in ops scripts or CI steps using this wrapper.
3. Keep strict decode for internal validation; use `--no-strict` only when parsing uncertain human/LLM output.

## Install Notes

- Node.js: 20+ recommended.
- Running with `npx` downloads the CLI if missing. Alternatively, install globally:

```bash
# pnpm
pnpm add -g @toon-format/cli

# npm
npm install -g @toon-format/cli

# yarn
yarn global add @toon-format/cli
```


## Baseline Script

Generate token-savings baselines and capture logs and outputs:

```bash
# Single file
tools/toon/baseline_stats.sh data/sample.json --delimiter "\t" --length-marker

# Directory of JSON files
tools/toon/baseline_stats.sh data/ --delimiter "|" --length-marker
```

- Outputs: `tools/toon/baselines/<name>.<timestamp>.{toon,log}`
- The script forwards extra flags to `tools/toon/toon.sh` and always includes `--stats`.
- Use this to quickly capture comparable results before and after changes.

## Roundtrip Validation

Validate that encoding and decoding preserves structure across the curated samples:

```bash
# Run with defaults (tab delimiter + length markers)
make toon-validate

# Or directly
tools/toon/roundtrip_validate.sh data/toon-samples --delimiter "\t" --length-marker
```

If `jq` is available, the script checks structural equality; otherwise it validates successful decode.

## Summarize Baselines

Aggregate baseline logs into a CSV with totals:

```bash
tools/toon/summarize_baselines.sh           # defaults to tools/toon/baselines
# or specify a dir
tools/toon/summarize_baselines.sh tools/toon/baselines
```

Outputs `summary.csv` with per-file and total savings.

## Local Pinned CLI (recommended)

Install the CLI locally (version-pinned) inside `tools/toon` to avoid repeated npx downloads and ensure consistency:

```bash
cd tools/toon
pnpm install   # or: npm install / yarn install
```

The wrapper will automatically prefer the local binary at `tools/toon/node_modules/.bin/toon`.
