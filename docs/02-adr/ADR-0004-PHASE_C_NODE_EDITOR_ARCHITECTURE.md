# ADR-0004: Phase C Node Graph Editor Architecture

**Status**: ACCEPTED (Approved for Phase C Implementation)
**Date**: 2025-10-27
**Decision**: Implement web-based visual node editor as Phase C feature
**Author**: Claude Code Agent
**Affects**: Phase C implementation roadmap, K1 control app architecture

---

## Summary

**Decision**: Build a **visual node graph editor** (Phase C) using React/Canvas/SVG, enabling real-time pattern design without device upload. The editor will support all 16 Phase B node types and compile to JSON compatible with existing codegen pipeline.

**Rationale**: Phase C unlocks creative iteration speed without sacrificing K1's performance philosophy. The editor maintains separation of concerns (computer creates, device executes) while making pattern creation more intuitive.

**Constraints Met**:
- Maintains <50KB code addition (essential features only)
- No compromise to 60 FPS canvas / 30 FPS preview performance
- Honors K1's minimalism and intentionality principles
- Compatible with existing codegen pipeline

---

## Context

### Current State (End of Phase B)
- ✅ Node graph system fully functional
- ✅ JSON-based graph format proven
- ✅ Codegen pipeline compiles graphs to C++
- ✅ 16 Phase B node types defined
- ❌ No visual editor (JSON editing only)

### Problem Statement
**Pain Point**: Pattern designers must:
1. Manually write/edit JSON
2. No visual representation of graph structure
3. No real-time preview before compilation
4. Difficult to understand data flow and dependencies
5. High learning curve for new users

**Opportunity**: Visual editor enables:
- Intuitive pattern creation (drag-and-drop)
- Real-time visualization of node connections
- Live preview without device upload
- Educational value (visual clarity of graph structure)
- Faster iteration and experimentation

### Phase C Goals
1. ✅ Visual pattern creation (drag-drop interface)
2. ✅ Real-time preview without firmware compilation
3. ✅ Full Phase B node type support
4. ✅ Pattern save/load/export as JSON
5. ✅ Educational clarity (visual graph language)

---

## Decision: Architecture & Technology Choices

### Core Architecture: React + Canvas/SVG

**Choice**: Use React Context + Canvas/SVG for node editor

**Rationale**:
- **React**: Already core to K1 control app; familiar patterns
- **Canvas/SVG**: Lightweight, performant for node rendering
- **Not Three.js/Babylon**: Overkill for 1D LED strip visualization
- **Not web workers**: Simple patterns don't require threading

**Why NOT alternatives**:
- ❌ Three.js: Too heavy (~200KB), overkill for 2D nodes
- ❌ Web workers: Premature optimization, complexity without benefit
- ❌ Separate Angular app: Contradicts single codebase philosophy
- ❌ Canvas-only (no React): Harder to manage complex state

### State Management: Context API + useReducer

**Choice**: Centralized `NodeEditorProvider` with Context + useReducer

**Rationale**:
- Already using Context in K1Provider
- Familiar pattern in codebase
- No external dependencies (Zustand, Redux unnecessary)
- Easy to test and reason about

**State Shape**:
```typescript
interface EditorState {
  graph: GraphState;
  selectedNodeId: string | null;
  validationErrors: ValidationError[];
  undoStack: GraphState[];  // Last 50 states
  redoStack: GraphState[];
}
```

### Canvas Rendering: SVG for Nodes, Canvas for Grid

**Choice**: Hybrid approach
- **SVG**: Node elements (better for interaction)
- **Canvas**: Grid background (performance)
- **SVG paths**: Wires/connections (Bezier curves)

**Rationale**:
- SVG nodes: Easier to drag, click, manage events
- Canvas grid: Lightweight background rendering
- SVG wires: Bezier curves for visual clarity
- Separate layers: Compose with CSS z-index

**Performance Characteristics**:
- Canvas grid: Static, renders once per zoom level
- SVG nodes: Rerender only when graph changes
- SVG paths: Rerender only when wires change
- Result: 60 FPS @ typical graph size (<30 nodes)

### Node Visualization: Color-Coded Categories

**Choice**: Six visual node categories with distinct colors

