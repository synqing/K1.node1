#!/bin/bash
# Conductor Server Health Check Script

set -e

# Check if server is responding
if curl -f -s http://localhost:8080/api/health > /dev/null 2>&1; then
    echo "Conductor server healthy"
    exit 0
else
    echo "Conductor server unhealthy"
    exit 1
fi
