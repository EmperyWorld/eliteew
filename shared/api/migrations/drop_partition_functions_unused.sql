-- Drop partition-maintenance functions: unified_content is a regular table (not partitioned).
-- Эти функции нигде не вызываются в API; партиции не используются.
-- Бэкап перед применением.

DROP FUNCTION IF EXISTS public.maintain_partitions();
DROP FUNCTION IF EXISTS public.drop_old_partitions(text, integer);
DROP FUNCTION IF EXISTS public.ensure_future_partitions(text, integer);
DROP FUNCTION IF EXISTS public.create_monthly_partition(text, date);
DROP FUNCTION IF EXISTS public.archive_old_partition(text, text);
