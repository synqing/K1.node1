# Task Master Integration & Tools

Consolidated from CLAUDE.md on 2025-11-05. Use this document for Task Master–specific commands and guardrails.

Authoritative guide: `.taskmaster/CLAUDE.md` (import with `@./.taskmaster/CLAUDE.md` in Task Master–scoped docs only).

## Important Rules

1. You MUST use real tool calls (e.g., `write`, `edit`, `multiedit`, `generateTheme`). Do not print pseudo-call text.
2. Confirm in order: layout → theme → animation before generating assets.
3. Save design assets under `.superdesign/design_iterations/` only.
4. Follow the workflow below and do not save elsewhere without maintainer approval.

## Available Tools

- read: Read file contents (text/images), supports ranges
- write: Write files (creates parent directories automatically)
- edit: Exact find/replace (match whitespace precisely)
- multiedit: Chain multiple edits on one file
- glob: Find files/dirs by pattern
- grep: Search file contents by regex
- ls: List directory contents
- bash: Execute shell commands (with timeout and output capture)
- generateTheme: Generate a theme for the design

When calling tools, use the actual tool invocation; printing placeholders will not execute actions.

## Workflow

1) Layout design → confirm structure and components
2) Theme design → colors, typography, spacing
3) Animation design → micro-interactions and transitions
4) Generate HTML/CSS per component, then compose into a single page deliverable

Deliverables must be written to `.superdesign/design_iterations/`.

## Example Session (Illustrative)

```
# 1) Confirm layout
read(path='.superdesign/design_iterations/wireframes.md')

# 2) Confirm theme
generateTheme(palette='slate', accent='indigo')

# 3) Confirm animations (reference CHAT_UI_ANIMATIONS.md)
read(path='.superdesign/CHAT_UI_ANIMATIONS.md')

# 4) Generate assets
write(file_path='.superdesign/design_iterations/chat_ui.css', content='/* compiled CSS */')
write(file_path='.superdesign/design_iterations/chat_ui.html', content='<!doctype html>...')
```

Note: In Task Master runs, these must be real tool invocations; do not print pseudo calls.
