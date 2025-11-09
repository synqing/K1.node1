#!/bin/bash
# K1.node1 Conductor Startup Script with 3-Tier Fallback
# ADR-0013: Multi-tier deployment resilience

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CONDUCTOR_DIR="$PROJECT_ROOT/.conductor"
DOCKER_DIR="$CONDUCTOR_DIR/docker"
JAR_PATH="$HOME/.conductor/conductor-server.jar"
SQLITE_DB="$HOME/.conductor/conductor.db"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() { echo -e "${BLUE}[INFO]${NC} $*"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $*"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }

echo "=========================================="
echo "K1.node1 Conductor Startup"
echo "ADR-0013: 3-Tier Fallback Architecture"
echo "=========================================="

# Function: Check if Docker is available and healthy
check_docker() {
    if ! command -v docker &> /dev/null; then
        return 1
    fi

    if ! docker info &> /dev/null; then
        return 1
    fi

    return 0
}

# Function: Check if Java is available
check_java() {
    if ! command -v java &> /dev/null; then
        return 1
    fi

    # Check Java version (need 17+)
    java_version=$(java -version 2>&1 | awk -F '"' '/version/ {print $2}' | cut -d'.' -f1)
    if [ "$java_version" -lt 17 ]; then
        log_warning "Java version $java_version found, but Java 17+ required"
        return 1
    fi

    return 0
}

# Function: Start Tier 1 (Docker Compose + PostgreSQL)
start_tier1() {
    log_info "Tier 1: Starting Docker Compose with PostgreSQL..."

    if [ ! -f "$DOCKER_DIR/docker-compose.yaml" ]; then
        log_error "Docker Compose file not found: $DOCKER_DIR/docker-compose.yaml"
        return 1
    fi

    cd "$DOCKER_DIR"

    log_info "Building Conductor server image..."
    docker-compose build conductor-server || {
        log_error "Failed to build Conductor server image"
        return 1
    }

    log_info "Starting services (PostgreSQL, Redis, Elasticsearch, Conductor)..."
    docker-compose up -d || {
        log_error "Failed to start Docker Compose services"
        return 1
    }

    log_info "Waiting for services to be healthy (max 90 seconds)..."
    timeout=90
    elapsed=0
    while [ $elapsed -lt $timeout ]; do
        if docker-compose ps | grep -q "unhealthy"; then
            log_warning "Some services still unhealthy... waiting (${elapsed}s/${timeout}s)"
            sleep 5
            elapsed=$((elapsed + 5))
        elif curl -f -s http://localhost:8080/api/health > /dev/null 2>&1; then
            log_success "Conductor server healthy!"
            log_success "✅ Tier 1 operational: http://localhost:8080"
            log_info "  - PostgreSQL: localhost:5432 (persistent storage)"
            log_info "  - Redis: localhost:6379 (caching)"
            log_info "  - Elasticsearch: localhost:9200 (indexing)"
            log_info "  - Conductor API: http://localhost:8080/api"
            log_info "  - Conductor UI: http://localhost:8080"
            return 0
        else
            sleep 5
            elapsed=$((elapsed + 5))
        fi
    done

    log_error "Conductor failed to become healthy after ${timeout} seconds"
    log_info "Checking logs:"
    docker-compose logs --tail=50 conductor-server
    return 1
}

# Function: Start Tier 2 (Standalone JAR + SQLite)
start_tier2() {
    log_info "Tier 2: Starting Standalone JAR with SQLite..."

    # Download JAR if not present
    if [ ! -f "$JAR_PATH" ]; then
        log_info "Downloading Conductor server JAR..."
        mkdir -p "$(dirname "$JAR_PATH")"

        CONDUCTOR_VERSION="3.15.0"
        JAR_URL="https://repo1.maven.org/maven2/com/netflix/conductor/conductor-server/${CONDUCTOR_VERSION}/conductor-server-${CONDUCTOR_VERSION}-boot.jar"

        curl -fsSL "$JAR_URL" -o "$JAR_PATH" || {
            log_error "Failed to download Conductor JAR from $JAR_URL"
            return 1
        }

        log_success "Downloaded Conductor server JAR to $JAR_PATH"
    fi

    # Check JAR file
    if [ ! -s "$JAR_PATH" ]; then
        log_error "JAR file empty or corrupted: $JAR_PATH"
        return 1
    fi

    log_info "Starting Conductor with SQLite database..."
    log_info "  Database: $SQLITE_DB"
    log_info "  Port: 8080"

    # Create SQLite directory
    mkdir -p "$(dirname "$SQLITE_DB")"

    # Start Conductor in background
    nohup java -Xms512m -Xmx2048m \
        -jar "$JAR_PATH" \
        --server.port=8080 \
        --spring.datasource.url="jdbc:sqlite:${SQLITE_DB}" \
        --conductor.db.type=sqlite \
        --management.endpoints.web.exposure.include=health,info \
        > "$CONDUCTOR_DIR/conductor-tier2.log" 2>&1 &

    JAVA_PID=$!
    echo $JAVA_PID > "$CONDUCTOR_DIR/conductor-tier2.pid"

    log_info "Conductor started with PID $JAVA_PID"
    log_info "Waiting for server to be healthy (max 60 seconds)..."

    timeout=60
    elapsed=0
    while [ $elapsed -lt $timeout ]; do
        if curl -f -s http://localhost:8080/api/health > /dev/null 2>&1; then
            log_success "Conductor server healthy!"
            log_success "✅ Tier 2 operational: http://localhost:8080"
            log_info "  - Storage: SQLite ($SQLITE_DB)"
            log_info "  - Process: PID $JAVA_PID"
            log_info "  - Logs: $CONDUCTOR_DIR/conductor-tier2.log"
            return 0
        fi
        sleep 2
        elapsed=$((elapsed + 2))
    done

    log_error "Conductor failed to start after ${timeout} seconds"
    log_info "Check logs: tail -f $CONDUCTOR_DIR/conductor-tier2.log"
    return 1
}

# Function: Tier 3 info (direct agent execution - manual)
show_tier3_info() {
    log_warning "Tier 3: Direct Agent Execution (Emergency Mode)"
    log_info "  This mode bypasses Conductor and executes agents directly."
    log_info "  Limitations: No dependency management, no parallelization, no persistence"
    log_info ""
    log_info "  To use Tier 3:"
    log_info "    ./ops/scripts/agent-direct.sh <agent-type> <task-id>"
    log_info ""
    log_info "  Example:"
    log_info "    ./ops/scripts/agent-direct.sh SecurityAgent 1"
}

# Main execution flow
main() {
    # Optional override via env: CONDUCTOR_TIER=1|2
    case "${CONDUCTOR_TIER:-auto}" in
      1)
        log_info "CONDUCTOR_TIER=1 set → forcing Tier 1 (Docker + PostgreSQL)"
        if ! check_docker; then
            log_error "Docker unavailable/unhealthy but CONDUCTOR_TIER=1 was requested"
            exit 1
        fi
        start_tier1 && exit 0 || exit 1
        ;;
      2)
        log_info "CONDUCTOR_TIER=2 set → forcing Tier 2 (Standalone JAR + SQLite)"
        if ! check_java; then
            log_error "Java 17+ unavailable but CONDUCTOR_TIER=2 was requested"
            exit 1
        fi
        start_tier2 && exit 0 || exit 1
        ;;
      auto)
        ;;
    esac

    # Tier 1: Try Docker + PostgreSQL
    if check_docker; then
        log_info "Docker available - attempting Tier 1 (Docker + PostgreSQL)"
        if start_tier1; then
            exit 0
        else
            log_warning "Tier 1 failed, falling back to Tier 2..."
        fi
    else
        log_warning "Docker unavailable or unhealthy, skipping Tier 1"
        log_info "  Tip: Install Docker Desktop or start Docker daemon"
    fi

    # Tier 2: Try Standalone JAR + SQLite
    if check_java; then
        log_info "Java available - attempting Tier 2 (Standalone JAR + SQLite)"
        if start_tier2; then
            exit 0
        else
            log_error "Tier 2 failed"
        fi
    else
        log_warning "Java 17+ unavailable, skipping Tier 2"
        log_info "  Tip: Install OpenJDK 17+ or Eclipse Temurin 17+"
    fi

    # All tiers failed
    log_error "All deployment tiers failed"
    log_error "  Tier 1 (Docker): $(check_docker && echo "Failed" || echo "Unavailable")"
    log_error "  Tier 2 (Java): $(check_java && echo "Failed" || echo "Unavailable")"
    echo ""
    show_tier3_info
    exit 1
}

main "$@"
