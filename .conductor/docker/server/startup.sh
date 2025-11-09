#!/bin/bash
# Conductor Server Startup Script with PostgreSQL Persistence

set -e

echo "=================================================="
echo "K1.node1 Conductor Server Starting"
echo "Version: ${CONDUCTOR_VERSION}"
echo "Java: $(java -version 2>&1 | head -n 1)"
echo "Database: PostgreSQL (persistent storage enabled)"
echo "=================================================="

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL..."
timeout=60
counter=0
until pg_isready -h postgres -p 5432 -U conductor > /dev/null 2>&1; do
    counter=$((counter + 1))
    if [ $counter -ge $timeout ]; then
        echo "ERROR: PostgreSQL not ready after ${timeout} seconds"
        exit 1
    fi
    echo "PostgreSQL not ready yet... waiting (${counter}/${timeout})"
    sleep 1
done
echo "PostgreSQL ready!"

# Wait for Redis to be ready
echo "Waiting for Redis..."
timeout=30
counter=0
until redis-cli -h redis ping > /dev/null 2>&1; do
    counter=$((counter + 1))
    if [ $counter -ge $timeout ]; then
        echo "WARNING: Redis not ready after ${timeout} seconds (continuing anyway)"
        break
    fi
    echo "Redis not ready yet... waiting (${counter}/${timeout})"
    sleep 1
done
echo "Redis ready!"

# Print configuration
echo "=================================================="
echo "Configuration:"
echo "  Database URL: ${spring.datasource.url}"
echo "  Redis: ${conductor.redis.hosts}"
echo "  Elasticsearch: ${conductor.elasticsearch.url}"
echo "  Server Port: ${SERVER_PORT}"
echo "=================================================="

# Start Conductor Server
echo "Starting Conductor Server..."
exec java ${JAVA_OPTS} \
    -jar conductor-server.jar \
    --server.port=${SERVER_PORT} \
    --spring.datasource.url="${spring.datasource.url}" \
    --spring.datasource.username="${spring.datasource.username}" \
    --spring.datasource.password="${spring.datasource.password}" \
    --conductor.db.type="${conductor.db.type}" \
    --conductor.redis.hosts="${conductor.redis.hosts}" \
    --conductor.elasticsearch.url="${conductor.elasticsearch.url}" \
    --management.endpoints.web.exposure.include=health,info,prometheus \
    2>&1 | tee /app/logs/conductor-server.log
