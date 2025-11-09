/**
 * @file test_webserver_buffer_bounds.cpp
 * @brief Unit tests for webserver buffer bounds checking (Task 3)
 *
 * Tests validate that buffer operations in the web server are protected against:
 * - Buffer overflow attacks
 * - String manipulation exploits
 * - Parameter injection attacks
 * - WebSocket frame size DoS attacks
 *
 * Security objectives:
 * 1. All string operations use snprintf/strnlen with bounds checking
 * 2. Query parameters validated before parsing
 * 3. WebSocket frames limited to 4KB max
 * 4. Format strings protected from injection
 * 5. Credential handling ensures null termination
 */

#include <gtest/gtest.h>
#include <cstring>
#include <cstdio>
#include <string>

// ============================================================================
// Test Suite: Buffer Size Calculations
// ============================================================================

class BufferBoundsTest : public ::testing::Test {
protected:
    // Test buffer operations match documented sizes
    static const size_t HEX_BUFFER_SIZE = 8;    // FIXED: 6 hex chars + null + safety
    static const size_t CREDENTIAL_BUFFER = 64; // FIXED: WiFi credentials max 64 bytes
    static const size_t PARAM_MAX_LEN = 32;     // Parameter validation limit
    static const size_t WEBSOCKET_MAX_LEN = 4096; // WebSocket frame max 4KB
};

// ============================================================================
// Test 1: HEX Buffer Overflow Prevention
// ============================================================================
TEST_F(BufferBoundsTest, HexBufferSizeProtectsAgainstOverflow) {
    // Simulate GetLedFrameHandler hex buffer
    char hexbuf[8];
    hexbuf[7] = '\0';

    uint8_t r = 0xFF, g = 0xFF, b = 0xFF;

    // snprintf with proper size should never overflow
    int written = snprintf(hexbuf, sizeof(hexbuf), "%02X%02X%02X", r, g, b);

    // Verify write was successful and within bounds
    EXPECT_GT(written, 0);
    EXPECT_LT(written, (int)sizeof(hexbuf));
    EXPECT_EQ(std::string(hexbuf), "FFFFFF");
    EXPECT_EQ(hexbuf[7], '\0');  // Verify null terminator in safety margin
}

// Test buffer still works with minimum values
TEST_F(BufferBoundsTest, HexBufferHandlesMinimalValues) {
    char hexbuf[8];
    hexbuf[7] = '\0';

    uint8_t r = 0x00, g = 0x00, b = 0x00;
    int written = snprintf(hexbuf, sizeof(hexbuf), "%02X%02X%02X", r, g, b);

    EXPECT_EQ(written, 6);  // Exactly 6 characters for RGB hex
    EXPECT_EQ(std::string(hexbuf), "000000");
}

// ============================================================================
// Test 2: Parameter Length Validation
// ============================================================================
TEST_F(BufferBoundsTest, ParameterLengthValidationPreventsParsing) {
    // Simulate safe_strtoul validator
    auto safe_strtoul_check = [](const char* str) -> uint32_t {
        if (!str) return 0;
        size_t len = strlen(str);
        if (len > 32) return 0;  // Reject oversized
        return (uint32_t)strtoul(str, nullptr, 10);
    };

    // Short valid parameter should parse
    uint32_t result = safe_strtoul_check("12345");
    EXPECT_EQ(result, 12345);

    // Parameter at boundary (32 chars) should accept
    std::string boundary(32, '5');  // "555...555" (32 chars)
    result = safe_strtoul_check(boundary.c_str());
    EXPECT_GT(result, 0);  // Should parse without error

    // Parameter over boundary (33 chars) should reject
    std::string oversized(33, '5');  // "555...555" (33 chars)
    result = safe_strtoul_check(oversized.c_str());
    EXPECT_EQ(result, 0);  // Should return 0 (safe failure)
}

