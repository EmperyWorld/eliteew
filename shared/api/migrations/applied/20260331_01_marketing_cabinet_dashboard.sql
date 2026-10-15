-- Marketing Cabinet: overview dashboard persistence (layouts, widgets, presets).
-- Schema and RLS align with EliteEW/temp_mk/dashboard_service.py (set_config app.current_user_id).
-- Apply: shared/api/migrations/apply_migrations.sh — see shared/api/migrations/README.md

BEGIN;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS marketing_dashboard_layouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    project_id UUID NULL REFERENCES projects (id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'custom' CHECK (type IN ('preset', 'custom')),
    description TEXT NULL,
    layout_config JSONB NOT NULL DEFAULT '{}'::JSONB,
    settings JSONB NOT NULL DEFAULT '{}'::JSONB,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_accessed_at TIMESTAMPTZ NULL,
    CONSTRAINT chk_mdl_name_not_empty CHECK (length(trim(name)) > 0)
);

COMMENT ON TABLE marketing_dashboard_layouts IS
    'Per-user marketing overview dashboard layouts (react-grid-layout config); RLS via app.current_user_id.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_mdl_user_project_name_nn
    ON marketing_dashboard_layouts (user_id, project_id, name)
    WHERE project_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_mdl_user_name_null_project
    ON marketing_dashboard_layouts (user_id, name)
    WHERE project_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_mdl_user_project_active
    ON marketing_dashboard_layouts (user_id, project_id, is_active);

CREATE INDEX IF NOT EXISTS idx_mdl_last_access
    ON marketing_dashboard_layouts (user_id, last_accessed_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_mdl_layout_config_gin
    ON marketing_dashboard_layouts USING GIN (layout_config);


CREATE TABLE IF NOT EXISTS marketing_dashboard_widgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    layout_id UUID NOT NULL REFERENCES marketing_dashboard_layouts (id) ON DELETE CASCADE,
    widget_key TEXT NOT NULL,
    widget_title TEXT NOT NULL,
    widget_config JSONB NOT NULL DEFAULT '{}'::JSONB,
    grid_position JSONB NOT NULL DEFAULT '{}'::JSONB,
    is_visible BOOLEAN NOT NULL DEFAULT TRUE,
    is_locked BOOLEAN NOT NULL DEFAULT FALSE,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_mdw_widget_key_not_empty CHECK (length(trim(widget_key)) > 0)
);

COMMENT ON TABLE marketing_dashboard_widgets IS
    'Widgets for a dashboard layout; access controlled via parent layout (RLS).';

CREATE INDEX IF NOT EXISTS idx_mdw_layout_id ON marketing_dashboard_widgets (layout_id);

CREATE INDEX IF NOT EXISTS idx_mdw_layout_widget_key ON marketing_dashboard_widgets (layout_id, widget_key);

CREATE INDEX IF NOT EXISTS idx_mdw_widget_config_gin ON marketing_dashboard_widgets USING GIN (widget_config);

CREATE INDEX IF NOT EXISTS idx_mdw_grid_position_gin ON marketing_dashboard_widgets USING GIN (grid_position);


CREATE TABLE IF NOT EXISTS marketing_dashboard_presets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT NULL,
    category TEXT NOT NULL DEFAULT 'general',
    template_config JSONB NOT NULL DEFAULT '{}'::JSONB,
    is_public BOOLEAN NOT NULL DEFAULT TRUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    usage_count BIGINT NOT NULL DEFAULT 0,
    version INTEGER NOT NULL DEFAULT 1,
    created_by UUID NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_mdp_name_not_empty CHECK (length(trim(name)) > 0)
);

COMMENT ON TABLE marketing_dashboard_presets IS
    'System preset templates; readable when is_public and is_active (RLS SELECT).';

CREATE INDEX IF NOT EXISTS idx_mdp_category_active ON marketing_dashboard_presets (category, is_active)
    WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_mdp_template_gin ON marketing_dashboard_presets USING GIN (template_config);

