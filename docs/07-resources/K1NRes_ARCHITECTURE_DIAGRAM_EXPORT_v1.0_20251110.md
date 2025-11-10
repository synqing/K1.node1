# Architecture Diagram Export

This guide explains how to export the consolidated K1.node1 architecture diagram to PDF.

## Files

- Source (Mermaid): `docs/01-architecture/K1NArch_SYSTEM_OVERVIEW_DIAGRAM.mmd`
- HTML Renderer: `docs/01-architecture/K1NArch_SYSTEM_OVERVIEW_DIAGRAM.html`

## Option A: Browser Print to PDF (Recommended)

1. Open `docs/01-architecture/K1NArch_SYSTEM_OVERVIEW_DIAGRAM.html` in your browser.
2. Use “File → Print…” or `Cmd+P` on macOS.
3. Destination: “Save as PDF”.
4. Layout: “Landscape” recommended.
5. Margins: “None” or “Minimum” for full-bleed.
6. Save the file as `K1NArch_SYSTEM_OVERVIEW_DIAGRAM.pdf`.

## Option B: Mermaid CLI (Alternative)

If you prefer generating PDF/PNG from the `.mmd` source via CLI:

```bash
npx @mermaid-js/mermaid-cli -i docs/01-architecture/K1NArch_SYSTEM_OVERVIEW_DIAGRAM.mmd \
  -o docs/01-architecture/K1NArch_SYSTEM_OVERVIEW_DIAGRAM.pdf \
  -t default -b transparent
```

Notes:
- Requires Node.js 20.x and internet access to install the CLI.
- Use `-o ...png` to export PNG instead.

## Versioning

- Update the Mermaid source with any topology changes.
- Re-export PDF on each release; attach to `docs/README.md` and release notes.

