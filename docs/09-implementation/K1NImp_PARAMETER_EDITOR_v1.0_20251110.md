# Parameter Editor Implementation Guide

**Title:** Parameter Editor for SDK Patterns
**Owner:** Claude Code Agent
**Date:** 2025-11-10
**Status:** accepted
**Version:** 1.0.0
**Scope:** Complete parameter editing system for graph editor pattern nodes
**Tags:** parameter-editor, graph-editor, pattern-editor, forms

## Overview

The Parameter Editor provides a user-friendly interface for editing node parameters in the graph editor without requiring manual JSON editing. It supports dynamic form generation, real-time validation, parameter presets, and advanced features like randomization and undo/redo.

## Architecture

### Component Structure

```
ParameterEditor/
├── ParameterEditor.tsx          # Main component
├── PresetManager.tsx            # Preset management UI
├── types.ts                     # Type definitions
├── schemas.ts                   # Parameter schema registry
├── validation.ts                # Validation utilities
├── utils.ts                     # Helper functions
├── Controls/                    # Input control components
│   ├── NumberControl.tsx
│   ├── ColorControl.tsx
│   ├── SelectControl.tsx
│   ├── BooleanControl.tsx
│   └── ArrayControl.tsx
└── __tests__/
    └── ParameterEditor.test.ts
```

### Type System

#### Core Types

```typescript
// Parameter configuration
type ParameterType = 'number' | 'color' | 'select' | 'boolean' | 'array' | 'object' | 'string';

interface ParameterDefinition {
  name: string;
  label: string;
  description?: string;
  config: ParameterConfig;
  required?: boolean;
  hidden?: boolean;
}

interface ParameterSchema {
  nodeType: string;
  version: string;
  parameters: ParameterDefinition[];
}
```

#### Configuration Types

- **NumberParameterConfig**: Numeric inputs with optional range and step
- **ColorParameterConfig**: Color picker with RGB/Hex/HSV support
- **SelectParameterConfig**: Dropdown with predefined options
- **BooleanParameterConfig**: Toggle switches
- **ArrayParameterConfig**: Multi-item lists with min/max constraints
- **ObjectParameterConfig**: Nested parameter objects
- **StringParameterConfig**: Text inputs with optional pattern validation

### Parameter Schemas

Pre-defined schemas for common node types:

#### Gradient Node
```typescript
{
  nodeType: 'gradient',
  parameters: [
    { name: 'color1', label: 'Start Color', config: { type: 'color' } },
    { name: 'color2', label: 'End Color', config: { type: 'color' } },
    { name: 'smoothness', label: 'Smoothness', config: { type: 'number', min: 0, max: 1 } }
  ]
}
```

#### Sine Wave Node
```typescript
{
  nodeType: 'sine_wave',
  parameters: [
    { name: 'frequency', label: 'Frequency', config: { type: 'number', min: 0.1, max: 10, unit: 'Hz' } },
    { name: 'amplitude', label: 'Amplitude', config: { type: 'number', min: 0, max: 1 } },
    { name: 'phase', label: 'Phase', config: { type: 'number', min: 0, max: Math.PI * 2 } }
  ]
}
```

#### Pulse Node
```typescript
{
  nodeType: 'pulse',
  parameters: [
    { name: 'rate', label: 'Pulse Rate', config: { type: 'number', min: 0.5, max: 20, unit: 'Hz' } },
    { name: 'width', label: 'Pulse Width', config: { type: 'number', min: 0, max: 1 } },
    { name: 'easing', label: 'Easing', config: { type: 'select', options: [...] } }
  ]
}
```

#### Audio Reactive Node
```typescript
{
  nodeType: 'audio_reactive',
  parameters: [
    { name: 'band', label: 'Frequency Band', config: { type: 'select', options: [...] } },
    { name: 'sensitivity', label: 'Sensitivity', config: { type: 'number', min: 0.1, max: 2 } },
    { name: 'smoothing', label: 'Smoothing', config: { type: 'number', min: 0, max: 1 } },
    { name: 'decay', label: 'Decay Time', config: { type: 'number', min: 0, max: 1, unit: 's' } }
  ]
}
```

