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
import { Request, Response, NextFunction } from 'express';
/**
 * Supported API versions
 */
export declare const SUPPORTED_VERSIONS: readonly ["1", "2", "3"];
export type APIVersion = typeof SUPPORTED_VERSIONS[number];
/**
 * Version configuration
 */
export interface VersionConfig {
    current: APIVersion;
    supported: APIVersion[];
    deprecated: Partial<Record<APIVersion, {
        since: string;
        sunset: string;
    }>>;
}
export declare const DEFAULT_VERSION_CONFIG: VersionConfig;
/**
 * Versioned request with API metadata
 */
export interface VersionedRequest extends Request {
    apiVersion?: APIVersion;
    requestId?: string;
    versionSource?: 'path' | 'header' | 'query' | 'accept' | 'default';
}
/**
 * Extract API version from request
 * Returns version and source of extraction
 */
export declare const extractAPIVersion: (req: VersionedRequest, config?: VersionConfig) => {
    version: APIVersion;
    source: VersionedRequest["versionSource"];
} | null;
/**
 * Validate API version
 */
export declare const isVersionSupported: (version: APIVersion, config?: VersionConfig) => boolean;
/**
 * Check if version is deprecated
 */
export declare const isVersionDeprecated: (version: APIVersion, config?: VersionConfig) => boolean;
/**
 * Get deprecation info
 */
export declare const getDeprecationInfo: (version: APIVersion, config?: VersionConfig) => {
    since: string;
    sunset: string;
} | null;
/**
 * API versioning middleware
 * Extracts version, validates it, and sets it on request
 */
export declare const apiVersionMiddleware: (config?: VersionConfig) => (req: VersionedRequest, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
/**
 * Version-specific router factory
 * Routes requests to handlers based on API version
 */
export declare const createVersionRouter: () => (req: VersionedRequest, res: Response, next: NextFunction) => void;
/**
 * Version validation middleware factory
 * Ensures only specific versions can access certain endpoints
 */
export declare const requireVersions: (...versions: APIVersion[]) => (req: VersionedRequest, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export default apiVersionMiddleware;
//# sourceMappingURL=api-version.d.ts.map