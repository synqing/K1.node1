# K1.node1 Vendor Agent Index v1.0

**Purpose:** Comprehensive catalog of 66 vendor agent plugins deployed from claude-infra.

**Deployment Date:** 2026-01-08
**Source:** claude-infra v1.2.0 (vendors/agents/plugins/)
**Total Plugins:** 66
**Total Agents:** 147+
**Total Skills:** 59+

---

## Quick Start: Firmware-Relevant Specialists

For K1.node1 ESP32-S3 development, these 8 plugins provide directly applicable expertise:

| Plugin | Agents | Use Case |
|--------|--------|----------|
| **arm-cortex-microcontrollers** | 1 (@arm-cortex-expert) | ARM patterns, memory barriers, DMA/cache coherency |
| **systems-programming** | 4 (@c-pro, @cpp-pro, @golang-pro, @rust-pro) | Modern C++17 firmware, low-level optimization |
| **debugging-toolkit** | 2 (@debugger, @dx-optimizer) | GDB workflows, hardfault analysis, tooling |
| **performance-testing-review** | 2+ (@performance-engineer, @test-automator) | Profiling, FPS optimization, stress testing |
| **error-debugging** | 2 (@debugger, @error-detective) | Error analysis, multi-agent diagnostics |
| **error-diagnostics** | 2 (@debugger, @error-detective) | Error tracing, root cause analysis |
| **incident-response** | 2 (@incident-responder, @devops-troubleshooter) | Production troubleshooting, rapid resolution |
| **application-performance** | 3+ (@performance-engineer, @observability-engineer) | End-to-end performance optimization |

**Total Firmware-Relevant:** 18+ agents directly supporting embedded development

---

## Full Plugin Catalog by Category

### 🔧 Development (5 plugins)
- **code-documentation** - Documentation generation, code explanation
- **backend-development** - Backend API design, GraphQL, TDD
- **frontend-mobile-development** - Frontend UI and mobile apps
- **full-stack-orchestration** - End-to-end feature coordination
- **multi-platform-apps** - Cross-platform development

### 🐛 Debugging & Diagnostics (3 plugins)
- **debugging-toolkit** ⭐ - Interactive debugging, GDB workflows
- **error-debugging** ⭐ - Error analysis, trace debugging
- **error-diagnostics** ⭐ - Error tracing, root cause analysis

### 🤖 AI/ML & Data (5 plugins)
- **llm-application-dev** - LLM development, prompt engineering
- **agent-orchestration** - Multi-agent optimization
- **context-management** - Context persistence
- **machine-learning-ops** - ML pipelines, MLOps
- **data-engineering** - ETL, data warehousing

### 🚨 Operations & Infrastructure (9 plugins)
- **incident-response** ⭐ - Production incident management
- **observability-monitoring** - Metrics, logging, tracing, SLO
- **deployment-strategies** - Deployment patterns, rollback
- **deployment-validation** - Pre-deployment checks
- **cicd-automation** - CI/CD pipelines, GitHub Actions
- **kubernetes-operations** - K8s, Helm, GitOps
- **cloud-infrastructure** - AWS/Azure/GCP, Terraform
- **database-cloud-optimization** - Database optimization
- **distributed-debugging** - Distributed system tracing

### ⚡ Performance & Quality (4 plugins)
- **application-performance** ⭐ - Application profiling, optimization
- **performance-testing-review** ⭐ - Performance analysis, test coverage
- **comprehensive-review** - Multi-perspective code analysis
- **codebase-cleanup** - Technical debt reduction

### 🔒 Security (4 plugins)
- **security-scanning** - SAST, vulnerability scanning, OWASP
- **security-compliance** - SOC2, HIPAA, GDPR compliance
- **backend-api-security** - API security, authentication
- **frontend-mobile-security** - XSS/CSRF, CSP, mobile security

### 🗄️ Database & Validation (3 plugins)
- **database-design** - Database architecture, SQL optimization
- **database-migrations** - Migration automation
- **data-validation-suite** - Schema validation, data quality

### 🌐 API & Documentation (3 plugins)
- **api-scaffolding** - REST/GraphQL API generation
- **api-testing-observability** - API testing, mocking, OpenAPI
- **documentation-generation** - OpenAPI specs, diagrams, tutorials

