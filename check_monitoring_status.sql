-- Show all websites and their check intervals
SELECT id, name, check_interval, is_active FROM websites ORDER BY id;

-- For each website, show the last 10 monitoring logs (change 1 to any website ID)
-- You can copy-paste this block for each website you want to check
-- Replace :website_id with the actual ID
\\echo '--- Monitoring logs for website_id = 1 ---'
SELECT website_id, checked_at, change_type
FROM monitoring_logs
WHERE website_id = 1
ORDER BY checked_at DESC
LIMIT 10;

\\echo '--- Monitoring logs for website_id = 2 ---'
SELECT website_id, checked_at, change_type
FROM monitoring_logs
WHERE website_id = 2
ORDER BY checked_at DESC
LIMIT 10;

\\echo '--- Monitoring logs for website_id = 3 ---'
SELECT website_id, checked_at, change_type
FROM monitoring_logs
WHERE website_id = 3
ORDER BY checked_at DESC
LIMIT 10;

-- Show active compression policy
\\echo '--- Compression Policy ---'
SELECT 
  job_id,
  config->>'compress_after' as compress_after,
  next_start,
  hypertable_name
FROM timescaledb_information.jobs 
WHERE proc_name = 'policy_compression'
ORDER BY compress_after;

-- Show recent chunks and their compression status
\\echo '--- Recent Chunks ---'
SELECT 
  chunk_name,
  range_start,
  range_end,
  is_compressed,
  chunk_creation_time
FROM timescaledb_information.chunks
WHERE hypertable_name = 'monitoring_logs'
ORDER BY chunk_creation_time DESC
LIMIT 10;