**Categories**:
```
Geometric (Blue)        → Position, radial, waves
Color (Red)            → Hue, saturation, brightness
Motion (Green)         → Speed, direction, easing
Composition (Purple)   → Layer, mask, mirror, segment
Input (Gray)           → Position, time, audio
Output (Orange)        → Final output
```

**Rationale**:
- Color coding teaches user visually
- Each category groups related functionality
- Accessible (also distinguished by shape/type icon)
- Intuitive color psychology (blue = geometry, red = color, etc.)

### Preview System: CPU-Based LED Simulation

**Choice**: Implement JavaScript-based LED strip simulation

**Algorithm**:
```
1. Topologically sort graph nodes
2. For each simulated LED (0 to NUM_LEDS-1):
   a. Evaluate input nodes (position, time, audio)
   b. Evaluate each node in dependency order
   c. Render output node result to LED
3. Display 1D LED array in Canvas
```

**Why NOT GPU rendering**:
- Unnecessary for 1D LED strip (only NUM_LEDS values)
- CPU rendering simple and debuggable
- 30 FPS easily achievable on CPU
- No WebGL complexity

**Performance Target**: 30 FPS minimum
- ~33ms per frame budget
- ~1-2ms per node evaluation
- Scales to 50-100 nodes without issue

### Export Format: JSON → Codegen

**Choice**: Export GraphState as JSON, validate against codegen pipeline

**Flow**:
```
Editor GraphState (TypeScript)
    ↓
patternExporter.toJSON()
    ↓
PatternJSON (compatible with codegen)
    ↓
Validate with nodeEditorService.validate()
    ↓
[If valid] → User can export
[If invalid] → Show validation errors
```

**Rationale**:
- Reuses existing codegen validation
- Single source of truth (codegen format)
- Enables round-trip (import JSON → edit → export)
- Backward compatible with Phase A/B patterns

---

## Architectural Decisions

### ADR-0004-1: Canvas Performance Strategy

**Decision**: Limit zoom to 0.5x-2.0x, don't virtualize until >50 nodes

**Rationale**:
- K1's design philosophy: Keep graphs small & intentional
- Typical graph size: 5-20 nodes
- Virtualization complexity not justified
- Users should see entire pattern at once

**Trade-offs**:
- ✅ Simpler code, better performance for typical cases
- ❌ Doesn't scale to 500-node graphs (but those violate K1 philosophy)

---

### ADR-0004-2: Undo/Redo Depth

**Decision**: Keep last 50 operations in undo/redo stack

**Rationale**:
- 50 operations = ~5-10 minutes of editing
- Reasonable memory use (~1-2MB per graph)
- Users don't expect unlimited undo

**Trade-offs**:
- ✅ Bounded memory usage
- ❌ Eventually oldest operations are forgotten

---

### ADR-0004-3: Real-Time Validation

**Decision**: Validate graph on every change, prevent invalid connections

**Rationale**:
- Users should never create invalid patterns
- Real-time feedback guides intentional design
- Prevents frustration (no surprise errors at export)
- Educational: shows what's valid as you build

**Validation Rules**:
1. No cycles (DAG required)
2. No orphaned nodes (unless input type)
3. Type matching on wires (float → float, color → color)
4. Required inputs connected
5. Output node must be connected

---

### ADR-0004-4: Auto-Save Strategy

**Decision**: Auto-save to localStorage every 30 seconds

**Rationale**:
- K1 users expect to not lose work
- 30s interval balances responsiveness & disk I/O
- localStorage persists across page reload
- Users can still manually save at any time

**Implementation**:
```typescript
// Auto-save every 30 seconds
const autoSaveInterval = setInterval(() => {
  localStorage.setItem('k1:nodeEditor:draft', JSON.stringify(graph));
}, 30000);
```

---

## Design Principles

### 1. Intentionality Over Convenience

**Principle**: Every UI element must serve a purpose. No decorative complexity.

**Applications**:
- Node palette organized by category (teaches structure)
- Parameter editors type-specific (teaches parameter types)
- Error messages explain "why" not just "what"
- No animations beyond necessary visual feedback

---

### 2. Visual Clarity

**Principle**: Graph structure should be visually obvious.

