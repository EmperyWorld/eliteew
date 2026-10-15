-- EWDesk, обращения (feedback), история чата помощника (MVP таблицы)

CREATE TABLE IF NOT EXISTS company_news_posts (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	title TEXT NOT NULL,
	body TEXT NOT NULL,
	pinned BOOLEAN NOT NULL DEFAULT false,
	is_published BOOLEAN NOT NULL DEFAULT false,
	published_at TIMESTAMPTZ NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_company_news_published
	ON company_news_posts (is_published, published_at DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS feedback_tickets (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	kind VARCHAR(16) NOT NULL CHECK (kind IN ('wish', 'bug')),
	body TEXT NOT NULL,
	status VARCHAR(32) NOT NULL DEFAULT 'open',
	admin_notes TEXT NULL,
	reward_credits NUMERIC(14, 2) NULL,
	closed_at TIMESTAMPTZ NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_user ON feedback_tickets (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback_tickets (status, created_at DESC);

CREATE TABLE IF NOT EXISTS assistant_chat_messages (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	role VARCHAR(16) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
	content TEXT NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assistant_chat_user ON assistant_chat_messages (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS assistant_faq_entries (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	question TEXT NOT NULL,
	answer TEXT NOT NULL,
	sort_order INT NOT NULL DEFAULT 0,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Каталог: приложения (установка из магазина)
INSERT INTO desktop_app_catalog (
	id, app_id, name, description, app_component, category, sort_order, is_system, is_factory
)
SELECT gen_random_uuid(), 'app-ewdesk', 'EWDesk', 'Новости компании', 'EWDeskApp', 'productivity', 520, false, false
WHERE NOT EXISTS (SELECT 1 FROM desktop_app_catalog WHERE app_id = 'app-ewdesk');

INSERT INTO desktop_app_catalog (
	id, app_id, name, description, app_component, category, sort_order, is_system, is_factory
)
SELECT gen_random_uuid(), 'app-feedback-hub', 'Обращения', 'Пожелания и сообщения об ошибках', 'FeedbackHubApp', 'productivity', 510, false, false
WHERE NOT EXISTS (SELECT 1 FROM desktop_app_catalog WHERE app_id = 'app-feedback-hub');

INSERT INTO desktop_app_catalog (
	id, app_id, name, description, app_component, category, sort_order, is_system, is_factory
)
SELECT gen_random_uuid(), 'app-assistant', 'Справочник', 'Помощник по приложению', 'AssistantApp', 'productivity', 505, false, false
WHERE NOT EXISTS (SELECT 1 FROM desktop_app_catalog WHERE app_id = 'app-assistant');
