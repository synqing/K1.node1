# Gantt Chart Component (T17)

Production-ready React component for visualizing task execution timelines with full interactivity and responsive design.

## Features

- **Task Visualization**: Display tasks as horizontal bars on a timeline
- **Status Color Coding**: Pending (gray), Running (blue), Completed (green), Failed (red)
- **Time Tracking**: Shows start time, end time, duration, and progress percentage
- **Task Dependencies**: Visual arrows connecting dependent tasks
- **Interactive Elements**:
  - Hover for tooltip details
  - Click for task callbacks
  - Zoom in/out (0.5x to 2x)
  - Pan support for horizontal scrolling
- **Responsive Design**: Adapts to desktop, tablet, and mobile layouts
- **Dark Mode**: Automatic detection and support
- **Accessibility**: Reduced motion, high contrast, keyboard navigation

## Installation & Usage

### Basic Usage

```typescript
import GanttChart from './components/GanttChart';

export function MyApp() {
  return (
    <GanttChart
      height={500}
      width="100%"
    />
  );
}
```

### With Schedule Filter

```typescript
<GanttChart
  scheduleId="my-schedule-id"
  apiUrl="/api/execution-history"
  refetchInterval={10000}
/>
```

### With Event Handlers

```typescript
<GanttChart
  onTaskClick={(task) => {
    console.log('Task clicked:', task);
  }}
  showDependencies={true}
  showGrid={true}
/>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `scheduleId` | `string \| undefined` | `undefined` | Filter tasks by schedule ID |
| `height` | `number` | `400` | Chart height in pixels |
| `width` | `string \| number` | `"100%"` | Chart width (CSS value or pixels) |
| `showGrid` | `boolean` | `true` | Display time grid lines |
| `showDependencies` | `boolean` | `true` | Display dependency arrows |
| `zoomLevel` | `number` | `1` | Initial zoom level (0.5-2) |
| `onTaskClick` | `(task: GanttTask) => void` | `undefined` | Callback when task bar clicked |
| `apiUrl` | `string` | `"/api/execution-history"` | API endpoint for execution data |
| `refetchInterval` | `number` | `5000` | Auto-refetch interval in milliseconds |

## Data Structure

### GanttTask

```typescript
interface GanttTask {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  status: "pending" | "running" | "completed" | "failed";
  progress?: number; // 0-100
  dependsOn?: string[]; // task IDs
  duration: number; // milliseconds
}
```

### GanttData

```typescript
interface GanttData {
  tasks: GanttTask[];
  timeline: {
    minTime: Date;
    maxTime: Date;
    totalDuration: number; // ms
  };
  groupedBySchedule: Record<string, GanttTask[]>;
}
```

## API Contract

The component expects the API endpoint to return an array of execution records:

### Request

```
GET /api/execution-history?scheduleId=optional-id
Accept: application/json
```

### Response

```json
[
  {
    "id": "exec-123",
    "taskId": "task-1",
    "taskName": "Deploy Service",
    "scheduleId": "schedule-1",
    "startTime": "2024-11-10T10:00:00Z",
    "endTime": "2024-11-10T10:05:30Z",
    "status": "completed",
    "progress": 100,
    "dependencies": ["task-0"]
  },
  {
    "id": "exec-124",
    "taskId": "task-2",
    "taskName": "Run Tests",
    "scheduleId": "schedule-1",
    "startTime": "2024-11-10T10:05:30Z",
    "endTime": "2024-11-10T10:10:00Z",
    "status": "running",
    "progress": 75
  }
]
```

## Hook: useGanttData

Low-level hook for fetching and managing Gantt data:

```typescript
import { useGanttData } from './hooks/useGanttData';

