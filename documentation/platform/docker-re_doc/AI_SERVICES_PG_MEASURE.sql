-- Операторский срез для плана perf (ai_services): pg_stat_statements, индексы, мёртвые строки.
-- Запуск (пример): docker exec -i stack1-postgres psql -U "$POSTGRES_USER" -d ai_services -f - < AI_SERVICES_PG_MEASURE.sql

-- 1) Топ по суммарному времени (нужно расширение pg_stat_statements)
SELECT queryid::text,
       calls,
       round(total_exec_time::numeric, 2) AS total_ms,
       round(mean_exec_time::numeric, 2) AS mean_ms,
       rows,
       left(regexp_replace(query, E'\\s+', ' ', 'g'), 200) AS query_preview
FROM pg_stat_statements
WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
ORDER BY total_exec_time DESC
LIMIT 25;

-- 2) Индексы по крупным таблицам UGS / контент
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch,
       pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND tablename IN ('generation_requests', 'generation_queue', 'unified_content')
ORDER BY tablename, indexname;

-- 3) Мёртвые строки и autovacuum
SELECT relname,
       n_live_tup,
       n_dead_tup,
       last_vacuum,
       last_autovacuum,
       last_analyze,
       last_autoanalyze
FROM pg_stat_user_tables
WHERE schemaname = 'public'
  AND relname IN ('generation_requests', 'generation_queue', 'unified_content')
ORDER BY n_dead_tup DESC;

-- 4) Шаблон EXPLAIN (подставить реальные UUID/даты из логов приложения)
-- EXPLAIN (ANALYZE, BUFFERS)
-- SELECT ... ;
