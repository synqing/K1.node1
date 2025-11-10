-- Phase 5.3 Database Schema
-- Purpose: Real database schema for Advanced Features
-- Status: Implementation Ready
-- Date: 2025-11-10

-- ============================================================================
-- 1. TASK SCHEDULES
-- ============================================================================
CREATE TABLE task_schedules (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,

  -- Task configuration
  task_type VARCHAR(50) NOT NULL, -- 'conductor_task', 'shell_command', 'http_request'
  task_config JSONB NOT NULL, -- Task-specific configuration

  -- Schedule configuration
  schedule_type VARCHAR(50) NOT NULL, -- 'cron', 'interval', 'one_time'
  schedule_config JSONB NOT NULL, -- { "cron": "0 0 * * *" } or { "intervalMs": 60000 }

  -- State
  enabled BOOLEAN DEFAULT true,
  last_run_at TIMESTAMP WITH TIME ZONE,
  next_run_at TIMESTAMP WITH TIME ZONE,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by VARCHAR(100),

  -- Constraints
  CONSTRAINT valid_task_type CHECK (task_type IN ('conductor_task', 'shell_command', 'http_request')),
  CONSTRAINT valid_schedule_type CHECK (schedule_type IN ('cron', 'interval', 'one_time'))
);

CREATE INDEX idx_schedules_next_run ON task_schedules(next_run_at) WHERE enabled = true;
CREATE INDEX idx_schedules_enabled ON task_schedules(enabled);

-- ============================================================================
-- 2. TASK EXECUTIONS
-- ============================================================================
CREATE TABLE task_executions (
  id SERIAL PRIMARY KEY,
  schedule_id INTEGER REFERENCES task_schedules(id) ON DELETE CASCADE,

  -- Execution identity
  execution_id VARCHAR(100) UNIQUE NOT NULL, -- UUID for tracking

  -- Execution state
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  -- 'pending', 'running', 'completed', 'failed', 'timeout', 'cancelled'

  -- Timing
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_ms INTEGER,

  -- Results
  result JSONB, -- Task output/result
  error JSONB, -- Error details if failed

  -- Conductor integration
  conductor_thread_id VARCHAR(100), -- Claude Conductor thread ID
  conductor_status VARCHAR(50), -- Conductor-specific status

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_status CHECK (status IN ('pending', 'running', 'completed', 'failed', 'timeout', 'cancelled'))
);

CREATE INDEX idx_executions_schedule ON task_executions(schedule_id);
CREATE INDEX idx_executions_status ON task_executions(status);
CREATE INDEX idx_executions_scheduled_at ON task_executions(scheduled_at DESC);
CREATE INDEX idx_executions_execution_id ON task_executions(execution_id);

-- ============================================================================
-- 3. ERROR RECORDS
-- ============================================================================
CREATE TABLE error_records (
  id SERIAL PRIMARY KEY,

  -- Error identity
  error_type VARCHAR(100) NOT NULL, -- 'execution_failure', 'timeout', 'conductor_error', 'system_error'
  severity VARCHAR(50) NOT NULL, -- 'low', 'medium', 'high', 'critical'

  -- Context
  execution_id INTEGER REFERENCES task_executions(id) ON DELETE SET NULL,
  schedule_id INTEGER REFERENCES task_schedules(id) ON DELETE SET NULL,

  -- Error details
  message TEXT NOT NULL,
  stack_trace TEXT,
  error_data JSONB, -- Additional error context

  -- Recovery state
  recovery_status VARCHAR(50) DEFAULT 'unresolved',
  -- 'unresolved', 'retry_scheduled', 'retrying', 'resolved', 'ignored', 'escalated'
  recovery_attempts INTEGER DEFAULT 0,
  max_retry_attempts INTEGER DEFAULT 3,
  next_retry_at TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolution_notes TEXT,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_error_type CHECK (error_type IN ('execution_failure', 'timeout', 'conductor_error', 'system_error')),
  CONSTRAINT valid_severity CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT valid_recovery_status CHECK (recovery_status IN ('unresolved', 'retry_scheduled', 'retrying', 'resolved', 'ignored', 'escalated'))
);

CREATE INDEX idx_errors_recovery_status ON error_records(recovery_status);
CREATE INDEX idx_errors_severity ON error_records(severity);
CREATE INDEX idx_errors_next_retry ON error_records(next_retry_at) WHERE recovery_status = 'retry_scheduled';
CREATE INDEX idx_errors_execution_id ON error_records(execution_id);

-- ============================================================================
-- 4. WEBSOCKET SESSIONS
-- ============================================================================
CREATE TABLE websocket_sessions (
  id SERIAL PRIMARY KEY,

  -- Session identity
  session_id VARCHAR(100) UNIQUE NOT NULL, -- UUID

  -- Connection details
  connected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_ping_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  disconnected_at TIMESTAMP WITH TIME ZONE,

  -- Subscription filters
  subscriptions JSONB, -- { "scheduleIds": [1,2,3], "severities": ["high", "critical"] }

  -- Metadata
  client_info JSONB, -- User agent, IP, etc.

  -- State
  is_active BOOLEAN DEFAULT true
);

CREATE INDEX idx_ws_sessions_active ON websocket_sessions(is_active) WHERE is_active = true;
CREATE INDEX idx_ws_sessions_last_ping ON websocket_sessions(last_ping_at);

-- ============================================================================
-- 5. AUDIT LOG (Optional but recommended)
-- ============================================================================
CREATE TABLE audit_log (
  id SERIAL PRIMARY KEY,

  -- Event details
  event_type VARCHAR(100) NOT NULL, -- 'schedule_created', 'execution_started', 'error_resolved'
  event_data JSONB NOT NULL,

  -- Context
  schedule_id INTEGER REFERENCES task_schedules(id) ON DELETE SET NULL,
  execution_id INTEGER REFERENCES task_executions(id) ON DELETE SET NULL,
  error_id INTEGER REFERENCES error_records(id) ON DELETE SET NULL,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by VARCHAR(100)
);

CREATE INDEX idx_audit_event_type ON audit_log(event_type);
CREATE INDEX idx_audit_created_at ON audit_log(created_at DESC);

-- ============================================================================
-- 6. SYSTEM STATE (Singleton table for scheduler state)
-- ============================================================================
CREATE TABLE system_state (
  id INTEGER PRIMARY KEY DEFAULT 1,

  -- Scheduler state
  scheduler_running BOOLEAN DEFAULT false,
  scheduler_started_at TIMESTAMP WITH TIME ZONE,
  scheduler_last_tick_at TIMESTAMP WITH TIME ZONE,

  -- Error recovery state
  error_recovery_running BOOLEAN DEFAULT false,
  error_recovery_last_run_at TIMESTAMP WITH TIME ZONE,

  -- Metadata
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure only one row
  CONSTRAINT singleton_check CHECK (id = 1)
);

-- Insert initial state
INSERT INTO system_state (id) VALUES (1);

-- ============================================================================
-- 7. TRIGGERS FOR UPDATED_AT
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_schedules_updated_at
  BEFORE UPDATE ON task_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_errors_updated_at
  BEFORE UPDATE ON error_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_system_state_updated_at
  BEFORE UPDATE ON system_state
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
