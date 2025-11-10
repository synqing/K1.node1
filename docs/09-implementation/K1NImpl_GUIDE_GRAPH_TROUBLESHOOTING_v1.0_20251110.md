
# Graph Troubleshooting (v1)

Common Validator Errors
- E1001 Unknown node type
  - Cause: `type` not found in node catalog.
  - Fix: Correct typos; ensure node exists; update catalog if new node required.

- E1002 Required input not connected
  - Cause: Missing connection for a required port.
  - Fix: Add connection in `inputs` or define node default.

- E1003 Parameter type mismatch
  - Cause: Non-numeric provided where number expected, etc.
  - Fix: Correct param value types; keep params simple scalars/enums/arrays.

- E1004/E1005 Parameter out of bounds (warning)
  - Cause: Value outside declared min/max.
  - Fix: Adjust value; warnings do not block build, but may clip.

- E1006 Stateful memory budget exceeded
  - Cause: Node state > 2.5KB or >1KB in strict mode.
  - Fix: Reduce stateful nodes; lower resolution; split effect.

- E1007 Cycle detected in graph
  - Cause: Back edge forms a cycle.
  - Fix: Restructure to be acyclic; use BufferPersist/ParamF for feedback-like behavior.

- E1009 Unknown input port
  - Cause: Port key not defined for node.
  - Fix: Use correct port names (see Node Catalog Reference).

- E1010 Dangling input source
  - Cause: `inputs.port = "unknown_id"`.
  - Fix: Connect to an existing node id.

- E1011 Total stateful budget exceeded
  - Cause: Sum of stateful memory > budget (default 16KB).
  - Fix: Reduce number of stateful nodes or adjust `--state-budget`.

- E1012 Type mismatch (not coercible)
  - Cause: Upstream type cannot be coerced to expected port.
  - Fix: Insert conversion nodes (`Hsv`, `ColorizeBuffer`) or adjust wiring.

Debugging Workflow
- Run with dumps:
  - `k1c validate graph.json --dump` → inspect `dump-ast.json` and `dump-typed.json`.
  - `k1c build graph.json --dump` → add `dump-plan.json` for schedule/allocations.
- Disable in-place if suspicious:
  - `k1c build graph.json --no-inplace` to avoid aliasing during diagnosis.
- Minimize repros:
  - Start from Bloom/Spectrum and introduce changes in small steps.

Performance & Memory
- Scratch cap:
  - Use `--scratch-cap <bytes>` to enforce peak temporary memory; increase only if necessary.
- Large geometry costs:
  - Prefer small `Blur` radii; use `Shift/Downsample` judiciously.
- Trails:
  - Keep `BufferPersist.decay` near 0.9–0.95 to stay within budgets while preserving motion.

References
- Schema: `docs/06-reference/GRAPH_SCHEMA_SPEC.md`
- Node Catalog: `docs/06-reference/NODE_CATALOG_REFERENCE.md`
- Compatibility: `docs/06-reference/SENSORY_BRIDGE_COMPAT.md`
- Bring‑up: `docs/09-implementation/CODEGEN_BRINGUP_CHECKLIST.md`
