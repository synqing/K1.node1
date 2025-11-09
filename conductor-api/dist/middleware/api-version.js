/**
 * API Versioning Middleware
 * Extracts API version from request and validates/routes accordingly
 * Task T8: API Versioning Middleware
 *
 * Supports version extraction from:
 * 1. URL path (e.g., /v2/...)
 * 2. Accept header (e.g., application/vnd.conductor.v2+json)
 * 3. Query parameter (e.g., ?api-version=2)
 * 4. X-API-Version header
 */
/**
 * Supported API versions
 */
export const SUPPORTED_VERSIONS = ['1', '2', '3'];
export const DEFAULT_VERSION_CONFIG = {
    current: '2',
    supported: ['1', '2', '3'],
    deprecated: {
        '1': {
            since: '2024-06-01',
            sunset: '2025-06-01',
        },
    },
};
/**
 * Extract version from URL path
 * Matches patterns like /v2/..., /api/v3/...
 */
const extractVersionFromPath = (path) => {
    // Pattern: /v{digit}/ or /api/v{digit}/
    const match = path.match(/\/(?:api\/)?v(\d+)\//);
    if (match && SUPPORTED_VERSIONS.includes(match[1])) {
        return match[1];
    }
    return null;
};
/**
 * Extract version from Accept header
 * Matches application/vnd.conductor.v{digit}+json
 */
const extractVersionFromAccept = (acceptHeader) => {
    // Pattern: application/vnd.conductor.v{digit}+json
    const match = acceptHeader.match(/vnd\.conductor\.v(\d+)/);
    if (match && SUPPORTED_VERSIONS.includes(match[1])) {
        return match[1];
    }
    return null;
};
/**
 * Extract version from query parameter
 */
const extractVersionFromQuery = (query) => {
    const version = query['api-version'] || query['version'];
    if (version && SUPPORTED_VERSIONS.includes(version)) {
        return version;
    }
    return null;
};
/**
 * Extract version from X-API-Version header
 */
const extractVersionFromHeader = (headers) => {
    const version = headers['x-api-version'];
    if (version && SUPPORTED_VERSIONS.includes(version)) {
        return version;
    }
    return null;
};
/**
 * Extract API version from request
 * Returns version and source of extraction
 */
export const extractAPIVersion = (req, config = DEFAULT_VERSION_CONFIG) => {
    // Priority order: path > header > query > accept > default
    let version = null;
    let source = null;
    // 1. Check path
    version = extractVersionFromPath(req.path);
    if (version) {
        return { version, source: 'path' };
    }
    // 2. Check X-API-Version header
    version = extractVersionFromHeader(req.headers);
    if (version) {
        return { version, source: 'header' };
    }
    // 3. Check query parameter
    version = extractVersionFromQuery(req.query);
    if (version) {
        return { version, source: 'query' };
    }
    // 4. Check Accept header
    const accept = req.get('Accept') || '';
    version = extractVersionFromAccept(accept);
    if (version) {
        return { version, source: 'accept' };
    }
    // 5. Use default version
    return { version: config.current, source: 'default' };
};
/**
 * Validate API version
 */
export const isVersionSupported = (version, config = DEFAULT_VERSION_CONFIG) => {
    return config.supported.includes(version);
};
/**
 * Check if version is deprecated
 */
export const isVersionDeprecated = (version, config = DEFAULT_VERSION_CONFIG) => {
    return version in config.deprecated;
};
/**
 * Get deprecation info
 */
export const getDeprecationInfo = (version, config = DEFAULT_VERSION_CONFIG) => {
    return config.deprecated[version] || null;
};
/**
 * API versioning middleware
 * Extracts version, validates it, and sets it on request
 */
export const apiVersionMiddleware = (config = DEFAULT_VERSION_CONFIG) => {
    return (req, res, next) => {
        // Extract version from request
        const result = extractAPIVersion(req, config);
        if (!result) {
            // This should not happen as extractAPIVersion always returns default
            return res.status(400).json({
                status: 'error',
                error: {
                    code: 'INVALID_VERSION',
                    message: 'Could not determine API version from request',
                    status: 400,
                    timestamp: new Date().toISOString(),
                    details: {
                        supported_versions: config.supported,
                        hint: 'Provide version via path (/v2/...), header (X-API-Version), or query (?api-version=2)',
                    },
                },
            });
        }
        const { version, source } = result;
        req.apiVersion = version;
        req.versionSource = source;
        // Generate request ID if not present
        if (!req.requestId) {
            req.requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        }
        // Set version header in response
        res.set('X-API-Version', version);
        res.set('X-API-Version-Source', source);
        // Check if version is supported
        if (!isVersionSupported(version, config)) {
            return res.status(400).json({
                status: 'error',
                error: {
                    code: 'UNSUPPORTED_VERSION',
                    message: `API version ${version} is not supported`,
                    status: 400,
                    timestamp: new Date().toISOString(),
                    details: {
                        requested_version: version,
                        supported_versions: config.supported,
                        current_version: config.current,
                    },
                },
            });
        }
        // Check if version is deprecated and add warning header
        if (isVersionDeprecated(version, config)) {
            const deprecationInfo = getDeprecationInfo(version, config);
            const warningHeader = `299 - "API version ${version} is deprecated. Sunset: ${deprecationInfo.sunset}"`;
            res.set('Deprecation', 'true');
            res.set('Sunset', deprecationInfo.sunset);
            res.set('Warning', warningHeader);
            res.set('X-API-Deprecation', `true; sunset="${deprecationInfo.sunset}"`);
            // Log deprecation usage
            if (process.env.DEBUG_VERSION === 'true') {
                console.warn(`[API Versioning] Deprecated version ${version} used. Sunset: ${deprecationInfo.sunset}. Request ID: ${req.requestId}`);
            }
        }
        next();
    };
};
/**
 * Version-specific router factory
 * Routes requests to handlers based on API version
 */
export const createVersionRouter = () => {
    return (req, res, next) => {
        const version = req.apiVersion || DEFAULT_VERSION_CONFIG.current;
        // Attach version info to response for easy access in handlers
        res.locals.apiVersion = version;
        res.locals.requestId = req.requestId;
        next();
    };
};
/**
 * Version validation middleware factory
 * Ensures only specific versions can access certain endpoints
 */
export const requireVersions = (...versions) => {
    return (req, res, next) => {
        const currentVersion = req.apiVersion || DEFAULT_VERSION_CONFIG.current;
        if (!versions.includes(currentVersion)) {
            return res.status(400).json({
                status: 'error',
                error: {
                    code: 'UNSUPPORTED_VERSION_FOR_ENDPOINT',
                    message: `This endpoint is only available in API versions: ${versions.join(', ')}`,
                    status: 400,
                    timestamp: new Date().toISOString(),
                    details: {
                        requested_version: currentVersion,
                        supported_versions: versions,
                    },
                },
            });
        }
        next();
    };
};
export default apiVersionMiddleware;
//# sourceMappingURL=api-version.js.map