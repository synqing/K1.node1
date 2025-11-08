/**
 * K1.node1 Builder Component Registration Stubs
 * 
 * Maps existing React components to Builder Editor with proper inputs/outputs.
 * Import existing components; do NOT modify component logic.
 * 
 * Usage:
 * - Paste into your Builder integration file
 * - Configure in Builder Editor: Space Settings > Components
 * - Register only the components you want exposed to Builder
 */

import React from 'react';
import { Builder } from '@builder.io/react';
import Button from '../src/components/ui/button';
import Card from '../src/components/ui/card';
import { Tabs } from '../src/components/ui/tabs';
import TerminalView from '../src/components/views/TerminalView';

// ============================================================================
// 1. BUTTON COMPONENT
// ============================================================================

Builder.registerComponent(Button, {
  name: 'Button',
  displayName: 'Button',
  description: 'Interactive button with variants and sizes',
  inputs: [
    {
      name: 'variant',
      type: 'enum',
      enum: ['default', 'destructive', 'outline', 'ghost', 'secondary', 'link'],
      defaultValue: 'default',
      helperText: 'Button style variant'
    },
    {
      name: 'size',
      type: 'enum',
      enum: ['sm', 'default', 'lg', 'icon'],
      defaultValue: 'default',
      helperText: 'Button size'
    },
    {
      name: 'text',
      type: 'string',
      defaultValue: 'Click me',
      helperText: 'Button label text'
    },
    {
      name: 'disabled',
      type: 'boolean',
      defaultValue: false,
      helperText: 'Disable button interaction'
    },
    {
      name: 'asChild',
      type: 'boolean',
      defaultValue: false,
      helperText: 'Render as child element (for custom wrappers)'
    },
    {
      name: 'className',
      type: 'string',
      helperText: 'Additional Tailwind classes (e.g., "w-full")'
    }
  ],
  defaultStyles: {
    display: 'inline-flex'
  }
});

// ============================================================================
// 2. CARD COMPONENT
// ============================================================================

Builder.registerComponent(Card, {
  name: 'Card',
  displayName: 'Card',
  description: 'Container surface with header, title, and content slots',
  inputs: [
    {
      name: 'header',
      type: 'string',
      helperText: 'Card header text'
    },
    {
      name: 'subheader',
      type: 'string',
      helperText: 'Card subheader/description text'
    },
    {
      name: 'children',
      type: 'slot',
      helperText: 'Card content area'
    },
    {
      name: 'className',
      type: 'string',
      helperText: 'Override Tailwind classes'
    }
  ],
  defaultStyles: {
    display: 'block',
    padding: '24px'
  }
});

// ============================================================================
// 3. TABS COMPONENT
// ============================================================================

Builder.registerComponent(Tabs, {
  name: 'Tabs',
  displayName: 'Tabs',
  description: 'Tabbed interface with multiple content panes',
  inputs: [
    {
      name: 'value',
      type: 'string',
      defaultValue: 'tab-1',
      helperText: 'Currently active tab value'
    },
    {
      name: 'tabs',
      type: 'list',
      subFields: [
        {
          name: 'label',
          type: 'string',
          required: true,
          helperText: 'Tab label'
        },
        {
          name: 'value',
          type: 'string',
          required: true,
          helperText: 'Unique tab identifier'
        },
        {
          name: 'disabled',
          type: 'boolean',
          defaultValue: false,
          helperText: 'Disable this tab'
        }
      ],
      helperText: 'List of tab definitions'
    }
  ],
  defaultStyles: {
    display: 'block'
  }
});

// ============================================================================
// 4. METRIC TILE COMPONENT (Composition Stub)
// ============================================================================

interface MetricTileProps {
  label?: string;
  value?: string;
  unit?: string;
  trend?: 'up' | 'down' | 'flat';
  tone?: 'default' | 'success' | 'warning' | 'error' | 'info';
}

