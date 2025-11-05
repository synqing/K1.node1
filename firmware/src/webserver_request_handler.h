#pragma once

#include <Arduino.h>
#include <ArduinoJson.h>
#include "webserver_rate_limiter.h"
#include "webserver_response_builders.h"

// Security: Maximum POST body size (64KB) to prevent memory exhaustion attacks
// Requests exceeding this will be rejected with 413 Payload Too Large
#define K1_MAX_REQUEST_BODY_SIZE (64 * 1024)

// Forward declarations
class AsyncWebServer;
class AsyncWebServerRequest;
class K1RequestHandler;

/**
 * RequestContext - Wraps AsyncWebServerRequest with convenience methods
 *
 * Handles JSON parsing for POST requests, provides error/response helpers,
 * and encapsulates all request-related state.
 */
struct RequestContext {
    // Note: request is exposed for advanced handlers that need custom response headers
    // Most handlers should use convenience methods (sendJson, sendError, sendText, sendJsonWithHeaders)
    AsyncWebServerRequest* request;
    const char* route_path;
    RouteMethod route_method;
    StaticJsonDocument<1024>* json_doc;
    bool json_parse_error;

    /**
     * Constructor - parses JSON for POST requests
     */
    RequestContext(AsyncWebServerRequest* req, const char* path, RouteMethod method)
        : request(req), route_path(path), route_method(method),
          json_doc(nullptr), json_parse_error(false) {

        // Parse JSON body for POST requests
        if (method == ROUTE_POST && req->_tempObject) {
            String* body = static_cast<String*>(req->_tempObject);
            json_doc = new StaticJsonDocument<1024>();
            DeserializationError err = deserializeJson(*json_doc, *body);
            delete body;
            req->_tempObject = nullptr;

            if (err) {
                delete json_doc;
                json_doc = nullptr;
                json_parse_error = true;
            }
        }
    }

    /**
     * Destructor - cleans up allocated JSON document
     */
    ~RequestContext() {
        if (json_doc) {
            delete json_doc;
            json_doc = nullptr;
        }
    }

    /**
     * Check if JSON document exists and is valid
     */
    bool hasJson() const {
        return json_doc != nullptr && !json_parse_error;
    }

    /**
     * Get JSON object as const reference
     */
    JsonObjectConst getJson() const {
        if (!hasJson()) {
            return JsonObjectConst();
        }
        return json_doc->as<JsonObjectConst>();
    }

    /**
     * Send JSON response with proper headers
     */
    void sendJson(int status, const String& json) {
        auto* resp = request->beginResponse(status, "application/json", json);
        attach_cors_headers(resp);
        request->send(resp);
    }

    /**
     * Send error response with error code and optional message
     */
    void sendError(int status, const char* error_code, const char* message = nullptr) {
        auto* resp = create_error_response(request, status, error_code, message);
        request->send(resp);
    }

    /**
     * Send plain text response
     */
    void sendText(int status, const String& text) {
        auto* resp = request->beginResponse(status, "text/plain", text);
        attach_cors_headers(resp);
        request->send(resp);
    }

    /**
     * Send JSON response with custom headers
     *
     * Allows handlers to attach additional headers (e.g., Content-Disposition)
     * while maintaining consistent error handling and CORS support.
     *
     * @param status HTTP status code (200, 201, etc.)
     * @param json JSON response body
     * @param headerName Custom header name (e.g., "Content-Disposition")
     * @param headerValue Custom header value (e.g., "attachment; filename=\"...\"")
     */
    void sendJsonWithHeaders(int status, const String& json, const char* headerName, const char* headerValue) {
        auto* resp = request->beginResponse(status, "application/json", json);
        resp->addHeader(headerName, headerValue);
        attach_cors_headers(resp);
        request->send(resp);
    }
};

/**
 * K1RequestHandler - Base class for all request handlers
 *
 * Handles rate limiting automatically, provides RequestContext,
 * and ensures consistent error handling across all endpoints.
 *
 * Subclasses implement handle(RequestContext&) to process requests.
 */
class K1RequestHandler {
protected:
    const char* route_path;
    RouteMethod route_method;

public:
    K1RequestHandler(const char* path, RouteMethod method)
        : route_path(path), route_method(method) {}