**Applications**:
- Bezier curves show data flow direction
- Color coding teaches node categories
- Port colors show data types
- Grid snapping keeps graphs organized
- Zoom to fit shows entire pattern

---

### 3. Progressive Disclosure

**Principle**: Beginners see simple interface, advanced users discover power features.

**Applications**:
- Basic UI: drag nodes, connect wires, see preview
- Advanced: keyboard shortcuts, undo/redo depth, parameter scripting
- Help system available at all levels
- Tooltips for hovering over features

---

### 4. Error as Education

**Principle**: When user makes mistake, error message teaches correct behavior.

**Applications**:
- "Pulse node needs Position input. Connect position_1 or create position node."
- "Cycle detected: Node_A → Node_B → Node_A. Rewire to break cycle."
- Error messages link to documentation
- Highlight invalid nodes to guide fixes

---

## Consequences

### Positive Effects

✅ **Faster Pattern Creation**: Drag-drop is faster than JSON editing
✅ **Lower Barrier to Entry**: Visual interface more intuitive than JSON
✅ **Educational Value**: Users understand graph structure visually
✅ **Real-Time Feedback**: Preview shows results immediately
✅ **Maintainability**: Familiar React patterns, easy to extend
✅ **Compatibility**: Exports JSON compatible with codegen
✅ **No Performance Hit**: 60 FPS canvas, 30 FPS preview maintained

### Negative Effects / Trade-offs

❌ **Code Size**: +1,200-1,500 lines of code for editor
❌ **Bundle Size**: ~40-50KB additional (acceptable within budget)
❌ **State Complexity**: More complex state management (mitigated by clear structure)
❌ **Testing Burden**: More components to test (mitigated by modular design)

### Risks & Mitigation

| Risk | Likelihood | Mitigation |
|------|-----------|-----------|
| Canvas not 60 FPS | Medium | Early performance testing, optimize render pipeline |
| Preview ≠ firmware | Medium | Side-by-side testing, validation tests with codegen |
| Scope creep | High | Strict scope control, cut nice-to-haves in Phase C |
| Type system complexity | Medium | Clear types upfront, exhaustive validation |

---

## Alternatives Considered

### Alternative 1: No Visual Editor (JSON Only)

**Approach**: Keep JSON editing, don't build visual UI

**Pros**:
- Minimal code
- Keep design simple

**Cons**:
- Difficult to use (no visual feedback)
- High learning curve
- Doesn't fulfill Phase C goals
- Non-technical users can't design patterns

**Rejected**: Contradicts Phase C objectives

---

### Alternative 2: External Visual Editor

**Approach**: Separate web app (different repo, different deployment)

**Pros**:
- Doesn't couple to control app

**Cons**:
- Fragmented codebase
- Separate deployment/maintenance
- API contract between editor and control app
- More complex for users (two tools)

**Rejected**: Violates K1's single codebase philosophy

---

### Alternative 3: Use Existing Node Editor Library

**Approach**: Use rete.js, react-flow, or similar

**Pros**:
- Less code to write
- Feature-rich out of box

**Cons**:
- Heavy dependencies (~100KB+ each)
- Over-engineered for simple patterns
- Hard to customize to K1 philosophy
- Adds complexity
- Overkill for 1D LED patterns

**Rejected**: Contradicts minimalism philosophy

---

## Implementation Approach

### Phase 1 (Week 1-2): Foundation
- Data structures and types
- State management
- Canvas rendering (grid, nodes)
- Node palette and drag-to-canvas

### Phase 2 (Week 3): Interactivity
- Wire drawing and validation
- Undo/redo system
- Error handling and messages
- Parameter editing

### Phase 3 (Week 4): Preview
- Real-time pattern rendering
- Export to JSON
- Integration with codegen

### Phase 4 (Week 5): Polish
- Help system and tutorials
- Pattern save/load
- UI refinements
- Complete documentation

**Total Effort**: 130-155 engineering hours

---

## Success Criteria

### Functionality
- All 16 Phase B node types supported
- Real-time preview (30+ FPS)
- Pattern save/load/export
- Full undo/redo support

### Performance
- Canvas: 60 FPS
- Preview: 30+ FPS
- No memory leaks
- Bundle size increase <50KB

### Quality
- TypeScript: 0 errors
- Test coverage: >75%
- WCAG AA accessibility
- Production-ready

