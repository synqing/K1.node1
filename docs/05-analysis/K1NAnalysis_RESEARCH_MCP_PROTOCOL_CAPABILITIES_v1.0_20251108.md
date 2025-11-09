<!-- markdownlint-disable MD013 MD024 MD033 -->

# MCP Protocol Capabilities Research

**Title:** Model Context Protocol (MCP) Research for Phase 4 Conductor Integration
**Owner:** Claude Code Agent
**Date:** 2025-11-08
**Status:** Complete
**Scope:** Comprehensive research on MCP specification, capabilities, tool design, and best practices
**Related:** `K1NAnalysis_ANALYSIS_CONDUCTOR_INTEGRATION_TECHNICAL_v1.0_20251108.md`, Phase 4 planning
**Tags:** MCP, protocol, research, tools, resources, conductor, integration

---

## Executive Summary

This document provides comprehensive research on the Model Context Protocol (MCP) to support Phase 4 planning for Conductor task management integration. MCP is an open standard announced by Anthropic in November 2024 that enables seamless integration between LLM applications and external data sources and tools.

**Key Findings:**

- **Current Version:** 2024-11-05 (specification uses YYYY-MM-DD format)
- **Protocol Base:** JSON-RPC 2.0
- **Transport Mechanisms:** stdio, HTTP, Server-Sent Events (SSE)
- **Core Capabilities:** Tools, Resources, Prompts, Sampling, Roots, Elicitation
- **Official SDKs:** TypeScript, Python, C#, Kotlin
- **Resource Limits:** 1MB per resource/response, context window constraints on tool calls
- **Adoption:** OpenAI, Google DeepMind, Microsoft, JetBrains

**Recommended for Conductor:**

- Expose task management as MCP tools with strict JSON Schema validation
- Implement resource endpoints for workflow definitions and task state
- Use TypeScript SDK for consistency with existing tooling
- Follow error handling best practices with proper JSON-RPC error codes
- Implement timeout and cancellation mechanisms
- Support both stdio (local) and HTTP/SSE (remote) transports

---

## 1. MCP Protocol Specification

### 1.1 Protocol Version and Core Architecture

**Current Version:** `2024-11-05`

**Version Format:** YYYY-MM-DD (date-based versioning)

**Protocol Foundation:**
- All messages between MCP clients and servers MUST follow JSON-RPC 2.0 specification
- Transport-agnostic design supporting stdio, HTTP, and Server-Sent Events
- Capability-based negotiation system for feature support
- Stateful sessions with unique session IDs per transport

**Official Specification:**
- Primary: `https://modelcontextprotocol.io/specification/2025-06-18/`
- Schema: TypeScript definitions in `schema.ts` (authoritative)
- JSON Schema: Available for wider compatibility

### 1.2 Core Concepts

MCP provides six core features:

#### **1. Tools**
- Executable functions that perform actions or computations
- Exposed to clients as callable operations
- Examples: database queries, file operations, API calls, workflow triggers
- **Best for:** Actions that modify state or perform computations

#### **2. Resources**
- Data entities exposed by the server
- Can be static (configuration, documentation) or dynamic (database records, user profiles)
- Ideal for static or semi-static information
- **Best for:** Providing context without unnecessary operations

#### **3. Prompts**
- Predefined instruction templates with variables
- Standardize common tasks across teams
- Can be versioned and updated centrally
- **Best for:** Consistent task guidance and best practices

#### **4. Sampling**
- Enables MCP servers to request LLM completions from clients
- Allows nested LLM calls inside other MCP features
- Supports agentic behaviors and decision-making
- **Best for:** AI-driven analysis and workflow decisions

#### **5. Roots**
- Define base paths or entry points for resources
- Establish context boundaries
- Support hierarchical organization

#### **6. Elicitation**
- Mechanism for gathering additional information from users
- Enables interactive workflows
- Supports multi-turn interactions

---

## 2. MCP Lifecycle and Capability Negotiation

### 2.1 Three-Phase Lifecycle

#### **Phase 1: Initialization**
Capability negotiation and protocol version agreement.

**Client sends `initialize` request:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "roots": { "listChanged": true },
      "sampling": {},
      "elicitation": {}
    },
    "clientInfo": {
      "name": "ExampleClient",
      "version": "1.0.0"
    }
  }
}
```

**Server responds:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "prompts": { "listChanged": true },
      "resources": { "subscribe": true, "listChanged": true },
      "tools": { "listChanged": true },
      "logging": {}
    },
    "serverInfo": {
      "name": "ExampleServer",
      "version": "1.0.0"
    }
  }
}
```

**Client sends `initialized` notification:**
```json
{
  "jsonrpc": "2.0",
  "method": "notifications/initialized"
}
```

**Critical Rule:** The client SHOULD NOT send requests other than pings before the server has responded to the initialize request.

#### **Phase 2: Operation**
Normal protocol communication with negotiated capabilities.

#### **Phase 3: Shutdown**
Graceful termination of the connection.

### 2.2 Version Negotiation

1. Client sends supported protocol version
2. Server responds with same version if supported, or alternative version
3. If client doesn't support server's version, client SHOULD disconnect
4. For HTTP transports, clients must include `MCP-Protocol-Version` header on all subsequent requests

### 2.3 Capability Exchange

**Client Capabilities:**
- `roots`: Support for workspace roots
  - `listChanged`: Notification support for root changes
- `sampling`: LLM sampling requests
- `elicitation`: User input gathering

**Server Capabilities:**
- `prompts`: Template support
  - `listChanged`: Notification support for prompt changes
- `resources`: Data entity exposure
  - `subscribe`: Individual resource subscriptions
  - `listChanged`: Notification support for resource list changes
