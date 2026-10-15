-- Drop functions that became orphan after fourth wave of trigger drops.
-- См. docs/TRIGGERS_KEEP_VS_REMOVE.md. Применять после drop_triggers_fourth_wave.sql.

BEGIN;

DROP FUNCTION IF EXISTS public.update_analysis_type_updated_at();
DROP FUNCTION IF EXISTS public.update_bi_runs_updated_at();
DROP FUNCTION IF EXISTS public.update_dashboard_updated_at();
DROP FUNCTION IF EXISTS public.update_dashboard_widget_timestamp();
DROP FUNCTION IF EXISTS public.update_marketing_presentations_updated_at();
DROP FUNCTION IF EXISTS public.update_project_researches_updated_at();
DROP FUNCTION IF EXISTS public.update_research_categories_updated_at();

COMMIT;
