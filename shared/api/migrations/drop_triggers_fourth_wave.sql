-- Drop triggers (fourth wave) — updated_at на доменных таблицах (research, marketing, jtbd, porter, swot, bi, content, competitive, dashboard).
-- После применения эти таблицы не будут автоматически обновлять updated_at; при необходимости проставлять в API при UPDATE.
-- См. docs/TRIGGERS_KEEP_VS_REMOVE.md. Применять после бэкапа БД.

BEGIN;

-- Дубликат updated_at на value_propositions (оставляем trigger_update_value_proposition_timestamp)
DROP TRIGGER IF EXISTS update_value_props_updated_at ON public.value_propositions;

-- Competitive / content
DROP TRIGGER IF EXISTS competitive_analyses_updated_at ON public.competitive_analyses;
DROP TRIGGER IF EXISTS competitor_features_updated_at ON public.competitor_features;
DROP TRIGGER IF EXISTS content_analyses_updated_at ON public.content_analyses;
DROP TRIGGER IF EXISTS content_comparisons_updated_at ON public.content_comparisons;
DROP TRIGGER IF EXISTS update_content_documents_updated_at ON public.content_documents;
DROP TRIGGER IF EXISTS content_recommendations_updated_at ON public.content_recommendations;
DROP TRIGGER IF EXISTS content_topics_updated_at ON public.content_topics;

-- Financial / job
DROP TRIGGER IF EXISTS update_financial_scenarios_updated_at ON public.financial_scenarios;
DROP TRIGGER IF EXISTS update_job_clusters_updated_at ON public.job_clusters;
DROP TRIGGER IF EXISTS update_job_stories_updated_at ON public.job_stories;

-- JTBD
DROP TRIGGER IF EXISTS jtbd_ab_tests_updated_at ON public.jtbd_ab_tests;
DROP TRIGGER IF EXISTS update_jtbd_clusters_updated_at ON public.jtbd_clusters;
DROP TRIGGER IF EXISTS update_jtbd_embeddings_updated_at ON public.jtbd_embeddings_cache;
DROP TRIGGER IF EXISTS jtbd_gains_updated_at ON public.jtbd_gains;
DROP TRIGGER IF EXISTS update_jtbd_offers_updated_at ON public.jtbd_offers;
DROP TRIGGER IF EXISTS jtbd_outcomes_updated_at ON public.jtbd_outcomes;
DROP TRIGGER IF EXISTS jtbd_pain_points_updated_at ON public.jtbd_pain_points;
DROP TRIGGER IF EXISTS jtbd_segments_updated_at ON public.jtbd_segments;
DROP TRIGGER IF EXISTS jtbd_value_propositions_updated_at ON public.jtbd_value_propositions;

-- Porter / research
DROP TRIGGER IF EXISTS porter_analyses_updated_at ON public.porter_analyses;
DROP TRIGGER IF EXISTS porter_forces_updated_at ON public.porter_forces;
DROP TRIGGER IF EXISTS update_porters_analyses_updated_at ON public.porters_analyses;
DROP TRIGGER IF EXISTS trigger_research_categories_updated_at ON public.research_categories;
DROP TRIGGER IF EXISTS research_comments_updated_at ON public.research_comments;
DROP TRIGGER IF EXISTS research_projects_updated_at ON public.research_projects;

-- SWOT (часть; competitors/financial_models/swot_analyses/swot_factors уже по одному триггеру — не трогаем)
DROP TRIGGER IF EXISTS trigger_swot_documents_updated_at ON public.swot_documents;
DROP TRIGGER IF EXISTS trigger_swot_recommendations_updated_at ON public.swot_recommendations;
DROP TRIGGER IF EXISTS swot_strategies_updated_at ON public.swot_strategies;

-- BI / analysis / dashboard / marketing / project_researches
DROP TRIGGER IF EXISTS trigger_bi_runs_updated_at ON public.bi_airflow_runs;
DROP TRIGGER IF EXISTS trigger_analysis_types_updated_at ON public.analysis_type_templates;
DROP TRIGGER IF EXISTS trigger_update_dashboard_widget_timestamp ON public.dashboard_widgets;
DROP TRIGGER IF EXISTS update_dashboard_layouts_timestamp ON public.marketing_dashboard_layouts;
DROP TRIGGER IF EXISTS update_dashboard_presets_timestamp ON public.marketing_dashboard_presets;
DROP TRIGGER IF EXISTS update_dashboard_widgets_timestamp ON public.marketing_dashboard_widgets;
DROP TRIGGER IF EXISTS update_marketing_presentations_updated_at ON public.marketing_presentations;
DROP TRIGGER IF EXISTS trigger_project_researches_updated_at ON public.project_researches;

COMMIT;
