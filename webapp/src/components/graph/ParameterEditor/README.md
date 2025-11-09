# Parameter Editor

A comprehensive, production-ready parameter editing system for graph editor pattern nodes.

## Quick Start

```typescript
import { ParameterEditor } from '@/components/graph/ParameterEditor';

<ParameterEditor
  nodeId="node-123"
  nodeType="sine_wave"
  initialValues={{ frequency: 2, amplitude: 0.8 }}
  onParametersChange={(nodeId, params) => {
    updateNodeParameters(nodeId, params);
  }}
  showPresets={true}
  livePreview={true}
/>
```

## Features

- Dynamic form generation based on node type
- 6 specialized input controls (number, color, select, boolean, array, string)
- Real-time validation with error messages
- Undo/redo history (up to 50 states)
- Parameter presets (save/load/delete)
- Import/export as JSON
- Randomization and reset to defaults
- Live preview of changes
- Full TypeScript support

## File Structure

```
ParameterEditor/
├── ParameterEditor.tsx           # Main component (400+ lines)
├── PresetManager.tsx             # Preset management UI (200+ lines)
├── types.ts                      # Type definitions (100 lines)
├── schemas.ts                    # Parameter schemas (250+ lines)
├── validation.ts                 # Validation system (150 lines)
├── utils.ts                      # Utility functions (200 lines)
├── Controls/                     # Input control components
│   ├── NumberControl.tsx        # Range slider + input
│   ├── ColorControl.tsx         # Color picker
│   ├── SelectControl.tsx        # Dropdown menu
│   ├── BooleanControl.tsx       # Toggle switch
│   ├── ArrayControl.tsx         # List editor
│   └── index.ts                 # Exports
├── __tests__/
│   └── ParameterEditor.test.ts  # Test suite (15+ tests)
├── index.ts                      # Component exports
└── README.md                     # This file
```

## Components

### ParameterEditor

Main component for editing node parameters.

**Props:**
- `nodeId: string` - Node identifier
- `nodeType: string` - Node type (must have schema)
- `initialValues?: Record<string, any>` - Starting parameter values
- `onParametersChange: (nodeId, params) => void` - Change callback
- `showPresets?: boolean` - Show preset manager (default: true)
- `showRandomize?: boolean` - Show randomize button (default: true)
- `showReset?: boolean` - Show reset button (default: true)
- `showExport?: boolean` - Show export/import (default: true)
- `livePreview?: boolean` - Real-time preview (default: true)

### Input Controls

- **NumberControl**: Range slider + numeric input
- **ColorControl**: Color picker with hex/RGB
- **SelectControl**: Dropdown selection
- **BooleanControl**: Toggle switch
- **ArrayControl**: List editor with add/remove

### PresetManager

Manages parameter presets with localStorage persistence.

## Custom Hook: useParameterEditor

```typescript
const {
  values,
  errors,
  isDirty,
  canUndo,
  canRedo,
  updateParameter,
  reset,
  randomize,
  undo,
  redo,
  validate,
  export,
  import,
  savePreset,
  loadPreset,
} = useParameterEditor({
  nodeType: 'sine_wave',
  initialValues: { frequency: 1 },
  onParametersChange: (params) => console.log(params),
});
```

## Parameter Types

1. **Number**: Range slider with min/max constraints
2. **Color**: Color picker with hex input and RGB display
3. **Select**: Dropdown with predefined options
4. **Boolean**: Toggle switch
5. **Array**: Multi-item list with add/remove
6. **String**: Text input with optional pattern validation

## Pre-defined Schemas

- **gradient**: Color gradient (2 colors + smoothness)
- **sine_wave**: Sine wave generator (frequency, amplitude, phase)
- **pulse**: Pulse effect (rate, width, easing)
- **audio_reactive**: Audio reactive effect (band, sensitivity, smoothing, decay)
- **perlin_noise**: Perlin noise generator (scale, octaves, persistence)
- **keyframe_animation**: Keyframe animation (duration, loop, reverse)

Add custom schemas in `schemas.ts`:

```typescript
export const parameterSchemas: Record<string, ParameterSchema> = {
  my_node_type: {
    nodeType: 'my_node_type',
    version: '1.0.0',
    parameters: [
      {
        name: 'intensity',
        label: 'Intensity',
        config: { type: 'number', min: 0, max: 1, defaultValue: 0.5 },
      },
      // ... more parameters
    ],
  },
};
```

## Validation