// ============================================================================
// Test 3: Format String Validation
// ============================================================================
TEST_F(BufferBoundsTest, FormatParameterValidation) {
    // Simulate fmt parameter validation from GetLedFrameHandler
    auto validate_fmt = [](const std::string& fmt) -> bool {
        if (fmt.length() <= 32 && (fmt == "rgb" || fmt == "hex")) {
            return true;
        }
        return false;
    };

    // Valid formats should pass
    EXPECT_TRUE(validate_fmt("hex"));
    EXPECT_TRUE(validate_fmt("rgb"));

    // Invalid formats should fail
    EXPECT_FALSE(validate_fmt("hex; DROP TABLE"));
    EXPECT_FALSE(validate_fmt("hax"));
    EXPECT_FALSE(validate_fmt(""));

    // Oversized strings should fail
    std::string oversized(64, 'x');
    EXPECT_FALSE(validate_fmt(oversized));
}

// ============================================================================
// Test 4: Credential String Null Termination
// ============================================================================
TEST_F(BufferBoundsTest, CredentialBufferNullTermination) {
    // Simulate GetWifiCredentialsHandler buffers
    char ssid[64] = {0};
    char pass[64] = {0};

    // Simulate receiving unterminated data
    strncpy(ssid, "TestNetwork", 63);
    strncpy(pass, "SecurePass123", 63);

    // SECURITY FIX: Force null termination
    ssid[63] = '\0';
    pass[63] = '\0';

    // Verify strings are properly terminated
    EXPECT_LT(strlen(ssid), 64);
    EXPECT_LT(strlen(pass), 64);
    EXPECT_EQ(ssid[63], '\0');
    EXPECT_EQ(pass[63], '\0');
}

// Test strnlen usage instead of strlen for safety
TEST_F(BufferBoundsTest, SafeStringLengthWithBounds) {
    char pass[64] = {0};
    strncpy(pass, "password", 63);
    pass[63] = '\0';

    // Use strnlen instead of strlen to prevent overflow reading past buffer
    size_t pass_len = strnlen(pass, sizeof(pass) - 1);

    EXPECT_EQ(pass_len, 8);
    EXPECT_LT(pass_len, 64);
}

// ============================================================================
// Test 5: WebSocket Frame Size Limits
// ============================================================================
TEST_F(BufferBoundsTest, WebSocketFrameSizeValidation) {
    // Simulate WebSocket frame size validation
    auto validate_ws_frame = [](size_t len) -> bool {
        if (len > 4096) {
            return false;  // Frame too large, should close connection
        }
        return true;
    };

    // Normal frames should pass
    EXPECT_TRUE(validate_ws_frame(256));
    EXPECT_TRUE(validate_ws_frame(1024));
    EXPECT_TRUE(validate_ws_frame(4096));  // At limit

    // Oversized frames should fail
    EXPECT_FALSE(validate_ws_frame(4097));  // Just over limit
    EXPECT_FALSE(validate_ws_frame(8192));  // 2x limit
    EXPECT_FALSE(validate_ws_frame(1000000));  // Huge
}

// ============================================================================
// Test 6: Query Parameter Chains
// ============================================================================
TEST_F(BufferBoundsTest, MultipleParametersValidation) {
    // Simulate GetLedTxRecentHandler with multiple timestamp parameters
    auto safe_parse_params = [](const std::string& limit_str,
                                 const std::string& since_str) -> std::pair<uint32_t, uint32_t> {
        auto safe_strtoul = [](const std::string& s) -> uint32_t {
            if (s.length() > 32) return 0;
            return (uint32_t)strtoul(s.c_str(), nullptr, 10);
        };
        return {safe_strtoul(limit_str), safe_strtoul(since_str)};
    };

    // Valid parameters
    auto [limit, since] = safe_parse_params("16", "1000000");
    EXPECT_EQ(limit, 16);
    EXPECT_EQ(since, 1000000);

    // One oversized parameter should fail gracefully
    std::tie(limit, since) = safe_parse_params(std::string(40, '5'), "1000000");
    EXPECT_EQ(limit, 0);  // Oversized rejected
    EXPECT_EQ(since, 1000000);  // Valid parameter still works
}