- `tools`: Callable functions
  - `listChanged`: Notification support for tool changes
- `logging`: Server logging capabilities

**Important:** Both parties must respect negotiated protocol versions and use only agreed-upon capabilities during operation.

---

## 3. Tool Definition Schema

### 3.1 Tool Structure

Tools are the primary mechanism for exposing actions to LLM clients.

**Core Components:**
- `name`: Unique identifier (required)
- `title`: Human-readable display name (optional)
- `description`: Functionality overview (required)
- `inputSchema`: JSON Schema specifying parameters (required)
- `outputSchema`: Optional schema for response validation
- `annotations`: Metadata describing tool behavior

### 3.2 Input Schema Definition

Tools use JSON Schema to define expected parameters.

**Example: Simple Tool**
```json
{
  "name": "get_weather",
  "description": "Get current weather for a location",
  "inputSchema": {
    "type": "object",
    "properties": {
      "location": {
        "type": "string",
        "description": "City name or zip code"
      },
      "units": {
        "type": "string",
        "enum": ["celsius", "fahrenheit"],
        "description": "Temperature units",
        "default": "celsius"
      }
    },
    "required": ["location"]
  }
}
```

**Example: Complex Tool for Task Management**
```json
{
  "name": "create_task",
  "description": "Create a new task in the workflow system",
  "inputSchema": {
    "type": "object",
    "properties": {
      "title": {
        "type": "string",
        "description": "Task title",
        "minLength": 1,
        "maxLength": 200
      },
      "description": {
        "type": "string",
        "description": "Detailed task description"
      },
      "priority": {
        "type": "string",
        "enum": ["low", "medium", "high", "critical"],
        "default": "medium"
      },
      "tags": {
        "type": "array",
        "items": {
          "type": "string"
        },
        "description": "Task tags for categorization"
      },
      "dueDate": {
        "type": "string",
        "format": "date-time",
        "description": "ISO 8601 due date"
      },
      "assignee": {
        "type": "string",
        "description": "User ID of assignee"
      },
      "dependencies": {
        "type": "array",
        "items": {
          "type": "string"
        },
        "description": "Array of task IDs this task depends on"
      }
    },
    "required": ["title"]
  }
}
```

**Example: Workflow Execution Tool**
```json
{
  "name": "execute_workflow",
  "description": "Execute a workflow with the given parameters",
  "inputSchema": {
    "type": "object",
    "properties": {
      "workflowId": {
        "type": "string",
        "description": "Unique workflow identifier"
      },
      "parameters": {
        "type": "object",
        "description": "Workflow-specific parameters",
        "additionalProperties": true
      },
      "mode": {
        "type": "string",
        "enum": ["dry-run", "execute"],
        "default": "execute"
      },
      "timeout": {
        "type": "integer",
        "minimum": 1,
        "maximum": 3600,
        "description": "Execution timeout in seconds"
      }
    },
    "required": ["workflowId"]
  }
}
```

**Example: Search/Query Tool**
```json
{
  "name": "search_tasks",
  "description": "Search and filter tasks by criteria",
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Text search query"
      },
      "filters": {
        "type": "object",
        "properties": {
          "status": {
            "type": "array",
            "items": {
              "type": "string",
              "enum": ["pending", "in_progress", "completed", "blocked"]
            }
          },
          "priority": {
            "type": "array",
            "items": {
              "type": "string",
              "enum": ["low", "medium", "high", "critical"]
            }
          },
          "tags": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "assignee": {
            "type": "string"
          },
          "dateRange": {
            "type": "object",
            "properties": {
              "start": {
                "type": "string",
                "format": "date-time"
              },
              "end": {
                "type": "string",
                "format": "date-time"
              }
            }
          }
        }
      },
      "sort": {
        "type": "object",
        "properties": {
          "field": {
            "type": "string",
            "enum": ["created", "updated", "priority", "dueDate"]
          },
          "order": {
            "type": "string",
            "enum": ["asc", "desc"]
          }
        }
      },
      "limit": {
        "type": "integer",
        "minimum": 1,
        "maximum": 100,
        "default": 20
      }
    }
  }
}
```

**Example: Batch Operation Tool**
```json
{
  "name": "batch_update_tasks",
  "description": "Update multiple tasks in a single operation",
  "inputSchema": {
    "type": "object",
    "properties": {
      "taskIds": {
        "type": "array",
        "items": {
          "type": "string"
        },
        "minItems": 1,
        "maxItems": 50
      },
      "updates": {
        "type": "object",
        "properties": {
          "status": {
            "type": "string",
            "enum": ["pending", "in_progress", "completed", "blocked"]
          },
          "priority": {
            "type": "string",
            "enum": ["low", "medium", "high", "critical"]
          },
          "assignee": {
            "type": "string"
          },
          "addTags": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "removeTags": {
            "type": "array",
            "items": {
              "type": "string"
            }
          }
        },
        "minProperties": 1
      }
    },
    "required": ["taskIds", "updates"]
  }
}
```

### 3.3 JSON Schema Validation Features

**Supported Types:**
- `string`, `number`, `integer`, `boolean`, `object`, `array`, `null`

**Validation Keywords:**
- **Numeric:** `minimum`, `maximum`, `multipleOf`
- **String:** `minLength`, `maxLength`, `pattern`, `format`
- **Array:** `minItems`, `maxItems`, `uniqueItems`
- **Object:** `properties`, `required`, `additionalProperties`, `minProperties`, `maxProperties`
- **Generic:** `enum`, `const`, `default`

**Format Strings:**
- `date-time`, `date`, `time`, `email`, `uri`, `uuid`, `regex`

