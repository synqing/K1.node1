# Parameter Editor Integration Guide

**Title:** Integrating Parameter Editor with Graph Editor
**Owner:** Claude Code Agent
**Date:** 2025-11-10
**Status:** accepted
**Scope:** Integration instructions for existing graph editor systems

## Quick Integration

### Step 1: Replace PropertyPanel Parameter Section

In `webapp/src/components/graph/PropertyPanel.tsx`, replace the manual parameter section with the ParameterEditor component:

```typescript
import { ParameterEditor } from './ParameterEditor';
import { hasParameters } from './ParameterEditor/schemas';

export function PropertyPanel({ node, onParameterChange, onClose }: PropertyPanelProps) {
  // ... existing code ...

  return (
    <div className="h-full flex flex-col bg-[var(--prism-bg-surface)] border-l border-[var(--prism-bg-elevated)]">
      {/* ... existing header and sections ... */}

      {/* Replace the manual PARAMETERS section with: */}
      {hasParameters(node.type) && (
        <ParameterEditor
          nodeId={node.id}
          nodeType={node.type}
          initialValues={node.parameters}
          onParametersChange={(nodeId, params) => {
            if (onParameterChange) {
              onParameterChange(nodeId, params);
            }
          }}
          showPresets={true}
          showRandomize={true}
          showReset={true}
          showExport={true}
          livePreview={true}
        />
      )}
    </div>
  );
}
```

### Step 2: Update Canvas Integration

In `webapp/src/components/graph/Canvas.tsx`, handle parameter changes:

```typescript
import { useParameterTransport } from '@/hooks/useParameterTransport';

// In your canvas component
const handleParameterChange = async (nodeId: string, parameters: Record<string, any>) => {
  // Update local state
  updateNode(nodeId, { parameters });

  // Redraw node
  redrawCanvas();

  // Sync to device (optional, if using parameter transport)
  if (connectionState.connected) {
    await sendParameters({ nodeId, parameters });
  }
};
```

### Step 3: Extend Node Schemas

Add parameter schemas for your custom node types in `ParameterEditor/schemas.ts`:

```typescript
export const parameterSchemas: Record<string, ParameterSchema> = {
  // ... existing schemas ...

  // Add your custom schemas
  my_effect_node: {
    nodeType: 'my_effect_node',
    version: '1.0.0',
    parameters: [
      {
        name: 'intensity',
        label: 'Intensity',
        description: 'Effect intensity (0-1)',
        config: {
          type: 'number',
          min: 0,
          max: 1,
          step: 0.01,
          defaultValue: 0.5,
        },
      },
      // ... more parameters
    ],
  },
};
```

## Advanced Features

### Real-time Device Sync

Combine with existing parameter transport hook:

```typescript
import { useParameterTransport } from '@/hooks/useParameterTransport';

function GraphEditorView() {
  const { sendParameters } = useParameterTransport({
    connectionState,
    onSuccess: (params) => {
      toast.success('Parameters sent to device');
    },
    onError: (error) => {
      toast.error('Failed to send parameters');
    },
  });

  const handleParameterChange = async (nodeId: string, params: Record<string, any>) => {
    // Update UI
    updateNode(nodeId, { parameters: params });

    // Send to device
    await sendParameters(params);
  };

  return (
    <ParameterEditor
      onParametersChange={handleParameterChange}
      livePreview={true}
    />
  );
}
```

### Preset Synchronization

Sync presets across sessions:

```typescript
// Save to cloud
const handleSavePreset = (name: string, params: Record<string, any>) => {
  const preset = {
    id: generateId(),
    name,
    nodeType,
    values: params,
    createdAt: Date.now(),
  };

  // Save locally
  saveToLocalStorage(preset);

  // Optional: sync to server
  if (user) {
    syncPresetToServer(user.id, preset);
  }
};

// Load from cloud
const handleLoadPreset = async (presetId: string) => {
  const preset = await loadPresetFromServer(presetId) || loadFromLocalStorage(presetId);
  if (preset) {
    updateParameters(preset.values);
  }
};
```

## Usage Patterns

### Pattern 1: Basic Usage

```typescript
<ParameterEditor
  nodeId={node.id}
  nodeType={node.type}
  initialValues={node.parameters}
  onParametersChange={(nodeId, params) => updateNode(nodeId, params)}
/>
```

### Pattern 2: With Validation

```typescript
<ParameterEditor
  nodeId={node.id}
  nodeType={node.type}
  initialValues={node.parameters}
  onParametersChange={(nodeId, params) => {
    // Validate before updating
    if (validateNodeParameters(nodeId, params)) {
      updateNode(nodeId, params);
    }
  }}
/>
```

