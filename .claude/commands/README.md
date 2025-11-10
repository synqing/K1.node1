# Commands

Reusable slash commands and workflows available to Claude Code in this repository.

## Vendor: wshobson/commands

Community commands are vendored under:
- `./.claude/commands/vendors/wshobson-commands/tools/`
- `./.claude/commands/vendors/wshobson-commands/workflows/`

### How to Invoke
- With directory prefixes:
  - Workflows: `/workflows:feature-development implement OAuth2 authentication`
  - Tools: `/tools:security-scan perform vulnerability assessment`
- Or copy selected files to repo root for direct use:
  ```bash
  cp .claude/commands/vendors/wshobson-commands/tools/*.md .
  cp .claude/commands/vendors/wshobson-commands/workflows/*.md .
  ```
  Then run commands like `/api-scaffold create REST endpoints`.

### Notes
- Keep only the commands you need in the root to avoid clutter.
- Vendored content updates can be pulled from the central infra using `./tools/claude_infra_sync.sh`.