**Best Practices:**
1. Always specify `type` for all properties
2. Use `description` fields extensively (LLMs read these)
3. Set appropriate bounds (`minLength`, `maxLength`, `minimum`, `maximum`)
4. Use `enum` for constrained value sets
5. Mark truly required fields in `required` array
6. Provide sensible `default` values when applicable
7. Use `additionalProperties: false` to prevent unexpected fields

---

## 4. Input Validation and Error Handling

### 4.1 Input Validation Process

**Three-Layer Validation:**

1. **Schema Validation (Server)**
   - Server validates incoming JSON payload against tool's `inputSchema`
   - Uses JSON Schema validation library
   - Rejects request if validation fails

2. **Type Coercion (Optional)**
   - FastMCP (Python) uses Pydantic's flexible validation by default
   - Coerces compatible inputs (e.g., string "42" → integer 42)
   - Can enable strict mode to disable coercion

3. **Business Logic Validation (Tool Implementation)**
   - Additional validation beyond schema constraints
   - Cross-field validation
   - External dependency checks (e.g., does user exist?)

**Validation Flow:**
```
Client Request → JSON-RPC Validation → Schema Validation → Tool Handler → Business Logic
     ↓ invalid         ↓ invalid           ↓ invalid          ↓ runtime error
Protocol Error    Protocol Error      Protocol Error       Tool Error (isError: true)
```

### 4.2 Error Handling Patterns

**Three Error Categories:**

#### **1. Transport-Level Errors**
- Network timeouts, broken pipes, authentication failures
- Handled by transport layer (stdio, HTTP, SSE)
- Not visible to tool implementations

#### **2. Protocol-Level Errors**
- JSON-RPC 2.0 violations
- Malformed JSON, unknown methods, invalid parameters
- Returned as JSON-RPC errors

**Standard JSON-RPC Error Codes:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32600,
    "message": "Invalid Request",
    "data": {
      "details": "Missing required field: location"
    }
  }
}
```

**JSON-RPC 2.0 Error Codes:**
- `-32700`: Parse error (invalid JSON)
- `-32600`: Invalid Request
- `-32601`: Method not found
- `-32602`: Invalid params
- `-32603`: Internal error
- `-32000 to -32099`: Server-defined errors

#### **3. Application-Level Errors**
- Business logic failures
- External API errors
- Resource not found
- Permission denied

**Tool Error Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Task not found: TASK-123"
      }
    ],
    "isError": true
  }
}
```

**Key Point:** Application errors use the `isError: true` flag in the result, allowing LLMs to understand and potentially recover from failures.

### 4.3 Error Handling Best Practices

1. **Catch Specific Exceptions First**
   ```typescript
   try {
     // tool logic
   } catch (error) {
     if (error instanceof TaskNotFoundError) {
       return { content: [{ type: "text", text: error.message }], isError: true };
     }
     if (error instanceof ValidationError) {
       return { content: [{ type: "text", text: error.message }], isError: true };
     }
     throw error; // Let framework handle unexpected errors
   }
   ```

2. **Log Full Details Internally**
   - Log to stderr (NEVER stdout for MCP servers)
   - Include stack traces, context, timestamps
   - Use structured logging

3. **Sanitize User-Facing Messages**
   - Don't leak system information
   - Provide actionable feedback
   - Use standardized error codes

4. **Implement Timeout Handling**
   ```typescript
   const timeoutMs = 30000;
   const result = await Promise.race([
     executeWorkflow(params),
     new Promise((_, reject) =>
       setTimeout(() => reject(new Error("Workflow execution timeout")), timeoutMs)
     )
   ]);
   ```

5. **Graceful Degradation**
   - Return partial results when possible
   - Indicate what succeeded vs. failed
   - Provide recovery suggestions

---

## 5. Tool Return Value Formats

### 5.1 Content Types

Tools can return multiple content types:

#### **Text Content**
```json
{
  "content": [
    {
      "type": "text",
      "text": "Task TASK-123 created successfully"
    }
  ]
}
```

#### **Image Content**
```json
{
  "content": [
    {
      "type": "image",
      "data": "base64-encoded-image-data",
      "mimeType": "image/png"
    }
  ]
}
```

#### **Audio Content**
```json
{
  "content": [
    {
      "type": "audio",
      "data": "base64-encoded-audio-data",
      "mimeType": "audio/wav"
    }
  ]
}
```

#### **Resource Links**
```json
{
  "content": [
    {
      "type": "resource",
      "resource": {
        "uri": "task://TASK-123",
        "name": "Task Details",
        "mimeType": "application/json"
      }
    }
  ]
}
```

#### **Embedded Resources**
```json
{
  "content": [
    {
      "type": "resource",
      "resource": {
        "uri": "task://TASK-123",
        "name": "Task Details",
        "mimeType": "application/json",
        "text": "{\"id\": \"TASK-123\", \"title\": \"Implement feature X\"}"
      }
    }
  ]
}
```

#### **Structured Content**
```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"taskId\": \"TASK-123\", \"status\": \"created\", \"url\": \"https://tasks.example.com/TASK-123\"}"
    }
  ]
}
```

### 5.2 Multi-Content Responses

Tools can return multiple content items:

```json
{
  "content": [
    {
      "type": "text",
      "text": "# Workflow Execution Report\n\nWorkflow completed successfully."
    },
    {
      "type": "image",
      "data": "base64-execution-graph",
      "mimeType": "image/png"
    },
    {
      "type": "resource",
      "resource": {
        "uri": "workflow://exec-456/logs",
        "name": "Execution Logs"
      }
    }
  ]
}
```

### 5.3 Tool Response Metadata