    virtual ~K1RequestHandler() = default;

    /**
     * Pure virtual - subclasses implement request handling logic
     */
    virtual void handle(RequestContext& ctx) = 0;

    /**
     * Wrapper that enforces rate limiting before calling handle()
     *
     * This is called by the router and checks rate limits,
     * then creates RequestContext and calls subclass handler.
     */
    void handleWithRateLimit(AsyncWebServerRequest* request) {
        // Check rate limiting
        uint32_t window_ms = 0, next_ms = 0;
        if (route_is_rate_limited(route_path, route_method, &window_ms, &next_ms)) {
            auto *resp = create_error_response(request, 429, "rate_limited", "Too many requests");
            resp->addHeader("X-RateLimit-Window", String(window_ms));
            resp->addHeader("X-RateLimit-NextAllowedMs", String(next_ms));
            request->send(resp);
            return;
        }

        // Rate limit passed - create context and handle
        RequestContext ctx(request, route_path, route_method);

        // For POST requests with JSON parsing errors, return 400 immediately
        if (route_method == ROUTE_POST && ctx.json_parse_error) {
            ctx.sendError(400, "invalid_json", "Request body contains invalid JSON");
            return;
        }

        // Call subclass handler
        handle(ctx);
    }
};

/**
 * K1PostBodyHandler - Wrapper for POST request body handling
 *
 * Accumulates request body data and routes to handler when complete.
 * Handles the AsyncWebServer onBody callback pattern.
 */
class K1PostBodyHandler {
private:
    K1RequestHandler* handler;

public:
    K1PostBodyHandler(K1RequestHandler* h) : handler(h) {}

    /**
     * AsyncWebServer body callback
     * Accumulates data and routes to handler when complete
     */
    void operator()(AsyncWebServerRequest* request, uint8_t* data, size_t len,
                    size_t index, size_t total) {
        // SECURITY FIX: Reject oversized POST bodies to prevent memory exhaustion
        // This prevents attackers from sending Content-Length: 2GB and exhausting heap
        if (total > K1_MAX_REQUEST_BODY_SIZE) {
            auto *resp = request->beginResponse(413, "application/json",
                "{\"error\":\"payload_too_large\",\"max_size\":" + String(K1_MAX_REQUEST_BODY_SIZE) + "}");
            resp->addHeader("Content-Type", "application/json");
            request->send(resp);
            return;
        }

        String *body = static_cast<String*>(request->_tempObject);

        // Initialize body buffer on first chunk
        if (index == 0) {
            body = new String();
            body->reserve(total);
            request->_tempObject = body;
        }

        // Append data chunk
        body->concat(reinterpret_cast<const char*>(data), len);

        // Wait for more data if not complete
        if (index + len != total) {
            return;
        }

        // Body complete - invoke handler with rate limiting
        handler->handleWithRateLimit(request);
    }
};

/**
 * Register a GET endpoint with rate limiting
 *
 * Usage:
 *   class GetPatternHandler : public K1RequestHandler { ... };
 *   registerGetHandler(server, "/api/patterns", new GetPatternHandler());
 */
inline void registerGetHandler(AsyncWebServer& server, const char* path, K1RequestHandler* handler) {
    server.on(path, HTTP_GET, [handler](AsyncWebServerRequest* request) {
        handler->handleWithRateLimit(request);
    });
}

/**
 * Register a POST endpoint with body parsing and rate limiting
 *
 * Usage:
 *   class PostParamHandler : public K1RequestHandler { ... };
 *   registerPostHandler(server, "/api/params", new PostParamHandler());
 */
inline void registerPostHandler(AsyncWebServer& server, const char* path, K1RequestHandler* handler) {
    K1PostBodyHandler bodyHandler(handler);

    server.on(path, HTTP_POST,
        [](AsyncWebServerRequest* request) {},  // Empty normal handler
        NULL,  // No file upload handler
        [bodyHandler](AsyncWebServerRequest* request, uint8_t* data, size_t len, size_t index, size_t total) {
            const_cast<K1PostBodyHandler&>(bodyHandler)(request, data, len, index, total);
        }
    );
}
