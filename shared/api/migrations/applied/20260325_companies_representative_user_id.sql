-- Владелец записи компании companies.user_id = маркетинговый пользователь (создатель карточки).
-- Заказчик (владелец/представитель с одной ролью) — nullable FK, выбор из друзей создателя.
ALTER TABLE companies
    ADD COLUMN IF NOT EXISTS representative_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_companies_representative_user_id
    ON companies (representative_user_id)
    WHERE deleted_at IS NULL AND representative_user_id IS NOT NULL;