**Optional Metadata:**
- `isError`: Boolean indicating tool execution failure
- Tool-specific metadata (custom fields)

**Example with Metadata:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "Found 42 matching tasks"
    }
  ],
  "_meta": {
    "executionTime": "127ms",
    "cacheHit": false,
    "queryComplexity": "medium"
  }
}
```

---

## 6. MCP Sampling (Streaming Responses)

### 6.1 Sampling Overview

**Sampling** enables MCP servers to request LLM completions from clients. This allows servers to implement agentic behaviors by nesting LLM calls inside other MCP features.

**Use Cases:**
- Analyze data from resources before responding
- Decide which tool to call based on context
- Generate summaries or insights
- Validate or transform user inputs
- Implement multi-step reasoning workflows

### 6.2 Sampling Workflow

1. Server exposes a tool or resource
2. During execution, server requests sampling from client
3. Client sends request to LLM with provided context
4. LLM generates response
5. Server receives response and continues execution
6. Server returns final result to client

**Example: Task Analysis with Sampling**
```typescript
// Server requests sampling during tool execution
const analysisPrompt = `Analyze the following task list and identify:
1. High-priority tasks
2. Potential blockers
3. Recommended next steps

Tasks:
${JSON.stringify(tasks, null, 2)}`;

const samplingRequest = {
  messages: [
    { role: "user", content: analysisPrompt }
  ],
  maxTokens: 500
};

// Client performs sampling and returns result
const analysis = await client.sample(samplingRequest);

// Server uses analysis in response
return {
  content: [
    { type: "text", text: analysis.content }
  ]
};
```

### 6.3 Sampling Best Practices

1. **Combine with Other Features**
   - Read resources → sample to analyze → return insights
   - Sample to decide tool parameters → call tool → return results

2. **Provide Clear Context**
   - Include relevant data in sampling request
   - Structure prompts for clear LLM understanding

3. **Handle Sampling Errors**
   - Sampling may fail (rate limits, model unavailable)
   - Provide fallback behavior

4. **Respect Token Limits**
   - Set appropriate `maxTokens`
   - Truncate large contexts if needed

---

## 7. State Management Across MCP Calls

### 7.1 Session Management

**Session Lifecycle:**
- Each transport connection establishes a unique session
- Session persists across multiple requests
- Sessions track conversation context
- Sessions end when connection closes

**Session ID Requirements:**
- Must be unique per transport connection
- Must be unique across different transport types
- Server manages session state internally

### 7.2 State Patterns

#### **Stateless Tools**
- Most tools should be stateless
- All required context in input parameters
- No server-side state between calls
- Easier to test, scale, and debug

**Example:**
```typescript
// Stateless: All context in parameters
async function createTask(params: { title: string; description: string }) {
  return await db.tasks.create(params);
}
```

#### **Stateful Tools**
- Use only when truly necessary
- Store state in session context
- Document state dependencies clearly

**Example:**
```typescript
// Stateful: Maintains conversation context
class WorkflowSession {
  private currentStep: number = 0;
  private workflowId: string;