const {
  data,      // GanttData | null
  isLoading, // boolean
  error,     // Error | null
  refetch    // () => Promise<void>
} = useGanttData({
  scheduleId: "optional-id",
  apiUrl: "/api/execution-history",
  refetchInterval: 5000
});
```

## Styling

### CSS Classes

| Class | Purpose |
|-------|---------|
| `.gantt-container` | Main container |
| `.gantt-controls` | Control bar (zoom, refresh) |
| `.gantt-chart-wrapper` | SVG wrapper with scrolling |
| `.gantt-chart` | SVG element |
| `.gantt-task-bar` | Individual task bar |
| `.gantt-tooltip` | Hover tooltip |
| `.gantt-legend` | Status legend |
| `.gantt-loading` | Loading state |
| `.gantt-error` | Error state |
| `.gantt-empty` | Empty state |

### CSS Variables

```css
--color-surface: #ffffff;        /* Background */
--color-background: #f5f5f5;     /* Secondary background */
--color-text: #000000;            /* Text */
--color-text-secondary: #666666;  /* Secondary text */
--color-border: #e0e0e0;          /* Border */
--color-border-light: #f0f0f0;    /* Light border */
--color-primary: #1976d2;         /* Primary accent */
--color-primary-dark: #1565c0;    /* Dark primary */
--color-secondary: #ff9800;       /* Dependency color */
```

### Customizing Colors

```css
.gantt-container {
  --color-primary: #2196f3;
  --color-secondary: #ff5722;
}
```

## Examples

### Example 1: Integration with Dashboard

```typescript
import GanttChart from './components/GanttChart';
import { useState } from 'react';

export function ExecutionDashboard() {
  const [selectedTask, setSelectedTask] = useState<GanttTask | null>(null);

  return (
    <div>
      <GanttChart
        height={500}
        onTaskClick={setSelectedTask}
        refetchInterval={10000}
      />
      {selectedTask && (
        <div>
          <h3>{selectedTask.title}</h3>
          <p>Status: {selectedTask.status}</p>
          <p>Duration: {formatDuration(selectedTask.duration)}</p>
        </div>
      )}
    </div>
  );
}
```

### Example 2: Multiple Schedules

```typescript
export function SchedulesView() {
  const schedules = ['schedule-1', 'schedule-2', 'schedule-3'];

  return (
    <div>
      {schedules.map((scheduleId) => (
        <div key={scheduleId}>
          <h3>{scheduleId}</h3>
          <GanttChart
            scheduleId={scheduleId}
            height={300}
            showDependencies={false}
          />
        </div>
      ))}
    </div>
  );
}
```

### Example 3: Custom Styling

```typescript
export function CustomGanttChart() {
  return (
    <div style={{ '--color-primary': '#42a5f5' } as React.CSSProperties}>
      <GanttChart
        height={600}
        showGrid={true}
        zoomLevel={1.2}
      />
    </div>
  );
}
```

## Performance Considerations

- **Large Datasets**: Component uses SVG rendering which handles ~1000 tasks efficiently
- **Auto-Refresh**: Default 5-second interval can be adjusted or disabled (set `refetchInterval` to 0)
- **Zoom**: Zoom operations are computed in-memory, no API calls
- **Tooltips**: Positioned absolutely, not affecting render performance

## Testing

Run tests with:

```bash
npm test -- --include="**/*.test.tsx"
```

### Test Coverage

- Hook data transformation and API integration
- Component rendering and state management
- Interactive features (zoom, pan, tooltips)
- Error and loading states
- Responsive layout
- Dark mode support
- Accessibility features

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari 14+, Chrome Mobile 90+)

## Known Limitations

1. **SVG Rendering**: Very large datasets (>5000 tasks) may experience performance degradation
2. **Dependency Visualization**: Complex dependency graphs may become cluttered
3. **Touch Support**: Basic pan/zoom support; multi-touch not yet implemented
4. **Real-time Updates**: Relies on polling via `refetchInterval`

## Future Enhancements

- [ ] WebSocket support for real-time updates
- [ ] Drag-to-pan instead of scroll
- [ ] Task filtering and search
- [ ] Export to image/PDF
- [ ] Custom task bar rendering
- [ ] Gantt milestone markers
- [ ] Resource allocation view
- [ ] Baseline comparison view

## Troubleshooting

### Tooltip Not Appearing

Check browser console for errors. Verify API endpoint is returning valid data in the expected format.

### Tasks Not Rendering

Ensure `startTime` and `endTime` are valid ISO 8601 date strings or Date objects. Check API response format.

### Performance Issues

- Reduce chart height/width
- Disable dependency visualization (`showDependencies={false}`)
- Increase refetch interval
- Filter by schedule ID to reduce task count

## Related Files

- Component: `/webapp/src/components/GanttChart.tsx`
- Hook: `/webapp/src/hooks/useGanttData.ts`
- Styles: `/webapp/src/styles/gantt-chart.css`
- Tests: `/webapp/src/components/__tests__/GanttChart.test.tsx`

## Authors

Task T17: Frontend Engineer - Gantt Chart Component Implementation
