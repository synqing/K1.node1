/**
 * API v2 Router
 * Main router setup with versioning, authentication, and route handlers
 * Consolidates error recovery and scheduling routes under v2 namespace
 * Task T3: API v2 Router Scaffolding
 */
import { Router } from 'express';
import { authMiddlewareV2 } from '../../middleware/v2-authentication';
import errorRecoveryRouter from './error-recovery';
import schedulingRouter from './scheduling';
/**
 * Create API v2 router with authentication and versioning
 */
export const createV2Router = () => {
    const router = Router();
    // ==================== Middleware Stack ====================
    /**
     * V2-specific authentication middleware
     * Validates tokens with v2 schema
     */
    router.use(authMiddlewareV2);
    /**
     * Request logging for v2 endpoints
     */
    router.use((req, res, next) => {
        const client = req.client ? `${req.client.type}:${req.client.id}` : 'unauthenticated';
        const user = req.user?.id || '';
        const correlationId = req.headers['x-correlation-id'] || `v2-${Date.now()}`;
        if (process.env.DEBUG_REQUESTS === 'true') {
            console.log(`[API v2] ${req.method} ${req.path} [${client}${user ? ':' + user : ''}] (${correlationId})`);
        }
        // Attach correlation ID for tracing
        req.correlationId = correlationId;
        res.set('X-Correlation-ID', correlationId);
        next();
    });
    // ==================== Sub-routers ====================
    /**
     * Error recovery routes
     * POST /v2/errors/retry - create retry attempt
     * GET /v2/errors/retry/:id - get retry attempt
     * POST /v2/errors/resolve - mark error resolved
     */
    router.use('/errors', errorRecoveryRouter);
    /**
     * Scheduling routes
     * POST /v2/schedules - create schedule
     * GET /v2/schedules/:id - get schedule
     * PUT /v2/schedules/:id - update schedule
     */
    router.use('/schedules', schedulingRouter);
    // ==================== Health Check ====================
    /**
     * Health check endpoint for v2 API
     * Returns API version and status
     */
    router.get('/health', (req, res) => {
        res.json({
            status: 'ok',
            version: '2.0.0',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            environment: process.env.NODE_ENV || 'development',
        });
    });
    /**
     * API version endpoint
     * Returns detailed version and capability information
     */
    router.get('/version', (req, res) => {
        res.json({
            api_version: '2.0.0',
            api_name: 'Conductor API',
            capabilities: [
                'error-recovery',
                'scheduling',
                'task-management',
                'webhook-integration',
            ],
            deprecations: [],
            documentation_url: 'https://docs.conductor.local/api/v2',
            timestamp: new Date().toISOString(),
        });
    });
    // ==================== Root Status ====================
    /**
     * API root endpoint
     * Provides navigation and documentation links
     */
    router.get('/', (req, res) => {
        res.json({
            api: 'Conductor API v2',
            status: 'operational',
            endpoints: {
                health: '/v2/health',
                version: '/v2/version',
                errors: '/v2/errors',
                schedules: '/v2/schedules',
            },
            documentation: 'https://docs.conductor.local/api/v2',
            timestamp: new Date().toISOString(),
        });
    });
    // ==================== 404 Handler ====================
    /**
     * Catch-all 404 handler for unmapped endpoints
     */
    router.all('*', (req, res) => {
        res.status(404).json({
            error: {
                code: 'NOT_FOUND',
                message: `Endpoint not found: ${req.method} ${req.path}`,
                status: 404,
                timestamp: new Date().toISOString(),
                hint: 'Check /v2 for available endpoints',
            },
        });
    });
    return router;
};
export default createV2Router;
//# sourceMappingURL=index.js.map