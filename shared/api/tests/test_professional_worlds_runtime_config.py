# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T && TZBrand
# ---
# Purpose:
# Guardrails for Professional Worlds runtime config SQL and user-facing realtor catalog copy.
# Invariants:
# - Tests read source only; no live Postgres.
# - Runtime module fallback labels must stay human-readable for Russian users.
# Related:
# - api/services/professional_worlds/runtime_config_service.py
# - api/migrations/applied/20260529_02_pw_realtor_runtime_labels_ru.sql
# ---

from __future__ import annotations

import json
import re
from pathlib import Path

REALTOR_RUNTIME_LABEL_SEED = "migrations/applied/20260529_02_pw_realtor_runtime_labels_ru.sql"
ACTIVE_REALTOR_RUNTIME_COPY_SEEDS = (REALTOR_RUNTIME_LABEL_SEED,)
REALTOR_LEGACY_CATALOG_SEEDS = (
    "migrations/applied/20260505_03_professional_worlds_next.sql",
    "migrations/applied/20260523_pw_realtor_pro_four_modules_catalog.sql",
)

BANNED_REALTOR_FALLBACK_COPY = (
    "AI-сценарии",
    "AI Playbooks",
    "AI-плейбуки",
    "Objection library",
    "Lead inbox and qualification",
    "Showing calendar and outcome capture",
    "Lead qualification",
    "Buyer match explain",
    "Realtor lead v1",
    "Premium gallery polish",
    "Hero cover",
)

LEGACY_REALTOR_SEED_COPY_EXCEPTIONS = {
    "migrations/applied/20260505_03_professional_worlds_next.sql": ("Lead inbox and qualification",),
    "migrations/applied/20260523_pw_realtor_pro_four_modules_catalog.sql": ("Objection library",),
}

EXPECTED_REALTOR_RUNTIME_MODULE_LABELS = {
    "realtor_leads": "Обращения",
    "realtor_buyers": "Покупатели",
    "realtor_sellers": "Продавцы",
    "realtor_pipeline": "Сделки",
    "realtor_documents": "Документы",
    "realtor_marketing": "Продвижение",
    "realtor_insights": "Аналитика",
    "realtor_playbooks": "Сценарии",
    "realtor_showings": "Показы",
    "realtor_tasks": "Задачи",
    "realtor_communications": "Контакты",
    "realtor_objections": "Ответы на возражения",
}

EXPECTED_REALTOR_ACTION_LABELS = {
    "lead_qualification": "Проверка обращения",
    "buyer_match_explain": "Объяснение подбора",
    "seller_valuation_narrative": "Контекст оценки продавца",
    "showing_followup_message": "Сообщение после показа",
    "negotiation_prep": "Подготовка к переговорам",
    "document_checklist_explain": "Пояснение по документам",
    "listing_quality_audit": "Проверка качества объявления",
    "weekly_sales_plan": "План недели",
    "objection_handling_variants": "Ответы на возражение",
}

EXPECTED_REALTOR_PLAYBOOK_LABELS = {
    "object_to_sales_package": "Объект в пакет материалов",
    "lead_to_first_contact": "Обращение в первый контакт",
    "weekly_pipeline_review": "Еженедельный обзор сделок",
    "seller_onboarding_to_campaign": "Продавец в план продвижения",
    "buyer_match_to_showing_plan": "Подбор в план показа",
}

EXPECTED_REALTOR_SCHEMA_LABELS = {
    "realtor_lead": "Обращение риэлтора",
    "realtor_buyer_requirement": "Запрос покупателя",
    "realtor_seller_profile": "Профиль продавца",
}

EXPECTED_REALTOR_LEGACY_PHOTO_PRESET_LABELS = {
    "realtor_hero_cover": "Обложка объекта",
    "marketplace_crop": "Кадрирование для площадок",
    "document_safe_cleanup": "Нейтральная чистка документов",
    "premium_gallery": "Премиальная галерея",
}

EXPECTED_REALTOR_STATUS_VOCABULARY = {
    "lead": {"new", "contacted", "qualified", "converted", "lost"},
    "task": {"open", "done"},
    "showing": {"planned", "interested", "follow_up", "declined"},
    "marketing": {"draft", "active", "paused"},
    "publication": {"pending", "published", "failed"},
}


def test_runtime_config_sql_omits_prompt_templates_from_user_payload() -> None:
    """User runtime must not SELECT prompt_template for AI actions or photo presets."""
    root = Path(__file__).resolve().parents[1]
    text = (root / "services/professional_worlds/runtime_config_service.py").read_text(encoding="utf-8")
    ai_idx = text.find("FROM professional_ai_actions")
    assert ai_idx != -1
    ai_window = text[ai_idx : ai_idx + 320]
    assert "prompt_template" not in ai_window

    ph_idx = text.find("FROM professional_photo_presets")
    assert ph_idx != -1
    ph_window = text[ph_idx : ph_idx + 380]
    assert "prompt_template" not in ph_window


def test_runtime_config_exposes_module_description_fallback() -> None:
    """Runtime modules must carry fallback descriptions seeded for user-facing empty states."""
    root = Path(__file__).resolve().parents[1]
    service_text = (root / "services/professional_worlds/runtime_config_service.py").read_text(encoding="utf-8")
    schema_text = (root / "schemas/professional_worlds.py").read_text(encoding="utf-8")

    modules_idx = service_text.find("FROM professional_vertical_modules")
    assert modules_idx != -1
    modules_window = service_text[modules_idx - 420 : modules_idx + 220]
    assert "m.description AS module_description" in modules_window
    assert "module_description: str | None = None" in schema_text