-- ---------------------------------------------------------------------------
-- Triggers: updated_at + single active layout per (user, project scope)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION trg_marketing_dashboard_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_dashboard_layouts_timestamp ON marketing_dashboard_layouts;
CREATE TRIGGER update_dashboard_layouts_timestamp
    BEFORE UPDATE ON marketing_dashboard_layouts
    FOR EACH ROW
    EXECUTE PROCEDURE trg_marketing_dashboard_touch_updated_at();

DROP TRIGGER IF EXISTS update_dashboard_widgets_timestamp ON marketing_dashboard_widgets;
CREATE TRIGGER update_dashboard_widgets_timestamp
    BEFORE UPDATE ON marketing_dashboard_widgets
    FOR EACH ROW
    EXECUTE PROCEDURE trg_marketing_dashboard_touch_updated_at();

DROP TRIGGER IF EXISTS update_dashboard_presets_timestamp ON marketing_dashboard_presets;
CREATE TRIGGER update_dashboard_presets_timestamp
    BEFORE UPDATE ON marketing_dashboard_presets
    FOR EACH ROW
    EXECUTE PROCEDURE trg_marketing_dashboard_touch_updated_at();

CREATE OR REPLACE FUNCTION trg_ensure_single_active_dashboard_layout()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.is_active THEN
        UPDATE marketing_dashboard_layouts
        SET is_active = FALSE
        WHERE user_id = NEW.user_id
          AND (project_id IS NOT DISTINCT FROM NEW.project_id)
          AND id IS DISTINCT FROM NEW.id
          AND is_active = TRUE;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_single_active_layout_trigger ON marketing_dashboard_layouts;
CREATE TRIGGER ensure_single_active_layout_trigger
    BEFORE INSERT OR UPDATE OF is_active, user_id, project_id ON marketing_dashboard_layouts
    FOR EACH ROW
    EXECUTE PROCEDURE trg_ensure_single_active_dashboard_layout();

