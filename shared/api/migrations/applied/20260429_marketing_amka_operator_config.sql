-- Глобальные переопределения оператора для AMKA (конструктор: тайминги, флаги, доп. инструкции к промптам).
-- Одна строка singleton: id = 'default'.

CREATE TABLE IF NOT EXISTS marketing_amka_operator_config (
    id VARCHAR(32) PRIMARY KEY DEFAULT 'default',
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL
);

INSERT INTO marketing_amka_operator_config (id, config)
VALUES ('default', '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;