## Components

### ParameterEditor

Main component for editing node parameters.

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

**Features:**
- Dynamic form generation based on node type
- Real-time validation with error messages
- Live preview of parameter changes
- Undo/redo history (up to 50 states)
- Quick action buttons (reset, randomize, export, import)
- Preset management (save, load, delete)

**Usage:**
```typescript
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

### Input Controls

#### NumberControl
Range sliders for numeric parameters with visual feedback.
- Supports min/max constraints
- Optional step size
- Displays current value and range
- Works with integer and decimal numbers

#### ColorControl
Color picker with multiple format support.
- Hex color input (#RRGGBB)
- Color picker widget
- RGB value display
- Live color preview

#### SelectControl
Dropdown menu for selecting from predefined options.
- Supports any value type
- Clear option labels
- Required field validation

#### BooleanControl
Toggle switch for boolean parameters.
- Large touch targets
- Clear enabled/disabled states
- Smooth transitions

#### ArrayControl
Multi-item list editor with add/remove functionality.
- Dynamic item addition
- Item removal with confirmation
- Min/max length constraints
- Type-specific item inputs

### PresetManager

Manages saving and loading parameter presets.

```typescript
interface PresetManagerProps {
  nodeType: string;
  currentValues: Record<string, any>;
  onLoadPreset: (preset: ParameterPreset) => void;
}
```

**Features:**
- Save current parameters as preset
- Load saved presets
- Delete presets
- Organize by node type
- Persist to localStorage

**Usage:**
```typescript
<PresetManager
  nodeType="pulse"
  currentValues={parameters}
  onLoadPreset={(preset) => loadParameters(preset.values)}
/>
```

## Custom Hook: useParameterEditor

Hook for managing parameter editor state and operations.

```typescript
const {
  // State
  values,
  errors,
  isDirty,
  isSaving,
  hasChanges,

  // History
  canUndo,
  canRedo,
  historySize,

  // Operations
  updateParameter,
  updateParameters,
  reset,
  randomize,
  undo,
  redo,
  clearHistory,

  // Validation
  validate,
  getValidationError,

  // Import/Export
  export,
  import,

  // Presets
  savePreset,
  loadPreset,
} = useParameterEditor({
  nodeType: 'sine_wave',
  initialValues: { frequency: 1 },
  onParametersChange: (params) => sendToDevice(params),
  maxHistorySize: 50,
});
```

**Methods:**

- `updateParameter(name, value)` - Update single parameter
- `updateParameters(values)` - Update multiple parameters
- `reset()` - Reset to default values
- `randomize()` - Generate random valid values
- `undo()` - Undo last change
- `redo()` - Redo undone change
- `validate()` - Validate all parameters
- `export()` - Export as JSON string
- `import(json)` - Import from JSON string
- `savePreset(name, description)` - Save as preset
- `loadPreset(preset)` - Load preset values

## Validation System

### Validation Functions

```typescript
// Validate single parameter
validateParameter(definition, value): ParameterValidationError | null

// Validate all parameters
validateParameters(definitions, values): Record<string, string>

// Check for any errors
hasValidationErrors(errors): boolean

// Get first error message
getFirstError(errors): string | null
```

### Validation Rules

- **Required fields**: Empty/null values fail validation
- **Number ranges**: Values must be within min/max bounds
- **Color format**: Must be valid hex color (#RRGGBB)
- **Enum values**: Must be one of the defined options
- **Array length**: Must respect min/max length constraints
- **String patterns**: Can validate against regex patterns
- **Type checking**: Values must match expected type

## Utility Functions

### Parameter Manipulation

```typescript
// Get default values for a schema
getDefaultValues(definitions): Record<string, any>

// Reset to defaults
resetToDefaults(definitions): Record<string, any>

// Generate random valid values
randomizeParameters(definitions): Record<string, any>

// Deep clone parameters
cloneParameters(values): Record<string, any>

