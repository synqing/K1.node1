-- K1.node1 Scheduler Schema Migration
-- Adds schedules and execution_history tables for cron-based workflow scheduling

-- Schedules table: stores schedule definitions
CREATE TABLE IF NOT EXISTS schedules (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    workflow_id VARCHAR(255) NOT NULL,
    cron_expression VARCHAR(255) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    timezone VARCHAR(50) DEFAULT 'UTC',
    next_execution_time TIMESTAMP,
    last_execution_time TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB,
    CONSTRAINT fk_schedules_workflow FOREIGN KEY (workflow_id) REFERENCES workflow (id) ON DELETE CASCADE
);

-- Indexes for schedules table
CREATE INDEX idx_schedules_enabled ON schedules(enabled);
CREATE INDEX idx_schedules_workflow_id ON schedules(workflow_id);
CREATE INDEX idx_schedules_next_execution ON schedules(next_execution_time) WHERE enabled = true;
CREATE INDEX idx_schedules_created_at ON schedules(created_at DESC);

-- Execution history table: tracks schedule executions
CREATE TABLE IF NOT EXISTS execution_history (
    id VARCHAR(255) PRIMARY KEY,
    schedule_id VARCHAR(255) NOT NULL,
    workflow_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL,
    started_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP,
    duration_ms INTEGER,
    execution_id VARCHAR(255),
    error TEXT,
    result JSONB,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_history_schedule FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE,
    CONSTRAINT fk_history_workflow FOREIGN KEY (workflow_id) REFERENCES workflow (id) ON DELETE CASCADE
);

-- Indexes for execution_history table
CREATE INDEX idx_history_schedule_id ON execution_history(schedule_id);
CREATE INDEX idx_history_workflow_id ON execution_history(workflow_id);
CREATE INDEX idx_history_status ON execution_history(status);
CREATE INDEX idx_history_started_at ON execution_history(started_at DESC);
CREATE INDEX idx_history_schedule_time ON execution_history(schedule_id, started_at DESC);

-- View for execution summary by schedule
CREATE OR REPLACE VIEW schedule_execution_summary AS
SELECT
    s.id,
    s.name,
    s.workflow_id,
    s.cron_expression,
    s.enabled,
    s.next_execution_time,
    s.last_execution_time,
    COUNT(DISTINCT eh.id) as total_executions,
    COUNT(DISTINCT CASE WHEN eh.status = 'success' THEN eh.id END) as successful_executions,
    COUNT(DISTINCT CASE WHEN eh.status = 'failed' THEN eh.id END) as failed_executions,
    COUNT(DISTINCT CASE WHEN eh.status = 'running' THEN eh.id END) as running_executions,
    COALESCE(AVG(CASE WHEN eh.status = 'success' THEN eh.duration_ms END), 0) as avg_success_duration_ms,
    MAX(eh.completed_at) as last_completion_time
FROM schedules s
LEFT JOIN execution_history eh ON s.id = eh.schedule_id
GROUP BY s.id, s.name, s.workflow_id, s.cron_expression, s.enabled, s.next_execution_time, s.last_execution_time;

-- Grant permissions
GRANT ALL PRIVILEGES ON schedules TO conductor;
GRANT ALL PRIVILEGES ON execution_history TO conductor;
GRANT SELECT ON schedule_execution_summary TO conductor;

-- Log migration completion
DO $$
BEGIN
    RAISE NOTICE 'Scheduler schema migration V14 completed successfully';
    RAISE NOTICE 'Created tables: schedules, execution_history';
    RAISE NOTICE 'Created view: schedule_execution_summary';
END $$;