Automatic validation with friendly error messages:
- Required field checking
- Range validation for numbers
- Format validation for colors
- Enum validation for selects
- Length constraints for arrays
- Pattern validation for strings

## Features

### Undo/Redo
- Automatic history tracking
- Up to 50 states maintained
- Works across all parameter updates

### Randomization
- Type-aware random generation
- Respects range constraints
- Single button trigger

### Import/Export
- Export parameters as JSON
- Import from JSON files
- Type validation on import

### Presets
- Save current parameters
- Load saved presets
- Delete presets
- Persist to localStorage

## Usage Examples

### Basic Usage

```typescript
<ParameterEditor
  nodeId={node.id}
  nodeType={node.type}
  initialValues={node.parameters}
  onParametersChange={(nodeId, params) => {
    updateNode(nodeId, params);
  }}
/>
```

### With Device Sync

```typescript
<ParameterEditor
  nodeId={node.id}
  nodeType={node.type}
  initialValues={node.parameters}
  onParametersChange={async (nodeId, params) => {
    updateNode(nodeId, params);
    await syncToDevice(nodeId, params);
  }}
  livePreview={true}
/>
```

### With Hook

```typescript
const { values, errors, updateParameter, randomize } = useParameterEditor({
  nodeType: node.type,
  initialValues: node.parameters,
  onParametersChange: (params) => updateNode(node.id, params),
});

return (
  <div>
    {/* Custom UI */}
    <ParameterEditor {...} />
    <button onClick={randomize}>Randomize</button>
  </div>
);
```

## Testing

Run test suite:
```bash
npm test ParameterEditor
```

Includes 15+ test cases covering:
- Validation for all parameter types
- Utility function behavior
- Schema loading
- Export/import workflows
- Parameter equality
- Deep cloning
- Default value generation
- Random value generation

## Integration

To integrate with PropertyPanel:

```typescript
import { ParameterEditor, hasParameters } from './ParameterEditor';

{hasParameters(node.type) && (
  <ParameterEditor
    nodeId={node.id}
    nodeType={node.type}
    initialValues={node.parameters}
    onParametersChange={handleParameterChange}
  />
)}
```

## Documentation

- **Implementation Guide**: `docs/09-implementation/K1NImp_PARAMETER_EDITOR_v1.0_20251110.md`
- **Integration Guide**: `docs/09-implementation/K1NImp_PARAMETER_EDITOR_INTEGRATION_GUIDE_v1.0_20251110.md`
- **Deliverables**: `docs/09-implementation/K1NImp_PARAMETER_EDITOR_DELIVERABLES_v1.0_20251110.md`

## API Reference

### ParameterEditor Props

```typescript
interface ParameterEditorProps {
  nodeId: string;
  nodeType: string;
  initialValues?: Record<string, any>;
  onParametersChange: (nodeId: string, parameters: Record<string, any>) => void;
  onClose?: () => void;
  showPresets?: boolean;
  showRandomize?: boolean;
  showReset?: boolean;
  showExport?: boolean;
  livePreview?: boolean;
}
```

### useParameterEditor Options

```typescript
interface UseParameterEditorOptions {
  nodeType: string;
  initialValues?: Record<string, any>;
  onParametersChange?: (parameters: Record<string, any>) => void;
  maxHistorySize?: number;
}
```

### Validation Functions

```typescript
validateParameter(definition, value): ParameterValidationError | null
validateParameters(definitions, values): Record<string, string>
hasValidationErrors(errors): boolean
getFirstError(errors): string | null
```

### Utility Functions

```typescript
getDefaultValues(definitions): Record<string, any>
randomizeParameters(definitions): Record<string, any>
cloneParameters(values): Record<string, any>
areParametersEqual(a, b): boolean
getChangedFields(original, current): string[]
mergeParameters(base, current): Record<string, any>
```

## Browser Support

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support
- IE11: Not supported

## Dependencies

No new dependencies. Uses existing:
- React (hooks)
- TypeScript
- UI components (Button, Input, Label, Separator)
- Icons (lucide-react)
- Notifications (sonner)

## Performance

- Component size: ~35KB minified
- History limit: 50 states
- Validation: O(n) for n parameters
- No external API calls (except device sync)

## Future Enhancements

1. Preset sharing and collections
2. Parameter linking across nodes
3. Batch editing for multiple nodes
4. Parameter groups/sections
5. Animation curve editor
6. Preset search by tags
7. Cloud preset sync
8. Collaborative editing

## License

Part of K1.node1 project

## Contact

For issues, questions, or feature requests, contact the development team.
