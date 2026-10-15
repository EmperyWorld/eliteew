-- Point legacy static icon URL to the canonical public asset (idem: second run is no-op).
-- Removes reliance on /brotherhood-icon.svg duplicate of emperyworld-icon.svg.

UPDATE desktop_app_catalog
SET
  icon_url = REPLACE(icon_url, 'brotherhood-icon.svg', 'emperyworld-icon.svg'),
  icon_url_2x = REPLACE(icon_url_2x, 'brotherhood-icon.svg', 'emperyworld-icon.svg'),
  preview_url = REPLACE(preview_url, 'brotherhood-icon.svg', 'emperyworld-icon.svg'),
  preview_url_2x = REPLACE(preview_url_2x, 'brotherhood-icon.svg', 'emperyworld-icon.svg')
WHERE icon_url LIKE '%brotherhood-icon.svg%'
   OR icon_url_2x LIKE '%brotherhood-icon.svg%'
   OR preview_url LIKE '%brotherhood-icon.svg%'
   OR preview_url_2x LIKE '%brotherhood-icon.svg%';

UPDATE users
SET avatar_url = REPLACE(avatar_url, 'brotherhood-icon.svg', 'emperyworld-icon.svg')
WHERE avatar_url LIKE '%brotherhood-icon.svg%';

UPDATE desktop_items
SET meta = regexp_replace(meta::text, 'brotherhood-icon\.svg', 'emperyworld-icon.svg', 'g')::json
WHERE meta::text LIKE '%brotherhood-icon.svg%';

UPDATE desktop_configs
SET wallpaper = REPLACE(wallpaper, 'brotherhood-icon.svg', 'emperyworld-icon.svg')
WHERE wallpaper LIKE '%brotherhood-icon.svg%';

UPDATE desktop_configs
SET wallpapers_history = regexp_replace(wallpapers_history::text, 'brotherhood-icon\.svg', 'emperyworld-icon.svg', 'g')::json
WHERE wallpapers_history::text LIKE '%brotherhood-icon.svg%';

UPDATE desktop_configs
SET shell_state = regexp_replace(shell_state::text, 'brotherhood-icon\.svg', 'emperyworld-icon.svg', 'g')::json
WHERE shell_state::text LIKE '%brotherhood-icon.svg%';
