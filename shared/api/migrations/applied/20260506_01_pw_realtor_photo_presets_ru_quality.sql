-- EliteEW / Professional Worlds
-- Realtor photo presets refresh:
-- - Russian prompt templates for direct instruction flow
-- - Meaningful interior/renovation-oriented presets
-- - Quality parameters stored in DB and consumed as-is by PW runtime

INSERT INTO professional_photo_presets (
    vertical_slug, preset_key, display_name, description, category, action_type,
    ugs_type_key, prompt_template, parameters, is_active, sort_order
)
VALUES
(
    'realtor',
    'premium_interior',
    'Премиальный интерьер',
    'Подчеркивает дорогой интерьер квартиры: свет, материалы, чистая премиальная подача.',
    'enhance',
    'image_edit',
    'image_studio_image_edit',
    'Сделай премиальный интерьер квартиры: дорогие материалы, аккуратный свет, чистый реалистичный вид без изменения геометрии помещения. {{instruction}}',
    '{"steps": 20, "cfg": 4.0, "denoise": 0.72, "megapixels": 2.0, "resolution_steps": 2}'::jsonb,
    true,
    10
),
(
    'realtor',
    'premium_renovation',
    'Премиум ремонт',
    'Визуально показывает, как выглядит квартира после качественного премиального ремонта.',
    'enhance',
    'image_edit',
    'image_studio_image_edit',
    'Покажи премиум ремонт в квартире: современная отделка высокого уровня, дорогие фактуры, реалистичное освещение, без изменения планировки. {{instruction}}',
    '{"steps": 22, "cfg": 4.2, "denoise": 0.75, "megapixels": 2.0, "resolution_steps": 2}'::jsonb,
    true,
    11
),
(
    'realtor',
    'listing_cleanup',
    'Чистая подача для объявления',
    'Нейтральная подготовка фото для карточки объявления: свет, цвет и читаемость.',
    'enhance',
    'image_edit',
    'image_studio_image_edit',
    'Подготовь фото для объявления: чистая нейтральная обработка, ровный свет, естественный цвет, аккуратная детализация, без изменения объектов. {{instruction}}',
    '{"steps": 16, "cfg": 3.2, "denoise": 0.58, "megapixels": 2.0, "resolution_steps": 2}'::jsonb,
    true,
    12
),
(
    'realtor',
    'facade_presentation',
    'Фасад и входная группа',
    'Улучшение внешнего вида фасада и входной группы для презентации объекта.',
    'enhance',
    'image_edit',
    'image_studio_image_edit',
    'Улучши фото фасада и входной группы: аккуратная архитектурная подача, естественные цвета, четкая детализация, без изменения геометрии здания. {{instruction}}',
    '{"steps": 18, "cfg": 3.6, "denoise": 0.62, "megapixels": 2.0, "resolution_steps": 2}'::jsonb,
    true,
    13
)
ON CONFLICT (vertical_slug, preset_key) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    action_type = EXCLUDED.action_type,
    ugs_type_key = EXCLUDED.ugs_type_key,
    prompt_template = EXCLUDED.prompt_template,
    parameters = EXCLUDED.parameters,
    is_active = EXCLUDED.is_active,
    sort_order = EXCLUDED.sort_order,
    updated_at = now();

UPDATE professional_photo_presets
SET
    is_active = false,
    updated_at = now()
WHERE vertical_slug = 'realtor'
  AND preset_key IN (
      'realtor_hero_cover',
      'marketplace_crop',
      'document_safe_cleanup',
      'premium_gallery'
  );