-- ---------------------------------------------------------------------------
-- Helper functions (used by dashboard_service.py)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION create_layout_from_preset(
    p_preset_name TEXT,
    p_user_id UUID,
    p_project_id UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_preset RECORD;
    v_layout_id UUID;
    v_layout_obj JSONB;
    v_widget JSONB;
    v_name TEXT;
BEGIN
    SELECT * INTO v_preset
    FROM marketing_dashboard_presets
    WHERE name = p_preset_name AND is_active = TRUE
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    v_layout_obj := COALESCE(v_preset.template_config->'layout', '{}'::JSONB);
    v_name := COALESCE(v_layout_obj->>'name', v_preset.display_name);

    INSERT INTO marketing_dashboard_layouts (
        user_id,
        project_id,
        name,
        type,
        description,
        layout_config,
        settings,
        is_active,
        is_default
    )
    VALUES (
        p_user_id,
        p_project_id,
        v_name,
        COALESCE(v_layout_obj->>'type', 'preset'),
        COALESCE(v_layout_obj->>'description', v_preset.description),
        COALESCE(v_layout_obj->'layout_config', '{}'::JSONB),
        COALESCE(v_layout_obj->'settings', '{}'::JSONB),
        TRUE,
        FALSE
    )
    RETURNING id INTO v_layout_id;

    FOR v_widget IN
        SELECT jsonb_array_elements(COALESCE(v_preset.template_config->'widgets', '[]'::JSONB))
    LOOP
        INSERT INTO marketing_dashboard_widgets (
            layout_id,
            widget_key,
            widget_title,
            widget_config,
            grid_position,
            is_visible,
            is_locked,
            display_order
        )
        VALUES (
            v_layout_id,
            COALESCE(v_widget->>'widget_key', 'widget'),
            COALESCE(v_widget->>'widget_title', v_widget->>'widget_key', 'Widget'),
            COALESCE(v_widget->'widget_config', '{}'::JSONB),
            COALESCE(v_widget->'grid_position', '{}'::JSONB),
            COALESCE((v_widget->>'is_visible')::BOOLEAN, TRUE),
            COALESCE((v_widget->>'is_locked')::BOOLEAN, FALSE),
            COALESCE((v_widget->>'display_order')::INTEGER, 0)
        );
    END LOOP;

    UPDATE marketing_dashboard_presets
    SET usage_count = usage_count + 1,
        updated_at = NOW()
    WHERE id = v_preset.id;

    RETURN v_layout_id;
END;
$$;

CREATE OR REPLACE FUNCTION clone_dashboard_layout(
    p_source_layout_id UUID,
    p_new_name TEXT,
    p_user_id UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_src marketing_dashboard_layouts%ROWTYPE;
    v_new_id UUID;
    w RECORD;
BEGIN
    SELECT * INTO v_src
    FROM marketing_dashboard_layouts
    WHERE id = p_source_layout_id
      AND user_id = p_user_id;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    INSERT INTO marketing_dashboard_layouts (
        user_id,
        project_id,
        name,
        type,
        description,
        layout_config,
        settings,
        is_active,
        is_default
    )
    VALUES (
        p_user_id,
        v_src.project_id,
        p_new_name,
        v_src.type,
        v_src.description,
        v_src.layout_config,
        v_src.settings,
        FALSE,
        FALSE
    )
    RETURNING id INTO v_new_id;

    FOR w IN
        SELECT * FROM marketing_dashboard_widgets WHERE layout_id = p_source_layout_id
    LOOP
        INSERT INTO marketing_dashboard_widgets (
            layout_id,
            widget_key,
            widget_title,
            widget_config,
            grid_position,
            is_visible,
            is_locked,
            display_order
        )
        VALUES (
            v_new_id,
            w.widget_key,
            w.widget_title,
            w.widget_config,
            w.grid_position,
            w.is_visible,
            w.is_locked,
            w.display_order
        );
    END LOOP;

    RETURN v_new_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Stats view (get_usage_stats in dashboard_service.py)
-- ---------------------------------------------------------------------------

DROP VIEW IF EXISTS dashboard_usage_stats CASCADE;

CREATE VIEW dashboard_usage_stats AS
SELECT
    l.user_id,
    l.project_id,
    COUNT(DISTINCT l.id)::INTEGER AS total_layouts,
    COUNT(DISTINCT l.id) FILTER (WHERE l.type = 'preset')::INTEGER AS preset_layouts,
    COUNT(DISTINCT l.id) FILTER (WHERE l.type = 'custom')::INTEGER AS custom_layouts,
    COALESCE(COUNT(w.id), 0)::INTEGER AS total_widgets,
    COALESCE(COUNT(w.id) FILTER (WHERE w.is_visible), 0)::INTEGER AS visible_widgets,
    COALESCE(COUNT(DISTINCT w.widget_key) FILTER (WHERE w.widget_key IS NOT NULL), 0)::INTEGER
        AS unique_widget_types,
    MAX(l.last_accessed_at) AS last_dashboard_access
FROM marketing_dashboard_layouts l
LEFT JOIN marketing_dashboard_widgets w ON w.layout_id = l.id
GROUP BY l.user_id, l.project_id;

COMMENT ON VIEW dashboard_usage_stats IS
    'Aggregated dashboard usage per user and project scope (nullable project_id).';

-- ---------------------------------------------------------------------------
-- Row level security (session: SELECT set_config('app.current_user_id', uid, false))
-- ---------------------------------------------------------------------------

ALTER TABLE marketing_dashboard_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_dashboard_layouts FORCE ROW LEVEL SECURITY;

ALTER TABLE marketing_dashboard_widgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_dashboard_widgets FORCE ROW LEVEL SECURITY;

ALTER TABLE marketing_dashboard_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_dashboard_presets FORCE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION app_marketing_dashboard_current_user_id()
RETURNS UUID
LANGUAGE SQL
STABLE
AS $$
    SELECT NULLIF(BTRIM(current_setting('app.current_user_id', TRUE)), '')::UUID;
$$;

-- Legacy policy names (older MC dashboard drafts) — drop before replacing.
DROP POLICY IF EXISTS dashboard_layouts_user_isolation ON marketing_dashboard_layouts;
DROP POLICY IF EXISTS dashboard_widgets_user_isolation ON marketing_dashboard_widgets;
DROP POLICY IF EXISTS dashboard_presets_admin_all ON marketing_dashboard_presets;
DROP POLICY IF EXISTS dashboard_presets_public_read ON marketing_dashboard_presets;

DROP POLICY IF EXISTS mdl_isolation_select ON marketing_dashboard_layouts;
DROP POLICY IF EXISTS mdl_isolation_insert ON marketing_dashboard_layouts;
DROP POLICY IF EXISTS mdl_isolation_update ON marketing_dashboard_layouts;
DROP POLICY IF EXISTS mdl_isolation_delete ON marketing_dashboard_layouts;

CREATE POLICY mdl_isolation_select ON marketing_dashboard_layouts
    FOR SELECT
    USING (user_id = app_marketing_dashboard_current_user_id());

CREATE POLICY mdl_isolation_insert ON marketing_dashboard_layouts
    FOR INSERT
    WITH CHECK (user_id = app_marketing_dashboard_current_user_id());

CREATE POLICY mdl_isolation_update ON marketing_dashboard_layouts
    FOR UPDATE
    USING (user_id = app_marketing_dashboard_current_user_id())
    WITH CHECK (user_id = app_marketing_dashboard_current_user_id());

CREATE POLICY mdl_isolation_delete ON marketing_dashboard_layouts
    FOR DELETE
    USING (user_id = app_marketing_dashboard_current_user_id());

DROP POLICY IF EXISTS mdw_isolation_all ON marketing_dashboard_widgets;

CREATE POLICY mdw_isolation_all ON marketing_dashboard_widgets
    FOR ALL
    USING (
        EXISTS (
            SELECT 1
            FROM marketing_dashboard_layouts l
            WHERE l.id = marketing_dashboard_widgets.layout_id
              AND l.user_id = app_marketing_dashboard_current_user_id()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM marketing_dashboard_layouts l
            WHERE l.id = marketing_dashboard_widgets.layout_id
              AND l.user_id = app_marketing_dashboard_current_user_id()
        )
    );

DROP POLICY IF EXISTS mdp_select_public_active ON marketing_dashboard_presets;

CREATE POLICY mdp_select_public_active ON marketing_dashboard_presets
    FOR SELECT
    USING (is_public = TRUE AND is_active = TRUE);

-- ---------------------------------------------------------------------------
-- Seed presets (minimal + maximum-style examples; template_config.widgets drives create_layout_from_preset)
-- ---------------------------------------------------------------------------

INSERT INTO marketing_dashboard_presets (
    name,
    display_name,
    description,
    category,
    template_config,
    is_public,
    is_active,
    version
)
VALUES (
    'minimal',
    'Минимальный',
    'Компактный набор виджетов для обзора',
    'minimal',
    jsonb_build_object(
        'layout', jsonb_build_object(
            'name', 'Минимальный',
            'type', 'preset',
            'description', 'Базовые KPI и задачи',
            'layout_config', '{}'::JSONB,
            'settings', '{}'::JSONB
        ),
        'widgets', jsonb_build_array(
            jsonb_build_object(
                'widget_key', 'overview_kpi',
                'widget_title', 'KPI',
                'widget_config', '{}'::JSONB,
                'grid_position', jsonb_build_object('x', 0, 'y', 0, 'w', 6, 'h', 3, 'minW', 2, 'minH', 2),
                'is_visible', TRUE,
                'is_locked', FALSE,
                'display_order', 0
            ),
            jsonb_build_object(
                'widget_key', 'tasks',
                'widget_title', 'Задачи',
                'widget_config', '{}'::JSONB,
                'grid_position', jsonb_build_object('x', 6, 'y', 0, 'w', 6, 'h', 3, 'minW', 2, 'minH', 2),
                'is_visible', TRUE,
                'is_locked', FALSE,
                'display_order', 1
            )
        )
    ),
    TRUE,
    TRUE,
    1
)
ON CONFLICT (name) DO NOTHING;

INSERT INTO marketing_dashboard_presets (
    name,
    display_name,
    description,
    category,
    template_config,
    is_public,
    is_active,
    version
)
VALUES (
    'maximum',
    'Максимальный',
    'Расширенная аналитика и виджеты',
    'general',
    jsonb_build_object(
        'layout', jsonb_build_object(
            'name', 'Максимальный',
            'type', 'preset',
            'description', 'Полный обзор воронки, кампаний и алертов',
            'layout_config', '{}'::JSONB,
            'settings', '{}'::JSONB
        ),
        'widgets', jsonb_build_array(
            jsonb_build_object(
                'widget_key', 'funnel',
                'widget_title', 'Воронка',
                'widget_config', '{}'::JSONB,
                'grid_position', jsonb_build_object('x', 0, 'y', 0, 'w', 4, 'h', 4, 'minW', 2, 'minH', 2),
                'is_visible', TRUE,
                'is_locked', FALSE,
                'display_order', 0
            ),
            jsonb_build_object(
                'widget_key', 'campaigns',
                'widget_title', 'Кампании',
                'widget_config', '{}'::JSONB,
                'grid_position', jsonb_build_object('x', 4, 'y', 0, 'w', 4, 'h', 4, 'minW', 2, 'minH', 2),
                'is_visible', TRUE,
                'is_locked', FALSE,
                'display_order', 1
            ),
            jsonb_build_object(
                'widget_key', 'alerts',
                'widget_title', 'Алерты',
                'widget_config', '{}'::JSONB,
                'grid_position', jsonb_build_object('x', 8, 'y', 0, 'w', 4, 'h', 4, 'minW', 2, 'minH', 2),
                'is_visible', TRUE,
                'is_locked', FALSE,
                'display_order', 2
            ),
            jsonb_build_object(
                'widget_key', 'segments',
                'widget_title', 'Сегменты',
                'widget_config', '{}'::JSONB,
                'grid_position', jsonb_build_object('x', 0, 'y', 4, 'w', 6, 'h', 3, 'minW', 2, 'minH', 2),
                'is_visible', TRUE,
                'is_locked', FALSE,
                'display_order', 3
            ),
            jsonb_build_object(
                'widget_key', 'ai_activity',
                'widget_title', 'AI-активность',
                'widget_config', '{}'::JSONB,
                'grid_position', jsonb_build_object('x', 6, 'y', 4, 'w', 6, 'h', 3, 'minW', 2, 'minH', 2),
                'is_visible', TRUE,
                'is_locked', FALSE,
                'display_order', 4
            )
        )
    ),
    TRUE,
    TRUE,
    1
)
ON CONFLICT (name) DO NOTHING;

INSERT INTO marketing_dashboard_presets (
    name,
    display_name,
    description,
    category,
    template_config,
    is_public,
    is_active,
    version
)
VALUES (
    'analysis',
    'Анализ',
    'Акцент на исследованиях и SWOT',
    'analytics',
    jsonb_build_object(
        'layout', jsonb_build_object(
            'name', 'Анализ',
            'type', 'preset',
            'description', 'SWOT и исследования',
            'layout_config', '{}'::JSONB,
            'settings', '{}'::JSONB
        ),
        'widgets', jsonb_build_array(
            jsonb_build_object(
                'widget_key', 'swot',
                'widget_title', 'SWOT',
                'widget_config', '{}'::JSONB,
                'grid_position', jsonb_build_object('x', 0, 'y', 0, 'w', 6, 'h', 5, 'minW', 2, 'minH', 2),
                'is_visible', TRUE,
                'is_locked', FALSE,
                'display_order', 0
            ),
            jsonb_build_object(
                'widget_key', 'researches',
                'widget_title', 'Исследования',
                'widget_config', '{}'::JSONB,
                'grid_position', jsonb_build_object('x', 6, 'y', 0, 'w', 6, 'h', 5, 'minW', 2, 'minH', 2),
                'is_visible', TRUE,
                'is_locked', FALSE,
                'display_order', 1
            )
        )
    ),
    TRUE,
    TRUE,
    1
)
ON CONFLICT (name) DO NOTHING;

COMMIT;