// Check equality
areParametersEqual(a, b): boolean

// Get changed fields
getChangedFields(original, current): string[]

// Merge parameter sets
mergeParameters(base, current): Record<string, any>
```

## Integration with Graph Editor

### PropertyPanel Integration

The ParameterEditor can replace or enhance the existing PropertyPanel parameter section:

```typescript
// In PropertyPanel.tsx
import { ParameterEditor } from './ParameterEditor';

<ParameterEditor
  nodeId={node.id}
  nodeType={node.type}
  initialValues={node.parameters}
  onParametersChange={(nodeId, params) => {
    updateNodeParameters(nodeId, params);
    // Also update the visual canvas
    updateCanvasNode(nodeId, { parameters: params });
  }}
  livePreview={true}
/>
```

### Device Synchronization

Parameters can be synced to device in real-time:

```typescript
const { updateParameter } = useParameterEditor({
  nodeType: node.type,
  onParametersChange: async (params) => {
    // Send to device via REST API
    await fetch('/api/parameters', {
      method: 'POST',
      body: JSON.stringify({
        nodeId: node.id,
        parameters: params
      })
    });
  }
});
```

## Features

### Real-time Validation

- Validates as user types
- Shows error messages immediately
- Prevents invalid state transitions
- Live preview disabled during errors

### Undo/Redo

- Automatic history tracking
- Up to 50 states maintained
- Works across all parameter updates
- Clear undo/redo availability status

### Randomization

- Type-aware random generation
- Respects range constraints
- Generates meaningful random values
- Single button trigger

### Import/Export

- Export parameters as JSON
- Import from JSON files
- Type validation on import
- Error handling for invalid files

### Preset Management

- Save current parameters as preset
- Organize by node type
- Persists to browser localStorage
- Load presets with single click

## Testing

### Test Coverage

Test suite includes 15+ test cases covering:

1. **Number validation**: Range checking, step validation
2. **Color validation**: Hex format validation
3. **Select validation**: Option validation
4. **Boolean validation**: Type checking
5. **Array validation**: Length constraints
6. **Default values**: Correct defaults for each type
7. **Randomization**: Type-aware random generation
8. **Deep cloning**: Proper object cloning
9. **Parameter comparison**: Equality checking
10. **Schema loading**: All schemas load correctly
11. **Integration**: Export/import workflows
12. **String patterns**: Regex pattern validation
13. **Required fields**: Missing required field handling
14. **Range constraints**: Min/max enforcement
15. **Complex objects**: Nested parameter handling

**Run tests:**
```bash
npm test ParameterEditor
```

## Example Usage

### Basic Parameter Editing

```typescript
import { ParameterEditor } from '@/components/graph/ParameterEditor';

function PatternEditorPanel({ node }) {
  const handleParameterChange = (nodeId, parameters) => {
    // Update store
    updateNodeParameters(nodeId, parameters);

    // Update canvas
    redrawNode(nodeId);

    // Sync to device
    sendParametersToDevice(nodeId, parameters);
  };

  return (
    <ParameterEditor
      nodeId={node.id}
      nodeType={node.type}
      initialValues={node.parameters}
      onParametersChange={handleParameterChange}
      showPresets={true}
      showRandomize={true}
      livePreview={true}
    />
  );
}
```

### Advanced Usage with Hook

```typescript
import { useParameterEditor } from '@/hooks/useParameterEditor';

function AdvancedParameterEditor({ node }) {
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
    export: exportParams,
    validate,
  } = useParameterEditor({
    nodeType: node.type,
    initialValues: node.parameters,
    onParametersChange: (params) => {
      syncToDevice(node.id, params);
    },
  });

  return (
    <div>
      {/* Parameter controls */}
      {/* Undo/Redo buttons */}
      <button onClick={undo} disabled={!canUndo}>Undo</button>
      <button onClick={redo} disabled={!canRedo}>Redo</button>

      {/* Save/Load */}
      <button onClick={() => savePreset('My Preset')}>Save Preset</button>

      {/* Export */}
      <button onClick={() => {
        const json = exportParams();
        downloadAsFile(json, 'parameters.json');
      }}>Export</button>
    </div>
  );
}
```

### Adding Custom Schemas

```typescript
import { parameterSchemas } from '@/components/graph/ParameterEditor';