const MetricTileComponent: React.FC<MetricTileProps> = ({
  label = 'Metric',
  value = '0',
  unit = '',
  trend = 'flat',
  tone = 'default'
}) => {
  const toneColors: Record<string, string> = {
    success: 'text-green-600',
    warning: 'text-yellow-600',
    error: 'text-red-600',
    info: 'text-blue-600',
    default: 'text-muted-foreground'
  };

  const trendIcon: Record<string, string> = {
    up: '↑',
    down: '↓',
    flat: '→'
  };

  return (
    <div className="p-4 rounded-lg border bg-card">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="flex items-baseline gap-1 mt-2">
        <span className="text-2xl font-bold">{value}</span>
        <span className="text-xs text-muted-foreground">{unit}</span>
      </div>
      <div className={`text-xs mt-2 ${toneColors[tone]}`}>
        {trendIcon[trend]} Metric
      </div>
    </div>
  );
};

Builder.registerComponent(MetricTileComponent, {
  name: 'MetricTile',
  displayName: 'Metric Tile',
  description: 'Small data card showing a single metric with trend indicator',
  inputs: [
    {
      name: 'label',
      type: 'string',
      required: true,
      helperText: 'Metric label (e.g., "CPU Usage")'
    },
    {
      name: 'value',
      type: 'string',
      required: true,
      helperText: 'Numeric value (e.g., "42.5")'
    },
    {
      name: 'unit',
      type: 'string',
      defaultValue: '',
      helperText: 'Unit suffix (e.g., "%", "GB", "FPS")'
    },
    {
      name: 'trend',
      type: 'enum',
      enum: ['up', 'down', 'flat'],
      defaultValue: 'flat',
      helperText: 'Trend indicator'
    },
    {
      name: 'tone',
      type: 'enum',
      enum: ['default', 'success', 'warning', 'error', 'info'],
      defaultValue: 'default',
      helperText: 'Semantic color tone'
    }
  ],
  defaultStyles: {
    display: 'inline-block',
    minWidth: '150px'
  }
});

// ============================================================================
// 5. TERMINAL PANEL COMPONENT
// ============================================================================

Builder.registerComponent(TerminalView, {
  name: 'TerminalPanel',
  displayName: 'Terminal Panel',
  description: 'Interactive terminal emulator with command execution and history',
  inputs: [
    {
      name: 'initialCommand',
      type: 'string',
      defaultValue: '',
      helperText: 'Initial command to display in input (optional)'
    },
    {
      name: 'autoScroll',
      type: 'boolean',
      defaultValue: true,
      helperText: 'Auto-scroll output to bottom on new content'
    },
    {
      name: 'historyLimit',
      type: 'number',
      defaultValue: 1000,
      helperText: 'Max number of output lines to keep in memory'
    },
    {
      name: 'enableSyntaxHighlight',
      type: 'boolean',
      defaultValue: true,
      helperText: 'Enable ANSI color syntax highlighting'
    },
    {
      name: 'showHistoryDrawer',
      type: 'boolean',
      defaultValue: true,
      helperText: 'Show command history sidebar (desktop) or drawer (mobile)'
    },
    {
      name: 'theme',
      type: 'enum',
      enum: ['dark', 'light'],
      defaultValue: 'dark',
      helperText: 'Terminal color scheme'
    },
    {
      name: 'className',
      type: 'string',
      helperText: 'Override Tailwind classes for the terminal container'
    }
  ],
  defaultStyles: {
    display: 'block',
    height: '100%',
    fontFamily: 'JetBrains Mono, monospace'
  }
});

// ============================================================================
// EXPORTS
// ============================================================================

export const REGISTERED_COMPONENTS = [
  'Button',
  'Card',
  'Tabs',
  'MetricTile',
  'TerminalPanel'
];

export const BUILDER_CONFIG = {
  apiKey: process.env.REACT_APP_BUILDER_API_KEY || '',
  components: REGISTERED_COMPONENTS,
  modelNames: ['page', 'section']
};

/**
 * INTEGRATION CHECKLIST
 * 
 * 1. Set REACT_APP_BUILDER_API_KEY environment variable
 * 2. Import this file in your root component or app initialization
 * 3. Configure models in Builder Editor: Dashboard > Models > page, section
 * 4. Add custom CSS (from custom-code.css) to Builder Space: Settings > Custom Code
 * 5. Test component previews in Builder Editor
 * 6. Publish models and components to production
 * 
 * NOTES
 * -----
 * - These stubs wrap existing components; component logic is unchanged
 * - Do NOT pass Builder-specific props to components
 * - Use token variables in styles for consistency
 * - Test each component in Builder before publishing
 */
