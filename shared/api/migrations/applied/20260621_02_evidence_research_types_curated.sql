-- Evidence-брифы: нормализация legacy research_type в research_projects.
-- Каталог UI/API — api/services/marketing_cabinet/research_type_catalog.py
-- Enum PG не сужаем (backward compat); скрытые значения мапятся на активные.

BEGIN;

UPDATE research_projects
SET research_type = 'market'::research_type,
    updated_at = NOW()
WHERE research_type = 'business'::research_type
  AND deleted_at IS NULL;

UPDATE research_projects
SET research_type = 'competitive'::research_type,
    updated_at = NOW()
WHERE research_type = 'porter'::research_type
  AND deleted_at IS NULL;

UPDATE research_projects
SET research_type = 'trend_analysis'::research_type,
    updated_at = NOW()
WHERE research_type IN ('opportunity_analysis'::research_type, 'risk_assessment'::research_type)
  AND deleted_at IS NULL;

COMMIT;
