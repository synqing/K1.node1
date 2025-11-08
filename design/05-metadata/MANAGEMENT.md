# Metadata Management

Centralize design documentation metadata to enable discovery, governance, and change tracking.

Tagging:
- Use facets: `area`, `component`, `capability`, `status`, `version`, `accessibility`, `performance`.
- Example values: `area: control`, `component: StatusBar`, `capability: capability_3`, `status: shipped`.

Categorization:
- Registry lives in `design/05-metadata/`. Maintain taxonomies and controlled vocabularies.
- Each document includes a top metadata block with tags and version.

Versioning:
- Semantic versioning for component specs and tokens.
- Track changes centrally in `design/04-quality/CHANGELOG.md` and optional per-component logs.

Schema:
- See `design/05-metadata/METADATA_SCHEMA.md` for the machine-readable schema and examples.