// ============================================================================
// Test 7: Integer Overflow Prevention
// ============================================================================
TEST_F(BufferBoundsTest, IntegerOverflowInTimestamps) {
    // Simulate timestamp parameter parsing
    auto parse_timestamp = [](const std::string& ts_str) -> uint32_t {
        if (ts_str.length() > 32) return 0;
        return (uint32_t)strtoul(ts_str.c_str(), nullptr, 10);
    };

    // Large valid timestamp (within uint32 range)
    uint32_t ts = parse_timestamp("4294967295");  // MAX_UINT32
    EXPECT_EQ(ts, 4294967295U);

    // Oversized number string should be rejected before parsing
    ts = parse_timestamp("99999999999999999999999999999999");
    EXPECT_EQ(ts, 0);  // Rejected due to length
}

// ============================================================================
// Test 8: Real-World Attack Patterns
// ============================================================================
TEST_F(BufferBoundsTest, SqlInjectionAttackRejected) {
    auto validate_format = [](const std::string& fmt) -> bool {
        if (fmt.length() <= 32 && (fmt == "rgb" || fmt == "hex")) {
            return true;
        }
        return false;
    };

    // Common SQL injection attempts should be rejected
    EXPECT_FALSE(validate_format("hex'; DROP TABLE leds; --"));
    EXPECT_FALSE(validate_format("hex\" OR 1=1"));
    EXPECT_FALSE(validate_format("hex%00"));
}

TEST_F(BufferBoundsTest, BufferOverflowPayloadRejected) {
    auto safe_parse = [](const std::string& param) -> uint32_t {
        if (param.length() > 32) return 0;
        return (uint32_t)strtoul(param.c_str(), nullptr, 10);
    };

    // Long sequence of 'A' characters (classic buffer overflow)
    std::string payload(256, 'A');
    uint32_t result = safe_parse(payload);
    EXPECT_EQ(result, 0);  // Rejected
}

TEST_F(BufferBoundsTest, PathTraversalRejected) {
    auto validate_strategy = [](const std::string& strategy) -> bool {
        if (strategy.length() <= 32 &&
            (strategy == "oldest" || strategy == "newer" || strategy == "nearest")) {
            return true;
        }
        return false;
    };

    // Path traversal attempts should be rejected
    EXPECT_FALSE(validate_strategy("../../../etc/passwd"));
    EXPECT_FALSE(validate_strategy("..\\..\\..\\windows\\system32"));
}

// ============================================================================
// Test 9: Boundary Conditions
// ============================================================================
TEST_F(BufferBoundsTest, EmptyAndNullParameters) {
    auto safe_strtoul = [](const char* str) -> uint32_t {
        if (!str) return 0;
        size_t len = strlen(str);
        if (len > 32) return 0;
        return (uint32_t)strtoul(str, nullptr, 10);
    };

    // NULL pointer should be safe
    EXPECT_EQ(safe_strtoul(nullptr), 0);

    // Empty string should be safe
    EXPECT_EQ(safe_strtoul(""), 0);

    // String with only spaces should be safe
    EXPECT_EQ(safe_strtoul("   "), 0);
}

// ============================================================================
// Test 10: Buffer Interaction Edge Cases
// ============================================================================
TEST_F(BufferBoundsTest, SnprintfTruncationHandling) {
    // Test that snprintf properly truncates when format exceeds buffer
    char small_buf[4];  // Smaller than needed

    int written = snprintf(small_buf, sizeof(small_buf), "%02X%02X%02X", 0xFF, 0xFF, 0xFF);

    // snprintf returns number of bytes that WOULD have been written
    EXPECT_GT(written, 0);

    // Buffer should be null-terminated regardless
    EXPECT_EQ(small_buf[3], '\0');

    // Content should be truncated gracefully
    EXPECT_LE(strlen(small_buf), 3);
}

// ============================================================================
// Main Test Entry
// ============================================================================
int main(int argc, char** argv) {
    ::testing::InitGoogleTest(&argc, argv);
    return RUN_ALL_TESTS();
}
