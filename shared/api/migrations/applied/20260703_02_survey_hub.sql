-- Survey Hub: опросы, аудитория, ответы, GAF delivery ledger, catalog app

CREATE TABLE IF NOT EXISTS surveys (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	title TEXT NOT NULL,
	description_user TEXT NOT NULL DEFAULT '',
	description_admin TEXT NULL,
	status VARCHAR(32) NOT NULL DEFAULT 'draft',
	audience_mode VARCHAR(32) NOT NULL DEFAULT 'groups_or_users',
	reward_json JSONB NOT NULL DEFAULT '{"ugs_credits":0,"ew_balance":0,"web_search_coins":0}'::jsonb,
	gaf_notify_body_template TEXT NULL,
	closes_at TIMESTAMPTZ NULL,
	published_at TIMESTAMPTZ NULL,
	sort_order INT NOT NULL DEFAULT 0,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	CONSTRAINT surveys_status_check CHECK (status IN ('draft', 'published', 'archived')),
	CONSTRAINT surveys_audience_mode_check CHECK (
		audience_mode IN ('groups_only', 'users_only', 'groups_or_users', 'groups_and_users')
	)
);

CREATE INDEX IF NOT EXISTS idx_surveys_status_sort ON surveys (status, sort_order, updated_at DESC);

CREATE TABLE IF NOT EXISTS survey_questions (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
	question_key VARCHAR(64) NOT NULL,
	question_type VARCHAR(32) NOT NULL,
	prompt TEXT NOT NULL,
	help_text TEXT NULL,
	required BOOLEAN NOT NULL DEFAULT true,
	sort_order INT NOT NULL DEFAULT 0,
	options_json JSONB NOT NULL DEFAULT '{}'::jsonb,
	validation_json JSONB NOT NULL DEFAULT '{}'::jsonb,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	UNIQUE (survey_id, question_key),
	CONSTRAINT survey_questions_type_check CHECK (
		question_type IN (
			'single_choice',
			'multi_choice',
			'scale',
			'yes_no',
			'text_short',
			'text_long',
			'nps'
		)
	)
);

CREATE INDEX IF NOT EXISTS idx_survey_questions_survey ON survey_questions (survey_id, sort_order);

CREATE TABLE IF NOT EXISTS survey_audience_groups (
	survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
	app_access_group_id UUID NOT NULL REFERENCES app_access_groups(id) ON DELETE CASCADE,
	PRIMARY KEY (survey_id, app_access_group_id)
);

CREATE TABLE IF NOT EXISTS survey_audience_users (
	survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
	user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	PRIMARY KEY (survey_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_survey_audience_users_user ON survey_audience_users (user_id);

CREATE TABLE IF NOT EXISTS survey_responses (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
	user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	answers_json JSONB NOT NULL DEFAULT '{}'::jsonb,
	reward_granted_json JSONB NULL,
	client_meta JSONB NULL,
	submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	UNIQUE (survey_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_survey_responses_survey ON survey_responses (survey_id, submitted_at DESC);

CREATE TABLE IF NOT EXISTS survey_gaf_deliveries (
	survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
	user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	message_id UUID NULL,
	PRIMARY KEY (survey_id, user_id)
);

INSERT INTO desktop_app_catalog (
	id, app_id, name, description, app_component, category, sort_order, is_system, is_factory
)
SELECT
	gen_random_uuid(),
	'app-survey-hub',
	'Опросы',
	'Интерактивные опросы с наградами за участие',
	'SurveyHubApp',
	'productivity',
	515,
	false,
	false
WHERE NOT EXISTS (SELECT 1 FROM desktop_app_catalog WHERE app_id = 'app-survey-hub');