def test_realtor_runtime_catalog_seed_keeps_human_ru_labels() -> None:
    """DB fallback copy must not leak English/admin module labels into user UI."""
    root = Path(__file__).resolve().parents[1]
    text = (root / REALTOR_RUNTIME_LABEL_SEED).read_text(encoding="utf-8")

    for module_key, label in EXPECTED_REALTOR_RUNTIME_MODULE_LABELS.items():
        assert f"('{module_key}', '{label}'," in text

    assert "Lead inbox and qualification" not in text
    assert "Showing calendar and outcome capture" not in text


def test_active_realtor_runtime_fallback_copy_has_no_legacy_jargon() -> None:
    """Active/pending fallback copy must stay human; legacy applied seeds are explicit exceptions."""
    root = Path(__file__).resolve().parents[1]

    for relative_path in ACTIVE_REALTOR_RUNTIME_COPY_SEEDS:
        text = (root / relative_path).read_text(encoding="utf-8")
        for banned in BANNED_REALTOR_FALLBACK_COPY:
            assert banned not in text, f"{relative_path} leaks {banned!r}"

    for relative_path, allowed_terms in LEGACY_REALTOR_SEED_COPY_EXCEPTIONS.items():
        text = (root / relative_path).read_text(encoding="utf-8")
        for allowed in allowed_terms:
            assert allowed in text, f"legacy exception drifted: {relative_path}"


def test_runtime_label_cleanup_covers_legacy_realtor_catalog_seeds() -> None:
    """The active cleanup seed must rewrite every Realtor module introduced by old English seeds."""
    root = Path(__file__).resolve().parents[1]
    cleanup = (root / ACTIVE_REALTOR_RUNTIME_COPY_SEEDS[0]).read_text(encoding="utf-8")
    legacy_text = "\n".join((root / path).read_text(encoding="utf-8") for path in REALTOR_LEGACY_CATALOG_SEEDS)

    legacy_module_keys = set(re.findall(r"'(realtor_[a-z_]+)'", legacy_text))
    missing = legacy_module_keys - set(EXPECTED_REALTOR_RUNTIME_MODULE_LABELS)
    assert not missing

    for module_key in legacy_module_keys:
        label = EXPECTED_REALTOR_RUNTIME_MODULE_LABELS[module_key]
        assert f"('{module_key}', '{label}'," in cleanup


def test_runtime_label_cleanup_covers_exposed_action_playbook_schema_and_preset_labels() -> None:
    """Runtime/admin-visible seed labels must have Russian fallback names before frontend i18n."""
    root = Path(__file__).resolve().parents[1]
    cleanup = (root / REALTOR_RUNTIME_LABEL_SEED).read_text(encoding="utf-8")

    for action_key, label in EXPECTED_REALTOR_ACTION_LABELS.items():
        assert f"'{action_key}', '{label}'," in cleanup

    for playbook_key, label in EXPECTED_REALTOR_PLAYBOOK_LABELS.items():
        assert f"'{playbook_key}', '{label}'," in cleanup

    for schema_key, label in EXPECTED_REALTOR_SCHEMA_LABELS.items():
        assert f"'{schema_key}', 1, '{label}'," in cleanup

    for preset_key, label in EXPECTED_REALTOR_LEGACY_PHOTO_PRESET_LABELS.items():
        assert f"'{preset_key}', '{label}'," in cleanup


def test_active_realtor_photo_presets_have_unique_keys() -> None:
    """Active Realtor media presets must not duplicate keys that drive frontend selector rows."""
    root = Path(__file__).resolve().parents[1]
    text = (root / "migrations/applied/20260506_01_pw_realtor_photo_presets_ru_quality.sql").read_text(encoding="utf-8")
    active_keys = re.findall(r"\(\s*'realtor',\s*'([^']+)'[\s\S]+?\n\s*true,\n\s*\d+\n\)", text)

    assert active_keys
    assert len(active_keys) == len(set(active_keys))


def test_realtor_runtime_status_vocabulary_is_documented_in_tests() -> None:
    """Known backend status buckets must have locale labels before they reach users."""
    root = Path(__file__).resolve().parents[1]
    locale_path = root.parent / "web/frontend/src/i18n/locales/ru/professionalWorlds.json"
    locale = json.loads(locale_path.read_text(encoding="utf-8"))
    realtor_pro = locale["realtorPro"]

    actual = {
        "lead": set(realtor_pro["leads"]["statuses"]),
        "task": set(realtor_pro["tasks"]["statuses"]),
        "showing": {
            "planned" if realtor_pro["showings"]["plannedStatus"] else "",
            "interested" if realtor_pro["showings"]["outcomeInterested"] else "",
            "follow_up" if realtor_pro["showings"]["outcomeFollowUp"] else "",
            "declined" if realtor_pro["showings"]["outcomeDeclined"] else "",
        },
        "marketing": set(realtor_pro["marketing"]["statuses"]),
        "publication": set(realtor_pro["marketing"]["publicationStatuses"]),
    }
    for bucket, statuses in EXPECTED_REALTOR_STATUS_VOCABULARY.items():
        assert statuses <= actual[bucket]


def test_professional_worlds_service_py_under_arch_cap() -> None:
    """Cause-First Wave 4: backend facade must stay under 800 lines."""
    root = Path(__file__).resolve().parents[1]
    service_path = root / "services/professional_worlds/service.py"
    line_count = len(service_path.read_text(encoding="utf-8").splitlines())
    assert line_count <= 800, f"service.py grew to {line_count} lines; split before merging"
