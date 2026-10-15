-- ---
-- EliteEW · Empery World · https://empery.world
-- Author: po&T && TZBrand
-- ---
-- Purpose:
-- Singleton defaults for stack0 release maintenance notice/downtime (admin-editable).
-- Related:
-- - documentation/platform/USER-SAFE-RESTARTS-AND-MAINTENANCE.md
-- - api/services/maintenance_service.py
-- ---

CREATE TABLE IF NOT EXISTS public.system_maintenance_deploy_defaults (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  notice_before_seconds integer NOT NULL DEFAULT 600
    CHECK (notice_before_seconds >= 0 AND notice_before_seconds <= 86400),
  expected_downtime_seconds integer NOT NULL DEFAULT 120
    CHECK (expected_downtime_seconds >= 30 AND expected_downtime_seconds <= 86400),
  title text NOT NULL DEFAULT 'EliteEW обновляет среду',
  message_template text NOT NULL,
  user_impact_template text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NULL
);

COMMENT ON TABLE public.system_maintenance_deploy_defaults IS
  'Admin-editable defaults for automatic stack0 release maintenance windows (notice + downtime + copy templates).';

INSERT INTO public.system_maintenance_deploy_defaults (
  id,
  notice_before_seconds,
  expected_downtime_seconds,
  title,
  message_template,
  user_impact_template
) VALUES (
  1,
  600,
  120,
  'EliteEW обновляет среду',
  'Через {notice_minutes} мин, с {starts_at_local} до {ends_at_local} (~{downtime_minutes} мин), Безраздельный мир будет на паузе. Данные и раскладка сохранены.',
  'Оставьте вкладку открытой: с {starts_at_local} до {ends_at_local} сервис кратко недоступен, затем восстановится автоматически.'
)
ON CONFLICT (id) DO NOTHING;