### Pattern 3: With Device Sync

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

### Pattern 4: Advanced with Hook

```typescript
const { values, errors, updateParameter, randomize, undo, redo } = useParameterEditor({
  nodeType: node.type,
  initialValues: node.parameters,
  onParametersChange: (params) => {
    updateNode(node.id, params);
  },
});

return (
  <div>
    {/* Custom UI around the hook */}
    <ParameterEditor {...} />
    <button onClick={undo} disabled={!canUndo}>Undo</button>
    <button onClick={redo} disabled={!canRedo}>Redo</button>
  </div>
);
```

## Configuration Options

```typescript
interface ParameterEditorProps {
  // Required
  nodeId: string;                                    // Node identifier
  nodeType: string;                                  // Node type (matches schema)
  onParametersChange: (nodeId, params) => void;    // Change callback

  // Optional
  initialValues?: Record<string, any>;              // Starting values
  onClose?: () => void;                             // Close handler
  showPresets?: boolean;                            // Show preset manager
  showRandomize?: boolean;                          // Show randomize button
  showReset?: boolean;                              // Show reset button
  showExport?: boolean;                             // Show export/import
  livePreview?: boolean;                            // Real-time preview
}
```

## Testing Integration

### Unit Tests

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { ParameterEditor } from './ParameterEditor';

describe('ParameterEditor Integration', () => {
  it('should update node on parameter change', () => {
    const mockOnChange = jest.fn();
    const { container } = render(
      <ParameterEditor
        nodeId="test-node"
        nodeType="sine_wave"
        onParametersChange={mockOnChange}
      />
    );

    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '5' } });

    expect(mockOnChange).toHaveBeenCalledWith('test-node', expect.objectContaining({
      frequency: 5,
    }));
  });
});
```

### Integration Tests

```typescript
describe('Parameter Editor with Graph Editor', () => {
  it('should sync parameters between UI and device', async () => {
    const { getByRole } = render(<GraphEditorView />);

    // Select node
    fireEvent.click(getByRole('button', { name: /sine_wave/ }));

    // Change parameter
    const input = getByRole('spinbutton', { name: /frequency/ });
    fireEvent.change(input, { target: { value: '10' } });

    // Verify device sync
    await waitFor(() => {
      expect(mockDeviceAPI.updateParameters).toHaveBeenCalledWith({
        frequency: 10,
      });
    });
  });
});
```

## Common Issues & Solutions

### Issue: Parameters Not Showing

**Problem:** ParameterEditor shows "No parameters available"

**Solution:** Ensure node type has schema defined:
```typescript
// In schemas.ts
export const parameterSchemas: Record<string, ParameterSchema> = {
  your_node_type: { ... }
};
```

### Issue: Changes Not Syncing

**Problem:** Parameter changes don't appear on device

**Solution:** Ensure callback is properly connected:
```typescript
const handleChange = (nodeId, params) => {
  console.log('Parameter change:', nodeId, params); // Debug
  sendToDevice(nodeId, params);
};
```

### Issue: Presets Not Saving

**Problem:** Presets disappear after refresh

**Solution:** Check localStorage quota:
```typescript
try {
  localStorage.setItem('test', 'test');
  localStorage.removeItem('test');
} catch (e) {
  // Storage quota exceeded or disabled
}
```

## Performance Tips

1. **Debounce live preview** for large parameter sets
2. **Use lazy validation** instead of continuous validation
3. **Memoize control components** to prevent re-renders
4. **Limit history size** to 50 states (configurable)
5. **Throttle device sync** to 1-2 requests per second

## Related Documentation

- Parameter Editor Reference: `K1NImp_PARAMETER_EDITOR_v1.0_20251110.md`
- Graph Editor: `../../components/graph/PropertyPanel.tsx`
- Parameter Transport: `../../hooks/useParameterTransport.ts`
- Parameter Persistence: `../../hooks/useParameterPersistence.ts`

## Checklist for Integration

- [ ] Add ParameterEditor to PropertyPanel
- [ ] Add custom schemas for your node types
- [ ] Connect parameter change handler
- [ ] Test with sample nodes
- [ ] Verify device sync (if applicable)
- [ ] Test preset save/load
- [ ] Test randomize and reset buttons
- [ ] Test export/import functionality
- [ ] Verify validation errors display
- [ ] Check responsive layout
- [ ] Test keyboard navigation
- [ ] Verify accessibility features
