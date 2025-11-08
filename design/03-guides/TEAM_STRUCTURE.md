# Team Structure

Define clear, specialized roles for UI/UX within K1.node1:

- Product Designer: Owns end-to-end flows, prototypes, and usability.
- UI Designer: Owns visual design, tokens, components, and accessibility.
- UX Researcher: Plans studies, captures insights, maintains personas and journey maps.
- Front-end Engineer: Implements components, performance budgets, and accessibility.
- Design System Engineer: Maintains component library and tokens. Coordinates with UI Designer.
- Interaction Designer: Defines motion, micro-interactions, and feedback patterns.
- Design Ops: Tooling, versioning, handoff, governance.

Operating model:
- Weekly design/dev sync anchored to capability gates (see `.kiro/DEPLOYMENT_STATUS_*`).
- Work is scoped by capabilities (not timelines); designers and engineers progress together.
- Handoff occurs continuously via documented specs (`handoff/`) and dev pairing sessions.

Decision governance:
- Visual and accessibility decisions: UI Designer + Design System Engineer.
- Interaction and motion decisions: Interaction Designer + Front-end Engineer.
- Research-derived changes: UX Researcher + Product Designer.
- Breaking changes to design tokens/components: Design System Engineer approval.