### 💻 Programming Languages (9 plugins)
- **python-development** - Python 3.12+, Django, FastAPI
- **javascript-typescript** - ES6+, Node.js, React, TypeScript
- **systems-programming** ⭐ - Rust, Go, C, C++ low-level development
- **jvm-languages** - Java, Scala, C# enterprise
- **web-scripting** - PHP, Ruby
- **functional-programming** - Elixir, OTP, Phoenix
- **julia-development** - Julia scientific computing
- **arm-cortex-microcontrollers** ⭐ - ARM firmware (Teensy, STM32, nRF52)
- **shell-scripting** - Bash, POSIX shell

### 📚 Modernization & Refactoring (2 plugins)
- **framework-migration** - Framework updates, migrations
- **dependency-management** - Dependency auditing, upgrades
- **code-refactoring** - Code cleanup, tech debt
- **git-pr-workflows** - Git workflows, PR enhancement

### 📊 Marketing & Content (4 plugins)
- **seo-content-creation** - SEO writing, auditing
- **seo-technical-optimization** - Meta tags, schema, keywords
- **seo-analysis-monitoring** - Content freshness, authority
- **content-marketing** - Content strategy, research

### 💼 Business (3 plugins)
- **business-analytics** - Business metrics, KPI tracking
- **hr-legal-compliance** - HR policies, legal/regulatory docs
- **customer-sales-automation** - Customer support, sales CRM

### 💰 Finance & Blockchain (3 plugins)
- **blockchain-web3** - Smart contracts, DeFi, NFT, Web3
- **quantitative-trading** - Quant analysis, algorithmic trading
- **payment-processing** - Stripe, PayPal, billing, PCI

### 🎮 Specialized (2 plugins)
- **game-development** - Unity, Minecraft plugins
- **accessibility-compliance** - WCAG, inclusive design

### 🏆 Developer Essentials (1 plugin)
- **developer-essentials** - 8 skills: Git, SQL, debugging, testing, auth, code review, E2E testing, monorepo

### Other (2 plugins)
- **tdd-workflows** - Test-driven development
- **unit-testing** - Unit and integration tests
- **code-review-ai** - AI-powered architectural review

---

## Invocation Patterns

### Direct Agent Call (for specific expertise)
```
@cpp-pro review this RMT synchronization code for modern C++17 patterns
@arm-cortex-expert how should I handle DMA cache coherency for audio buffers?
@debugger help me debug this intermittent hardfault in LED rendering
@performance-engineer profile this beat detection algorithm for bottlenecks
@test-automator design a stress test for the stress-test suite (Task 12)
```

### Plugin-Level Activation (automatic)
```
# Skills activate automatically when relevant code/files detected
# Example: Editing RMT code → rmt-dual-channel-sync skill activates
# Example: Editing I2S code → i2s-legacy-api-handling skill activates
# Example: Editing perf-critical code → hot-path-telemetry skill activates
```

### Command Invocation (vendor commands)
```bash
# Already deployed under .claude/commands/vendors/
/tools:error-analysis analyze production firmware crash logs
/workflows:incident-response handle LED synchronization regression
/tools:tech-debt identify firmware technical debt and ROI
/tools:debug-trace set up distributed tracing for audio pipeline
/workflows:performance-optimization profile beat detection bottleneck
```

---

## Token Efficiency

### Progressive Disclosure Architecture
The vendor plugins use three-tier loading:

- **Tier 1 (Metadata):** Always loaded (~80 tokens/plugin)
  - Plugin name, description, version, category
  - Agent/skill/command paths

- **Tier 2 (Instructions):** Loaded when skill/agent activates (~200-500 tokens)
  - Core rules, patterns, validation checklist
  - When user invokes agent or edits relevant files

- **Tier 3 (Resources):** On-demand (~500-2000 tokens)
  - Examples, test patterns, templates
  - Only when user requests detailed guidance

### Savings Calculation
```
Traditional approach (all content loaded):
  66 plugins × 200 avg tokens per plugin = 13,200 tokens

Progressive disclosure (metadata only):
  66 plugins × 80 tokens metadata = 5,280 tokens

Activation overhead (when used):
  Per-agent activation: ~200-500 tokens (only when needed)

Efficiency gain: 60% reduction in baseline context usage
```

