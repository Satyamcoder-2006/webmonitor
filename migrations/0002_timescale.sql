-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Convert monitoring_logs to a hypertable
SELECT create_hypertable('monitoring_logs', 'checked_at');

-- Create indexes for better query performance
CREATE INDEX idx_monitoring_logs_website_id ON monitoring_logs (website_id, checked_at DESC);
CREATE INDEX idx_monitoring_logs_status ON monitoring_logs (status, checked_at DESC);

-- Add compression policy (compress data older than 7 days)
SELECT add_compression_policy('monitoring_logs', INTERVAL '7 days');

-- Add retention policy (keep data for 90 days)
SELECT add_retention_policy('monitoring_logs', INTERVAL '90 days'); 