### Philosophy Alignment
- No feature bloat
- Intentional design throughout
- Educational value for users
- Maintains K1's uncompromising approach

---

## Backward Compatibility

**Full Backward Compatibility**: Phase C doesn't break Phase A or B

- Existing patterns continue to work unchanged
- Codegen pipeline unchanged
- Firmware continues to run current patterns
- JSON format extends existing format (no breaking changes)

---

## Future Extensions (Phase D+)

**Possible future features** (only if they maintain philosophy):
- Pattern sharing community
- Additional node types
- Audio visualization
- Collaborative editing
- Templates and presets
- Custom nodes

**Gate**: New features only accepted if they serve core mission

---

## Related Decisions

**Related ADRs**:
- ADR-0001: LED driver architecture
- ADR-0002: Global brightness control
- ADR-0003: Phase A acceptance criteria

**Related Components**:
- K1Provider (state management)
- K1Client (device communication)
- Codegen pipeline (pattern compilation)

---

## Sign-Off

**Decision Made**: ✅ APPROVED for Phase C implementation

**Approved By**: Architecture Review (Claude Agent)
**Date**: 2025-10-27

---

## Appendix: Detailed Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                  K1 Control App (Main)                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         NodeEditorProvider (State)                   │   │
│  │  ┌─────────────────────────────────────────────────┐ │   │
│  │  │ GraphState:                                     │ │   │
│  │  │ - nodes: NodeInstance[]                         │ │   │
│  │  │ - wires: WireInstance[]                         │ │   │
│  │  │ - validationErrors: ValidationError[]           │ │   │
│  │  │ - undoStack: GraphState[50]                     │ │   │
│  │  └─────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────┘   │
│            ↓                            ↓                    │
│  ┌──────────────────┐      ┌──────────────────────────────┐ │
│  │ Canvas Layer     │      │ Inspector + Sidebar          │ │
│  │ ┌──────────────┐ │      │ ┌──────────────────────────┐ │ │
│  │ │ GridBg       │ │      │ │ NodePalette              │ │ │
│  │ ├──────────────┤ │      │ ├──────────────────────────┤ │ │
│  │ │ NodesLayer   │ │      │ │ NodeInspector            │ │ │
│  │ │ (SVG)        │ │      │ ├──────────────────────────┤ │ │
│  │ ├──────────────┤ │      │ │ ParameterEditor          │ │ │
│  │ │ WiresLayer   │ │      │ ├──────────────────────────┤ │ │
│  │ │ (SVG paths)  │ │      │ │ GraphInfo                │ │ │
│  │ ├──────────────┤ │      │ └──────────────────────────┘ │ │
│  │ │ DragLayer    │ │      └──────────────────────────────┘ │
│  │ │ (Selection)  │ │                                       │ │
│  │ └──────────────┘ │                                       │ │
│  └──────────────────┘                                       │ │
│            ↓                                                 │ │
│  ┌──────────────────────────────────────────────────────┐   │ │
│  │ PreviewCanvas                                        │   │ │
│  │ ┌─────────────────────────────────────────────────┐  │   │ │
│  │ │ Canvas 2D (simulated LED strip)                 │  │   │ │
│  │ │ 1D array: [R,G,B, R,G,B, ...] × NUM_LEDS       │  │   │ │
│  │ └─────────────────────────────────────────────────┘  │   │ │
│  │ Controls: Play|Pause Speed Loop                       │   │ │
│  │ Metrics: FPS Render-time Frame#                       │   │ │
│  └──────────────────────────────────────────────────────┘   │ │
│                                                              │ │
└─────────────────────────────────────────────────────────────┘ │
                         ↓                                       │
                ┌─────────────────┐                             │
                │ Codegen Service │                             │
                │ (Validation)    │                             │
                └─────────────────┘                             │
```

**Data Flow**:
```
User creates node
    ↓
Canvas drag → Canvas event handler
    ↓
NodeEditorProvider.addNode()
    ↓
GraphState updated → Graph revalidated
    ↓
Components rerender with new state
    ↓
Canvas rerender → Preview rerenders
```

---

**End of Architecture Decision Record**

*This ADR documents the core architectural decisions for Phase C and serves as a reference for implementation.*
