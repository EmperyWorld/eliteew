-- Витрина «Новое» и режим обслуживания приложений в каталоге десктопа.
ALTER TABLE desktop_app_catalog
	ADD COLUMN IF NOT EXISTS is_featured_new BOOLEAN NOT NULL DEFAULT false,
	ADD COLUMN IF NOT EXISTS new_until TIMESTAMPTZ NULL,
	ADD COLUMN IF NOT EXISTS maintenance_mode BOOLEAN NOT NULL DEFAULT false,
	ADD COLUMN IF NOT EXISTS maintenance_title TEXT NULL,
	ADD COLUMN IF NOT EXISTS maintenance_reason TEXT NULL,
	ADD COLUMN IF NOT EXISTS maintenance_expected_outcome TEXT NULL,
	ADD COLUMN IF NOT EXISTS maintenance_eta_note TEXT NULL;

COMMENT ON COLUMN desktop_app_catalog.is_featured_new IS 'Показывать бейдж «Новое» в магазине при активном new_until или без срока';
COMMENT ON COLUMN desktop_app_catalog.new_until IS 'До какой даты считать новинкой; NULL = без срока';
COMMENT ON COLUMN desktop_app_catalog.maintenance_mode IS 'Приложение недоступно: показывается экран обслуживания';
COMMENT ON COLUMN desktop_app_catalog.maintenance_title IS 'Заголовок экрана обслуживания';
COMMENT ON COLUMN desktop_app_catalog.maintenance_reason IS 'Причина';
COMMENT ON COLUMN desktop_app_catalog.maintenance_expected_outcome IS 'Ожидаемый результат после ремонта';
COMMENT ON COLUMN desktop_app_catalog.maintenance_eta_note IS 'Ориентировочные сроки (текст)';