// Add custom node type schema
parameterSchemas['my_custom_node'] = {
  nodeType: 'my_custom_node',
  version: '1.0.0',
  parameters: [
    {
      name: 'speed',
      label: 'Speed',
      config: {
        type: 'number',
        min: 0,
        max: 100,
        step: 1,
        defaultValue: 50,
      },
    },
    // ... more parameters
  ],
};
```

## Performance Considerations

### Optimization Techniques

1. **Lazy validation**: Only validate on change, not continuously
2. **Debounced live preview**: Delay preview updates to reduce API calls
3. **Memoized components**: Controls memoized to prevent unnecessary re-renders
4. **Efficient history**: Limited to 50 states to prevent memory issues
5. **LocalStorage caching**: Presets cached locally to avoid network calls

### Best Practices

- Use `livePreview={false}` for large parameter sets
- Limit presets in localStorage (clean up old ones periodically)
- Debounce device sync calls (throttle to 1-2 times per second)
- Use randomization sparingly (high CPU for complex schemas)

## API Endpoints

Parameters are synced using existing device API:

- `POST /api/parameters` - Update node parameters
- `GET /api/parameters/{nodeId}` - Get current parameters
- `GET /api/nodes/{nodeId}/schema` - Get parameter schema (optional)

## Keyboard Shortcuts

- `Ctrl+Z` / `Cmd+Z` - Undo
- `Ctrl+Shift+Z` / `Cmd+Shift+Z` - Redo
- `Escape` - Close editor (if `onClose` provided)

## Accessibility

### Features

- Full keyboard navigation
- ARIA labels on all inputs
- Color contrast compliance (WCAG AA)
- Focus management
- Error announcements

### Controls

- All inputs have associated labels
- Form layout follows semantic HTML
- Error messages linked to inputs
- Toggle switches large enough for touch

## Storage

### LocalStorage Schema

Presets stored as:
```json
{
  "parameter-presets": [
    {
      "id": "1234567890-abc123",
      "name": "Preset Name",
      "nodeType": "sine_wave",
      "values": { /* parameters */ },
      "createdAt": 1699633800000,
      "updatedAt": 1699633800000,
      "tags": ["favorite", "demo"]
    }
  ]
}
```

### Storage Limits

- Browser localStorage quota: 5-10MB typically
- Presets: ~1-5KB each
- Safe limit: ~1000 presets per node type

## Future Enhancements

1. **Preset sharing**: Export/import preset collections
2. **Parameter linking**: Link parameters across nodes
3. **Batch editing**: Edit multiple nodes simultaneously
4. **Parameter groups**: Organize parameters into sections
5. **Animation curves**: Visual editor for curve parameters
6. **Preset search**: Find presets by name/tags
7. **Version history**: Track preset changes over time
8. **Collaborative editing**: Real-time multi-user parameter editing

## Troubleshooting

### Common Issues

**Issue: Changes not syncing to device**
- Check `onParametersChange` callback is connected
- Verify device API endpoint is reachable
- Check browser console for errors

**Issue: Presets not saving**
- Check localStorage is enabled
- Verify sufficient storage space
- Check browser privacy settings

**Issue: Validation errors**
- Ensure values match parameter type
- Check range constraints
- Validate color hex format

## References

- Graph Editor: `./GraphEditorView.tsx`
- Device API: `/api/parameters`
- Related: Parameter Transport Hook, Parameter Persistence Hook
- Design System: `@/components/ui/*`

## Changelog

### v1.0.0 (2025-11-10)
- Initial release
- Support for 5 parameter types
- Preset management
- Undo/redo history
- Import/export functionality
- Real-time validation
- 10+ pre-defined schemas
- Comprehensive test coverage
