# ------------------------------------------------------------------------------
#  EliteEW · Empery World
#  https://eliteew.ru
#  Author: po&T <keysray70@gmail.com>
# ------------------------------------------------------------------------------
# Purpose:
#   Оркестрация AI для Site Studio (контент-паки, слоты изображений, вызовы UGS).
# Invariants:
#   - createdAt в метаданных — utc_now_iso().
#   - Image prompts are visual-only; no example quotes; Cyrillic stripped.
#   - Stills use Flux.2 Klein distilled (`site_studio_photo`), not z-image 01_top.
# Related:
#   - UnifiedGenerationService, site_studio_runtime_service
#   - api/services/ugs/z_image_prompt.py
#   - api/services/ugs/flux2_klein.py
# ------------------------------------------------------------------------------
from __future__ import annotations

import json
import logging
import re
from typing import Any
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.core.database_manager import get_asyncpg_pool
from api.models.desktop import UserSiteInstance
from api.services.ugs.flux2_klein import snap_flux2_klein_latent
from api.services.ugs.unified_generation_service import UnifiedGenerationService
from api.services.ugs.z_image_prompt import (
    SITE_STUDIO_IMAGE_NO_TEXT_POSITIVE as _SITE_STUDIO_IMAGE_NO_TEXT_POSITIVE,
)
from api.services.ugs.z_image_prompt import (
    extract_english_wordmarks,
    sanitize_z_image_visual_prompt,
)
from api.utils.datetime_helpers import utc_now_iso
from api.utils.llm_json_extract import extract_llm_json_payload

logger = logging.getLogger(__name__)

# Olenti-витрина: контент-паки должны адаптироваться под тему клиента, но сохранять структуру витрины/услуг.
_OLENTI_STOREFRONT_VERTICAL = (
    "Структура шаблона: витрина товаров/продуктов, запись на консультации и мастер-классы. "
    "Адаптируй тексты СТРОГО под тематику клиента, вписывая её в этот формат (товары, услуги, обучение). "
    "КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО использовать старую демо-тематику (парфюмерия, ароматы, Ollenti, Ольга Бутенко)."
)

_DEFAULT_NEGATIVE_PROMPT = (
    "text, letters, words, typography, caption, subtitle, title card, watermark, logo, brand mark, "
    "signage, banner, label, writing, handwriting, graffiti, neon sign, screen UI, infographic, "
    "poster with text, menu board, price tag, cyrillic, russian text, latin letters, alphabet, "
    "random characters, gibberish, pseudo-text, illegible writing, misspelled words, semi-readable text, "
    "blurry text, fake text, decorative letters, "
    "blurry, lowres, jpeg artifacts, distorted anatomy, extra limbs, bad hands, oversaturated, duplicate subject"
)

# Appended to positive prompts for Site Studio / ImperorG image slots and entity rewrites.
# Canonical text lives in ugs.z_image_prompt — never embed example quotes here.


def site_studio_image_negative_prompt(extra: str | None = None) -> str:
    """Merge Site Studio default anti-text negative prompt with optional operator override."""
    base = _DEFAULT_NEGATIVE_PROMPT.strip()
    tail = (extra or "").strip()
    if not tail:
        return base
    if tail.lower() in base.lower():
        return base
    return f"{base}, {tail}"


# Flux.2 Klein 4B distilled on command-center Comfy (`host/comfyui/site_studio_photo.json`).
_SITE_STUDIO_IMAGE_WORKFLOW_KEY = "site_studio_photo"

