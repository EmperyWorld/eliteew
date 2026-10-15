-- I.92: support frequent widget listing per layout with ORDER BY display_order, created_at
-- (see DashboardService widget SELECT in dashboard_service.py).
CREATE INDEX IF NOT EXISTS idx_mdw_layout_display_order_created
    ON marketing_dashboard_widgets (layout_id, display_order ASC, created_at ASC);