---

## Integration Examples

### Scenario 1: RMT Stability Regression
```
Triggered by: Push to firmware with LED flickering
Workflow: /workflows:incident-response
├─ K1 Plugin: rmt-led-control → Loads RMT expertise
├─ Vendor Agent: @debugger → Systematic troubleshooting
├─ Vendor Agent: @performance-engineer → Profile refill timing
├─ K1 Skill: hot-path-telemetry → Zero-cost instrumentation
└─ Output: Root cause identified, fix validated
```

### Scenario 2: IDF Version Upgrade
```
Triggered by: IDF v5.1 release available
Workflow: Manual + K1 plugins
├─ K1 Plugin: firmware-toolchain → IDF upgrade planning
├─ Vendor Agent: @cpp-pro → Modern C++17 API migration
├─ K1 Skill: idf-feature-gating → __has_include patterns
├─ Vendor Skill: error-handling-patterns → Robust errors
└─ Output: Migration plan with fallback strategies
```

### Scenario 3: FPS Performance Investigation
```
Triggered by: LED rendering FPS drops below 30
Workflow: /workflows:performance-optimization
├─ Vendor Agent: @performance-engineer → Profiling setup
├─ K1 Plugin: diagnostics-telemetry → REST diagnostics
├─ K1 Skill: zero-cost-probe-design → Measurement strategy
├─ Vendor Agent: @cpp-pro → Hot-path optimization
└─ Output: Performance baseline, bottleneck analysis, optimization plan
```

### Scenario 4: Test Suite Expansion (Task 12)
```
Triggered by: Need comprehensive stress testing suite
Workflow: /workflows:tdd-cycle
├─ Vendor Agent: @test-automator → Test infrastructure
├─ K1 Plugin: testing-automation → Firmware test patterns
├─ Vendor Skill: error-handling-patterns → Robust test harness
├─ Vendor Workflow: /tools:tech-debt → Coverage analysis
└─ Output: Complete stress test suite with coverage reporting
```

---

## Maintenance & Sync Protocol

**Current Status:** Deployed 2026-01-08
**Next Quarterly Review:** April 2026

**Sync Procedure:**
1. Check claude-infra for vendor plugin updates
2. Compare versions: K1-marketplace.json vs claude-infra
3. Selective update for firmware-relevant changes only:
   - Critical: Systems programming, debugging, performance, error handling
   - Important: Operations, infrastructure, security updates
   - Nice-to-have: Marketing, business, niche domain plugins
4. Document changes in `docs/08-governance/CHANGELOG.md`
5. Commit with detailed rationale

**Version Tracking:**
- Current K1 marketplace: v1.1.0 (2026-01-08)
- Current vendor plugins version: 1.2.0 (from claude-infra)
- Next sync check: April 2026

---

## Plugin Reference Table