_CONTENT_PACKS: list[dict[str, Any]] = [
    {
        "key": "hero_pack",
        "title": "Hero Pack",
        "description": "Главный экран с сильным первым сообщением и понятными CTA.",
        "prompt_focus": (
            "Сделай hero-секцию премиальной, ясной и пригодной для живого сайта. "
            "Заголовки короткие, lead без воды, CTA понятные."
        ),
        "blocks": [
            {"page": "home", "section": "hero", "key": "badge", "label": "Hero badge", "maxLength": 60},
            {"page": "home", "section": "hero", "key": "headline_1", "label": "Hero headline line 1", "maxLength": 40},
            {"page": "home", "section": "hero", "key": "headline_2", "label": "Hero headline line 2", "maxLength": 60},
            {"page": "home", "section": "hero", "key": "lead", "label": "Hero lead", "maxLength": 400},
            {"page": "home", "section": "hero", "key": "cta_shop", "label": "CTA shop", "maxLength": 40},
            {
                "page": "home",
                "section": "hero",
                "key": "cta_consultation",
                "label": "CTA consultation",
                "maxLength": 40,
            },
            {"page": "home", "section": "hero", "key": "card_label", "label": "Hero card label", "maxLength": 40},
            {"page": "home", "section": "hero", "key": "card_title", "label": "Hero card title", "maxLength": 60},
            {
                "page": "home",
                "section": "hero",
                "key": "card_description",
                "label": "Hero card description",
                "maxLength": 300,
            },
            {"page": "home", "section": "hero", "key": "card_notes", "label": "Hero card notes", "maxLength": 80},
            {"page": "home", "section": "hero", "key": "card_footer", "label": "Hero card footer", "maxLength": 200},
            {
                "page": "home",
                "section": "hero",
                "key": "badge_small_label",
                "label": "Hero small badge label",
                "maxLength": 30,
            },
            {
                "page": "home",
                "section": "hero",
                "key": "badge_small_text",
                "label": "Hero small badge text",
                "maxLength": 30,
            },
        ],
    },
    {
        "key": "trust_pack",
        "title": "Trust Pack",
        "description": "Блок «Почему выбирают нас» — аргументы доверия на главной.",
        "prompt_focus": "Четыре короткие причины выбрать бренд без клише и перегруза.",
        "blocks": [
            {
                "page": "home",
                "section": "why_choose",
                "key": "section_title",
                "label": "Why choose title",
                "maxLength": 80,
            },
            {
                "page": "home",
                "section": "why_choose",
                "key": "section_subtitle",
                "label": "Why choose subtitle",
                "maxLength": 300,
            },
            {
                "page": "home",
                "section": "why_choose",
                "key": "item1_title",
                "label": "Why item 1 title",
                "maxLength": 60,
            },
            {
                "page": "home",
                "section": "why_choose",
                "key": "item1_description",
                "label": "Why item 1 description",
                "maxLength": 250,
            },
            {
                "page": "home",
                "section": "why_choose",
                "key": "item2_title",
                "label": "Why item 2 title",
                "maxLength": 60,
            },
            {
                "page": "home",
                "section": "why_choose",
                "key": "item2_description",
                "label": "Why item 2 description",
                "maxLength": 250,
            },
            {
                "page": "home",
                "section": "why_choose",
                "key": "item3_title",
                "label": "Why item 3 title",
                "maxLength": 60,
            },
            {
                "page": "home",
                "section": "why_choose",
                "key": "item3_description",
                "label": "Why item 3 description",
                "maxLength": 250,
            },
            {
                "page": "home",
                "section": "why_choose",
                "key": "item4_title",
                "label": "Why item 4 title",
                "maxLength": 60,
            },
            {
                "page": "home",
                "section": "why_choose",
                "key": "item4_description",
                "label": "Why item 4 description",
                "maxLength": 250,
            },
        ],
    },
    {
        "key": "formats_pack",
        "title": "Formats Pack",
        "description": "Форматы работы: каталог, консультации, обучение, сопровождение.",
        "prompt_focus": "Опиши понятные форматы взаимодействия с брендом без отраслевых клише.",
        "blocks": [
            {"page": "home", "section": "ways_to_work", "key": "badge", "label": "Formats badge", "maxLength": 60},
            {"page": "home", "section": "ways_to_work", "key": "title", "label": "Formats title", "maxLength": 80},
            {"page": "home", "section": "ways_to_work", "key": "intro", "label": "Formats intro", "maxLength": 400},
            {
                "page": "home",
                "section": "ways_to_work",
                "key": "item1_title",
                "label": "Format 1 title",
                "maxLength": 60,
            },
            {
                "page": "home",
                "section": "ways_to_work",
                "key": "item1_description",
                "label": "Format 1 description",
                "maxLength": 200,
            },
            {
                "page": "home",
                "section": "ways_to_work",
                "key": "item2_title",
                "label": "Format 2 title",
                "maxLength": 60,
            },
            {
                "page": "home",
                "section": "ways_to_work",
                "key": "item2_description",
                "label": "Format 2 description",
                "maxLength": 200,
            },
            {
                "page": "home",
                "section": "ways_to_work",
                "key": "item3_title",
                "label": "Format 3 title",
                "maxLength": 60,
            },
            {
                "page": "home",
                "section": "ways_to_work",
                "key": "item3_description",
                "label": "Format 3 description",
                "maxLength": 200,
            },
            {
                "page": "home",
                "section": "ways_to_work",
                "key": "item4_title",
                "label": "Format 4 title",
                "maxLength": 60,
            },
            {
                "page": "home",
                "section": "ways_to_work",
                "key": "item4_description",
                "label": "Format 4 description",
                "maxLength": 200,
            },
        ],
    },
    {
        "key": "catalog_section_pack",
        "title": "Catalog Section Pack",
        "description": "Заголовок и подводка к блоку каталога на главной.",
        "prompt_focus": "Коротко представь каталог/витрину без перечисления конкретных SKU.",
        "blocks": [
            {"page": "home", "section": "products_section", "key": "badge", "label": "Catalog badge", "maxLength": 60},
            {
                "page": "home",
                "section": "products_section",
                "key": "headline_1",
                "label": "Catalog headline 1",
                "maxLength": 40,
            },
            {
                "page": "home",
                "section": "products_section",
                "key": "headline_2",
                "label": "Catalog headline 2",
                "maxLength": 40,
            },
            {
                "page": "home",
                "section": "products_section",
                "key": "subtitle",
                "label": "Catalog subtitle",
                "maxLength": 200,
            },
        ],
    },
    {
        "key": "about_depth_pack",
        "title": "About Depth Pack",
        "description": "Философия, процесс, таймлайн и цифры на странице about.",
        "prompt_focus": "Раскрой экспертизу бренда структурно: принципы, этапы, история, метрики.",
        "blocks": [
            {"page": "about", "section": "philosophy", "key": "title", "label": "Philosophy title", "maxLength": 60},
            {
                "page": "about",
                "section": "philosophy",
                "key": "description",
                "label": "Philosophy description",
                "maxLength": 300,
            },
            {
                "page": "about",
                "section": "philosophy",
                "key": "value1_title",
                "label": "Value 1 title",
                "maxLength": 60,
            },
            {
                "page": "about",
                "section": "philosophy",
                "key": "value1_description",
                "label": "Value 1 description",
                "maxLength": 200,
            },
            {
                "page": "about",
                "section": "philosophy",
                "key": "value2_title",
                "label": "Value 2 title",
                "maxLength": 60,
            },
            {
                "page": "about",
                "section": "philosophy",
                "key": "value2_description",
                "label": "Value 2 description",
                "maxLength": 200,
            },
            {
                "page": "about",
                "section": "philosophy",
                "key": "value3_title",
                "label": "Value 3 title",
                "maxLength": 60,
            },
            {
                "page": "about",
                "section": "philosophy",
                "key": "value3_description",
                "label": "Value 3 description",
                "maxLength": 200,
            },
            {"page": "about", "section": "process", "key": "title", "label": "Process title", "maxLength": 60},
            {
                "page": "about",
                "section": "process",
                "key": "description",
                "label": "Process description",
                "maxLength": 300,
            },
            {
                "page": "about",
                "section": "process",
                "key": "archive_note",
                "label": "Process archive note",
                "maxLength": 300,
            },
            {
                "page": "about",
                "section": "process",
                "key": "step1_title",
                "label": "Process step 1 title",
                "maxLength": 60,
            },
            {
                "page": "about",
                "section": "process",
                "key": "step1_description",
                "label": "Process step 1 description",
                "maxLength": 200,
            },
            {
                "page": "about",
                "section": "process",
                "key": "step2_title",
                "label": "Process step 2 title",
                "maxLength": 60,
            },
            {
                "page": "about",
                "section": "process",
                "key": "step2_description",
                "label": "Process step 2 description",
                "maxLength": 200,
            },
            {
                "page": "about",
                "section": "process",
                "key": "step3_title",
                "label": "Process step 3 title",
                "maxLength": 60,
            },
            {
                "page": "about",
                "section": "process",
                "key": "step3_description",
                "label": "Process step 3 description",
                "maxLength": 200,
            },
            {
                "page": "about",
                "section": "process",
                "key": "step4_title",
                "label": "Process step 4 title",
                "maxLength": 60,
            },
            {
                "page": "about",
                "section": "process",
                "key": "step4_description",
                "label": "Process step 4 description",
                "maxLength": 200,
            },
            {"page": "about", "section": "timeline", "key": "title", "label": "Timeline title", "maxLength": 60},
            {"page": "about", "section": "timeline", "key": "intro", "label": "Timeline intro", "maxLength": 400},
            {
                "page": "about",
                "section": "timeline",
                "key": "item1_year",
                "label": "Timeline item 1 year",
                "maxLength": 10,
            },
            {
                "page": "about",
                "section": "timeline",
                "key": "item1_title",
                "label": "Timeline item 1 title",
                "maxLength": 60,
            },
            {
                "page": "about",
                "section": "timeline",
                "key": "item1_description",
                "label": "Timeline item 1 description",
                "maxLength": 250,
            },
            {
                "page": "about",
                "section": "timeline",
                "key": "item2_year",
                "label": "Timeline item 2 year",
                "maxLength": 10,
            },
            {
                "page": "about",
                "section": "timeline",
                "key": "item2_title",
                "label": "Timeline item 2 title",
                "maxLength": 60,
            },
            {
                "page": "about",
                "section": "timeline",
                "key": "item2_description",
                "label": "Timeline item 2 description",
                "maxLength": 250,
            },
            {
                "page": "about",
                "section": "timeline",
                "key": "item3_year",
                "label": "Timeline item 3 year",
                "maxLength": 10,
            },
            {
                "page": "about",
                "section": "timeline",
                "key": "item3_title",
                "label": "Timeline item 3 title",
                "maxLength": 60,
            },
            {
                "page": "about",
                "section": "timeline",
                "key": "item3_description",
                "label": "Timeline item 3 description",
                "maxLength": 250,
            },
            {
                "page": "about",
                "section": "timeline",
                "key": "item4_year",
                "label": "Timeline item 4 year",
                "maxLength": 10,
            },
            {
                "page": "about",
                "section": "timeline",
                "key": "item4_title",
                "label": "Timeline item 4 title",
                "maxLength": 60,
            },
            {
                "page": "about",
                "section": "timeline",
                "key": "item4_description",
                "label": "Timeline item 4 description",
                "maxLength": 250,
            },
            {"page": "about", "section": "stats", "key": "stat1_value", "label": "Stat 1 value", "maxLength": 10},
            {"page": "about", "section": "stats", "key": "stat1_label", "label": "Stat 1 label", "maxLength": 50},
            {"page": "about", "section": "stats", "key": "stat2_value", "label": "Stat 2 value", "maxLength": 10},
            {"page": "about", "section": "stats", "key": "stat2_label", "label": "Stat 2 label", "maxLength": 50},
            {"page": "about", "section": "stats", "key": "stat3_value", "label": "Stat 3 value", "maxLength": 10},
            {"page": "about", "section": "stats", "key": "stat3_label", "label": "Stat 3 label", "maxLength": 50},
        ],
    },
    {
        "key": "page_heroes_pack",
        "title": "Page Heroes Pack",
        "description": "Hero-блоки внутренних страниц: shop, consultations, masterclasses.",
        "prompt_focus": "Короткие заголовки и описания для внутренних страниц витрины.",
        "blocks": [
            {"page": "layout", "section": "header", "key": "tagline", "label": "Header tagline", "maxLength": 80},
            {"page": "shop", "section": "hero", "key": "badge", "label": "Shop hero badge", "maxLength": 60},
            {"page": "shop", "section": "hero", "key": "title", "label": "Shop hero title", "maxLength": 60},
            {
                "page": "shop",
                "section": "hero",
                "key": "description",
                "label": "Shop hero description",
                "maxLength": 200,
            },
            {
                "page": "consultations",
                "section": "hero",
                "key": "title",
                "label": "Consultations hero title",
                "maxLength": 60,
            },
            {
                "page": "consultations",
                "section": "hero",
                "key": "description",
                "label": "Consultations hero description",
                "maxLength": 300,
            },
            {
                "page": "masterclasses",
                "section": "hero",
                "key": "title",
                "label": "Masterclasses hero title",
                "maxLength": 60,
            },
            {
                "page": "masterclasses",
                "section": "hero",
                "key": "description",
                "label": "Masterclasses hero description",
                "maxLength": 300,
            },
        ],
    },
    {
        "key": "about_pack",
        "title": "About Pack",
        "description": "Блоки про бренд, автора и доверие к сайту.",
        "prompt_focus": ("Собери связную историю бренда без банальностей. Дай ощущение личности, ремесла и доверия."),
        "blocks": [
            {
                "page": "home",
                "section": "about_preview",
                "key": "greeting",
                "label": "About preview greeting",
                "maxLength": 60,
            },
            {
                "page": "home",
                "section": "about_preview",
                "key": "title",
                "label": "About preview title",
                "maxLength": 60,
            },
            {
                "page": "home",
                "section": "about_preview",
                "key": "description_1",
                "label": "About preview description 1",
                "maxLength": 500,
            },
            {
                "page": "home",
                "section": "about_preview",
                "key": "description_2",
                "label": "About preview description 2",
                "maxLength": 500,
            },
            {
                "page": "home",
                "section": "about_preview",
                "key": "cta_consultation",
                "label": "About preview consultation CTA",
                "maxLength": 40,
            },
            {
                "page": "home",
                "section": "about_preview",
                "key": "cta_shop",
                "label": "About preview shop CTA",
                "maxLength": 40,
            },
            {"page": "about", "section": "hero", "key": "badge", "label": "About hero badge", "maxLength": 30},
            {"page": "about", "section": "hero", "key": "title", "label": "About hero title", "maxLength": 100},
            {
                "page": "about",
                "section": "hero",
                "key": "description",
                "label": "About hero description",
                "maxLength": 400,
            },
            {
                "page": "about",
                "section": "hero",
                "key": "image_caption",
                "label": "About hero image caption",
                "maxLength": 80,
            },
            {"page": "about", "section": "founder", "key": "name", "label": "Founder name", "maxLength": 50},
            {"page": "about", "section": "founder", "key": "title", "label": "Founder title", "maxLength": 80},
            {"page": "about", "section": "founder", "key": "bio", "label": "Founder bio", "maxLength": 500},
            {"page": "about", "section": "founder", "key": "bullet1", "label": "Founder bullet 1", "maxLength": 150},
            {"page": "about", "section": "founder", "key": "bullet2", "label": "Founder bullet 2", "maxLength": 150},
            {"page": "about", "section": "founder", "key": "bullet3", "label": "Founder bullet 3", "maxLength": 150},
            {"page": "about", "section": "founder", "key": "cta_button", "label": "Founder CTA", "maxLength": 40},
        ],
    },
    {
        "key": "cta_pack",
        "title": "CTA Pack",
        "description": "Короткие блоки на конверсию, консультацию и следующий шаг.",
        "prompt_focus": (
            "Сделай тексты призыва к действию ясными, уверенными и без шаблонной агрессии. "
            "Нужен понятный следующий шаг."
        ),
        "blocks": [
            {"page": "home", "section": "value_block", "key": "badge", "label": "Value block badge", "maxLength": 60},
            {
                "page": "home",
                "section": "value_block",
                "key": "paragraph_1",
                "label": "Value block paragraph 1",
                "maxLength": 300,
            },
            {
                "page": "home",
                "section": "value_block",
                "key": "paragraph_2",
                "label": "Value block paragraph 2",
                "maxLength": 300,
            },
            {
                "page": "home",
                "section": "value_block",
                "key": "paragraph_3",
                "label": "Value block paragraph 3",
                "maxLength": 300,
            },
            {"page": "home", "section": "value_block", "key": "cta", "label": "Value block CTA", "maxLength": 40},
            {"page": "about", "section": "cta_section", "key": "title", "label": "Bottom CTA title", "maxLength": 100},
            {
                "page": "about",
                "section": "cta_section",
                "key": "description",
                "label": "Bottom CTA description",
                "maxLength": 300,
            },
            {
                "page": "about",
                "section": "cta_section",
                "key": "button_consultation",
                "label": "Bottom CTA consultation button",
                "maxLength": 40,
            },
            {
                "page": "about",
                "section": "cta_section",
                "key": "button_shop",
                "label": "Bottom CTA shop button",
                "maxLength": 40,
            },
        ],
    },
]

