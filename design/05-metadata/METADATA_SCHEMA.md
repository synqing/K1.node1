# Metadata Schema

Use this schema to annotate design docs and component specs. Include as a YAML frontmatter or JSON header in each markdown file.

Fields:
- id: unique identifier (string)
- name: human-readable name (string)
- area: product area (enum)
- component: component name (PascalCase)
- capability: capability reference (string, e.g., `capability_3`)
- status: draft | in_review | ready | shipped | deprecated
- version: semantic version (string)
- accessibility: notes or checklist status (string)
- performance: budget or measured stats (string)
- authors: array of names
- links: array of URLs (Figma, Builder.io, code refs)
- updated_at: ISO date

Example (YAML frontmatter):
```yaml
id: status-bar
name: Status Bar
area: control
component: StatusBar
capability: capability_3
status: shipped
version: 1.2.0
accessibility: AA contrast, keyboard focus visible
performance: renders in <16ms at 60fps
authors: ["UI Designer", "Front-end Engineer"]
links:
  - https://www.figma.com/file/.../StatusBar
  - webapp/src/components/control/StatusBar.tsx
updated_at: 2025-11-05
```

