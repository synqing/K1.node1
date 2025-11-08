# Modern CLI Toolkit Agent (Reference)

Relocated from CLAUDE.md on 2025-11-05. This guide consolidates practical commands for file discovery, contextual search, safe refactors, data extraction, and code viewing.

Use these as patterns; adapt paths and globs to the repo.

## Find Files by Type

- List TypeScript/JavaScript files: `rg --files -g "**/*.{ts,tsx,js,jsx}"`
- Only tests: `rg --files -g "**/*.{test,spec}.{ts,tsx,js,jsx}"`
- Only components: `rg --files -g "{src,webapp}/**/*.{tsx,jsx}" -g "!*__tests__/*"`
- Non-source assets: `rg --files -g "**/*.{md,mdx,json,yml,yaml}"`

Tip: add `-S` to make patterns case-sensitive and faster when applicable.

## Search Code with Context

- String with context: `rg -n "featureFlag" -C2 src/`
- Word boundary, ignore vendor: `rg -n "\bdebounce\b" -g "!node_modules" -g "!dist"`
- Multiline (PCRE2): `rg -nP "class\s+([A-Z]\w+)\s+extends\s+([A-Z]\w+)" src/`
- Find TODO owners: `rg -n "TODO\(([^)]+)\):" -g "!**/dist/**"`
- Function definitions: `rg -n "^export\s+function\s+\w+\(" src/`

Show only filenames: `rg -l "useEffect\(" webapp/`

## Refactor Code Structures (Safe Patterns)

Preview all matches first: `rg -n "OldType" src/`

- macOS in-place rename type: `rg -l "OldType" src/ | xargs -I{} sed -i '' -e 's/OldType/NewType/g' {}`
- Rename import path: `rg -l "from 'old/path'" | xargs -I{} sed -i '' -e "s#from 'old/path'#from 'new/path'#g" {}`
- Add missing flag (idempotent): `rg -l "createApp\(" src/ | xargs -I{} awk '!found&&/createApp\(/{print;print "  .enableFoo()";found=1;next}1' {} > {}.tmp && mv {}.tmp {}`

Notes:
- Always commit before automated edits. Use `git diff` to review.
- Prefer targeted patterns; avoid global replacements without scoping globs.

## Extract and Transform Data

- Pull package name: `jq -r '.name' package.json`
- List scripts: `jq -r '.scripts | to_entries[] | "\(.key): \(.value)"' package.json`
- Summarize tsconfig paths: `jq '.compilerOptions.paths' tsconfig.json`
- Count imports of a symbol: `rg -n "\bMySymbol\b" -g "**/*.{ts,tsx,js,jsx}" | wc -l`

CSV from matches: `rg -n "^\s*describe\(\"(.*)\"" -g "**/*.test.ts" | awk -F: '{print $1","$2","$3}'`

## View Code with Context

- Around line N: `nl -ba file.ts | sed -n '120,160p'`
- Show function body quickly: `rg -n "^function\s+name\(" -n file.ts -n && sed -n 'start,endp' file.ts`
- Show call sites: `rg -n "\bname\(" src/ -g "!node_modules"`

## Safety & Speed Tips

- Add `--hidden` only if you need to search dotfolders; keep `node_modules` excluded.
- Use `rg -S` for literal, case-sensitive matches (faster), `-F` for fixed strings.
- When mass-editing, start with a narrow subset (one folder) and expand.

## Additional Recipes

### Batch Rename Files by Pattern

- Dry run: `rg -l "^export default function Old" src/`
- Rename files: `fd OldComponent src/ -x bash -lc 'git mv "$0" "${0//OldComponent/NewComponent}"'`

### Move a Folder and Fix Imports

```
git mv src/legacy/widgets src/ui/widgets
rg -l "from 'src/legacy/widgets" | xargs -I{} sed -i '' -e "s#from 'src/legacy/widgets#from 'src/ui/widgets#g" {}
```

### Git-Aware Diffs for Review

- Changed files since main: `git diff --name-only origin/main...HEAD | rg "\.(ts|tsx|js|jsx|md)$"`
- View with context: `git diff -U3 origin/main...HEAD | less -R`

### Metrics Snapshot

- Count lines (src only): `rg -n "" src | wc -l`
- Count TODO/FIXME: `rg -n "\b(TODO|FIXME)\b" | wc -l`

### YAML ⇄ JSON Crosswalk

- YAML to JSON: `yq -o=json '.' config.yml > config.json`
- Extract key path: `yq '.services.api.url' config.yml`

## Governance Scripts (Repo Tools)

The repo provides governance helpers under `tools/governance/`.

### Add YAML Front Matter to Docs

```
./tools/governance/add_frontmatter.sh --check-missing
./tools/governance/add_frontmatter.sh --add-all
./tools/governance/add_frontmatter.sh --add-file docs/04-planning/my_doc.md
```

### Governance Health Check

```
./tools/governance/governance_health.sh
# Reports doc coverage of front matter, root file sprawl, and remediation steps
```

