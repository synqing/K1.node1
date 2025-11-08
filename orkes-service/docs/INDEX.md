# Orkes Service Documentation Index

## Quick Links

### Getting Started
- **[README](../README.md)** - Service overview, setup, API reference
- **[Integration Guide](./guides/INTEGRATION_GUIDE.md)** - How to integrate Orkes into K1.node1

### Architecture & Design
- **[Deep Dive](./guides/DEEP_DIVE.md)** - Comprehensive architecture explanation, features, patterns
- **[Architecture](./architecture/)** - System design documents

### Workflows & Workers
- **[Pattern Compilation](./guides/PATTERN_COMPILATION.md)** - Pattern compilation workflow implementation
- **[API Reference](./api-reference/)** - REST API documentation

## Directory Structure

```
docs/
├── INDEX.md                    # This file
├── guides/
│   ├── INTEGRATION_GUIDE.md   # Integration instructions
│   ├── DEEP_DIVE.md           # Architecture & design patterns
│   └── PATTERN_COMPILATION.md # Pattern compilation workflow
├── architecture/              # System design & diagrams
└── api-reference/             # API specification & examples
```

## Quick Start

1. Read [README](../README.md) for setup and basic usage
2. Check [Integration Guide](./guides/INTEGRATION_GUIDE.md) to understand architecture
3. Review [Deep Dive](./guides/DEEP_DIVE.md) for implementation patterns
4. Refer to [Pattern Compilation](./guides/PATTERN_COMPILATION.md) for workflow details

## Current Status

- ✅ Service setup with Orkes SDK
- ✅ REST API endpoints
- ✅ Pattern compilation workflow definition
- ✅ Pattern compilation task workers (5 workers, 20 tests passing)
- ✅ CI/CD workflow definition
- ⬜ CI/CD task workers
- ⬜ Asset processing workflow
- ⬜ Analytics workflow
- ⬜ Webapp integration
- ⬜ Production deployment

## Key Documents

| Document | Purpose | Status |
|----------|---------|--------|
| README.md | Service overview & API | ✅ Complete |
| INTEGRATION_GUIDE.md | Integration instructions | ✅ Complete |
| DEEP_DIVE.md | Architecture details | ✅ Complete |
| PATTERN_COMPILATION.md | Workflow implementation | ✅ Complete |

## API Endpoints

- `GET /health` - Health check
- `GET /api/status` - Orkes connection status
- `POST /api/workflows/execute` - Execute a workflow
- `GET /api/workflows/:workflowId` - Get workflow status
- `DELETE /api/workflows/:workflowId` - Terminate workflow
- `POST /api/workflows/:workflowId/pause` - Pause workflow
- `POST /api/workflows/:workflowId/resume` - Resume workflow
- `POST /api/workflows/:workflowId/retry` - Retry failed workflow

## Workflows

### Pattern Compilation (`k1_pattern_compilation`)
Compile LED patterns, test performance, benchmark results.
[Details](./guides/PATTERN_COMPILATION.md)

### CI/CD Pipeline (`k1_cicd_pipeline`)
Build, test, and deploy firmware and webapp.
[Details](./guides/INTEGRATION_GUIDE.md)

### Asset Processing (Coming Soon)
Audio conversion, preset generation, optimization.

### Analytics Pipeline (Coming Soon)
Telemetry collection and reporting.

## Development

### Adding a New Workflow

1. Create workflow definition in `src/workflows/`
2. Define TypeScript types in `src/types/workflows.ts`
3. Implement task workers in `src/workers/`
4. Add tests in `src/workers/__tests__/`
5. Document in `docs/guides/`

### Running Tests

```bash
npm test                    # Run all tests
npm test -- --watch       # Watch mode
npm test -- pattern-compiler  # Specific test file
```

### Development Server

```bash
npm run dev    # Start with auto-reload
npm run build  # TypeScript compilation
npm start      # Run compiled version
```

## Resources

- [Orkes Documentation](https://orkes.io/content/)
- [JavaScript SDK](https://orkes.io/content/sdks/javascript)
- [Conductor OSS](https://github.com/conductor-oss/conductor)
- [SDK Examples](https://github.com/conductor-sdk/conductor-javascript)

## Support

For issues:
1. Check the relevant guide
2. Review service logs: `npm run dev`
3. Check Orkes Cloud UI for workflow logs
4. Review test failures: `npm test`