_IMAGE_SLOTS: list[dict[str, Any]] = [
    {
        "slotId": "home.hero.background",
        "title": "Hero Background",
        "description": "Главный фон для первого экрана сайта.",
        "page": "home",
        "section": "hero",
        "key": "background",
        "alt": "Главный фон сайта",
        "recommendedWidth": 1600,
        "recommendedHeight": 900,
        "promptGuidance": (
            "wide cinematic exterior of a premium venue at golden hour, layered architecture, "
            "empty plaza, blank facades without print, dusk skyline reflected in glass"
        ),
    },
    {
        "slotId": "home.about_preview.portrait",
        "title": "About Preview Portrait",
        "description": "Портрет/образ для превью раздела о бренде на главной.",
        "page": "home",
        "section": "about_preview",
        "key": "portrait",
        "alt": "Портрет для превью о бренде",
        "recommendedWidth": 1200,
        "recommendedHeight": 1600,
        "promptGuidance": (
            "editorial three-quarter portrait of one specialist, plain unbranded wardrobe, "
            "soft key light, shallow depth, indoor window rim light"
        ),
    },
    {
        "slotId": "about.hero.atelier",
        "title": "Atelier Scene",
        "description": "Атмосферная сцена мастерской/пространства бренда.",
        "page": "about",
        "section": "hero",
        "key": "atelier",
        "alt": "Ателье бренда",
        "recommendedWidth": 1200,
        "recommendedHeight": 800,
        "promptGuidance": (
            "spacious empty atelier interior, daylight through tall windows, warm plaster walls, "
            "tools on a table with unlabeled surfaces, north-light studio loft"
        ),
    },
    {
        "slotId": "about.founder.portrait",
        "title": "Founder Portrait",
        "description": "Главный портрет основателя для страницы about.",
        "page": "about",
        "section": "founder",
        "key": "portrait",
        "alt": "Портрет основателя бренда",
        "recommendedWidth": 1200,
        "recommendedHeight": 1600,
        "promptGuidance": (
            "founder seated portrait, dark studio backdrop, warm Rembrandt light, "
            "plain clothing without logos, seated against charcoal backdrop"
        ),
    },
    {
        "slotId": "about.philosophy.ingredients",
        "title": "Philosophy Visual",
        "description": "Иллюстрация для блока принципов / материалов бренда.",
        "page": "about",
        "section": "philosophy",
        "key": "ingredients",
        "alt": "Визуал для блока принципов",
        "recommendedWidth": 1200,
        "recommendedHeight": 800,
        "promptGuidance": (
            "macro still life of raw unlabeled materials and textures, tactile surfaces, "
            "soft daylight, no packaging print, linen stone and ceramic cluster"
        ),
    },
    {
        "slotId": "about.process.crafting",
        "title": "Process Visual",
        "description": "Сцена процесса работы для страницы about.",
        "page": "about",
        "section": "process",
        "key": "crafting",
        "alt": "Процесс работы бренда",
        "recommendedWidth": 1200,
        "recommendedHeight": 800,
        "promptGuidance": (
            "documentary over-shoulder of hands working with tools, no screens, "
            "clean bench, brand-neutral, over-shoulder craft bench"
        ),
    },
]


