-- Display name: «Мой сайт» (was «Сайт заказчика») for catalog + existing rows.
UPDATE desktop_app_catalog
SET name = 'Мой сайт'
WHERE app_id = 'app-kirs-client-site';
