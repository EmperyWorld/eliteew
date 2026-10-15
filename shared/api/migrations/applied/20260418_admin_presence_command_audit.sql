-- Аудит команд админки «Онлайн»: разлогин / перезагрузка вкладки по Socket.IO
CREATE TABLE IF NOT EXISTS admin_presence_command_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    admin_id TEXT NOT NULL,
    admin_email TEXT,
    target_user_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('logout', 'reload')),
    delivered INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_admin_presence_audit_created
    ON admin_presence_command_audit (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_presence_audit_target
    ON admin_presence_command_audit (target_user_id);

COMMENT ON TABLE admin_presence_command_audit IS 'Админ: команды presence (logout/reload) по пользователю';
