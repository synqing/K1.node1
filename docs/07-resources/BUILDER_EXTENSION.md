---
title: Builder VS Code Extension — Workspace Integration
author: Development Team
date: 2025-11-05 12:00 UTC+8
status: published
intent: Setup and usage guide for bundled VSIX extension with preconfigured workspace
---

Builder VS Code Extension — Workspace Integration

Purpose
- Provide a clean, repeatable way to use the bundled VSIX (builder.builder-0.2.22.vsix) with this repo.
- Preconfigure the extension to run the webapp dev server and connect to it automatically.

Install the Extension
- Command line (preferred):
  - code --install-extension docs/07-resources/builder.builder-0.2.22.vsix --force
- VS Code UI:
  - Extensions panel → ⋯ menu → Install from VSIX… → select docs/07-resources/builder.builder-0.2.22.vsix

Workspace Recommendations
- This repo recommends the extension via .vscode/extensions.json (builder.builder). VS Code will prompt to install if missing.

Workspace Settings (preconfigured)
- .vscode/settings.json contains:
  - builder.serverUrl: http://localhost:3003 (Vite dev server for webapp)
  - builder.setupScript: cd webapp (run subsequent commands from the webapp folder)
  - builder.command: npm run dev (start Vite)
  - builder.openInBrowser: false (open inside the IDE UI)

How to Use
- Start the dev server through Builder:
  - Run command: “Builder: Start Fusion” (Command Palette)
  - The extension will run setupScript + command, then connect to builder.serverUrl.
- Stop via: “Builder: Stop Fusion”.
- If prompted for workspace trust, grant trust so the command can run.

Updating or Reinstalling
- Update the local VSIX file (if provided a newer version), then run:
  - code --install-extension docs/07-resources/builder.builder-<version>.vsix --force

Troubleshooting
- Port mismatch: If you change the dev server port in webapp/vite.config.ts, update builder.serverUrl in .vscode/settings.json.
- Monorepo path changes: If webapp moves, update builder.setupScript and builder.command accordingly.
- CLI not found: Ensure the code command is available (VS Code → Command Palette → “Shell Command: Install ‘code’ command in PATH”).