  async nextStep(params: { input: any }) {
    // Use currentStep state
    const result = await executeStep(this.workflowId, this.currentStep, params.input);
    this.currentStep++;
    return result;
  }
}
```

### 7.3 State Management Best Practices

1. **Prefer Stateless Design**
   - Pass all context explicitly
   - Use resource IDs for references
   - Avoid hidden dependencies

2. **Document State Requirements**
   - Clear documentation of stateful operations
   - Explicit session lifecycle management
   - State reset procedures

3. **Implement State Cleanup**
   - Clean up on session close
   - Implement timeout-based cleanup
   - Handle connection drops gracefully

4. **Use Resources for Persistent State**
   - Store durable state in resources
   - Tools operate on resource state
   - Resources survive session boundaries

---

## 8. Resource Limits and Constraints

### 8.1 Hard Limits

**MCP Resource Limits:**
- **Resource Size:** 1MB per resource maximum
- **Response Size:** 1MB per tool response maximum
- **Tool Call Arguments:** Constrained by context window

**Context Window Constraints:**
- Tool calls consume context tokens
- Large input schemas reduce available space
- Balance between detailed schemas and token usage

### 8.2 Performance Constraints

**CPU Management:**
- Tools should complete quickly (< 30s typical)
- Long-running operations need timeout handling
- CPU throttling impacts tool responsiveness

**Memory Management:**
- Memory allocation is sticky (rarely released)
- Right-size by measuring working set, not peak
- Avoid memory leaks in long-running servers

**Concurrent Requests:**
- Respect downstream service limits
- Implement rate limiting if needed
- Use weighted scoring for complex vs. simple operations

### 8.3 Optimization Strategies

#### **1. Pagination**
```json
{
  "name": "list_tasks",
  "inputSchema": {
    "type": "object",
    "properties": {
      "page": {
        "type": "integer",
        "minimum": 1,
        "default": 1
      },
      "pageSize": {
        "type": "integer",
        "minimum": 1,
        "maximum": 100,
        "default": 20
      }
    }
  }
}
```

#### **2. Caching**
- Cache frequently accessed data
- Use Redis, Memcached, or in-memory caches
- Respect cache invalidation rules
- Include cache metadata in responses

#### **3. Streaming (for large responses)**
- Break large responses into chunks
- Use resource links instead of inline content
- Implement progress indicators

#### **4. Horizontal Scaling**
- Add more server instances
- Use load balancers
- Stateless design enables easy scaling

#### **5. Request Prioritization**
- Prioritize time-sensitive operations
- Implement queue systems for batch operations
- Use separate worker pools for heavy tasks

### 8.4 Timeout and Cancellation

**Timeout Best Practices:**
- Establish timeouts for all tool operations
- Typical timeout: 30 seconds for interactive tools
- Longer timeouts for batch operations (up to 5 minutes)

**Cancellation Support:**
```typescript
// MCP cancellation notification
{
  "jsonrpc": "2.0",
  "method": "notifications/cancelled",
  "params": {
    "requestId": "abc123"
  }
}
```

**Implementation Pattern:**
```typescript
async function executeWithTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  requestId: string
): Promise<T> {
  let timeoutHandle: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(`Operation timeout after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([operation, timeoutPromise]);
    clearTimeout(timeoutHandle);
    return result;
  } catch (error) {
    // Cleanup on timeout or error
    await cleanupOperation(requestId);
    throw error;
  }
}
```

---

## 9. Best Practices for Tool Design

### 9.1 Naming Conventions

**Tool Names:**
- Use clear, purposeful names
- Follow `verb_noun` pattern (e.g., `create_task`, `search_workflows`)
- Avoid ambiguous abbreviations
- Be consistent across related tools

**Good Examples:**
- `create_task`, `update_task`, `delete_task`, `get_task`
- `search_tasks`, `list_tasks`, `filter_tasks`
- `execute_workflow`, `pause_workflow`, `resume_workflow`

**Bad Examples:**
- `task` (missing verb)
- `crt_tsk` (unclear abbreviation)
- `doSomething` (vague)
- `task_create` (noun before verb)

### 9.2 Description Quality

**Tool Description Guidelines:**
1. Start with verb describing the action
2. Include what it operates on
3. Mention key constraints or requirements
4. Keep under 200 characters

**Good Example:**
```json
{
  "name": "execute_workflow",
  "description": "Execute a workflow by ID with specified parameters. Requires active workflow state and valid parameter schema. Returns execution ID and initial status."
}
```

**Bad Example:**
```json
{
  "name": "execute_workflow",
  "description": "Executes workflows"
}
```

### 9.3 Input Schema Design

**Guidelines:**
1. **Validate All Inputs:** Never assume client sends valid data
2. **Provide Defaults:** Make optional parameters truly optional
3. **Use Enums:** Constrain values where possible
4. **Add Descriptions:** Every property should have a clear description
5. **Set Bounds:** Use `minLength`, `maxLength`, `minimum`, `maximum`
6. **Structure Clearly:** Group related properties in nested objects
7. **Document Examples:** Include example values in descriptions

**Example: Well-Designed Schema**
```json
{
  "name": "create_scheduled_task",
  "description": "Create a task with scheduled execution time and recurrence pattern",
  "inputSchema": {
    "type": "object",
    "properties": {
      "task": {
        "type": "object",
        "description": "Core task details",
        "properties": {
          "title": {
            "type": "string",
            "description": "Task title (e.g., 'Weekly backup')",
            "minLength": 1,
            "maxLength": 200
          },
          "description": {
            "type": "string",
            "description": "Detailed task description"
          }
        },
        "required": ["title"]
      },
      "schedule": {
        "type": "object",
        "description": "Scheduling configuration",
        "properties": {
          "startTime": {
            "type": "string",
            "format": "date-time",
            "description": "ISO 8601 start time (e.g., '2025-11-08T10:00:00Z')"
          },
          "recurrence": {
            "type": "string",
            "enum": ["once", "daily", "weekly", "monthly"],
            "default": "once",
            "description": "Recurrence pattern"
          },
          "timezone": {
            "type": "string",
            "description": "IANA timezone (e.g., 'America/New_York')",
            "default": "UTC"
          }
        },
        "required": ["startTime"]
      }
    },
    "required": ["task", "schedule"]
  }
}
```

### 9.4 Error Handling Design

**Guidelines:**
1. Return descriptive error messages
2. Include error codes for programmatic handling
3. Provide suggestions for fixing errors
4. Log detailed errors to stderr
5. Never expose sensitive information

**Example: Error Response Pattern**
```typescript
interface ToolError {
  content: [
    {
      type: "text",
      text: string; // User-facing message
    }
  ];
  isError: true;
  _meta?: {
    errorCode: string;
    errorType: string;
    suggestion?: string;
  };
}

// Usage
return {
  content: [
    {
      type: "text",
      text: "Task creation failed: Invalid assignee ID 'user-999'"
    }
  ],
  isError: true,
  _meta: {
    errorCode: "INVALID_ASSIGNEE",
    errorType: "ValidationError",
    suggestion: "Use GET /api/users to list valid assignee IDs"
  }
};
```

### 9.5 Testing Best Practices

**Test Categories:**
1. **Schema Validation Tests:** Verify schema constraints (type safety, bounds, required fields)
2. **Contract Tests:** Validate example payloads against schema
3. **Integration Tests:** Test against live dependencies
4. **Error Handling Tests:** Test error paths and edge cases
5. **Performance Tests:** Verify timeout and resource usage

**CI/CD Integration:**
- Add schema validation to pipelines
- Run contract tests on schema changes
- Prevent breaking changes from reaching production

**Example Test Structure:**
```typescript
describe('create_task tool', () => {
  test('validates required fields', async () => {
    const result = await callTool('create_task', {});
    expect(result.error.code).toBe(-32602); // Invalid params
  });

  test('creates task with valid input', async () => {
    const result = await callTool('create_task', {
      title: 'Test task',
      priority: 'high'
    });
    expect(result.content[0].text).toContain('created successfully');
  });

  test('handles duplicate task titles', async () => {
    await callTool('create_task', { title: 'Duplicate' });
    const result = await callTool('create_task', { title: 'Duplicate' });
    expect(result.isError).toBe(true);
  });

  test('respects timeout', async () => {
    const start = Date.now();
    const result = await callTool('long_running_task', { timeout: 5000 });
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(6000);
  });
});
```

---

## 10. Implementation Patterns

### 10.1 TypeScript Implementation

**Official SDK:**
- Package: `@modelcontextprotocol/sdk`
- GitHub: `github.com/modelcontextprotocol/typescript-sdk`

**Basic Server Structure:**
```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new Server(
  {
    name: "conductor-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// Register a tool
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "create_task",
      description: "Create a new task",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string" },
          priority: { type: "string", enum: ["low", "medium", "high"] }
        },
        required: ["title"]
      }
    }
  ]
}));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "create_task") {
    try {
      const task = await createTask(args);
      return {
        content: [
          { type: "text", text: `Task created: ${task.id}` }
        ]
      };
    } catch (error) {
      return {
        content: [
          { type: "text", text: `Error: ${error.message}` }
        ],
        isError: true
      };
    }
  }

  throw new Error(`Unknown tool: ${name}`);
});

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
```

**Using `registerTool` (Recommended):**
```typescript
server.registerTool(
  "create_task",
  {
    title: "Create Task",
    description: "Create a new task in the system",
    schema: z.object({
      title: z.string().min(1).max(200),
      description: z.string().optional(),
      priority: z.enum(["low", "medium", "high"]).default("medium"),
    })
  },
  async (args) => {
    const task = await createTask(args);
    return {
      content: [
        { type: "text", text: JSON.stringify(task, null, 2) }
      ]
    };
  }
);
```

### 10.2 Python Implementation

**Official SDK:**
- Package: `mcp`
- PyPI: `pypi.org/project/mcp/`

**FastMCP Framework:**
- Package: `fastmcp`
- PyPI: `pypi.org/project/fastmcp/`
- GitHub: `github.com/jlowin/fastmcp`

**Basic FastMCP Server:**
```python
from fastmcp import FastMCP

mcp = FastMCP("Conductor MCP Server")

@mcp.tool()
def create_task(title: str, priority: str = "medium") -> dict:
    """Create a new task in the system.

    Args:
        title: Task title (required)
        priority: Task priority (low, medium, high)

    Returns:
        Created task details
    """
    # Validate priority
    if priority not in ["low", "medium", "high"]:
        raise ValueError(f"Invalid priority: {priority}")

    # Create task (example)
    task = {
        "id": generate_task_id(),
        "title": title,
        "priority": priority,
        "status": "pending",
        "created": datetime.now().isoformat()
    }

    return task

@mcp.resource("task://{task_id}")
def get_task(task_id: str) -> str:
    """Get task details by ID."""
    task = db.get_task(task_id)
    return json.dumps(task, indent=2)

# Run server
if __name__ == "__main__":
    mcp.run()
```

**Advanced: Custom Validation:**
```python
from fastmcp import FastMCP
from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import datetime

mcp = FastMCP("Conductor MCP Server")

class TaskInput(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    priority: str = Field(default="medium")
    tags: List[str] = Field(default_factory=list)
    due_date: Optional[datetime] = None

    @validator('priority')
    def validate_priority(cls, v):
        if v not in ["low", "medium", "high", "critical"]:
            raise ValueError(f"Invalid priority: {v}")
        return v

    @validator('tags')
    def validate_tags(cls, v):
        if len(v) > 10:
            raise ValueError("Maximum 10 tags allowed")
        return v

@mcp.tool()
def create_task(task: TaskInput) -> dict:
    """Create a new task with full validation."""
    # Business logic here
    created_task = conductor.create_task(
        title=task.title,
        description=task.description,
        priority=task.priority,
        tags=task.tags,
        due_date=task.due_date
    )
    return created_task.dict()
```

### 10.3 Transport Options

**stdio (Local):**
```typescript
// TypeScript
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
const transport = new StdioServerTransport();
await server.connect(transport);
```

```python
# Python (FastMCP default)
mcp.run()  # Uses stdio by default
```

**SSE (Server-Sent Events):**
```typescript
// TypeScript
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
const transport = new SSEServerTransport("/mcp", response);
await server.connect(transport);
```

```python
# Python (FastMCP)
mcp.run(transport="sse", port=6278)
```

**HTTP:**
```typescript
// TypeScript (custom implementation needed)
import express from "express";
const app = express();
app.post("/mcp", async (req, res) => {
  const request = req.body;
  const response = await server.handleRequest(request);
  res.json(response);
});
```

### 10.4 Logging and Debugging

**Critical Rule:** MCP servers MUST only write JSON-RPC messages to stdout. All logs go to stderr.

**TypeScript Logging:**
```typescript
import pino from "pino";

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: {
    target: "pino-pretty",
    options: {
      destination: 2, // stderr (fd 2)
    },
  },
});

// Use logger
logger.info({ toolName: "create_task", args }, "Tool called");
logger.error({ error: err.message, stack: err.stack }, "Tool error");
```

**Python Logging:**
```python
import logging
import sys

# Configure logging to stderr
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stderr
)

logger = logging.getLogger(__name__)

# Use logger
logger.info("Tool called", extra={"tool": "create_task", "args": args})
logger.error("Tool error", exc_info=True)
```

**Testing with MCP Inspector:**
```bash
# TypeScript
npx @modelcontextprotocol/inspector ./dist/server.js

# Python
npx @modelcontextprotocol/inspector python server.py
```

---

## 11. Real-World MCP Tool Examples

### 11.1 Filesystem Operations

**Official MCP Filesystem Server:**
- Repository: `github.com/modelcontextprotocol/servers/tree/main/src/filesystem`
- Features: Read, write, search, directory operations
- Security: Configurable access controls, path restrictions

**Example Tools:**
- `read_file`: Read file contents
- `write_file`: Write to file
- `create_directory`: Create directory
- `move_file`: Move/rename file
- `search_files`: Search by pattern
- `get_file_info`: Get file metadata

### 11.2 Git Operations

**Official MCP Git Server:**
- Repository: `github.com/modelcontextprotocol/servers/tree/main/src/git`
- Features: Read, search, manipulate repositories

**Example Tools:**
- `git_status`: Get repository status
- `git_diff`: Show changes
- `git_log`: View commit history
- `git_commit`: Create commit
- `git_create_branch`: Create branch
- `git_checkout`: Switch branches

### 11.3 Database Operations

**PostgreSQL MCP Server:**
- Features: Read-only access, schema inspection
- Security: Prepared statements, query validation

**Example Tools:**
- `query_database`: Execute SELECT query
- `list_tables`: List all tables
- `describe_table`: Get table schema
- `get_table_stats`: Get row counts, sizes

**SQLite MCP Server:**
- Features: Full CRUD operations, transaction support

**Example Tools:**
- `execute_query`: Run SQL query
- `begin_transaction`: Start transaction
- `commit_transaction`: Commit changes
- `rollback_transaction`: Rollback changes

### 11.4 Task Management Examples

**ClickUp MCP Server:**
- Features: Task CRUD, bulk operations, markdown descriptions

**Example Tools:**
- `create_task`: Create new task
- `update_task`: Update existing task
- `delete_task`: Delete task
- `bulk_update`: Update multiple tasks
- `get_task`: Get task details
- `search_tasks`: Search with filters

**AI Tasks MCP Server:**
- Features: Complex plan management, integrated tracking

**Example Tools:**
- `create_plan`: Create execution plan
- `add_task`: Add task to plan
- `update_task_status`: Mark progress
- `get_plan_status`: Get plan overview
- `analyze_dependencies`: Check task dependencies

### 11.5 API Integration Examples

**Slack MCP Server:**
```json
{
  "name": "send_message",
  "description": "Send message to Slack channel",
  "inputSchema": {
    "type": "object",
    "properties": {
      "channel": { "type": "string", "description": "Channel ID or name" },
      "text": { "type": "string", "description": "Message text" },
      "thread_ts": { "type": "string", "description": "Thread timestamp for replies" }
    },
    "required": ["channel", "text"]
  }
}
```

**GitHub MCP Server:**
```json
{
  "name": "create_issue",
  "description": "Create GitHub issue",
  "inputSchema": {
    "type": "object",
    "properties": {
      "repo": { "type": "string", "description": "Repository (owner/name)" },
      "title": { "type": "string", "description": "Issue title" },
      "body": { "type": "string", "description": "Issue body" },
      "labels": { "type": "array", "items": { "type": "string" } },
      "assignees": { "type": "array", "items": { "type": "string" } }
    },
    "required": ["repo", "title"]
  }
}
```

---

## 12. Recommendations for Conductor Integration

### 12.1 Phase 4 Implementation Strategy

**1. Core Tool Set (Priority 1)**
- `create_task`: Create new tasks
- `get_task`: Retrieve task details
- `update_task`: Update task properties
- `list_tasks`: List with pagination
- `search_tasks`: Search with filters

**2. Workflow Tools (Priority 2)**
- `create_workflow`: Define workflow
- `execute_workflow`: Start workflow execution
- `get_workflow_status`: Check execution state
- `pause_workflow`: Pause execution
- `resume_workflow`: Resume execution

**3. Advanced Tools (Priority 3)**
- `batch_update_tasks`: Bulk operations
- `analyze_workflow`: AI-powered analysis (uses sampling)
- `optimize_schedule`: Suggest optimizations (uses sampling)
- `export_tasks`: Export to various formats

### 12.2 Resource Exposure

**Task Resources:**
```
task://TASK-{id}                    → Individual task
tasks://by-status/{status}          → Tasks by status
tasks://by-assignee/{user}          → Tasks by assignee
tasks://recent?days=7               → Recent tasks
```

**Workflow Resources:**
```
workflow://WORKFLOW-{id}            → Workflow definition
workflow://WORKFLOW-{id}/execution  → Current execution state
workflows://templates               → Available templates
```

### 12.3 Architecture Recommendations

**Transport:**
- **Local Development:** stdio transport
- **Production:** HTTP/SSE transport with authentication

**Security:**
- Implement API key authentication
- Use TLS for network transports
- Validate all inputs rigorously
- Sanitize error messages
- Rate limit per-client requests

**Performance:**
- Implement caching for frequently accessed resources
- Use pagination for list operations (max 100 items)
- Set timeout: 30s for interactive tools, 5min for batch
- Monitor and log slow operations

**Error Handling:**
- Use standardized error codes
- Provide actionable error messages
- Log full details to stderr
- Implement retry logic for transient failures

### 12.4 Testing Strategy

**Test Coverage:**
1. Schema validation tests
2. Tool integration tests
3. Error handling tests
4. Performance/timeout tests
5. Security tests (authentication, authorization)

**CI/CD Integration:**
- Validate schemas on every commit
- Run contract tests against example payloads
- Performance benchmarks
- Security scanning

### 12.5 Documentation Requirements

**For Each Tool:**
- Clear description (LLMs read this!)
- Example input/output
- Error codes and meanings
- Rate limits and constraints
- Required permissions

**For Server:**
- Supported capabilities
- Authentication mechanism
- Rate limits
- Resource constraints
- Version compatibility

---

## 13. Additional Resources

### 13.1 Official Documentation

- **Specification:** `https://modelcontextprotocol.io/specification/`
- **TypeScript SDK:** `https://github.com/modelcontextprotocol/typescript-sdk`
- **Python SDK:** `https://github.com/modelcontextprotocol/python-sdk`
- **Example Servers:** `https://github.com/modelcontextprotocol/servers`
- **MCP Homepage:** `https://modelcontextprotocol.io/`

### 13.2 Community Resources

- **FastMCP (Python):** `https://github.com/jlowin/fastmcp`
- **FastMCP (TypeScript):** `https://github.com/punkpeye/fastmcp`
- **Microsoft MCP Tutorials:** `https://github.com/microsoft/mcp-for-beginners`
- **MCP Inspector:** `@modelcontextprotocol/inspector`

### 13.3 Learning Materials

- **FreeCodeCamp Tutorial:** Building custom MCP servers with TypeScript
- **Microsoft Learn:** MCP server deployment on Azure
- **DataCamp Tutorial:** Building MCP server and client with FastMCP
- **WorkOS Blog:** Understanding MCP features guide

### 13.4 Development Tools

- **MCP Inspector:** Interactive testing tool
- **VS Code Extension:** MCP server integration
- **Claude Desktop:** Native MCP support
- **Cursor:** MCP integration

---

## 14. Glossary

**MCP (Model Context Protocol):** Open standard for connecting AI assistants to data systems and tools.

**Tool:** Callable function exposed by MCP server that performs actions or computations.

**Resource:** Data entity exposed by MCP server (static or dynamic).

**Prompt:** Predefined instruction template with variables for standardized task guidance.

**Sampling:** Mechanism for MCP servers to request LLM completions from clients.

**Capability Negotiation:** Process where client and server agree on supported features during initialization.

**JSON-RPC:** Remote procedure call protocol encoded in JSON (version 2.0 required by MCP).

**Transport:** Communication mechanism (stdio, HTTP, SSE) for MCP messages.

**Session:** Stateful connection between client and server with unique session ID.

**Input Schema:** JSON Schema defining expected parameters for a tool.

**Output Schema:** Optional JSON Schema defining expected return format from a tool.

**isError:** Boolean flag in tool response indicating execution failure vs. success.

---

## 15. Conclusion

The Model Context Protocol provides a robust, standardized approach for integrating AI assistants with external systems. For Conductor integration in Phase 4:

**Key Takeaways:**
1. Use TypeScript SDK for consistency with existing tooling
2. Design tools to be stateless where possible
3. Implement comprehensive input validation using JSON Schema
4. Handle errors gracefully with proper error codes and messages
5. Respect resource limits (1MB per response)
6. Set appropriate timeouts (30s interactive, 5min batch)
7. Log to stderr, never stdout
8. Test thoroughly with MCP Inspector
9. Document clearly for both humans and LLMs

**Next Steps:**
1. Review existing Conductor APIs and workflows
2. Design initial tool set (5-10 core tools)
3. Prototype with TypeScript SDK
4. Test with MCP Inspector
5. Iterate based on real-world usage
6. Expand to advanced features (sampling, resources, prompts)

**Success Criteria:**
- Tools execute reliably with <1% error rate
- Response times <500ms for reads, <2s for writes
- Clear, actionable error messages
- Comprehensive test coverage (>90%)
- Production-ready documentation

---

## Appendix A: Complete Tool Definition Template

```json
{
  "name": "tool_name",
  "title": "Human-Readable Tool Title",
  "description": "Clear, concise description of what this tool does, including key constraints and requirements. LLMs read this!",
  "inputSchema": {
    "type": "object",
    "properties": {
      "param1": {
        "type": "string",
        "description": "Description with example (e.g., 'user-123')",
        "minLength": 1,
        "maxLength": 100
      },
      "param2": {
        "type": "integer",
        "description": "Numeric parameter",
        "minimum": 1,
        "maximum": 1000,
        "default": 10
      },
      "param3": {
        "type": "string",
        "enum": ["option1", "option2", "option3"],
        "description": "Constrained choice",
        "default": "option1"
      },
      "param4": {
        "type": "array",
        "items": {
          "type": "string"
        },
        "description": "Array of items",
        "minItems": 0,
        "maxItems": 50
      },
      "param5": {
        "type": "object",
        "description": "Nested object",
        "properties": {
          "nested1": { "type": "string" },
          "nested2": { "type": "boolean" }
        },
        "required": ["nested1"]
      }
    },
    "required": ["param1"],
    "additionalProperties": false
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "result": { "type": "string" },
      "metadata": { "type": "object" }
    }
  },
  "annotations": {
    "rateLimit": "10 requests per minute",
    "timeout": "30 seconds",
    "permissions": ["read:tasks", "write:tasks"]
  }
}
```

---

## Appendix B: Error Code Reference

| Code | Meaning | Description |
|------|---------|-------------|
| -32700 | Parse error | Invalid JSON received |
| -32600 | Invalid Request | JSON-RPC structure invalid |
| -32601 | Method not found | Tool does not exist |
| -32602 | Invalid params | Input validation failed |
| -32603 | Internal error | Server-side error |
| -32000 to -32099 | Server error | Custom application errors |

**Custom Error Codes (Recommended for Conductor):**
- -32000: TaskNotFound
- -32001: WorkflowNotFound
- -32002: InvalidTaskState
- -32003: PermissionDenied
- -32004: RateLimitExceeded
- -32005: DependencyError
- -32010: DatabaseError
- -32011: NetworkError
- -32012: TimeoutError

---

**End of Research Document**