class SiteStudioAIError(RuntimeError):
    """Raised when Site Studio AI orchestration fails."""


def _as_string(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _as_string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    result: list[str] = []
    for item in value:
        text = _as_string(item)
        if text:
            result.append(text)
    return result


_CONTENT_PACK_BLOCK_KEYS: tuple[str, ...] = (
    "blocks",
    "contentBlocks",
    "content_blocks",
    "items",
    "entries",
    "fields",
)
_CONTENT_PACK_CONTAINER_KEYS: tuple[str, ...] = (
    "contentPack",
    "content_pack",
    "pack",
    "data",
    "result",
    "payload",
    "output",
)


def _iter_content_pack_containers(payload: dict[str, Any]) -> list[dict[str, Any]]:
    containers: list[dict[str, Any]] = [payload]
    for key in _CONTENT_PACK_CONTAINER_KEYS:
        nested = payload.get(key)
        if isinstance(nested, dict):
            containers.append(nested)
    return containers


def _extract_content_pack_blocks(payload: dict[str, Any]) -> list[dict[str, Any]] | None:
    for container in _iter_content_pack_containers(payload):
        for key in _CONTENT_PACK_BLOCK_KEYS:
            candidate = container.get(key)
            if isinstance(candidate, list):
                blocks = [item for item in candidate if isinstance(item, dict)]
                if blocks:
                    return blocks
    return None


def _resolve_block_identity_from_hint(
    hint: str,
    *,
    expected_by_identity: set[tuple[str, str, str]],
    expected_by_key: dict[str, list[tuple[str, str, str]]],
) -> tuple[str, str, str] | None:
    normalized = hint.strip().lower()
    if not normalized:
        return None
    tokens = [part for part in re.split(r"[./:|>\s]+", normalized) if part]
    if len(tokens) >= 3:
        for idx in range(len(tokens) - 2):
            candidate = (tokens[idx], tokens[idx + 1], tokens[idx + 2])
            if candidate in expected_by_identity:
                return candidate
    if tokens:
        key_matches = expected_by_key.get(tokens[-1], [])
        if len(key_matches) == 1:
            return key_matches[0]
        if len(tokens) >= 2:
            section = tokens[-2]
            section_matches = [identity for identity in key_matches if identity[1] == section]
            if len(section_matches) == 1:
                return section_matches[0]
    return None


def _extract_json_object(raw: str) -> dict[str, Any]:
    normalized = raw.strip()
    if not normalized:
        raise SiteStudioAIError("AI returned an empty response")

    try:
        parsed = extract_llm_json_payload(normalized)
    except ValueError as exc:
        raise SiteStudioAIError("AI returned invalid JSON") from exc
    if isinstance(parsed, dict):
        return parsed
    if isinstance(parsed, list):
        dict_items = [item for item in parsed if isinstance(item, dict)]
        if len(dict_items) == 1:
            return dict_items[0]
        if dict_items:
            merged: dict[str, Any] = {}
            for item in dict_items:
                merged.update(item)
            return merged
    raise SiteStudioAIError("AI returned JSON with unsupported root type")


def _truncate_history(items: list[dict[str, Any]], limit: int) -> list[dict[str, Any]]:
    return items[:limit]


def _find_content_pack(pack_key: str) -> dict[str, Any]:
    normalized = pack_key.strip().lower()
    for pack in _CONTENT_PACKS:
        if pack["key"] == normalized:
            return pack
    raise SiteStudioAIError(f"Unknown content pack: {pack_key}")


def _find_image_slot(slot_id: str) -> dict[str, Any]:
    normalized = slot_id.strip()
    for slot in _IMAGE_SLOTS:
        if slot["slotId"] == normalized:
            return slot
    raise SiteStudioAIError(f"Unknown image slot: {slot_id}")


class SiteStudioAIService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def close(self) -> None:
        return None

    def get_catalog(self) -> dict[str, Any]:
        return {
            "contentPacks": [
                {
                    "key": pack["key"],
                    "title": pack["title"],
                    "description": pack["description"],
                    "blockCount": len(pack["blocks"]),
                }
                for pack in _CONTENT_PACKS
            ],
            "imageSlots": [
                {
                    "slotId": slot["slotId"],
                    "title": slot["title"],
                    "description": slot["description"],
                    "page": slot["page"],
                    "section": slot["section"],
                    "key": slot["key"],
                    "alt": slot["alt"],
                    "recommendedWidth": slot["recommendedWidth"],
                    "recommendedHeight": slot["recommendedHeight"],
                }
                for slot in _IMAGE_SLOTS
            ],
        }

    def get_draft_state(self, instance: UserSiteInstance) -> dict[str, Any]:
        raw = instance.brief_json if isinstance(instance.brief_json, dict) else {}
        site_blueprint = raw.get("siteBlueprint")

        return {
            **raw,
            "brief": _as_string(raw.get("brief")) or instance.site_topic or "",
            "siteBlueprint": site_blueprint if isinstance(site_blueprint, dict) else None,
            "assistantMessages": [item for item in raw.get("assistantMessages", []) if isinstance(item, dict)],
            "contentDrafts": [item for item in raw.get("contentDrafts", []) if isinstance(item, dict)],
            "seoDrafts": [item for item in raw.get("seoDrafts", []) if isinstance(item, dict)],
            "imageDrafts": [item for item in raw.get("imageDrafts", []) if isinstance(item, dict)],
        }

    def build_image_generation_input(
        self,
        instance: UserSiteInstance,
        *,
        slot_id: str,
        prompt: str | None = None,
        negative_prompt: str | None = None,
        width: int | None = None,
        height: int | None = None,
        steps: int | None = None,
    ) -> dict[str, Any]:
        slot = _find_image_slot(slot_id)
        state = self.get_draft_state(instance)
        blueprint = state.get("siteBlueprint") if isinstance(state.get("siteBlueprint"), dict) else {}
        visual_direction = sanitize_z_image_visual_prompt(_as_string((blueprint or {}).get("visualDirection")))
        hero_mood = sanitize_z_image_visual_prompt(_as_string((blueprint or {}).get("heroMood")))
        audience = sanitize_z_image_visual_prompt(", ".join(_as_string_list((blueprint or {}).get("audience"))))
        _as_string(state.get("brief"))[:500]

        final_prompt = _as_string(prompt)
        if final_prompt:
            final_prompt = sanitize_z_image_visual_prompt(final_prompt)
            if not extract_english_wordmarks(final_prompt) and (
                _SITE_STUDIO_IMAGE_NO_TEXT_POSITIVE not in final_prompt
            ):
                final_prompt = f"{final_prompt.rstrip('.')}. {_SITE_STUDIO_IMAGE_NO_TEXT_POSITIVE}"
        else:
            # Visual-only defaults: never inject site_title/brand names — Comfy paints them as text.
            context_bits: list[str] = []
            topic_visual = sanitize_z_image_visual_prompt(instance.site_topic or "")
            if topic_visual:
                context_bits.append(f"scene domain: {topic_visual}")
            if visual_direction:
                context_bits.append(f"visual direction: {visual_direction}")
            if hero_mood:
                context_bits.append(f"mood: {hero_mood}")
            if audience:
                context_bits.append(f"audience vibe: {audience}")
            context_line = ". ".join(context_bits)
            lead = slot["promptGuidance"]
            final_prompt = (
                f"{lead}. {context_line}. {_SITE_STUDIO_IMAGE_NO_TEXT_POSITIVE}"
                if context_line
                else f"{lead}. {_SITE_STUDIO_IMAGE_NO_TEXT_POSITIVE}"
            )
            final_prompt = sanitize_z_image_visual_prompt(final_prompt)
            if _SITE_STUDIO_IMAGE_NO_TEXT_POSITIVE not in final_prompt:
                final_prompt = f"{final_prompt.rstrip('.')}. {_SITE_STUDIO_IMAGE_NO_TEXT_POSITIVE}"

        raw_w = int(width or 0) or int(slot.get("recommendedWidth") or 0) or 1024
        raw_h = int(height or 0) or int(slot.get("recommendedHeight") or 0) or 1024
        snapped_w, snapped_h = snap_flux2_klein_latent(raw_w, raw_h)
        return {
            "slot": slot,
            "input": {
                "prompt": final_prompt,
                "negative_prompt": site_studio_image_negative_prompt(negative_prompt),
                "width": snapped_w,
                "height": snapped_h,
                "steps": int(steps or 4),
                # Site Studio stills: Flux.2 Klein distilled (not z-image 01_top).
                "workflow_key": _SITE_STUDIO_IMAGE_WORKFLOW_KEY,
                "workflow_template": _SITE_STUDIO_IMAGE_WORKFLOW_KEY,
            },
        }

    async def generate_brief_blueprint(
        self,
        instance: UserSiteInstance,
        *,
        user_id: str,
        prompt: str | None = None,
    ) -> dict[str, Any]:
        draft_state = self.get_draft_state(instance)
        source_brief = (
            _as_string(prompt) or _as_string(draft_state.get("brief")) or instance.site_topic or instance.site_title
        )
        ai_prompt = (
            "Ты стратег Site Studio EliteEW. "
            "На основе сырого описания собери краткий site brief и структуру сайта. "
            "Ответ по схеме: "
            '{"brief":"...",'
            '"siteBlueprint":{"brandCore":"...",'
            '"audience":["..."],'
            '"offer":"...",'
            '"toneOfVoice":["..."],'
            '"visualDirection":"...",'
            '"heroMood":"...",'
            '"cta":"...",'
            '"keywords":["..."],'
            '"pages":[{"id":"home","goal":"..."},{"id":"about","goal":"..."},{"id":"shop","goal":"..."}]}}. '
            "Пиши по-русски, предметно, без воды."
        )
        context = (
            f"Название сайта: {instance.site_title}\n"
            f"Тематика: {instance.site_topic or 'не указана'}\n"
            f"Сырой brief: {source_brief}"
        )
        parsed = await self._complete_json_prompt(
            prompt=ai_prompt,
            context=context,
            user_id=user_id,
            temperature=0.35,
            max_tokens=2200,
        )

        blueprint = parsed.get("siteBlueprint")
        next_state = {
            **draft_state,
            "brief": _as_string(parsed.get("brief")) or source_brief,
            "siteBlueprint": blueprint if isinstance(blueprint, dict) else None,
        }
        await self._persist_state(instance, next_state)
        return self.get_draft_state(instance)

    async def assist(
        self,
        instance: UserSiteInstance,
        *,
        user_id: str,
        message: str,
    ) -> dict[str, Any]:
        draft_state = self.get_draft_state(instance)
        history = [item for item in draft_state.get("assistantMessages", []) if isinstance(item, dict)]
        history_text = "\n".join(
            f"{_as_string(item.get('role'))}: {_as_string(item.get('content'))}" for item in history[-8:]
        )
        context = (
            f"Название сайта: {instance.site_title}\n"
            f"Тематика: {instance.site_topic or 'не указана'}\n"
            f"Brief: {_as_string(draft_state.get('brief'))}\n"
            f"Blueprint: {json.dumps(draft_state.get('siteBlueprint') or {}, ensure_ascii=False)}\n"
            f"История:\n{history_text}"
        )
        prompt = (
            "Ты AI-ассистент Site Studio. Отвечай по-русски, предметно и практично. "
            "Помогай улучшать brief, структуру сайта, контент, SEO и визуалы. "
            "Если есть риск или пробел в брифе, коротко укажи это и предложи следующий шаг.\n\n"
            f"Сообщение пользователя: {message.strip()}"
        )
        response = await self._complete_text_prompt(
            prompt=prompt,
            context=context,
            user_id=user_id,
            temperature=0.45,
            max_tokens=1600,
        )

        user_message = {
            "id": str(uuid4()),
            "role": "user",
            "content": message.strip(),
            "createdAt": utc_now_iso(),
        }
        assistant_message = {
            "id": str(uuid4()),
            "role": "assistant",
            "content": response.strip(),
            "createdAt": utc_now_iso(),
        }
        next_state = {
            **draft_state,
            "assistantMessages": _truncate_history([assistant_message, user_message, *history], 18),
        }
        await self._persist_state(instance, next_state)
        return {
            "message": assistant_message,
            "drafts": self.get_draft_state(instance),
        }

    async def generate_content_pack(
        self,
        instance: UserSiteInstance,
        *,
        user_id: str,
        pack_key: str,
    ) -> dict[str, Any]:
        pack = _find_content_pack(pack_key)
        draft_state = self.get_draft_state(instance)
        expected_identities = [(block["page"], block["section"], block["key"]) for block in pack["blocks"]]
        expected_by_identity = set(expected_identities)
        expected_by_key: dict[str, list[tuple[str, str, str]]] = {}
        for page, section, key in expected_identities:
            expected_by_key.setdefault(key, []).append((page, section, key))
        schema_lines = [
            (
                f'- page="{block["page"]}", section="{block["section"]}", '
                f'key="{block["key"]}", label="{block["label"]}", maxLength={block["maxLength"]}'
            )
            for block in pack["blocks"]
        ]
        prompt = (
            "Ты копирайтер Site Studio. "
            f"Сгенерируй pack '{pack['title']}' для сайта. Ответ по схеме: "
            '{"title":"...", "summary":"...", "blocks":[{"page":"...","section":"...","key":"...","value":"..."}]}. '
            f"Фокус пака: {pack['prompt_focus']}\n"
            f"Ограничение шаблона: {_OLENTI_STOREFRONT_VERTICAL}"
        )
        context = (
            f"Название сайта: {instance.site_title}\n"
            f"Тематика: {instance.site_topic or 'не указана'}\n"
            f"Brief: {_as_string(draft_state.get('brief'))}\n"
            f"Blueprint: {json.dumps(draft_state.get('siteBlueprint') or {}, ensure_ascii=False)}\n"
            f"{_OLENTI_STOREFRONT_VERTICAL}\n"
            "Нужно заполнить ровно эти поля:\n" + "\n".join(schema_lines)
        )
        parsed = await self._complete_json_prompt(
            prompt=prompt,
            context=context,
            user_id=user_id,
            temperature=0.55,
            max_tokens=2600,
        )

        parsed_blocks = _extract_content_pack_blocks(parsed)
        canonical_blocks = parsed.get("blocks")
        has_canonical_blocks = isinstance(canonical_blocks, list) and any(
            isinstance(item, dict) for item in canonical_blocks
        )
        if not has_canonical_blocks:
            logger.info(
                "[SiteStudioAI] Content pack %s returned non-canonical blocks; normalization pass (keys=%s)",
                pack_key,
                sorted(parsed.keys()),
            )
            parsed = await self._normalize_content_pack_payload(
                parsed_payload=parsed,
                schema_lines=schema_lines,
                prompt_focus=pack["prompt_focus"],
                user_id=user_id,
            )
            parsed_blocks = _extract_content_pack_blocks(parsed)
        if parsed_blocks is None:
            raise SiteStudioAIError("Content pack JSON is missing blocks")

        values_by_identity: dict[tuple[str, str, str], str] = {}
        for item in parsed_blocks:
            if not isinstance(item, dict):
                continue
            value = _as_string(item.get("value")) or _as_string(item.get("text")) or _as_string(item.get("content"))
            if not value:
                continue

            identity: tuple[str, str, str] | None = None
            page = _as_string(item.get("page"))
            section = _as_string(item.get("section"))
            key = _as_string(item.get("key"))
            if page and section and key:
                direct = (page, section, key)
                if direct in expected_by_identity:
                    identity = direct

            if identity is None and key:
                key_matches = expected_by_key.get(key)
                if key_matches and len(key_matches) == 1:
                    identity = key_matches[0]

            if identity is None:
                raw_hint = _as_string(item.get("id")) or _as_string(item.get("field")) or _as_string(item.get("path"))
                if raw_hint:
                    identity = _resolve_block_identity_from_hint(
                        raw_hint,
                        expected_by_identity=expected_by_identity,
                        expected_by_key=expected_by_key,
                    )

            if identity is not None:
                values_by_identity[identity] = value

        blocks = [
            {
                **block,
                "value": values_by_identity.get((block["page"], block["section"], block["key"]), ""),
            }
            for block in pack["blocks"]
        ]
        if not any(_as_string(block.get("value")) for block in blocks):
            raise SiteStudioAIError("Content pack generation returned empty values")

        draft = {
            "id": str(uuid4()),
            "draftKey": pack["key"],
            "title": _as_string(parsed.get("title")) or pack["title"],
            "summary": _as_string(parsed.get("summary")) or pack["description"],
            "createdAt": utc_now_iso(),
            "blocks": blocks,
        }
        existing_drafts = [item for item in draft_state.get("contentDrafts", []) if isinstance(item, dict)]
        next_state = {
            **draft_state,
            "contentDrafts": _truncate_history([draft, *existing_drafts], 10),
        }
        await self._persist_state(instance, next_state)
        return {
            "draft": draft,
            "drafts": self.get_draft_state(instance),
        }

    async def _normalize_content_pack_payload(
        self,
        *,
        parsed_payload: dict[str, Any],
        schema_lines: list[str],
        prompt_focus: str,
        user_id: str,
    ) -> dict[str, Any]:
        """Normalize non-canonical content-pack payload into the required blocks schema."""
        prompt = (
            "Ты приводишь JSON к канонической схеме Site Studio content pack. "
            "Ответ по схеме: "
            '{"title":"...", "summary":"...", "blocks":[{"page":"...","section":"...","key":"...","value":"..."}]}. '
            "Ключ blocks обязателен."
        )
        raw_json = json.dumps(parsed_payload, ensure_ascii=False)
        context = (
            f"Фокус пака: {prompt_focus}\n"
            f"{_OLENTI_STOREFRONT_VERTICAL}\n"
            "Нужно заполнить ровно эти поля:\n"
            + "\n".join(schema_lines)
            + "\n\nИсходный JSON для нормализации:\n"
            + raw_json[:9000]
            + "\n\nПравила: сохрани исходный смысл, title и summary; для неизвестных значений оставь value пустым."
        )
        return await self._complete_json_prompt(
            prompt=prompt,
            context=context,
            user_id=user_id,
            temperature=0.2,
            max_tokens=2600,
        )

    async def generate_seo_pack(
        self,
        instance: UserSiteInstance,
        *,
        user_id: str,
    ) -> dict[str, Any]:
        draft_state = self.get_draft_state(instance)
        prompt = (
            "Ты SEO-стратег Site Studio. "
            "Ответ по схеме: "
            '{"title":"...",'
            '"summary":"...",'
            '"siteSettings":{"siteTitle":"...", "siteDescription":"..."},'
            '"keywords":["..."],'
            '"suggestions":["..."]}. '
            "Пиши по-русски, ориентируйся на понятное позиционирование и живой пользовательский intent. "
            "Сайт имеет формат витрины/магазина и услуг. Пиши title/description строго по тематике клиента, без упоминания парфюмерии и демо-бренда Ollenti."
        )
        context = (
            f"Название сайта: {instance.site_title}\n"
            f"Тематика: {instance.site_topic or 'не указана'}\n"
            f"Brief: {_as_string(draft_state.get('brief'))}\n"
            f"Blueprint: {json.dumps(draft_state.get('siteBlueprint') or {}, ensure_ascii=False)}"
        )
        parsed = await self._complete_json_prompt(
            prompt=prompt,
            context=context,
            user_id=user_id,
            temperature=0.4,
            max_tokens=1600,
        )

        raw_site_settings = parsed.get("siteSettings")
        site_settings = raw_site_settings if isinstance(raw_site_settings, dict) else {}
        draft = {
            "id": str(uuid4()),
            "title": _as_string(parsed.get("title")) or "SEO Pack",
            "summary": _as_string(parsed.get("summary")) or "Краткий SEO-набор для описания и позиционирования сайта.",
            "createdAt": utc_now_iso(),
            "siteSettings": {
                "siteTitle": _as_string(site_settings.get("siteTitle")) or instance.site_title,
                "siteDescription": _as_string(site_settings.get("siteDescription")) or instance.site_topic,
            },
            "keywords": _as_string_list(parsed.get("keywords")),
            "suggestions": _as_string_list(parsed.get("suggestions")),
        }
        existing_drafts = [item for item in draft_state.get("seoDrafts", []) if isinstance(item, dict)]
        next_state = {
            **draft_state,
            "seoDrafts": _truncate_history([draft, *existing_drafts], 8),
        }
        await self._persist_state(instance, next_state)
        return {
            "draft": draft,
            "drafts": self.get_draft_state(instance),
        }

    async def save_image_draft(
        self,
        instance: UserSiteInstance,
        *,
        slot_id: str,
        image_url: str,
        prompt: str,
        negative_prompt: str | None = None,
        width: int | None = None,
        height: int | None = None,
    ) -> dict[str, Any]:
        slot = _find_image_slot(slot_id)
        draft_state = self.get_draft_state(instance)
        draft = {
            "id": str(uuid4()),
            "slotId": slot["slotId"],
            "title": slot["title"],
            "description": slot["description"],
            "page": slot["page"],
            "section": slot["section"],
            "key": slot["key"],
            "alt": slot["alt"],
            "imageUrl": image_url.strip(),
            "prompt": prompt.strip(),
            "negativePrompt": _as_string(negative_prompt),
            "width": int(width or slot["recommendedWidth"]),
            "height": int(height or slot["recommendedHeight"]),
            "createdAt": utc_now_iso(),
        }
        existing_drafts = [item for item in draft_state.get("imageDrafts", []) if isinstance(item, dict)]
        next_state = {
            **draft_state,
            "imageDrafts": _truncate_history([draft, *existing_drafts], 12),
        }
        await self._persist_state(instance, next_state)
        return {
            "draft": draft,
            "drafts": self.get_draft_state(instance),
        }

    async def _persist_state(self, instance: UserSiteInstance, next_state: dict[str, Any]) -> None:
        inst_mut: Any = instance
        inst_mut.brief_json = next_state
        await self.db.commit()
        await self.db.refresh(instance)

    async def _complete_json_prompt(
        self,
        *,
        prompt: str,
        context: str,
        user_id: str,
        temperature: float,
        max_tokens: int,
    ) -> dict[str, Any]:
        response = await self._complete_text_prompt(
            prompt=prompt,
            context=context,
            user_id=user_id,
            temperature=temperature,
            max_tokens=max_tokens,
            json_format=True,
        )

        async def _repair_json_response(reason: str) -> dict[str, Any]:
            logger.info("Site Studio AI JSON parse failed, trying repair pass: %s", reason)
            repair_prompt = (
                "Исправь синтаксис JSON-ответа (сервер llama.cpp ограничивает синтаксис JSON). "
                "Сохрани исходный смысл и поля, не добавляй комментарии и не меняй структуру, "
                "кроме минимально нужных синтаксических правок."
            )
            repair_context = (
                f"Исходная задача модели:\n{prompt}\n\n"
                f"Контекст:\n{context[:3000]}\n\n"
                f"Невалидный ответ для починки:\n{response[:8000]}"
            )
            repaired = await self._complete_text_prompt(
                prompt=repair_prompt,
                context=repair_context,
                user_id=user_id,
                temperature=0.1,
                max_tokens=min(max_tokens, 2400),
                json_format=True,
            )
            return _extract_json_object(repaired)

        # Fast malformed guard: parser may recover fragments from broken JSON, but content-pack/SEO contracts require
        # a fully balanced object before we trust the first pass.
        if response.count("{") != response.count("}") or response.count("[") != response.count("]"):
            return await _repair_json_response("unbalanced_brackets")

        try:
            parsed = _extract_json_object(response)
        except SiteStudioAIError as exc:
            return await _repair_json_response(str(exc))

        if not _as_string(parsed.get("title")):
            return await _repair_json_response("missing_title")
        return parsed

    async def _complete_text_prompt(
        self,
        *,
        prompt: str,
        context: str,
        user_id: str,
        temperature: float,
        max_tokens: int,
        json_format: bool = False,
    ) -> str:
        from api.services.doc_editor_service import DocEditorService  # noqa: PLC0415

        db_pool = await get_asyncpg_pool()
        ugs_service = UnifiedGenerationService(self.db)
        service = DocEditorService(db_pool, ugs_service)
        try:
            return await service.ai_complete(
                prompt=prompt,
                context=context,
                temperature=temperature,
                max_tokens=max_tokens,
                user_id=user_id,
                action_mode="site_studio",
                context_scope="site_workspace",
                json_format=json_format,
            )
        except Exception as exc:  # noqa: BLE001
            logger.exception("Site Studio AI text generation failed")
            raise SiteStudioAIError(f"Site Studio AI generation failed: {exc}") from exc
        finally:
            await ugs_service.close()
