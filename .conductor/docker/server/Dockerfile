# K1.node1 Conductor Server Dockerfile
# Base: Netflix Conductor OSS with PostgreSQL support

FROM eclipse-temurin:17-jre-jammy

# Metadata
LABEL maintainer="K1.node1 Team"
LABEL description="Conductor OSS Server with PostgreSQL persistence for K1.node1 multi-agent orchestration"
LABEL version="1.0"

# Environment variables
ENV CONDUCTOR_VERSION=3.15.0
ENV JAVA_OPTS="-Xms512m -Xmx2048m"
ENV SERVER_PORT=8080

# Install dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        curl \
        wget \
        ca-certificates \
        postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Download Conductor Server JAR
RUN wget -q https://repo1.maven.org/maven2/com/netflix/conductor/conductor-server/${CONDUCTOR_VERSION}/conductor-server-${CONDUCTOR_VERSION}-boot.jar \
    -O conductor-server.jar || \
    curl -fsSL https://repo1.maven.org/maven2/com/netflix/conductor/conductor-server/${CONDUCTOR_VERSION}/conductor-server-${CONDUCTOR_VERSION}-boot.jar \
    -o conductor-server.jar

# Verify JAR downloaded
RUN if [ ! -f conductor-server.jar ] || [ ! -s conductor-server.jar ]; then \
        echo "ERROR: Failed to download Conductor server JAR"; \
        exit 1; \
    fi

# Download PostgreSQL JDBC driver
RUN wget -q https://jdbc.postgresql.org/download/postgresql-42.7.1.jar -O postgresql.jar

# Create logs directory
RUN mkdir -p /app/logs

# Health check script
COPY healthcheck.sh /app/healthcheck.sh
RUN chmod +x /app/healthcheck.sh

# Expose ports
EXPOSE 8080 8090

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
    CMD /app/healthcheck.sh

# Startup script
COPY startup.sh /app/startup.sh
RUN chmod +x /app/startup.sh

# Run as non-root user
RUN groupadd -r conductor && useradd -r -g conductor conductor
RUN chown -R conductor:conductor /app
USER conductor

# Start Conductor Server
ENTRYPOINT ["/app/startup.sh"]
