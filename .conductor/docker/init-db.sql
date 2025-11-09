-- K1.node1 Conductor PostgreSQL Initialization Script
-- Executed on first database creation

-- Enable UUID extension for unique IDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create indexes for common queries (Conductor will auto-create tables)
-- These will be applied after Conductor creates its schema

-- Audit and metadata tables
CREATE TABLE IF NOT EXISTS k1_workflow_metadata (
    workflow_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conductor_execution_id VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id VARCHAR(255),
    source VARCHAR(50) DEFAULT 'MCP',
    tags JSONB,
    custom_metadata JSONB
);

CREATE INDEX idx_workflow_metadata_created ON k1_workflow_metadata(created_at DESC);
CREATE INDEX idx_workflow_metadata_source ON k1_workflow_metadata(source);

-- Performance metrics table
CREATE TABLE IF NOT EXISTS k1_execution_metrics (
    metric_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID REFERENCES k1_workflow_metadata(workflow_id) ON DELETE CASCADE,
    task_id VARCHAR(255),
    metric_name VARCHAR(100) NOT NULL,
    metric_value NUMERIC,
    metric_unit VARCHAR(50),
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    tags JSONB
);

CREATE INDEX idx_metrics_workflow ON k1_execution_metrics(workflow_id);
CREATE INDEX idx_metrics_task ON k1_execution_metrics(task_id);
CREATE INDEX idx_metrics_name ON k1_execution_metrics(metric_name);
CREATE INDEX idx_metrics_time ON k1_execution_metrics(recorded_at DESC);

-- Quality gates tracking
CREATE TABLE IF NOT EXISTS k1_quality_gates (
    gate_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID REFERENCES k1_workflow_metadata(workflow_id) ON DELETE CASCADE,
    task_id VARCHAR(255) NOT NULL,
    gate_name VARCHAR(100) NOT NULL,
    gate_threshold VARCHAR(50),
    actual_value VARCHAR(50),
    passed BOOLEAN NOT NULL,
    critical BOOLEAN DEFAULT false,
    checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    details JSONB
);

CREATE INDEX idx_gates_workflow ON k1_quality_gates(workflow_id);
CREATE INDEX idx_gates_task ON k1_quality_gates(task_id);
CREATE INDEX idx_gates_passed ON k1_quality_gates(passed);
CREATE INDEX idx_gates_critical ON k1_quality_gates(critical, passed);

-- Agent execution tracking
CREATE TABLE IF NOT EXISTS k1_agent_executions (
    execution_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID REFERENCES k1_workflow_metadata(workflow_id) ON DELETE CASCADE,
    task_id VARCHAR(255) NOT NULL,
    agent_type VARCHAR(50) NOT NULL,
    started_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP,
    status VARCHAR(50),
    exit_code INTEGER,
    stdout_log TEXT,
    stderr_log TEXT,
    result_file_path TEXT,
    metrics JSONB
);

CREATE INDEX idx_agent_workflow ON k1_agent_executions(workflow_id);
CREATE INDEX idx_agent_task ON k1_agent_executions(task_id);
CREATE INDEX idx_agent_type ON k1_agent_executions(agent_type);
CREATE INDEX idx_agent_status ON k1_agent_executions(status);

-- Create view for workflow summary
CREATE OR REPLACE VIEW k1_workflow_summary AS
SELECT
    m.workflow_id,
    m.conductor_execution_id,
    m.created_at,
    m.source,
    COUNT(DISTINCT a.task_id) as total_tasks,
    COUNT(DISTINCT CASE WHEN a.status = 'COMPLETED' THEN a.task_id END) as completed_tasks,
    COUNT(DISTINCT CASE WHEN a.status = 'FAILED' THEN a.task_id END) as failed_tasks,
    COUNT(DISTINCT g.gate_id) as total_quality_gates,
    COUNT(DISTINCT CASE WHEN g.passed THEN g.gate_id END) as passed_quality_gates,
    COUNT(DISTINCT CASE WHEN g.critical AND NOT g.passed THEN g.gate_id END) as critical_failures,
    MIN(a.started_at) as workflow_started,
    MAX(a.completed_at) as workflow_completed,
    EXTRACT(EPOCH FROM (MAX(a.completed_at) - MIN(a.started_at))) as duration_seconds
FROM k1_workflow_metadata m
LEFT JOIN k1_agent_executions a ON m.workflow_id = a.workflow_id
LEFT JOIN k1_quality_gates g ON m.workflow_id = g.workflow_id
GROUP BY m.workflow_id, m.conductor_execution_id, m.created_at, m.source;

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO conductor;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO conductor;

-- Insert initial metadata
INSERT INTO k1_workflow_metadata (conductor_execution_id, source, tags)
VALUES ('INIT', 'SYSTEM', '{"type": "initialization", "version": "1.0"}')
ON CONFLICT DO NOTHING;

-- Log initialization
DO $$
BEGIN
    RAISE NOTICE 'K1.node1 Conductor PostgreSQL database initialized successfully';
    RAISE NOTICE 'Persistent storage enabled - workflow state will survive restarts';
END $$;