| # | Plugin | Agents | Skills | Commands | Category |
|---|--------|--------|--------|----------|----------|
| 1 | accessibility-compliance | 1 | 0 | 1 | accessibility |
| 2 | agent-orchestration | 1 | 0 | 2 | ai-ml |
| 3 | api-scaffolding | 4 | 1 | 0 | api |
| 4 | api-testing-observability | 1 | 0 | 1 | api |
| 5 | application-performance | 3+ | 0 | 1 | performance |
| 6 | arm-cortex-microcontrollers | 1 | 0 | 0 | languages ⭐ |
| 7 | backend-api-security | 2 | 0 | 0 | security |
| 8 | backend-development | 3 | 3 | 1 | development |
| 9 | blockchain-web3 | 1 | 4 | 0 | finance |
| 10 | business-analytics | 1 | 0 | 0 | business |
| 11 | cicd-automation | 5 | 4 | 1 | operations |
| 12 | cloud-infrastructure | 6 | 4 | 0 | infrastructure |
| 13 | code-documentation | 3 | 0 | 2 | development |
| 14 | code-refactoring | 2 | 0 | 3 | modernization |
| 15 | code-review-ai | 1 | 0 | 1 | quality |
| 16 | codebase-cleanup | 3 | 0 | 3 | modernization |
| 17 | comprehensive-review | 3 | 0 | 2 | quality |
| 18 | content-marketing | 2 | 0 | 0 | marketing |
| 19 | context-management | 1 | 0 | 2 | ai-ml |
| 20 | customer-sales-automation | 2 | 0 | 0 | business |
| 21 | data-engineering | 2 | 0 | 2 | ai-ml |
| 22 | data-validation-suite | 1 | 0 | 0 | database |
| 23 | database-cloud-optimization | 4 | 0 | 1 | infrastructure |
| 24 | database-design | 2 | 1 | 0 | database |
| 25 | database-migrations | 2 | 0 | 2 | database |
| 26 | debugging-toolkit | 2 | 0 | 1 | development ⭐ |
| 27 | dependency-management | 1 | 0 | 1 | modernization |
| 28 | deployment-strategies | 2 | 0 | 0 | operations |
| 29 | deployment-validation | 1 | 0 | 1 | operations |
| 30 | developer-essentials | 0 | 8 | 0 | essentials |
| 31 | distributed-debugging | 2 | 0 | 1 | operations |
| 32 | documentation-generation | 5 | 0 | 1 | documentation |
| 33 | error-debugging | 2 | 0 | 3 | debugging ⭐ |
| 34 | error-diagnostics | 2 | 0 | 3 | debugging ⭐ |
| 35 | framework-migration | 2 | 4 | 3 | modernization |
| 36 | frontend-mobile-development | 2 | 0 | 1 | development |
| 37 | frontend-mobile-security | 3 | 0 | 1 | security |
| 38 | full-stack-orchestration | 4 | 0 | 1 | development |
| 39 | functional-programming | 1 | 0 | 0 | languages |
| 40 | game-development | 2 | 0 | 0 | specialized |
| 41 | git-pr-workflows | 1 | 0 | 3 | development |
| 42 | hr-legal-compliance | 2 | 0 | 0 | business |
| 43 | incident-response | 2 | 0 | 2 | operations ⭐ |
| 44 | javascript-typescript | 2 | 4 | 1 | languages |
| 45 | julia-development | 1 | 0 | 0 | languages |
| 46 | jvm-languages | 3 | 0 | 0 | languages |
| 47 | kubernetes-operations | 1 | 4 | 0 | infrastructure |
| 48 | llm-application-dev | 2 | 4 | 3 | ai-ml |
| 49 | machine-learning-ops | 3 | 1 | 1 | ai-ml |
| 50 | multi-platform-apps | 6 | 0 | 1 | development |
| 51 | observability-monitoring | 4 | 4 | 2 | operations |
| 52 | payment-processing | 1 | 4 | 0 | finance |
| 53 | performance-testing-review | 2+ | 0 | 2 | performance ⭐ |
| 54 | python-development | 3 | 5 | 1 | languages |
| 55 | quantitative-trading | 2 | 0 | 0 | finance |
| 56 | security-compliance | 1 | 0 | 1 | security |
| 57 | security-scanning | 1 | 1 | 3 | security |
| 58 | seo-analysis-monitoring | 3 | 0 | 0 | marketing |
| 59 | seo-content-creation | 3 | 0 | 0 | marketing |
| 60 | seo-technical-optimization | 4 | 0 | 0 | marketing |
| 61 | shell-scripting | 2 | 3 | 0 | languages |
| 62 | systems-programming | 4 | 0 | 1 | languages ⭐ |
| 63 | tdd-workflows | 2 | 0 | 4 | development |
| 64 | unit-testing | 2 | 0 | 1 | development |
| 65 | web-scripting | 2 | 0 | 0 | languages |

⭐ = Firmware-relevant for K1.node1 ESP32-S3 development

---

## Questions & Support

For help using vendor agents:

1. **Choosing the right agent:** Refer to "Firmware-Relevant Specialists" table or search by keyword in this index
2. **Direct invocation:** `@agent-name task description`
3. **Workflow activation:** `/workflows:workflow-name task description`
4. **Command tools:** `/tools:tool-name task description`

For updates/changes, see: `docs/08-governance/CHANGELOG.md`

---

**Last Updated:** 2026-01-08
**Maintained by:** K1.node1 Project Team
**Related:** `.claude-plugin/K1-marketplace.json`, `CLAUDE.md` (Vendor Agent Plugins section)
