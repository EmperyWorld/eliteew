-- EliteEW · Wave 4: allow native Tauri desktop-client SSO session class
-- Related: documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md
--          documentation/platform/SSO-SESSION-REGISTRY-AND-ADMIN-PRESENCE.md

ALTER TABLE sso_user_sessions
  DROP CONSTRAINT IF EXISTS sso_user_sessions_client_class_check;

ALTER TABLE sso_user_sessions
  ADD CONSTRAINT sso_user_sessions_client_class_check
  CHECK (client_class IN ('browser', 'mobile', 'desktop'));
