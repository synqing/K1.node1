# Conductor API

K1.node1 Conductor API service.

## Claude Infrastructure (Reference)

This service participates in the monorepo’s managed Claude infrastructure.

### Sync & Guardrails
- Central `.claude/` is synced via `tools/claude_infra_sync.sh`; avoid direct edits.
- Commits touching `.claude/` are blocked by default; override with `ALLOW_CLAUDE_CHANGES=1` only if necessary.

### Vendor Commands & Agents
- Vendor commands:
  - Tools: `./.claude/commands/vendors/wshobson-commands/tools/`
  - Workflows: `./.claude/commands/vendors/wshobson-commands/workflows/`
- Invocation patterns:
  - Prefix: `/workflows:feature-development implement OAuth2 authentication`
  - Prefix: `/tools:security-scan perform vulnerability assessment`
  - Direct: optionally copy selected files to repo root for simpler calls:
    ```bash
    cp .claude/commands/vendors/wshobson-commands/tools/*.md .
    cp .claude/commands/vendors/wshobson-commands/workflows/*.md .
    ```
    Then run commands like `/api-scaffold create REST endpoints`.
- Optional agent marketplace:
  - Add marketplace: `/plugin marketplace add wshobson/agents`
  - Install agents: `/plugin install <plugin-name>` (e.g., `python-development`, `backend-development`, `security-scanning`)
