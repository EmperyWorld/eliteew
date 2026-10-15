# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Build the product-overview HTML + Markdown pack (RU + EN) and share archive.
# Invariants:
# - Share ZIP bytes depend on content, not local file timestamps.
# - Existing same-day exports are soft-retired through trash-move.
# - English is meaning-first (not a calque of Russian).
# ---
# Usage (from monorepo root or this dir):
#   python3 documentation/product/product-overview/export/build_export.py
# Optional: ELITEEW_OVERVIEW_WITH_PDF=1 (alias ELITEEW_BUYER_*) · ELITEEW_OVERVIEW_SKIP_PDF=1
# Mermaid: vendor/mermaid.min.js (auto-download once) → html/assets/; D01–D12 inline in book.
# Layout: html/{index.html,ru/,en/,assets/} · md/{ru/,en/} · share zip includes both.

from __future__ import annotations

import html
import os
import re
import shutil
import subprocess
import sys
import urllib.request
import zipfile
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

import markdown

ROOT = Path(__file__).resolve().parent
PACK = ROOT.parent
HTML_DIR = ROOT / "html"
MD_DIR = ROOT / "md"
PDF_DIR = ROOT / "pdf"
SHARE_DIR = ROOT / "share"
ASSETS = HTML_DIR / "assets"
VENDOR = ROOT / "vendor"
MERMAID_JS = VENDOR / "mermaid.min.js"
MERMAID_URL = "https://cdn.jsdelivr.net/npm/mermaid@11.6.0/dist/mermaid.min.js"
ZIP_EPOCH = (1980, 1, 1, 0, 0, 0)

BOOK_FILES: list[str] = [
    "00-README.md",
    "01-what-is-eliteew.md",
    "01a-any-device-vr.md",
    "02-threats-and-protection.md",
    "02a-agentless-instant-access.md",
    "03-regulatory-map.md",
    "03a-employee-day-adoption.md",
    "03b-industry-profiles.md",
    "03c-full-complex-source.md",
    "03d-tco-orientative.md",
    "03e-delivery-models.md",
    "03f-transfer-bom-handover.md",
    "03g-si-migration-playbook.md",
    "04-desktop-workspace.md",
    "04a-files-two-planes.md",
    "04b-document-collaboration.md",
    "05-apps-store-ai-contours.md",
    "05a-roles-org-project.md",
    "05b-generation-spend-vault-ai.md",
    "05c-single-sign-on-sessions.md",
    "06-app-index-brief.md",
    "07-android-satellite-security.md",
    "07a-internal-messenger.md",
    "07b-internal-video-calls.md",
    "07c-trusted-phone-e2ee.md",
    "07d-edge-wall-one-click.md",
    "07e-mobile-capability-matrix.md",
    "08-tauri-clients-ota.md",
    "08a-atomic-conditional-access.md",
    "09-capsules-enterprise-seats.md",
    "09a-controlled-licenses-sealed.md",
    "10-editions.md",
    "10a-native-tauri-hybrid.md",
    "10b-live-sealed-install.md",
    "10c-ops-scale-not-user-cli.md",
    "10d-external-messenger-honesty.md",
    "11-must-app-cards.md",
    "11a-should-app-cards.md",
    "11b-later-app-cards.md",
    "12-honest-limits.md",
    "13-onepager-executive.md",
    "13-onepager-ciso.md",
    "13-onepager-industry.md",
    "13-onepager-dd-rfi.md",
    "13-summary-matrix.md",
    "glossary.md",
    "14-export-pdf-html.md",
]

ONEPAGER_FILES = [
    "13-onepager-executive.md",
    "13-onepager-ciso.md",
    "13-onepager-industry.md",
    "13-onepager-dd-rfi.md",
    "13-summary-matrix.md",
    "glossary.md",
]

# HTML IA: grouped reading structure (not flat 47-item dump).
BOOK_PARTS: list[tuple[str, tuple[str, str], list[str]]] = [
    # (part_id, (ru_label, en_label), chapter stems)
    ("start", ("Вход", "Start"), ["00-README"]),
    ("product", ("Продукт", "Product"), ["01-what-is-eliteew", "01a-any-device-vr"]),
    ("security", ("Периметр и ИБ", "Perimeter & security"), ["02-threats-and-protection", "02a-agentless-instant-access"]),
    ("gift", ("Дар и внедрение", "Gift & adoption"), [
        "03-regulatory-map", "03a-employee-day-adoption", "03b-industry-profiles",
        "03c-full-complex-source", "03d-tco-orientative", "03e-delivery-models",
        "03f-transfer-bom-handover", "03g-si-migration-playbook",
    ]),
    ("desk", ("Стол и приложения", "Desk & apps"), [
        "04-desktop-workspace", "04a-files-two-planes", "04b-document-collaboration",
        "05-apps-store-ai-contours", "05a-roles-org-project", "05b-generation-spend-vault-ai",
        "05c-single-sign-on-sessions", "06-app-index-brief",
    ]),
    ("mobile", ("Мобильный и native", "Mobile & native"), [
        "07-android-satellite-security", "07a-internal-messenger", "07b-internal-video-calls",
        "07c-trusted-phone-e2ee", "07d-edge-wall-one-click", "07e-mobile-capability-matrix",
        "08-tauri-clients-ota", "08a-atomic-conditional-access",
    ]),
    ("access", ("Доступ и editions", "Access & editions"), [
        "09-capsules-enterprise-seats", "09a-controlled-licenses-sealed",
        "10-editions", "10a-native-tauri-hybrid", "10b-live-sealed-install",
        "10c-ops-scale-not-user-cli", "10d-external-messenger-honesty",
    ]),
    ("cards", ("Карточки apps", "App cards"), [
        "11-must-app-cards", "11a-should-app-cards", "11b-later-app-cards",
    ]),
    ("limits", ("Честные границы", "Honest limits"), ["12-honest-limits"]),
    ("briefs", ("Сжато", "Briefs"), [
        "13-onepager-executive", "13-onepager-ciso", "13-onepager-industry",
        "13-onepager-dd-rfi", "13-summary-matrix", "glossary", "14-export-pdf-html",
    ]),
]


MD_EXT = ["tables", "fenced_code", "nl2br", "sane_lists", "smarty"]
DIAGRAM_LINK_RE = re.compile(
    r"\[([^\]]*)\]\((?:\.\./)?assets/diagrams/(D\d+[-\w]*)\.md\)",
)
MERMAID_BLOCK_RE = re.compile(r"```mermaid\n(.*?)```", re.DOTALL)
SENSE_RE = re.compile(r"\*\*(?:Смысл|Sense):\*\*\s*(.+)")

# Shared diagram sources are Russian; EN HTML/MD apply label swaps at export.
MERMAID_EN: dict[str, str] = {
    "BYOD без разделения": "BYOD without separation",
    "Client · устройство": "Client · device",
    "FoFline · local pack + канал\\n≠ air-gap": "FoFline · local pack + channel\\n≠ air-gap",
    "Object store S3-класс\\nбайты файла\\nSeaweedFS в контуре Empery": (
        "Object store S3-class\\nfile bytes\\nSeaweedFS in Empery contour"
    ),
    "On-prem · контур заказчика": "On-prem · organization contour",
    "P0 Оглавление": "P0 Contents",
    "P2 угрозы": "P2 threats",
    "PostgreSQL\\nметаданные · ACL · версии · проект": (
        "PostgreSQL\\nmetadata · ACL · versions · project"
    ),
    "Self-host затраты · не оценка дара · ориентир": (
        "Self-host costs · not gift valuation · orientation"
    ),
    "Shadow IT / личный мессенджер": "Shadow IT / personal messenger",
    "Аналог: фото экрана": "Analog: screen photo",
    "Аттестация · СЗИ": "Certification · protective tools",
    "Браузер / APK без admin-агента": "Browser / APK without admin agent",
    "Вход": "Sign-in",
    "Глухая стена": "Blind wall",
    "Дар миру · MIT first-party": "Gift to the world · MIT first-party",
    "Даёт EliteEW": "EliteEW contributes",
    "Десктоп / серверная ОС / VR-браузер": "Desktop / server OS / VR browser",
    "Доверенный\\nвыданный ключ / seat": "Trusted\\nissued key / seat",
    "Доступ в продукт": "Product access",
    "Запуск / изучение / изменение": "Run / study / modify",
    "Защита информации": "Information protection",
    "Защищённый канал": "Protected channel",
    "ИБ / периметр": "Security / perimeter",
    "ИИ в контуре": "AI in contour",
    "ИИ в контуре проекта": "AI in project contour",
    "Канал разрешён": "Channel allowed",
    "Классы угроз": "Threat classes",
    "Контур + хост как есть": "Contour + host as-is",
    "Контур данных edition": "Edition data contour",
    "Копипаст / внешний AI": "Copy-paste / external AI",
    "Лицензия активна": "Entitlement active",
    "Личность": "Identity",
    "Личные облака": "Personal clouds",
    "Масштаб у своей службы": "Scale with own service",
    "Миграция / интегратор": "Migration / integrator",
    "Минимизация · не 100%": "Minimization · not 100%",
    "Мобильный спутник": "Mobile satellite",
    "Модифицированный сетевой сервис → source своим users": (
        "Modified network service → source to its users"
    ),
    "Нормативные ориентиры": "Regulatory orientations",
    "ОС + агенты + внешние сервисы": "OS + agents + external services",
    "Один продукт EliteEW": "One EliteEW product",
    "Оператор данных": "Data controller",
    "Опциональное сопровождение": "Optional accompaniment",
    "Организация / внедрение": "Organization / adoption",
    "Остаётся организации": "Stays with the organization",
    "Ответы EliteEW": "EliteEW responses",
    "Отказ · без детального оракула": "Deny · no detailed oracle",
    "Отрасль / день сотрудника": "Industry / employee day",
    "Периметр + роли + доступы": "Perimeter + roles + access",
    "Периметр · роли · доступ": "Perimeter · roles · access",
    "Персональные данные": "Personal data",
    "Пилот орг. единицы": "Org-unit pilot",
    "Помощь с приёмкой / SBOM": "Help with acceptance / SBOM",
    "Помощь с эксплуатацией": "Help with operations",
    "Привязка учётки": "Account binding",
    "Применение ИИ": "AI use",
    "Проект / маркетинг": "Project / marketing",
    "Рабочий контур EliteEW": "EliteEW work contour",
    "Рабочий слой + внутренний чат": "Work layer + internal chat",
    "Рабочий слой EliteEW": "EliteEW work layer",
    "Распространение по MIT": "Share under MIT",
    "Сборка + ФОТ поддержки": "Build + support payroll",
    "Сборка / стенд": "Build / staging",
    "Сверка артефактов": "Artifact check",
    "Свой контур организации": "Organization’s own contour",
    "Связь GAF / звонки": "GAF comms / calls",
    "Сканер / чужой интернет": "Scanner / foreign internet",
    "Стол + apps": "Desk + apps",
    "Стол + apps + файлы": "Desk + apps + files",
    "Типичный десктоп-контур": "Typical desktop contour",
    "Трансграничные данные": "Cross-border data",
    "Управляемые файлы": "Managed files",
    "Устройство / ключ": "Device / key",
    "Файловый менеджер": "File manager",
    "Файлы / документы": "Files / documents",
    "Хост-устройство": "Host device",
    "Юр. основания · политики": "Legal bases · policies",
    "не абсолют": "not absolute",
}

DIAGRAM_TITLE_EN: dict[str, str] = {
    "D01-hybrid-formula": "D01 — Hybrid formula (P1)",
    "D02-threat-classes": "D02 — Threat classes → responses (P2)",
    "D03-npa-split": "D03 — Norms: EliteEW contributes / stays with org (P3)",
    "D04-employee-day": "D04 — Employee day (P3a)",
    "D05-files-two-planes": "D05 — Files: two planes (P4a)",
    "D06-edge-wall": "D06 — Edge: wall and one click (P7d)",
    "D07-atomic-access": "D07 — Atomic conditional access (P8a)",
    "D08-editions": "D08 — Editions (P10)",
    "D09-tco-columns": "D09 — Cost structure: three columns (P3d)",
    "D10-reading-paths": "D10 — Reading paths (P0)",
    "D11-gift-to-world": "D11 — Gift to the world: MIT and optional accompaniment (P3e)",
    "D12-transfer-handover": "D12 — Accept the gift locally (P3f)",
}


def mermaid_for_lang(mermaid: str, lang: str) -> str:
    if lang != "en":
        return mermaid
    out = mermaid
    for ru, en in sorted(MERMAID_EN.items(), key=lambda kv: len(kv[0]), reverse=True):
        out = out.replace(ru, en)
    # Edge / decision labels that are too short for the general map
    edge_swaps = (
        ('{"Все истины?"}', '{"All true?"}'),
        ("-->|лишние входы закрыты|", "-->|extra entries closed|"),
        ("-->|1 действие|", "-->|1 action|"),
        ("-->|да|", "-->|yes|"),
        ("-->|нет|", "-->|no|"),
    )
    for ru, en in edge_swaps:
        out = out.replace(ru, en)
    return out


def diagram_title_for_lang(diag: "Diagram", lang: str) -> str:
    if lang != "en":
        return diag.title
    return DIAGRAM_TITLE_EN.get(diag.stem, diag.title)


@dataclass(frozen=True)
class Diagram:
    stem: str
    title: str
    mermaid: str
    sense: str


@dataclass(frozen=True)
class Ui:
    lang: str
    html_lang: str
    content_dir: Path
    out_html: Path
    out_md: Path
    asset_href: str  # relative from lang HTML pages
    page_title_index: str
    page_title_onepagers: str
    page_title_book: str
    page_title_diagrams: str
    brand_sub: str
    nav_menu: str
    nav_cover: str
    nav_onepagers: str
    nav_book: str
    nav_diagrams: str
    nav_cta: str
    cover_back: str
    promise_full: str
    promise_compact: str
    lede: str
    status_chip: str
    path_org: str
    path_sec: str
    path_adopt: str
    path_dd: str
    foot: str
    back_top: str
    diagram_source: str
    diagram_missing: str
    meta_index: str
    badge_note: str
    path_grid_aria: str
    pc1_step: str
    pc1_title: str
    pc1_hint: str
    pc1_go: str
    pc2_step: str
    pc2_title: str
    pc2_hint: str
    pc2_go: str
    pc3_step: str
    pc3_title: str
    pc3_hint: str
    pc3_go: str
    pc4_step: str
    pc4_title: str
    pc4_hint: str
    pc4_go: str
    handover_aria: str
    handover_kicker: str
    handover_title: str
    handover_copy: str
    toc_h2: str
    onepagers_meta: str
    diagrams_meta: str
    book_meta: str
    rail_title: str
    md_book_title: str
    md_book_blurb: str
    md_onepager_title: str
    md_diagrams_title: str
    md_diagrams_blurb: str
    md_readme: str
    layering: str


def content_dir_for(lang: str) -> Path:
    return PACK / lang


def ui_for(lang: str) -> Ui:
    content = content_dir_for(lang)
    out_html = HTML_DIR / lang
    out_md = MD_DIR / lang
    asset = "../assets"
    if lang == "ru":
        return Ui(
            lang="ru",
            html_lang="ru",
            content_dir=content,
            out_html=out_html,
            out_md=out_md,
            asset_href=asset,
            page_title_index="EliteEW — обзор продукта",
            page_title_onepagers="EliteEW — сжато",
            page_title_book="EliteEW — полный текст",
            page_title_diagrams="EliteEW — схемы D01–D12",
            brand_sub="HTML primary · не схема эксплуатации",
            nav_menu="Меню",
            nav_cover="Вход",
            nav_onepagers="Сжато",
            nav_book="Полный текст",
            nav_diagrams="Схемы",
            nav_cta="Начать →",
            cover_back="← Обложка",
            promise_full="Рабочий слой организации ∩ безопасный периметр",
            promise_compact="Рабочий слой ∩ безопасный периметр",
            lede="Открытый рабочий комплекс · дар миру по MIT · HTML — основной формат",
            status_chip="MIT · open work complex",
            path_org="Дар",
            path_sec="ИБ",
            path_adopt="Приёмка",
            path_dd="DD / RFI",
            foot=(
                "Empery World / EliteEW · <strong>HTML — основной формат</strong> · "
                "PDF второстепенный · общие визуальные токены · текст: только "
                "product overview (не маркетинговый лендинг) · не схема эксплуатации"
            ),
            back_top="Наверх",
            diagram_source="Исходник схемы (текст)",
            diagram_missing="Схема {stem} — отсутствует в assets/diagrams/",
            meta_index=(
                "Основной формат выдачи — этот HTML-бандл. Рядом — "
                '<a href="../../md/ru/README.md">Markdown-пакет</a> (`export/md/ru/`). '
                "PDF опционален (<code>ELITEEW_OVERVIEW_WITH_PDF=1</code>). "
                "Оформление: общие визуальные токены · текст: "
                "<code>product-overview/ru/</code> + <code>product-overview/en/</code>."
            ),
            badge_note=(
                "<strong>Честно:</strong> визуал и клик-механика · "
                "<strong>не</strong> маркетинговые обещания. "
                "Схемы D01–D12 · UI screenshots отложены · "
                '<a href="diagrams.html">каталог схем</a>'
            ),
            path_grid_aria="Входы в пакет",
            pc1_step="01 · Продукт",
            pc1_title="Что такое EliteEW",
            pc1_hint="Формула · editions · apps · без рекламного захода",
            pc1_go="Открыть P1 →",
            pc2_step="02 · ИБ",
            pc2_title="Периметр и угрозы",
            pc2_hint="Классы атак · edge · atomic · честные лимиты",
            pc2_go="Открыть P2 →",
            pc3_step="03 · Дар",
            pc3_title="Как принять у себя",
            pc3_hint="MIT · self-host · приёмка · PoC",
            pc3_go="Открыть P3e →",
            pc4_step="04 · Сжато",
            pc4_title="One-pagers + DD",
            pc4_hint="Обзор · ИБ · отрасль · RFI · glossary",
            pc4_go="Сжатый вход →",
            handover_aria="Приёмка и внедрение",
            handover_kicker="Handover · внедрение",
            handover_title="После передачи контура — приёмка и проверка",
            handover_copy=(
                "BoM и Day‑0…90 · миграция с зоопарка · PoC только на проверенном · "
                "DD/RFI для комитета. Без обещания штата авторов."
            ),
            toc_h2="Содержание по частям",
            onepagers_meta="Сжатый вход для комитета / CISO / внедрения. Без новых обещаний.",
            diagrams_meta=(
                "Схемы D01–D12 · Mermaid в браузере · "
                "исходники в <code>../assets/diagrams-md/</code>."
            ),
            book_meta=(
                "Полный текст по частям · схемы inline · "
                '<a href="diagrams.html">каталог схем</a>.'
            ),
            rail_title="Части",
            md_book_title="# EliteEW — обзор продукта (Markdown)\n",
            md_book_blurb=(
                "> Тот же spine, что HTML-бандл. Откройте [README.md](README.md) "
                "или читайте этот файл сверху вниз.\n"
            ),
            md_onepager_title="# EliteEW — one-pagers + glossary (Markdown)\n\n",
            md_diagrams_title="# EliteEW — схемы D01–D12 (Markdown / Mermaid)\n\n",
            md_diagrams_blurb="Исходники также в [`assets/diagrams/`](assets/diagrams/).\n\n",
            md_readme="""# EliteEW product overview — Markdown pack (RU)

**Назначение:** тот же spine, что HTML, в Markdown для правок, DD и офлайн-чтения.

## Как открыть

| Файл | Для кого |
|------|----------|
| [`README.md`](README.md) | этот вход |
| [`book.md`](book.md) | полный spine одним файлом |
| [`onepagers.md`](onepagers.md) | executive / CISO / отрасль / DD / matrix / glossary |
| [`diagrams.md`](diagrams.md) | схемы D01–D12 (Mermaid fenced) |
| `00-README.md` … `14-….md` · `glossary.md` | главы по отдельности |
| [`assets/diagrams/`](assets/diagrams/) | исходники схем |
| [`assets/illustrations/brand/`](assets/illustrations/brand/) | логотип (chrome) |

## Честно

- HTML остаётся primary для презентации (Layering, progress, pills).
- MD — текст + схемы; не схема эксплуатации.
- English twin: [`../en/README.md`](../en/README.md).
- Safe-to-share после review оператора.

## Связь с HTML

Рядом в бандле: [`../../html/ru/index.html`](../../html/ru/index.html).
""",
            layering=layering_demo_html_ru(asset, content),
        )
    return Ui(
        lang="en",
        html_lang="en",
        content_dir=content,
        out_html=out_html,
        out_md=out_md,
        asset_href=asset,
        page_title_index="EliteEW — product overview",
        page_title_onepagers="EliteEW — brief",
        page_title_book="EliteEW — full text",
        page_title_diagrams="EliteEW — diagrams D01–D12",
        brand_sub="HTML primary · not an operations runbook",
        nav_menu="Menu",
        nav_cover="Start",
        nav_onepagers="Brief",
        nav_book="Full text",
        nav_diagrams="Diagrams",
        nav_cta="Begin →",
        cover_back="← Cover",
        promise_full="Organization work layer ∩ secure perimeter",
        promise_compact="Work layer ∩ secure perimeter",
        lede="Open work complex · gift to the world under MIT · HTML is primary",
        status_chip="MIT · open work complex",
        path_org="Gift",
        path_sec="Security",
        path_adopt="Acceptance",
        path_dd="DD / RFI",
        foot=(
            "Empery World / EliteEW · <strong>HTML is primary</strong> · PDF secondary · "
            "shared visual tokens · text: product overview only (not marketing landing) · "
            "not an operations runbook"
        ),
        back_top="Top",
        diagram_source="Diagram source (text)",
        diagram_missing="Diagram {stem} — missing from assets/diagrams/",
        meta_index=(
            "Primary delivery is this HTML bundle. Nearby — "
            '<a href="../../md/en/README.md">Markdown pack</a> (`export/md/en/`). '
            "PDF is optional (<code>ELITEEW_OVERVIEW_WITH_PDF=1</code>). "
            "Look: shared visual tokens · text: "
            "<code>product-overview/en/</code> (meaning-first English)."
        ),
        badge_note=(
            "<strong>Honestly:</strong> look and click mechanics · "
            "<strong>not</strong> marketing promises. "
            "Diagrams D01–D12 · UI screenshots deferred · "
            '<a href="diagrams.html">diagram catalog</a>'
        ),
        path_grid_aria="Pack entrances",
        pc1_step="01 · Product",
        pc1_title="What EliteEW is",
        pc1_hint="Formula · editions · apps · no ad pitch",
        pc1_go="Open P1 →",
        pc2_step="02 · Security",
        pc2_title="Perimeter and threats",
        pc2_hint="Attack classes · edge · atomic · honest limits",
        pc2_go="Open P2 →",
        pc3_step="03 · Gift",
        pc3_title="Bring it up in-house",
        pc3_hint="MIT · self-host · acceptance · PoC",
        pc3_go="Open P3e →",
        pc4_step="04 · Condensed",
        pc4_title="One-pagers + DD",
        pc4_hint="Overview · security · industry · RFI · glossary",
        pc4_go="Condensed entry →",
        handover_aria="Acceptance and adoption",
        handover_kicker="Handover · adoption",
        handover_title="After contour transfer — acceptance and checks",
        handover_copy=(
            "BoM and Day‑0…90 · migration from a tool zoo · PoC on checked claims only · "
            "DD/RFI for the committee. No promise of author headcount."
        ),
        toc_h2="Contents by part",
        onepagers_meta="Condensed entry for committee / CISO / adoption. No new promises.",
        diagrams_meta=(
            "Diagrams D01–D12 · Mermaid in the browser · "
            "sources in <code>../assets/diagrams-md/</code>."
        ),
        book_meta=(
            "Full text by part · diagrams inline · "
            '<a href="diagrams.html">diagram catalog</a>.'
        ),
        rail_title="Parts",
        md_book_title="# EliteEW — product overview (Markdown)\n",
        md_book_blurb=(
            "> Same spine as the HTML bundle. Open [README.md](README.md) "
            "or read this file top to bottom.\n"
        ),
        md_onepager_title="# EliteEW — one-pagers + glossary (Markdown)\n\n",
        md_diagrams_title="# EliteEW — diagrams D01–D12 (Markdown / Mermaid)\n\n",
        md_diagrams_blurb="Sources also under [`assets/diagrams/`](assets/diagrams/).\n\n",
        md_readme="""# EliteEW product overview — Markdown pack (EN)

**Purpose:** the same spine as HTML, in Markdown for edits, DD, and offline reading.
English here is **meaning-first**, not a literal calque of the Russian twin.

## How to open

| File | For |
|------|-----|
| [`README.md`](README.md) | this entry |
| [`book.md`](book.md) | full spine in one file |
| [`onepagers.md`](onepagers.md) | executive / CISO / industry / DD / matrix / glossary |
| [`diagrams.md`](diagrams.md) | diagrams D01–D12 (Mermaid fenced) |
| `00-README.md` … `14-….md` · `glossary.md` | chapters separately |
| [`assets/diagrams/`](assets/diagrams/) | diagram sources |
| [`assets/illustrations/brand/`](assets/illustrations/brand/) | logo (chrome) |

## Honestly

- HTML stays primary for presentation (Layering, progress, pills).
- MD is text + diagrams; not an operations runbook.
- Russian twin: [`../ru/README.md`](../ru/README.md).
- Safe-to-share after operator review.

## Link to HTML

Nearby in the bundle: [`../../html/en/index.html`](../../html/en/index.html).
""",
        layering=layering_demo_html_en(asset, content),
    )


def ensure_mermaid_vendor() -> None:
    VENDOR.mkdir(parents=True, exist_ok=True)
    if MERMAID_JS.exists() and MERMAID_JS.stat().st_size > 100_000:
        return
    print(f"[STEP] download mermaid → {MERMAID_JS}", flush=True)
    urllib.request.urlretrieve(MERMAID_URL, MERMAID_JS)


def load_diagrams() -> dict[str, Diagram]:
    out: dict[str, Diagram] = {}
    ddir = PACK / "assets" / "diagrams"
    for path in sorted(ddir.glob("D*.md")):
        raw = path.read_text(encoding="utf-8")
        m = MERMAID_BLOCK_RE.search(raw)
        if not m:
            print(f"[STEP] diagram_skip_no_mermaid {path.name}", flush=True)
            continue
        sense_m = SENSE_RE.search(raw)
        first = (
            raw.splitlines()[0].lstrip("# ").strip() if raw.splitlines() else path.stem
        )
        diag = Diagram(
            stem=path.stem,
            title=first,
            mermaid=m.group(1).strip(),
            sense=(sense_m.group(1).strip() if sense_m else ""),
        )
        out[path.stem] = diag
        short = path.stem.split("-", 1)[0]
        out[short] = diag
    return out


def diagram_figure(diag: Diagram, ui: Ui, *, link_title: str = "") -> str:
    caption = link_title.strip() or diagram_title_for_lang(diag, ui.lang)
    mermaid = mermaid_for_lang(diag.mermaid, ui.lang)
    sense_html = (
        f'<p class="diagram-sense">{html.escape(diag.sense)}</p>'
        if diag.sense and ui.lang == "ru"
        else ""
    )
    return (
        f'<figure class="diagram" id="{html.escape(diag.stem)}">\n'
        f"<figcaption><strong>{html.escape(caption)}</strong></figcaption>\n"
        f"{sense_html}"
        f'<pre class="mermaid">{html.escape(mermaid)}</pre>\n'
        f'<details class="diagram-source"><summary>{html.escape(ui.diagram_source)}</summary>'
        f'<pre class="diagram-fallback">{html.escape(mermaid)}</pre></details>\n'
        f"</figure>\n"
    )


def md_to_html(text: str, diagrams: dict[str, Diagram], ui: Ui) -> str:
    def _inject(match: re.Match[str]) -> str:
        link_title, stem = match.group(1), match.group(2)
        diag = diagrams.get(stem)
        if not diag:
            msg = ui.diagram_missing.format(stem=html.escape(stem))
            return f"<p><em>{msg}</em></p>"
        return "\n\n" + diagram_figure(diag, ui, link_title=link_title) + "\n\n"

    text = DIAGRAM_LINK_RE.sub(_inject, text)
    text = text.replace("](assets/illustrations/", f"]({ui.asset_href}/")
    text = text.replace("](../assets/illustrations/", f"]({ui.asset_href}/")
    # Cross-language entry → other-lang HTML cover
    text = re.sub(
        r"\]\(\.\./(en|ru)/00-README\.md(#[^)]*)?\)",
        r"](../\1/index.html\2)",
        text,
    )
    # Cross-language chapter → other-lang book + stem anchor
    text = re.sub(
        r"\]\(\.\./(en|ru)/([\w.-]+)\.md(#[^)]*)?\)",
        lambda m: f"](../{m.group(1)}/book.html#{Path(m.group(2)).stem})",
        text,
    )
    # Pack-relative export/assets links → paths valid from html/{lang}/*.html
    text = text.replace("](../export/html/", "](../")
    text = text.replace("](../export/md/", "](../../md/")
    text = text.replace("](../export/share/", "](../../share/")
    text = text.replace("](../export/pdf/", "](../../pdf/")
    text = re.sub(r"\]\(\.\./export/\)", "](../index.html)", text)
    text = re.sub(r"\]\(\.\./assets/diagrams/\)", "](../assets/diagrams-md/)", text)
    text = re.sub(
        r"\]\(\.\./assets/diagrams/([^)]+\.md)\)",
        r"](../assets/diagrams-md/\1)",
        text,
    )
    # Same-folder chapter.md → in-page #stem (book / onepagers)
    text = re.sub(
        r"\]\(([\w.-]+)\.md(#[^)]*)?\)",
        lambda m: f"](#{Path(m.group(1)).stem})",
        text,
    )
    return markdown.markdown(text, extensions=MD_EXT)


def shell(
    ui: Ui,
    page_title: str,
    body: str,
    *,
    active: str = "",
    mermaid: bool = False,
    cover: str = "full",
    page_class: str = "",
) -> str:
    def nav_cls(name: str) -> str:
        return ' class="active"' if name == active else ""

    a = ui.asset_href
    mermaid_boot = ""
    if mermaid:
        mermaid_boot = f"""
  <script src="{a}/mermaid.min.js"></script>
  <script>
    mermaid.initialize({{
      startOnLoad: true,
      theme: "dark",
      securityLevel: "strict",
      flowchart: {{ htmlLabels: false }},
      themeVariables: {{
        primaryColor: "#0e131c",
        primaryTextColor: "#e8eef7",
        primaryBorderColor: "#00f2ff55",
        lineColor: "#2dd4bf99",
        secondaryColor: "#121820",
        tertiaryColor: "#0b0e14",
        fontFamily: "Manrope, system-ui, sans-serif"
      }}
    }});
  </script>
"""

    if cover == "compact":
        cover_html = f"""
  <header class="cover is-compact">
    <div class="cover-copy">
      <p class="eyebrow">Empery World · product overview</p>
      <h1>EliteEW</h1>
      <p class="promise">{html.escape(ui.promise_compact)}</p>
    </div>
    <a class="nav-cta" href="index.html">{html.escape(ui.cover_back)}</a>
  </header>
"""
    else:
        cover_html = f"""
  <header class="cover">
    <div class="cover-glow" aria-hidden="true"></div>
    <div class="cover-inner">
      <img class="logo-hero" src="{a}/brand/emperyworld-logo.webp" alt="Empery World" width="120" height="120" />
      <p class="eyebrow">Empery World · product overview</p>
      <h1>EliteEW</h1>
      <p class="promise">{html.escape(ui.promise_full)}</p>
      <p class="lede">{html.escape(ui.lede)}</p>
      <span class="status-chip" role="status"><span class="dot" aria-hidden="true"></span> {html.escape(ui.status_chip)}</span>
    </div>
  </header>
"""

    body_class = f' class="{html.escape(page_class)}"' if page_class else ""
    other = "en" if ui.lang == "ru" else "ru"
    other_label = "English" if ui.lang == "ru" else "Русский"
    page_file = {
        "index": "index.html",
        "onepagers": "onepagers.html",
        "book": "book.html",
        "diagrams": "diagrams.html",
    }.get(active or "index", "index.html")
    lang_href = f"../{other}/{page_file}"

    return f"""<!DOCTYPE html>
<html lang="{ui.html_lang}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex" />
  <meta name="color-scheme" content="dark" />
  <title>{html.escape(page_title)}</title>
  <link rel="stylesheet" href="{a}/export.css" />
</head>
<body{body_class}>
  <div class="read-progress" aria-hidden="true"><div class="read-progress-bar" data-progress></div></div>
  <div class="ambient" aria-hidden="true"></div>
  <div class="site-top">
    <div class="site-top-inner">
      <a class="brand-row" href="index.html">
        <img class="logo" src="{a}/brand/emperyworld-logo.webp" alt="" width="34" height="34" />
        <div>
          <span class="brand-name">EliteEW</span>
          <span class="brand-sub">{html.escape(ui.brand_sub)}</span>
        </div>
      </a>
      <div class="nav-wrap">
        <button type="button" class="nav-toggle" data-nav-toggle aria-expanded="false" aria-label="{html.escape(ui.nav_menu)}">☰</button>
        <nav class="nav" aria-label="Export sections">
          <a href="index.html"{nav_cls("index")}>{html.escape(ui.nav_cover)}</a>
          <a href="onepagers.html"{nav_cls("onepagers")}>{html.escape(ui.nav_onepagers)}</a>
          <a href="book.html"{nav_cls("book")}>{html.escape(ui.nav_book)}</a>
          <a href="diagrams.html"{nav_cls("diagrams")}>{html.escape(ui.nav_diagrams)}</a>
          <a class="nav-cta" href="book.html#01-what-is-eliteew">{html.escape(ui.nav_cta)}</a>
          <a class="lang-switch" href="{lang_href}" hreflang="{other}" lang="{other}" data-lang-switch>{html.escape(other_label)}</a>
        </nav>
      </div>
    </div>
  </div>
{cover_html}
  <main class="wrap">
{body}
    <footer class="export-foot">
      {ui.foot}
    </footer>
  </main>
  <button type="button" class="back-top" data-back-top aria-label="{html.escape(ui.back_top)}">↑</button>
  <script src="{a}/export.js"></script>
{mermaid_boot}
</body>
</html>
"""


def layering_overview_nav(content_dir: Path, lang: str) -> str:
    """Mini TOC for the in-dome Overview app (switches book.html?embed=1#stem)."""
    lang_i = 0 if lang == "ru" else 1
    blocks: list[str] = []
    for part_id, labels, stems in BOOK_PARTS:
        links: list[str] = []
        for stem in stems:
            name = f"{stem}.md"
            if not (content_dir / name).exists():
                continue
            title = chapter_title(content_dir, name)
            if len(title) > 34:
                title = title[:32] + "…"
            links.append(
                f'<button type="button" class="ly-ov-link" data-ov-stem="{html.escape(stem)}">'
                f"{html.escape(title)}</button>"
            )
        if not links:
            continue
        blocks.append(
            f'<div class="ly-ov-part" data-part="{html.escape(part_id)}">'
            f'<p class="ly-ov-part-title">{html.escape(labels[lang_i])}</p>'
            f"{''.join(links)}"
            f"</div>"
        )
    return "".join(blocks)


def _layering_dome_workspace(*, asset: str, lang: str, content_dir: Path) -> str:
    nav = layering_overview_nav(content_dir, lang)
    logo = f"{asset}/brand/emperyworld-logo.webp"
    if lang == "ru":
        return f"""
        <div class="ly-glass ly-glass--desktop ly-desk" data-ly-desk>
          <div class="ly-desk-stage" data-ly-desk-stage>
            <div class="ly-desk-wallpaper" aria-hidden="true"><span class="ly-desk-grid"></span><span class="ly-desk-glow"></span></div>
            <div class="ly-desk-icons" role="group" aria-label="Ярлыки стола">
              <button type="button" class="ly-desk-icon" data-open-win="overview" data-glyph="ov"><span class="ly-desk-glyph" aria-hidden="true"></span><strong>Обзор</strong></button>
              <button type="button" class="ly-desk-icon" data-open-win="desk" data-glyph="desk"><span class="ly-desk-glyph" aria-hidden="true"></span><strong>Стол</strong></button>
              <button type="button" class="ly-desk-icon" data-open-win="files" data-glyph="files"><span class="ly-desk-glyph" aria-hidden="true"></span><strong>Файлы</strong></button>
              <button type="button" class="ly-desk-icon" data-open-win="chat" data-glyph="chat"><span class="ly-desk-glyph" aria-hidden="true"></span><strong>Связь</strong></button>
              <button type="button" class="ly-desk-icon" data-open-win="roles" data-glyph="roles"><span class="ly-desk-glyph" aria-hidden="true"></span><strong>Роли</strong></button>
            </div>
            <div class="ly-snap-guide" data-ly-snap hidden aria-hidden="true"></div>
            <div class="ly-toast-stack" data-ly-toasts aria-live="polite"></div>
            <div class="ly-jump" data-ly-jump hidden role="menu" aria-label="Меню окна"></div>
            <div class="ly-history" data-ly-history hidden role="dialog" aria-label="История глав"></div>
            <div class="ly-qs" data-ly-qs hidden>
              <p class="ly-qs-kicker">Трей · контур</p>
              <p class="ly-qs-status" data-ly-qs-status>Сессия · активна</p>
              <p class="ly-qs-meta" data-ly-qs-meta></p>
              <p class="ly-qs-sec">Свечение</p>
              <div class="ly-qs-themes" data-ly-themes>
                <button type="button" data-theme="cyan" class="is-on" title="Cyan" aria-label="Cyan"></button>
                <button type="button" data-theme="teal" title="Teal" aria-label="Teal"></button>
                <button type="button" data-theme="amber" title="Amber" aria-label="Amber"></button>
              </div>
              <p class="ly-qs-sec">Календарь</p>
              <div class="ly-qs-cal" data-ly-qs-cal aria-hidden="true"></div>
              <div class="ly-qs-actions">
                <button type="button" data-qs="overview">Обзор</button>
                <button type="button" data-qs="arrange">Упорядочить</button>
                <button type="button" data-qs="layout">Сброс окон</button>
                <button type="button" data-qs="read">Чтение</button>
                <button type="button" data-qs="replay">Сначала</button>
                <button type="button" data-qs="wallpaper">Пульс</button>
                <button type="button" data-qs="desktop">Стол</button>
                <button type="button" data-qs="tasks">Окна</button>
                <button type="button" data-qs="keys">Хоткеи</button>
              </div>
            </div>
            <div class="ly-switcher" data-ly-switcher hidden role="listbox" aria-label="Переключение окон"></div>
            <div class="ly-palette" data-ly-palette hidden role="dialog" aria-label="Палитра команд">
              <label class="ly-palette-search">
                <span class="sr-only">Команда</span>
                <input type="search" data-ly-palette-input placeholder="Приложение, глава или действие…" autocomplete="off" />
              </label>
              <div class="ly-palette-list" data-ly-palette-list role="listbox"></div>
              <p class="ly-palette-foot">Ctrl+K · ↑↓ Enter · Esc</p>
            </div>
            <div class="ly-boot" data-ly-boot hidden aria-hidden="true">
              <p class="ly-boot-kicker">EliteEW</p>
              <p class="ly-boot-title">Рабочий слой</p>
              <span class="ly-boot-bar" aria-hidden="true"></span>
            </div>
            <div class="ly-notif" data-ly-notif hidden role="dialog" aria-label="Уведомления">
              <div class="ly-notif-head">
                <p class="ly-notif-kicker">Центр · контур</p>
                <button type="button" data-ly-notif-clear>Очистить</button>
                <button type="button" data-ly-notif-close aria-label="Закрыть">×</button>
              </div>
              <p class="ly-notif-title">Уведомления</p>
              <div class="ly-notif-list" data-ly-notif-list></div>
            </div>
            <div class="ly-snap-layouts" data-ly-snap-layouts hidden>
              <button type="button" data-layout="full" title="На весь стол"><i class="ly-lay ly-lay-full"></i></button>
              <button type="button" data-layout="left" title="Слева"><i class="ly-lay ly-lay-left"></i></button>
              <button type="button" data-layout="right" title="Справа"><i class="ly-lay ly-lay-right"></i></button>
              <button type="button" data-layout="tl" title="Верх-лево"><i class="ly-lay ly-lay-tl"></i></button>
              <button type="button" data-layout="tr" title="Верх-право"><i class="ly-lay ly-lay-tr"></i></button>
              <button type="button" data-layout="cols" title="Две колонки"><i class="ly-lay ly-lay-cols"></i></button>
            </div>
            <div class="ly-tasks-panel" data-ly-tasks-panel hidden role="dialog" aria-label="Открытые окна">
              <div class="ly-tasks-head">
                <p class="ly-tasks-kicker">Диспетчер · слой</p>
                <button type="button" data-ly-tasks-close aria-label="Закрыть">×</button>
              </div>
              <p class="ly-tasks-title">Открытые окна</p>
              <div class="ly-tasks-list" data-ly-tasks-list></div>
            </div>
            <div class="ly-keys" data-ly-keys hidden role="dialog" aria-label="Горячие клавиши">
              <div class="ly-keys-head">
                <p class="ly-keys-kicker">Стол · подсказки</p>
                <button type="button" class="ly-keys-close" data-ly-keys-close aria-label="Закрыть">×</button>
              </div>
              <p class="ly-keys-title">Горячие клавиши</p>
              <ul class="ly-keys-list">
                <li><kbd>Ctrl</kbd>+<kbd>K</kbd><span>палитра команд</span></li>
                <li><kbd>Ctrl</kbd>+<kbd>F</kbd><span>поиск по главам</span></li>
                <li><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd><span>★ текущая глава</span></li>
                <li><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>T</kbd><span>вернуть окно</span></li>
                <li><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd><span>режим чтения</span></li>
                <li><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>0</kbd><span>сброс прогресса</span></li>
                <li><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>←→</kbd><span>непрочитанная глава</span></li>
                <li><kbd>1</kbd>…<kbd>5</kbd><span>недавняя глава</span></li>
                <li><kbd>Alt</kbd>+<kbd>Enter</kbd><span>max / restore</span></li>
                <li><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>F</kbd><span>только ★</span></li>
                <li><kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>←→</kbd><span>часть назад/вперёд</span></li>
                <li><kbd>Ctrl</kbd>+<kbd>End</kbd><span>последняя глава</span></li>
                <li><kbd>Ctrl</kbd>+<kbd>L</kbd><span>копировать ссылку</span></li>
                <li><kbd>Alt</kbd>+<kbd>Home</kbd><span>первая глава</span></li>
                <li><kbd>Ctrl</kbd>+<kbd>`</kbd><span>окна · Alt — назад</span></li>
                <li><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Esc</kbd><span>диспетчер</span></li>
                <li><kbd>Ctrl</kbd>+<kbd>1…5</kbd><span>приложения</span></li>
                <li><kbd>Ctrl</kbd>+<kbd>←→↑↓</kbd><span>snap / max / свернуть</span></li>
                <li><kbd>Ctrl</kbd>+<kbd>W</kbd><span>закрыть окно</span></li>
                <li><kbd>Ctrl</kbd>+<kbd>D</kbd><span>показать стол</span></li>
                <li><kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>Esc</kbd><span>Пуск</span></li>
                <li><kbd>F1</kbd><span>эта справка</span></li>
                <li><kbd>Esc</kbd><span>закрыть оверлеи</span></li>
              </ul>
              <p class="ly-keys-foot">ПКМ · shake · pin · ★ · копировать ссылку · не live-клиент</p>
            </div>
            <div class="ly-ctx" data-ly-ctx hidden role="menu" aria-label="Меню стола">
              <button type="button" role="menuitem" data-ctx="overview">Открыть Обзор</button>
              <button type="button" role="menuitem" data-ctx="arrange">Упорядочить окна</button>
              <button type="button" role="menuitem" data-ctx="desktop">Свернуть всё</button>
              <button type="button" role="menuitem" data-ctx="theme">Сменить свечение</button>
              <button type="button" role="menuitem" data-ctx="palette">Палитра команд</button>
              <button type="button" role="menuitem" data-ctx="tasks">Диспетчер окон</button>
              <button type="button" role="menuitem" data-ctx="keys">Горячие клавиши</button>
            </div>
            <div class="ly-wins" data-ly-wins>
              <article class="ly-win is-open is-focus" data-win="overview" data-win-title="Обзор" style="left:7%;top:5%;width:78%;height:78%;z-index:6">
                <header class="ly-win-bar" data-win-drag>
                  <span class="ly-win-mark" aria-hidden="true"></span>
                  <h3 class="ly-win-title">Обзор · пакет</h3>
                  <div class="ly-win-actions">
                    <button type="button" data-win-min aria-label="Свернуть">─</button>
                    <button type="button" data-win-max aria-label="На весь стол">□</button>
                    <button type="button" data-win-close aria-label="Закрыть">×</button>
                  </div>
                </header>
                <div class="ly-win-body">
                  <div class="ly-ov is-on" data-ly-overview>
                    <aside class="ly-ov-rail" aria-label="Главы обзора">
                      <p class="ly-ov-rail-title">Содержание по частям</p>
                      <div class="ly-ov-tools">
                        <label class="ly-ov-search">
                          <span class="sr-only">Фильтр глав</span>
                          <input type="search" data-ly-ov-search placeholder="Фильтр глав…" autocomplete="off" />
                        </label>
                        <button type="button" class="ly-ov-star-filter" data-ly-ov-star-filter title="Только избранное" aria-pressed="false" aria-label="Только избранное">★</button>
                      </div>
                      {nav}
                    </aside>
                    <div class="ly-ov-main">
                      <div class="ly-ov-chrome">
                        <button type="button" class="ly-ov-rail-toggle" data-ly-ov-rail-toggle title="Скрыть/показать содержание" aria-pressed="false" aria-label="Содержание">☰</button>
                        <button type="button" class="ly-ov-home" data-ly-ov-home title="Открыть обложку внутри слоя">⌂ Главная</button>
                        <div class="ly-ov-nav">
                          <button type="button" data-ly-ov-part-prev title="Предыдущая часть" aria-label="Предыдущая часть">«</button>
                          <button type="button" data-ly-ov-prev title="Предыдущая глава" aria-label="Предыдущая глава">‹</button>
                          <button type="button" data-ly-ov-next title="Следующая глава" aria-label="Следующая глава">›</button>
                          <button type="button" data-ly-ov-part-next title="Следующая часть" aria-label="Следующая часть">»</button>
                        </div>
                        <span data-ly-ov-label>Обзор · полный текст</span>
                        <span class="ly-ov-progress" data-ly-ov-progress title="Прочитанные главы · клик: история" role="button" tabindex="0">0/0</span>
                        <button type="button" class="ly-ov-star-cur" data-ly-ov-star-cur title="В избранное" aria-pressed="false">☆</button>
                        <button type="button" class="ly-ov-read" data-ly-ov-read title="Режим чтения" aria-pressed="false">Aa</button>
                        <button type="button" class="ly-ov-copy" data-ly-ov-copy title="Копировать ссылку на главу">⧉</button>
                        <a class="ly-ov-open" href="book.html#01-what-is-eliteew" target="_blank" rel="noopener">Открыть снаружи ↗</a>
                      </div>
                      <div class="ly-ov-meta">
                        <div class="ly-ov-meta-row">
                          <span class="ly-ov-crumb" data-ly-ov-crumb></span>
                          <span class="ly-ov-eta" data-ly-ov-eta></span>
                        </div>
                        <div class="ly-ov-parts" data-ly-ov-parts hidden aria-label="Прогресс по частям"></div>
                        <div class="ly-ov-bar" aria-hidden="true"><i data-ly-ov-bar></i></div>
                      </div>
                      <div class="ly-ov-recent" data-ly-ov-recent hidden aria-label="Недавние главы"></div>
                      <iframe class="ly-ov-frame" data-ly-ov-frame title="Обзор EliteEW внутри слоя"
                        src="book.html?embed=1#01-what-is-eliteew" loading="lazy"></iframe>
                    </div>
                  </div>
                </div>
              </article>
              <article class="ly-win" data-win="desk" data-win-title="Стол" hidden style="left:14%;top:12%;width:52%;height:58%;z-index:4">
                <header class="ly-win-bar" data-win-drag>
                  <span class="ly-win-mark" aria-hidden="true"></span>
                  <h3 class="ly-win-title">Стол · день</h3>
                  <div class="ly-win-actions">
                    <button type="button" data-win-min aria-label="Свернуть">─</button>
                    <button type="button" data-win-max aria-label="На весь стол">□</button>
                    <button type="button" data-win-close aria-label="Закрыть">×</button>
                  </div>
                </header>
                <div class="ly-win-body">
                  <div class="ly-job" data-ly-job-static>
                    <p class="ly-job-eye">Имитация · стол</p>
                    <p class="ly-job-h">Рабочий день в контуре</p>
                    <ul>
                      <li><b>Календарь команды</b><span>сегодня</span></li>
                      <li><b>Задача: приёмка состава</b><span>в слое</span></li>
                      <li><b>Файлы проекта</b><span>ACL</span></li>
                    </ul>
                  </div>
                </div>
              </article>
              <article class="ly-win" data-win="files" data-win-title="Файлы" hidden style="left:18%;top:16%;width:50%;height:56%;z-index:4">
                <header class="ly-win-bar" data-win-drag>
                  <span class="ly-win-mark" aria-hidden="true"></span>
                  <h3 class="ly-win-title">Файлы · ACL</h3>
                  <div class="ly-win-actions">
                    <button type="button" data-win-min aria-label="Свернуть">─</button>
                    <button type="button" data-win-max aria-label="На весь стол">□</button>
                    <button type="button" data-win-close aria-label="Закрыть">×</button>
                  </div>
                </header>
                <div class="ly-win-body">
                  <div class="ly-job">
                    <p class="ly-job-eye">Имитация · файлы</p>
                    <p class="ly-job-h">Файлы рабочей сессии</p>
                    <ul>
                      <li><b>Договор_Q3.pdf</b><span>документ</span></li>
                      <li><b>Контакты.xlsx</b><span>таблица</span></li>
                      <li><b>Политика_ИБ.md</b><span>политика</span></li>
                    </ul>
                  </div>
                </div>
              </article>
              <article class="ly-win" data-win="chat" data-win-title="Связь" hidden style="left:22%;top:18%;width:48%;height:54%;z-index:4">
                <header class="ly-win-bar" data-win-drag>
                  <span class="ly-win-mark" aria-hidden="true"></span>
                  <h3 class="ly-win-title">Связь · слой</h3>
                  <div class="ly-win-actions">
                    <button type="button" data-win-min aria-label="Свернуть">─</button>
                    <button type="button" data-win-max aria-label="На весь стол">□</button>
                    <button type="button" data-win-close aria-label="Закрыть">×</button>
                  </div>
                </header>
                <div class="ly-win-body">
                  <div class="ly-job">
                    <p class="ly-job-eye">Имитация · связь</p>
                    <p class="ly-job-h">Каналы внутри слоя</p>
                    <ul>
                      <li><b>Канал проекта</b><span>участники</span></li>
                      <li><b>ВКС 1:1</b><span>сначала принять</span></li>
                      <li><b>Уведомления</b><span>в контуре</span></li>
                    </ul>
                  </div>
                </div>
              </article>
              <article class="ly-win" data-win="roles" data-win-title="Роли" hidden style="left:26%;top:20%;width:46%;height:52%;z-index:4">
                <header class="ly-win-bar" data-win-drag>
                  <span class="ly-win-mark" aria-hidden="true"></span>
                  <h3 class="ly-win-title">Роли · доступ</h3>
                  <div class="ly-win-actions">
                    <button type="button" data-win-min aria-label="Свернуть">─</button>
                    <button type="button" data-win-max aria-label="На весь стол">□</button>
                    <button type="button" data-win-close aria-label="Закрыть">×</button>
                  </div>
                </header>
                <div class="ly-win-body">
                  <div class="ly-job">
                    <p class="ly-job-eye">Имитация · роли</p>
                    <p class="ly-job-h">Доступ организации</p>
                    <ul>
                      <li><b>Собственник</b><span>орг</span></li>
                      <li><b>Лид проекта</b><span>проект</span></li>
                      <li><b>Участник</b><span>проект</span></li>
                    </ul>
                  </div>
                </div>
              </article>
            </div>
            <div class="ly-start-menu" data-ly-start-menu hidden>
              <p class="ly-start-kicker">Пуск · рабочий слой</p>
              <p class="ly-start-title">Приложения контура</p>
              <label class="ly-start-search">
                <span class="sr-only">Поиск приложений</span>
                <input type="search" data-ly-start-search placeholder="Найти приложение…" autocomplete="off" />
              </label>
              <div class="ly-start-recent" data-ly-start-recent hidden>
                <p class="ly-start-sec">Недавние</p>
                <div class="ly-start-recent-list" data-ly-start-recent-list></div>
              </div>
              <p class="ly-start-sec">Все приложения</p>
              <div class="ly-start-apps">
                <button type="button" data-open-win="overview"><em>01</em><strong>Обзор</strong><span>весь пакет</span></button>
                <button type="button" data-open-win="desk"><em>02</em><strong>Стол</strong><span>день</span></button>
                <button type="button" data-open-win="files"><em>03</em><strong>Файлы</strong><span>ACL</span></button>
                <button type="button" data-open-win="chat"><em>04</em><strong>Связь</strong><span>слой</span></button>
                <button type="button" data-open-win="roles"><em>05</em><strong>Роли</strong><span>доступ</span></button>
              </div>
              <div class="ly-start-power">
                <button type="button" data-ly-power="palette">Палитра</button>
                <button type="button" data-ly-power="tasks">Окна</button>
                <button type="button" data-ly-power="focus">На весь экран</button>
                <button type="button" data-ly-power="exit">Снять купол</button>
              </div>
              <p class="ly-start-foot">
                <button type="button" class="ly-start-help" data-ly-keys-open>F1 · хоткеи</button>
                · не live-клиент
              </p>
            </div>
          </div>
          <footer class="ly-taskbar" aria-label="Панель задач">
            <button type="button" class="ly-start-btn" data-ly-start-toggle aria-expanded="false" aria-pressed="false">
              <img src="{logo}" alt="" width="18" height="18" />
              <span>Пуск</span>
            </button>
            <div class="ly-taskbar-tasks" data-ly-tasks role="list" aria-label="Открытые окна"></div>
            <div class="ly-taskbar-tray">
              <button type="button" class="ly-tray-ico" title="Периметр" aria-label="Периметр" data-tray="shield" data-ly-qs-toggle></button>
              <button type="button" class="ly-tray-ico" title="Канал" aria-label="Канал" data-tray="net" data-ly-qs-toggle></button>
              <button type="button" class="ly-tray-bell" data-ly-notif-toggle title="Уведомления" aria-label="Уведомления" aria-expanded="false">
                <span aria-hidden="true"></span>
                <em data-ly-notif-badge hidden>0</em>
              </button>
              <span class="ly-session">Сессия · активна</span>
              <button type="button" class="ly-clock" data-ly-clock data-ly-qs-toggle title="Быстрые настройки">
                <em data-ly-clock-time>09:41</em><small data-ly-clock-date></small>
              </button>
              <button type="button" class="ly-show-desk" data-ly-show-desk title="Показать стол" aria-label="Показать стол"></button>
            </div>
          </footer>
        </div>
"""
    return f"""
        <div class="ly-glass ly-glass--desktop ly-desk" data-ly-desk>
          <div class="ly-desk-stage" data-ly-desk-stage>
            <div class="ly-desk-wallpaper" aria-hidden="true"><span class="ly-desk-grid"></span><span class="ly-desk-glow"></span></div>
            <div class="ly-desk-icons" role="group" aria-label="Desktop shortcuts">
              <button type="button" class="ly-desk-icon" data-open-win="overview" data-glyph="ov"><span class="ly-desk-glyph" aria-hidden="true"></span><strong>Overview</strong></button>
              <button type="button" class="ly-desk-icon" data-open-win="desk" data-glyph="desk"><span class="ly-desk-glyph" aria-hidden="true"></span><strong>Desk</strong></button>
              <button type="button" class="ly-desk-icon" data-open-win="files" data-glyph="files"><span class="ly-desk-glyph" aria-hidden="true"></span><strong>Files</strong></button>
              <button type="button" class="ly-desk-icon" data-open-win="chat" data-glyph="chat"><span class="ly-desk-glyph" aria-hidden="true"></span><strong>Comms</strong></button>
              <button type="button" class="ly-desk-icon" data-open-win="roles" data-glyph="roles"><span class="ly-desk-glyph" aria-hidden="true"></span><strong>Roles</strong></button>
            </div>
            <div class="ly-snap-guide" data-ly-snap hidden aria-hidden="true"></div>
            <div class="ly-toast-stack" data-ly-toasts aria-live="polite"></div>
            <div class="ly-jump" data-ly-jump hidden role="menu" aria-label="Window menu"></div>
            <div class="ly-history" data-ly-history hidden role="dialog" aria-label="Chapter history"></div>
            <div class="ly-qs" data-ly-qs hidden>
              <p class="ly-qs-kicker">Tray · contour</p>
              <p class="ly-qs-status" data-ly-qs-status>Session · active</p>
              <p class="ly-qs-meta" data-ly-qs-meta></p>
              <p class="ly-qs-sec">Glow</p>
              <div class="ly-qs-themes" data-ly-themes>
                <button type="button" data-theme="cyan" class="is-on" title="Cyan" aria-label="Cyan"></button>
                <button type="button" data-theme="teal" title="Teal" aria-label="Teal"></button>
                <button type="button" data-theme="amber" title="Amber" aria-label="Amber"></button>
              </div>
              <p class="ly-qs-sec">Calendar</p>
              <div class="ly-qs-cal" data-ly-qs-cal aria-hidden="true"></div>
              <div class="ly-qs-actions">
                <button type="button" data-qs="overview">Overview</button>
                <button type="button" data-qs="arrange">Arrange</button>
                <button type="button" data-qs="layout">Reset layout</button>
                <button type="button" data-qs="read">Reading</button>
                <button type="button" data-qs="replay">Replay</button>
                <button type="button" data-qs="wallpaper">Pulse</button>
                <button type="button" data-qs="desktop">Desktop</button>
                <button type="button" data-qs="tasks">Windows</button>
                <button type="button" data-qs="keys">Hotkeys</button>
              </div>
            </div>
            <div class="ly-switcher" data-ly-switcher hidden role="listbox" aria-label="Window switcher"></div>
            <div class="ly-palette" data-ly-palette hidden role="dialog" aria-label="Command palette">
              <label class="ly-palette-search">
                <span class="sr-only">Command</span>
                <input type="search" data-ly-palette-input placeholder="App, chapter, or action…" autocomplete="off" />
              </label>
              <div class="ly-palette-list" data-ly-palette-list role="listbox"></div>
              <p class="ly-palette-foot">Ctrl+K · ↑↓ Enter · Esc</p>
            </div>
            <div class="ly-boot" data-ly-boot hidden aria-hidden="true">
              <p class="ly-boot-kicker">EliteEW</p>
              <p class="ly-boot-title">Work layer</p>
              <span class="ly-boot-bar" aria-hidden="true"></span>
            </div>
            <div class="ly-notif" data-ly-notif hidden role="dialog" aria-label="Notifications">
              <div class="ly-notif-head">
                <p class="ly-notif-kicker">Center · contour</p>
                <button type="button" data-ly-notif-clear>Clear</button>
                <button type="button" data-ly-notif-close aria-label="Close">×</button>
              </div>
              <p class="ly-notif-title">Notifications</p>
              <div class="ly-notif-list" data-ly-notif-list></div>
            </div>
            <div class="ly-snap-layouts" data-ly-snap-layouts hidden>
              <button type="button" data-layout="full" title="Maximize"><i class="ly-lay ly-lay-full"></i></button>
              <button type="button" data-layout="left" title="Left"><i class="ly-lay ly-lay-left"></i></button>
              <button type="button" data-layout="right" title="Right"><i class="ly-lay ly-lay-right"></i></button>
              <button type="button" data-layout="tl" title="Top-left"><i class="ly-lay ly-lay-tl"></i></button>
              <button type="button" data-layout="tr" title="Top-right"><i class="ly-lay ly-lay-tr"></i></button>
              <button type="button" data-layout="cols" title="Two columns"><i class="ly-lay ly-lay-cols"></i></button>
            </div>
            <div class="ly-tasks-panel" data-ly-tasks-panel hidden role="dialog" aria-label="Open windows">
              <div class="ly-tasks-head">
                <p class="ly-tasks-kicker">Task manager · layer</p>
                <button type="button" data-ly-tasks-close aria-label="Close">×</button>
              </div>
              <p class="ly-tasks-title">Open windows</p>
              <div class="ly-tasks-list" data-ly-tasks-list></div>
            </div>
            <div class="ly-keys" data-ly-keys hidden role="dialog" aria-label="Keyboard shortcuts">
              <div class="ly-keys-head">
                <p class="ly-keys-kicker">Desk · tips</p>
                <button type="button" class="ly-keys-close" data-ly-keys-close aria-label="Close">×</button>
              </div>
              <p class="ly-keys-title">Keyboard shortcuts</p>
              <ul class="ly-keys-list">
                <li><kbd>Ctrl</kbd>+<kbd>K</kbd><span>command palette</span></li>
                <li><kbd>Ctrl</kbd>+<kbd>F</kbd><span>search chapters</span></li>
                <li><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd><span>★ current chapter</span></li>
                <li><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>T</kbd><span>restore window</span></li>
                <li><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd><span>reading mode</span></li>
                <li><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>0</kbd><span>reset progress</span></li>
                <li><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>←→</kbd><span>unread chapter</span></li>
                <li><kbd>1</kbd>…<kbd>5</kbd><span>recent chapter</span></li>
                <li><kbd>Alt</kbd>+<kbd>Enter</kbd><span>max / restore</span></li>
                <li><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>F</kbd><span>starred only</span></li>
                <li><kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>←→</kbd><span>prev/next part</span></li>
                <li><kbd>Ctrl</kbd>+<kbd>End</kbd><span>last chapter</span></li>
                <li><kbd>Ctrl</kbd>+<kbd>L</kbd><span>copy chapter link</span></li>
                <li><kbd>Alt</kbd>+<kbd>Home</kbd><span>first chapter</span></li>
                <li><kbd>Ctrl</kbd>+<kbd>`</kbd><span>windows · Alt reverses</span></li>
                <li><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Esc</kbd><span>task manager</span></li>
                <li><kbd>Ctrl</kbd>+<kbd>1…5</kbd><span>apps</span></li>
                <li><kbd>Ctrl</kbd>+<kbd>←→↑↓</kbd><span>snap / max / minimize</span></li>
                <li><kbd>Ctrl</kbd>+<kbd>W</kbd><span>close window</span></li>
                <li><kbd>Ctrl</kbd>+<kbd>D</kbd><span>show desktop</span></li>
                <li><kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>Esc</kbd><span>Start</span></li>
                <li><kbd>F1</kbd><span>this help</span></li>
                <li><kbd>Esc</kbd><span>dismiss overlays</span></li>
              </ul>
              <p class="ly-keys-foot">Right-click · shake · pin · ★ · copy link · not a live client</p>
            </div>
            <div class="ly-ctx" data-ly-ctx hidden role="menu" aria-label="Desktop menu">
              <button type="button" role="menuitem" data-ctx="overview">Open Overview</button>
              <button type="button" role="menuitem" data-ctx="arrange">Arrange windows</button>
              <button type="button" role="menuitem" data-ctx="desktop">Minimize all</button>
              <button type="button" role="menuitem" data-ctx="theme">Cycle glow</button>
              <button type="button" role="menuitem" data-ctx="palette">Command palette</button>
              <button type="button" role="menuitem" data-ctx="tasks">Task manager</button>
              <button type="button" role="menuitem" data-ctx="keys">Keyboard shortcuts</button>
            </div>
            <div class="ly-wins" data-ly-wins>
              <article class="ly-win is-open is-focus" data-win="overview" data-win-title="Overview" style="left:7%;top:5%;width:78%;height:78%;z-index:6">
                <header class="ly-win-bar" data-win-drag>
                  <span class="ly-win-mark" aria-hidden="true"></span>
                  <h3 class="ly-win-title">Overview · pack</h3>
                  <div class="ly-win-actions">
                    <button type="button" data-win-min aria-label="Minimize">─</button>
                    <button type="button" data-win-max aria-label="Maximize">□</button>
                    <button type="button" data-win-close aria-label="Close">×</button>
                  </div>
                </header>
                <div class="ly-win-body">
                  <div class="ly-ov is-on" data-ly-overview>
                    <aside class="ly-ov-rail" aria-label="Overview chapters">
                      <p class="ly-ov-rail-title">Contents by part</p>
                      <div class="ly-ov-tools">
                        <label class="ly-ov-search">
                          <span class="sr-only">Filter chapters</span>
                          <input type="search" data-ly-ov-search placeholder="Filter chapters…" autocomplete="off" />
                        </label>
                        <button type="button" class="ly-ov-star-filter" data-ly-ov-star-filter title="Starred only" aria-pressed="false" aria-label="Starred only">★</button>
                      </div>
                      {nav}
                    </aside>
                    <div class="ly-ov-main">
                      <div class="ly-ov-chrome">
                        <button type="button" class="ly-ov-rail-toggle" data-ly-ov-rail-toggle title="Hide/show contents" aria-pressed="false" aria-label="Contents">☰</button>
                        <button type="button" class="ly-ov-home" data-ly-ov-home title="Open the cover inside the layer">⌂ Home</button>
                        <div class="ly-ov-nav">
                          <button type="button" data-ly-ov-part-prev title="Previous part" aria-label="Previous part">«</button>
                          <button type="button" data-ly-ov-prev title="Previous chapter" aria-label="Previous chapter">‹</button>
                          <button type="button" data-ly-ov-next title="Next chapter" aria-label="Next chapter">›</button>
                          <button type="button" data-ly-ov-part-next title="Next part" aria-label="Next part">»</button>
                        </div>
                        <span data-ly-ov-label>Overview · full text</span>
                        <span class="ly-ov-progress" data-ly-ov-progress title="Chapters read · click: history" role="button" tabindex="0">0/0</span>
                        <button type="button" class="ly-ov-star-cur" data-ly-ov-star-cur title="Star chapter" aria-pressed="false">☆</button>
                        <button type="button" class="ly-ov-read" data-ly-ov-read title="Reading mode" aria-pressed="false">Aa</button>
                        <button type="button" class="ly-ov-copy" data-ly-ov-copy title="Copy chapter link">⧉</button>
                        <a class="ly-ov-open" href="book.html#01-what-is-eliteew" target="_blank" rel="noopener">Open outside ↗</a>
                      </div>
                      <div class="ly-ov-meta">
                        <div class="ly-ov-meta-row">
                          <span class="ly-ov-crumb" data-ly-ov-crumb></span>
                          <span class="ly-ov-eta" data-ly-ov-eta></span>
                        </div>
                        <div class="ly-ov-parts" data-ly-ov-parts hidden aria-label="Parts progress"></div>
                        <div class="ly-ov-bar" aria-hidden="true"><i data-ly-ov-bar></i></div>
                      </div>
                      <div class="ly-ov-recent" data-ly-ov-recent hidden aria-label="Recent chapters"></div>
                      <iframe class="ly-ov-frame" data-ly-ov-frame title="EliteEW overview inside the layer"
                        src="book.html?embed=1#01-what-is-eliteew" loading="lazy"></iframe>
                    </div>
                  </div>
                </div>
              </article>
              <article class="ly-win" data-win="desk" data-win-title="Desk" hidden style="left:14%;top:12%;width:52%;height:58%;z-index:4">
                <header class="ly-win-bar" data-win-drag>
                  <span class="ly-win-mark" aria-hidden="true"></span>
                  <h3 class="ly-win-title">Desk · day</h3>
                  <div class="ly-win-actions">
                    <button type="button" data-win-min aria-label="Minimize">─</button>
                    <button type="button" data-win-max aria-label="Maximize">□</button>
                    <button type="button" data-win-close aria-label="Close">×</button>
                  </div>
                </header>
                <div class="ly-win-body">
                  <div class="ly-job">
                    <p class="ly-job-eye">Simulation · desk</p>
                    <p class="ly-job-h">Workday inside the contour</p>
                    <ul>
                      <li><b>Team calendar</b><span>today</span></li>
                      <li><b>Task: accept composition</b><span>in layer</span></li>
                      <li><b>Project files</b><span>ACL</span></li>
                    </ul>
                  </div>
                </div>
              </article>
              <article class="ly-win" data-win="files" data-win-title="Files" hidden style="left:18%;top:16%;width:50%;height:56%;z-index:4">
                <header class="ly-win-bar" data-win-drag>
                  <span class="ly-win-mark" aria-hidden="true"></span>
                  <h3 class="ly-win-title">Files · ACL</h3>
                  <div class="ly-win-actions">
                    <button type="button" data-win-min aria-label="Minimize">─</button>
                    <button type="button" data-win-max aria-label="Maximize">□</button>
                    <button type="button" data-win-close aria-label="Close">×</button>
                  </div>
                </header>
                <div class="ly-win-body">
                  <div class="ly-job">
                    <p class="ly-job-eye">Simulation · files</p>
                    <p class="ly-job-h">Session files</p>
                    <ul>
                      <li><b>Contract_Q3.pdf</b><span>document</span></li>
                      <li><b>Contacts.xlsx</b><span>sheet</span></li>
                      <li><b>Security_policy.md</b><span>policy</span></li>
                    </ul>
                  </div>
                </div>
              </article>
              <article class="ly-win" data-win="chat" data-win-title="Comms" hidden style="left:22%;top:18%;width:48%;height:54%;z-index:4">
                <header class="ly-win-bar" data-win-drag>
                  <span class="ly-win-mark" aria-hidden="true"></span>
                  <h3 class="ly-win-title">Comms · layer</h3>
                  <div class="ly-win-actions">
                    <button type="button" data-win-min aria-label="Minimize">─</button>
                    <button type="button" data-win-max aria-label="Maximize">□</button>
                    <button type="button" data-win-close aria-label="Close">×</button>
                  </div>
                </header>
                <div class="ly-win-body">
                  <div class="ly-job">
                    <p class="ly-job-eye">Simulation · comms</p>
                    <p class="ly-job-h">Channels inside the layer</p>
                    <ul>
                      <li><b>Project channel</b><span>members</span></li>
                      <li><b>1:1 call</b><span>accept first</span></li>
                      <li><b>Notifications</b><span>in contour</span></li>
                    </ul>
                  </div>
                </div>
              </article>
              <article class="ly-win" data-win="roles" data-win-title="Roles" hidden style="left:26%;top:20%;width:46%;height:52%;z-index:4">
                <header class="ly-win-bar" data-win-drag>
                  <span class="ly-win-mark" aria-hidden="true"></span>
                  <h3 class="ly-win-title">Roles · access</h3>
                  <div class="ly-win-actions">
                    <button type="button" data-win-min aria-label="Minimize">─</button>
                    <button type="button" data-win-max aria-label="Maximize">□</button>
                    <button type="button" data-win-close aria-label="Close">×</button>
                  </div>
                </header>
                <div class="ly-win-body">
                  <div class="ly-job">
                    <p class="ly-job-eye">Simulation · roles</p>
                    <p class="ly-job-h">Organization access</p>
                    <ul>
                      <li><b>Owner</b><span>org</span></li>
                      <li><b>Project lead</b><span>project</span></li>
                      <li><b>Participant</b><span>project</span></li>
                    </ul>
                  </div>
                </div>
              </article>
            </div>
            <div class="ly-start-menu" data-ly-start-menu hidden>
              <p class="ly-start-kicker">Start · work layer</p>
              <p class="ly-start-title">Contour apps</p>
              <label class="ly-start-search">
                <span class="sr-only">Search apps</span>
                <input type="search" data-ly-start-search placeholder="Find an app…" autocomplete="off" />
              </label>
              <div class="ly-start-recent" data-ly-start-recent hidden>
                <p class="ly-start-sec">Recent</p>
                <div class="ly-start-recent-list" data-ly-start-recent-list></div>
              </div>
              <p class="ly-start-sec">All apps</p>
              <div class="ly-start-apps">
                <button type="button" data-open-win="overview"><em>01</em><strong>Overview</strong><span>full pack</span></button>
                <button type="button" data-open-win="desk"><em>02</em><strong>Desk</strong><span>day</span></button>
                <button type="button" data-open-win="files"><em>03</em><strong>Files</strong><span>ACL</span></button>
                <button type="button" data-open-win="chat"><em>04</em><strong>Comms</strong><span>layer</span></button>
                <button type="button" data-open-win="roles"><em>05</em><strong>Roles</strong><span>access</span></button>
              </div>
              <div class="ly-start-power">
                <button type="button" data-ly-power="palette">Palette</button>
                <button type="button" data-ly-power="tasks">Windows</button>
                <button type="button" data-ly-power="focus">Full browser</button>
                <button type="button" data-ly-power="exit">Remove dome</button>
              </div>
              <p class="ly-start-foot">
                <button type="button" class="ly-start-help" data-ly-keys-open>F1 · hotkeys</button>
                · not a live client
              </p>
            </div>
          </div>
          <footer class="ly-taskbar" aria-label="Taskbar">
            <button type="button" class="ly-start-btn" data-ly-start-toggle aria-expanded="false" aria-pressed="false">
              <img src="{logo}" alt="" width="18" height="18" />
              <span>Start</span>
            </button>
            <div class="ly-taskbar-tasks" data-ly-tasks role="list" aria-label="Open windows"></div>
            <div class="ly-taskbar-tray">
              <button type="button" class="ly-tray-ico" title="Perimeter" aria-label="Perimeter" data-tray="shield" data-ly-qs-toggle></button>
              <button type="button" class="ly-tray-ico" title="Link" aria-label="Link" data-tray="net" data-ly-qs-toggle></button>
              <button type="button" class="ly-tray-bell" data-ly-notif-toggle title="Notifications" aria-label="Notifications" aria-expanded="false">
                <span aria-hidden="true"></span>
                <em data-ly-notif-badge hidden>0</em>
              </button>
              <span class="ly-session">Session · active</span>
              <button type="button" class="ly-clock" data-ly-clock data-ly-qs-toggle title="Quick settings">
                <em data-ly-clock-time>09:41</em><small data-ly-clock-date></small>
              </button>
              <button type="button" class="ly-show-desk" data-ly-show-desk title="Show desktop" aria-label="Show desktop"></button>
            </div>
          </footer>
        </div>
"""

def layering_demo_html_ru(asset: str, content_dir: Path) -> str:
    dome = _layering_dome_workspace(asset=asset, lang="ru", content_dir=content_dir)
    return f"""
<section class="layering reveal" data-layering aria-label="Метафора рабочего слоя">
  <div class="ly-head">
    <div>
      <p class="ly-eyebrow">Layering · one click</p>
      <p class="ly-title">Личный хаос → рабочий слой EliteEW</p>
      <p class="ly-hint">Кадр десктопа · после купола — стол с Обзором · листать пакет внутри слоя · не live client</p>
    </div>
    <div class="ly-stages" role="group" aria-label="Этапы">
      <button type="button" class="tone-risk" data-stage="chaos" aria-pressed="true">A · хаос BYOD</button>
      <button type="button" class="tone-safe" data-stage="dome" aria-pressed="false">B · рабочий слой</button>
    </div>
  </div>
  <div class="ly-device ly-device--desktop">
    <div class="ly-bezel">
      <div class="ly-traffic" aria-hidden="true"><span class="r"></span><span class="y"></span><span class="g"></span></div>
      <span>Личное устройство · BYOD · хост-ОС</span>
      <span class="ly-bezel-badge" data-ly-badge>этап A · без рабочего слоя</span>
      <span>09:41</span>
    </div>
    <div class="ly-screen">
      <div class="ly-chaos" aria-hidden="false">
        <div class="ly-wall" aria-hidden="true"></div>
        <button type="button" class="ly-photo ly-p1" data-risk="Личные фото рядом с рабочим контекстом — канал утечки вне периметра.">Отпуск · 2025</button>
        <button type="button" class="ly-photo ly-p2" data-risk="Семейные снимки в том же слое, что и корп. переписка.">Семья</button>
        <button type="button" class="ly-photo ly-p3" data-risk="Скрин чата с договором — классический Shadow IT.">Скрин · чат</button>
        <button type="button" class="ly-photo ly-p4" data-risk="Документы «просто на экране» без ACL контура.">Документы</button>
        <button type="button" class="ly-photo ly-p5" data-risk="Галерея устройства смешана с рабочими артефактами.">Галерея</button>
        <div class="ly-browser" aria-hidden="true">
          <div class="ly-browser-tabs">
            <span class="dot r"></span><span class="dot y"></span><span class="dot g"></span>
            <span class="tab"><i style="background:#67E8F9"></i>Мессенджер · Web</span>
            <span class="tab"><i style="background:#A78BFA"></i>Фото · личное</span>
            <span class="tab"><i style="background:#FBBF24"></i>Облако A</span>
            <span class="tab"><i style="background:#5EEAD4"></i>AI-чат</span>
            <span class="tab"><i style="background:#FDA4AF"></i>Мессенджер B</span>
          </div>
          <div class="ly-browser-bar">
            <span>personal-device.local · BYOD · без корпоративного периметра</span>
            <em>no perimeter</em>
          </div>
        </div>
        <div class="ly-risk-strip" aria-hidden="true">
          <span>Корп. данные в личных каналах · классический периметр эти окна не видит</span>
          <em>смешение · риск утечки</em>
        </div>
        <div class="ly-chats">
          <button type="button" class="ly-chat" data-risk="Корп. файл уходит в личный мессенджер.">
            <div class="ly-chat-top"><strong>Мессенджер A</strong><em>корп. файл</em></div>
            <p>файл.pdf · список контактов</p>
            <span>сейчас</span>
          </button>
          <button type="button" class="ly-chat" data-risk="Договор просят «скинуть на почту» мимо контура.">
            <div class="ly-chat-top"><strong>Мессенджер B</strong><em>договор</em></div>
            <p>договор.docx · «скинь на почту»</p>
            <span>2 мин</span>
          </button>
          <button type="button" class="ly-chat" data-risk="Фрагмент стратегии вставлен во внешний AI-чат.">
            <div class="ly-chat-top"><strong>AI-чат</strong><em>IP · наружу</em></div>
            <p>вставка: фрагмент стратегии</p>
            <span>сегодня</span>
          </button>
        </div>
        <div class="ly-toasts">
          <button type="button" class="ly-toast is-risk" data-risk="Уведомление о файле в «Работе» внутри личного мессенджера.">
            <strong>Мессенджер A</strong><span>Новый файл в «Работа»</span>
          </button>
          <button type="button" class="ly-toast" data-risk="Резерв личных фото — шум рядом с рабочим днём.">
            <strong>Photos</strong><span>Резервная копия · 240 фото</span>
          </button>
          <button type="button" class="ly-toast is-risk" data-risk="Документ от коллеги приходит вне рабочего слоя.">
            <strong>Мессенджер B</strong><span>Документ от коллеги</span>
          </button>
        </div>
        <div class="ly-files">
          <button type="button" class="ly-file is-risk" data-risk="Контакты.xlsx лежит в личном облаке."><b>Контакты.xlsx</b><span>Облако A · личное</span></button>
          <button type="button" class="ly-file is-risk" data-risk="Стратегия в чужом облаке вне политики."><b>стратегия.pptx</b><span>Облако B · личное</span></button>
          <button type="button" class="ly-file" data-risk="Личные фото в том же визуальном слое, что и работа."><b>IMG_2841.jpg</b><span>Камера</span></button>
        </div>
        <div class="ly-dock" aria-hidden="true">
          <span>Фото</span><span>Чаты</span><span>Файлы</span><span>Браузер</span><span>AI</span>
        </div>
      </div>
      <div class="ly-dome" aria-hidden="true">
{dome}
      </div>
    </div>
  </div>
  <div class="ly-risk-panel" data-ly-risk>
    <strong>Клик по элементу (этап A):</strong>
    <span data-ly-risk-text></span>
  </div>
  <div class="ly-cta">
    <div class="ly-cta-actions">
      <button type="button" class="primary" data-ly-toggle>Включить рабочий слой</button>
      <button type="button" class="ly-focus-btn" data-ly-focus aria-pressed="false">
        <span class="ly-focus-pulse" aria-hidden="true"></span>
        <span data-ly-focus-label>На весь экран</span>
      </button>
    </div>
    <p class="ly-disclaimer">Метафора Layering · внутри купола — навигация по обзору · не live-клиент · не снимок экрана продукта</p>
  </div>
</section>
"""


def layering_demo_html_en(asset: str, content_dir: Path) -> str:
    dome = _layering_dome_workspace(asset=asset, lang="en", content_dir=content_dir)
    return f"""
<section class="layering reveal" data-layering aria-label="Work-layer metaphor">
  <div class="ly-head">
    <div>
      <p class="ly-eyebrow">Layering · one click</p>
      <p class="ly-title">Personal chaos → EliteEW work layer</p>
      <p class="ly-hint">Desktop frame · after the dome — desk with Overview · browse the pack inside the layer · not a live client</p>
    </div>
    <div class="ly-stages" role="group" aria-label="Stages">
      <button type="button" class="tone-risk" data-stage="chaos" aria-pressed="true">A · BYOD chaos</button>
      <button type="button" class="tone-safe" data-stage="dome" aria-pressed="false">B · work layer</button>
    </div>
  </div>
  <div class="ly-device ly-device--desktop">
    <div class="ly-bezel">
      <div class="ly-traffic" aria-hidden="true"><span class="r"></span><span class="y"></span><span class="g"></span></div>
      <span>Personal device · BYOD · host OS</span>
      <span class="ly-bezel-badge" data-ly-badge>stage A · no work layer</span>
      <span>09:41</span>
    </div>
    <div class="ly-screen">
      <div class="ly-chaos" aria-hidden="false">
        <div class="ly-wall" aria-hidden="true"></div>
        <button type="button" class="ly-photo ly-p1" data-risk="Personal photos next to work context — a leak path outside the perimeter.">Vacation · 2025</button>
        <button type="button" class="ly-photo ly-p2" data-risk="Family shots in the same layer as work threads.">Family</button>
        <button type="button" class="ly-photo ly-p3" data-risk="Chat screenshot with a contract — classic Shadow IT.">Screenshot · chat</button>
        <button type="button" class="ly-photo ly-p4" data-risk="Documents “just on screen” with no contour ACL.">Documents</button>
        <button type="button" class="ly-photo ly-p5" data-risk="Device gallery mixed with work artifacts.">Gallery</button>
        <div class="ly-browser" aria-hidden="true">
          <div class="ly-browser-tabs">
            <span class="dot r"></span><span class="dot y"></span><span class="dot g"></span>
            <span class="tab"><i style="background:#67E8F9"></i>Messenger · Web</span>
            <span class="tab"><i style="background:#A78BFA"></i>Photos · personal</span>
            <span class="tab"><i style="background:#FBBF24"></i>Cloud A</span>
            <span class="tab"><i style="background:#5EEAD4"></i>AI chat</span>
            <span class="tab"><i style="background:#FDA4AF"></i>Messenger B</span>
          </div>
          <div class="ly-browser-bar">
            <span>personal-device.local · BYOD · no corporate perimeter</span>
            <em>no perimeter</em>
          </div>
        </div>
        <div class="ly-risk-strip" aria-hidden="true">
          <span>Corp data in personal channels · classic perimeter never sees these windows</span>
          <em>mixing · leak risk</em>
        </div>
        <div class="ly-chats">
          <button type="button" class="ly-chat" data-risk="A corp file leaves into a personal messenger.">
            <div class="ly-chat-top"><strong>Messenger A</strong><em>corp file</em></div>
            <p>file.pdf · contact list</p>
            <span>now</span>
          </button>
          <button type="button" class="ly-chat" data-risk="Someone asks to “mail the contract” past the contour.">
            <div class="ly-chat-top"><strong>Messenger B</strong><em>contract</em></div>
            <p>contract.docx · “mail it”</p>
            <span>2 min</span>
          </button>
          <button type="button" class="ly-chat" data-risk="A strategy fragment pasted into an external AI chat.">
            <div class="ly-chat-top"><strong>AI chat</strong><em>IP · out</em></div>
            <p>paste: strategy fragment</p>
            <span>today</span>
          </button>
        </div>
        <div class="ly-toasts">
          <button type="button" class="ly-toast is-risk" data-risk="A Work-folder file alert inside a personal messenger.">
            <strong>Messenger A</strong><span>New file in Work</span>
          </button>
          <button type="button" class="ly-toast" data-risk="Personal photo backup — noise next to the workday.">
            <strong>Photos</strong><span>Backup · 240 photos</span>
          </button>
          <button type="button" class="ly-toast is-risk" data-risk="A colleague’s document arrives outside the work layer.">
            <strong>Messenger B</strong><span>Document from colleague</span>
          </button>
        </div>
        <div class="ly-files">
          <button type="button" class="ly-file is-risk" data-risk="Contacts.xlsx sits in a personal cloud."><b>Contacts.xlsx</b><span>Cloud A · personal</span></button>
          <button type="button" class="ly-file is-risk" data-risk="Strategy in a foreign cloud outside policy."><b>strategy.pptx</b><span>Cloud B · personal</span></button>
          <button type="button" class="ly-file" data-risk="Personal photos in the same visual layer as work."><b>IMG_2841.jpg</b><span>Camera</span></button>
        </div>
        <div class="ly-dock" aria-hidden="true">
          <span>Photos</span><span>Chats</span><span>Files</span><span>Browser</span><span>AI</span>
        </div>
      </div>
      <div class="ly-dome" aria-hidden="true">
{dome}
      </div>
    </div>
  </div>
  <div class="ly-risk-panel" data-ly-risk>
    <strong>Click an element (stage A):</strong>
    <span data-ly-risk-text></span>
  </div>
  <div class="ly-cta">
    <div class="ly-cta-actions">
      <button type="button" class="primary" data-ly-toggle>Enable work layer</button>
      <button type="button" class="ly-focus-btn" data-ly-focus aria-pressed="false">
        <span class="ly-focus-pulse" aria-hidden="true"></span>
        <span data-ly-focus-label>Full browser</span>
      </button>
    </div>
    <p class="ly-disclaimer">Layering metaphor · inside the dome — navigate the overview · not a live client · not a product screenshot</p>
  </div>
</section>
"""


def chapter_article(path: Path, diagrams: dict[str, Diagram], ui: Ui) -> str:
    raw = path.read_text(encoding="utf-8")
    body = md_to_html(raw, diagrams, ui)
    return f'<article class="chapter reveal" id="{html.escape(path.stem)}">\n{body}\n</article>\n'


def sync_assets() -> None:
    ensure_mermaid_vendor()
    ASSETS.mkdir(parents=True, exist_ok=True)
    (ASSETS / "brand").mkdir(parents=True, exist_ok=True)
    ill = PACK / "assets" / "illustrations"
    brand = ill / "brand"
    for name in ("emperyworld-logo.webp", "emperyworld-icon.svg", "logo_empery.png"):
        shutil.copy2(brand / name, ASSETS / "brand" / name)
    for stale in ASSETS.glob("c0*.webp"):
        stale.unlink(missing_ok=True)
    for stale in (ASSETS / "illustrations").glob("c0*.webp") if (ASSETS / "illustrations").is_dir() else []:
        stale.unlink(missing_ok=True)
    shutil.copy2(MERMAID_JS, ASSETS / "mermaid.min.js")
    css_src = ROOT / "export.css"
    if css_src.exists():
        shutil.copy2(css_src, ASSETS / "export.css")
    js_src = ROOT / "export.js"
    if js_src.exists():
        shutil.copy2(js_src, ASSETS / "export.js")
    d_out = ASSETS / "diagrams-md"
    d_out.mkdir(parents=True, exist_ok=True)
    for path in sorted((PACK / "assets" / "diagrams").glob("D*.md")):
        shutil.copy2(path, d_out / path.name)


def build_lang_picker() -> None:
    HTML_DIR.mkdir(parents=True, exist_ok=True)
    body = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex" />
  <meta name="color-scheme" content="dark" />
  <title>EliteEW — product overview · language</title>
  <link rel="stylesheet" href="assets/export.css" />
</head>
<body class="page-index page-lang">
  <div class="ambient" aria-hidden="true"></div>
  <div class="site-top">
    <div class="site-top-inner">
      <a class="brand-row" href="index.html">
        <img class="logo" src="assets/brand/emperyworld-logo.webp" alt="" width="34" height="34" />
        <div>
          <span class="brand-name">EliteEW</span>
          <span class="brand-sub">product overview · language</span>
        </div>
      </a>
    </div>
  </div>
  <main class="wrap">
    <header class="cover">
      <div class="cover-glow" aria-hidden="true"></div>
      <div class="cover-inner">
        <img class="logo-hero" src="assets/brand/emperyworld-logo.webp" alt="Empery World" width="120" height="120" />
        <p class="eyebrow">Empery World · product overview</p>
        <h1>EliteEW</h1>
        <p class="lede">Choose language · Выберите язык</p>
      </div>
    </header>
    <div class="path-grid reveal" aria-label="Languages">
      <a class="path-card is-primary" href="ru/index.html" lang="ru" hreflang="ru">
        <p class="pc-step">RU</p>
        <p class="pc-title">Русский</p>
        <p class="pc-hint">Обзорный пакет · дар миру по MIT</p>
        <span class="pc-go">Открыть →</span>
      </a>
      <a class="path-card is-primary" href="en/index.html" lang="en" hreflang="en">
        <p class="pc-step">EN</p>
        <p class="pc-title">English</p>
        <p class="pc-hint">Meaning-first overview · gift under MIT</p>
        <span class="pc-go">Open →</span>
      </a>
    </div>
    <footer class="export-foot">
      Empery World / EliteEW · HTML primary · not an operations runbook
    </footer>
  </main>
  <script src="assets/export.js"></script>
</body>
</html>
"""
    (HTML_DIR / "index.html").write_text(body, encoding="utf-8")


def chapter_title(content_dir: Path, name: str) -> str:
    p = content_dir / name
    if p.exists():
        return p.read_text(encoding="utf-8").splitlines()[0].lstrip("# ").strip()
    return Path(name).stem


def grouped_toc_html(ui: Ui) -> str:
    """Part-grouped TOC for cover (collapsed) and book rail."""
    lang_i = 0 if ui.lang == "ru" else 1
    blocks: list[str] = []
    for part_id, labels, stems in BOOK_PARTS:
        items: list[str] = []
        for stem in stems:
            name = f"{stem}.md"
            title = chapter_title(ui.content_dir, name)
            if len(title) > 56:
                title = title[:54] + "…"
            items.append(
                f'<li><a href="book.html#{html.escape(stem)}">{html.escape(title)}</a></li>'
            )
        if not items:
            continue
        label = labels[lang_i]
        # Open the product part by default — first real reading block.
        open_attr = " open" if part_id == "product" else ""
        blocks.append(
            f'<details class="toc-part" id="part-{html.escape(part_id)}"{open_attr}>'
            f"<summary>{html.escape(label)}</summary>"
            f'<ol class="toc-dense">{"".join(items)}</ol>'
            f"</details>"
        )
    return "\n".join(blocks)


def build_index(ui: Ui, diagrams: dict[str, Diagram]) -> None:
    del diagrams  # keep start page free of build/meta noise
    if ui.lang == "ru":
        how = (
            "Четыре входа ниже · полный текст — в рабочем слое (Обзор) или страница «Полный текст» · "
            "сжатый вход — «Сжато»."
        )
    else:
        how = (
            "Four entrances below · full text lives in the work layer (Overview) or Full text page · "
            "condensed entry is Brief."
        )
    body = f"""
    <p class="lead-how reveal">{html.escape(how)}</p>
    <div class="path-grid reveal" aria-label="{html.escape(ui.path_grid_aria)}">
      <a class="path-card is-primary reveal" href="book.html#01-what-is-eliteew">
        <p class="pc-step">{html.escape(ui.pc1_step)}</p>
        <p class="pc-title">{html.escape(ui.pc1_title)}</p>
        <p class="pc-hint">{html.escape(ui.pc1_hint)}</p>
        <span class="pc-go">{html.escape(ui.pc1_go)}</span>
      </a>
      <a class="path-card reveal" href="book.html#02-threats-and-protection">
        <p class="pc-step">{html.escape(ui.pc2_step)}</p>
        <p class="pc-title">{html.escape(ui.pc2_title)}</p>
        <p class="pc-hint">{html.escape(ui.pc2_hint)}</p>
        <span class="pc-go">{html.escape(ui.pc2_go)}</span>
      </a>
      <a class="path-card reveal" href="book.html#03e-delivery-models">
        <p class="pc-step">{html.escape(ui.pc3_step)}</p>
        <p class="pc-title">{html.escape(ui.pc3_title)}</p>
        <p class="pc-hint">{html.escape(ui.pc3_hint)}</p>
        <span class="pc-go">{html.escape(ui.pc3_go)}</span>
      </a>
      <a class="path-card reveal" href="onepagers.html">
        <p class="pc-step">{html.escape(ui.pc4_step)}</p>
        <p class="pc-title">{html.escape(ui.pc4_title)}</p>
        <p class="pc-hint">{html.escape(ui.pc4_hint)}</p>
        <span class="pc-go">{html.escape(ui.pc4_go)}</span>
      </a>
    </div>
    <aside class="handover-strip reveal" aria-label="{html.escape(ui.handover_aria)}">
      <div>
        <p class="ds-kicker">{html.escape(ui.handover_kicker)}</p>
        <p class="ds-title">{html.escape(ui.handover_title)}</p>
        <p class="ds-copy">{html.escape(ui.handover_copy)}</p>
      </div>
      <div class="ds-links">
        <a href="book.html#03f-transfer-bom-handover">P3f · BoM</a>
        <a href="book.html#03g-si-migration-playbook">P3g</a>
        <a href="onepagers.html#13-onepager-dd-rfi">DD / RFI</a>
        <a href="book.html#glossary">Glossary</a>
      </div>
    </aside>
    {ui.layering}
"""
    ui.out_html.mkdir(parents=True, exist_ok=True)
    (ui.out_html / "index.html").write_text(
        shell(ui, ui.page_title_index, body, active="index", page_class="page-index"),
        encoding="utf-8",
    )


def build_onepagers(ui: Ui, diagrams: dict[str, Diagram]) -> None:
    parts = [
        f'<p class="meta reveal">{html.escape(ui.onepagers_meta)}</p>',
    ]
    for name in ONEPAGER_FILES:
        p = ui.content_dir / name
        if p.exists():
            parts.append(chapter_article(p, diagrams, ui))
    ui.out_html.mkdir(parents=True, exist_ok=True)
    (ui.out_html / "onepagers.html").write_text(
        shell(
            ui,
            ui.page_title_onepagers,
            "\n".join(parts),
            active="onepagers",
            cover="compact",
            page_class="page-onepagers",
        ),
        encoding="utf-8",
    )


def build_diagrams_page(ui: Ui, diagrams: dict[str, Diagram]) -> None:
    seen: set[str] = set()
    parts = [
        f'<p class="meta reveal">{ui.diagrams_meta}</p>',
    ]
    for stem in sorted({d.stem for d in diagrams.values()}):
        if stem in seen:
            continue
        seen.add(stem)
        parts.append(f'<div class="reveal">{diagram_figure(diagrams[stem], ui)}</div>')
    ui.out_html.mkdir(parents=True, exist_ok=True)
    (ui.out_html / "diagrams.html").write_text(
        shell(
            ui,
            ui.page_title_diagrams,
            "\n".join(parts),
            active="diagrams",
            mermaid=True,
            cover="compact",
            page_class="page-diagrams",
        ),
        encoding="utf-8",
    )


def build_book(ui: Ui, diagrams: dict[str, Diagram]) -> None:
    lang_i = 0 if ui.lang == "ru" else 1
    rail_blocks: list[str] = []
    articles: list[str] = []
    for part_id, labels, stems in BOOK_PARTS:
        links: list[str] = []
        first = True
        for stem in stems:
            name = f"{stem}.md"
            p = ui.content_dir / name
            if not p.exists():
                print(f"[STEP] book_skip_missing {ui.lang}/{name}", flush=True)
                continue
            title = chapter_title(ui.content_dir, name)
            if len(title) > 42:
                title = title[:40] + "…"
            links.append(f'<a href="#{html.escape(stem)}">{html.escape(title)}</a>')
            if first:
                articles.append(
                    f'<header class="part-head reveal" id="part-{html.escape(part_id)}">'
                    f"<h2>{html.escape(labels[lang_i])}</h2>"
                    f"</header>"
                )
                first = False
            articles.append(chapter_article(p, diagrams, ui))
        if not links:
            continue
        rail_blocks.append(
            f'<div class="sr-part" data-part="{html.escape(part_id)}">'
            f'<p class="sr-part-title">{html.escape(labels[lang_i])}</p>'
            f"{''.join(links)}"
            f"</div>"
        )

    rail_open = "Содержание" if ui.lang == "ru" else "Contents"
    body = f"""
    <button type="button" class="rail-fab" data-rail-toggle aria-expanded="false" aria-controls="book-side-rail">
      {html.escape(rail_open)}
    </button>
    <div class="rail-scrim" data-rail-scrim hidden aria-hidden="true"></div>
    <div class="book-layout">
      <aside class="side-rail" id="book-side-rail" aria-label="Chapter navigation">
        <p class="sr-title">{html.escape(ui.rail_title)}</p>
        <label class="sr-search">
          <span class="sr-search-label">{html.escape("Поиск" if ui.lang == "ru" else "Search")}</span>
          <input type="search" data-book-search autocomplete="off"
            placeholder="{html.escape("Фильтр глав…" if ui.lang == "ru" else "Filter chapters…")}"
            aria-label="{html.escape("Фильтр оглавления" if ui.lang == "ru" else "Filter table of contents")}" />
        </label>
        <p class="sr-search-empty" data-book-search-empty hidden>
          {html.escape("Ничего не найдено" if ui.lang == "ru" else "No matches")}
        </p>
        {"".join(rail_blocks)}
      </aside>
      <div class="book-main">
        <p class="meta reveal">{ui.book_meta}</p>
        {"".join(articles)}
      </div>
    </div>
"""
    ui.out_html.mkdir(parents=True, exist_ok=True)
    (ui.out_html / "book.html").write_text(
        shell(
            ui,
            ui.page_title_book,
            body,
            active="book",
            mermaid=True,
            cover="compact",
            page_class="page-book",
        ),
        encoding="utf-8",
    )


def rewrite_md_for_pack(text: str, lang: str) -> str:
    text = re.sub(
        r"\[`?\.\./ELITEEW-PUBLIC-BUYER-DOCS-PLAN\.md`?\]\(\.\./ELITEEW-PUBLIC-BUYER-DOCS-PLAN\.md\)",
        "*(внутри репозитория, не входит в share)*"
        if lang == "ru"
        else "*(in-repo only; not in share)*",
        text,
    )
    text = text.replace("](export/html/", "](../../html/")
    text = text.replace("](export/pdf/", "](../../pdf/")
    text = text.replace("](export/share/", "](../../share/")
    text = re.sub(
        r"\[`?export/`?\]\(export/\)",
        "[HTML export](../../html/)",
        text,
    )
    text = text.replace("](export/)", "](../../html/)")
    if lang == "en":
        text = text.replace("](../assets/", "](assets/")
    return text


def build_md_pack(ui: Ui) -> None:
    ui.out_md.mkdir(parents=True, exist_ok=True)
    assets_dir = ui.out_md / "assets"
    diagrams_out = assets_dir / "diagrams"
    brand_out = assets_dir / "illustrations" / "brand"
    diagrams_out.mkdir(parents=True, exist_ok=True)
    brand_out.mkdir(parents=True, exist_ok=True)

    book_parts: list[str] = [
        ui.md_book_title,
        "\n",
        ui.md_book_blurb,
        "\n---\n\n",
    ]
    onepager_parts: list[str] = [ui.md_onepager_title]
    diagrams_parts: list[str] = [ui.md_diagrams_title, ui.md_diagrams_blurb]

    for name in BOOK_FILES:
        src = ui.content_dir / name
        if not src.exists():
            print(f"[STEP] md_skip_missing {ui.lang}/{name}", flush=True)
            continue
        raw = rewrite_md_for_pack(src.read_text(encoding="utf-8"), ui.lang)
        (ui.out_md / name).write_text(raw, encoding="utf-8")
        book_parts.append(raw.rstrip() + "\n\n---\n\n")

    keep = set(BOOK_FILES) | set(ONEPAGER_FILES) | {
        "README.md",
        "book.md",
        "onepagers.md",
        "diagrams.md",
    }
    for stale in ui.out_md.glob("*.md"):
        if stale.name not in keep:
            stale.unlink(missing_ok=True)
            print(f"[STEP] md_purge_stale {ui.lang}/{stale.name}", flush=True)

    for name in ONEPAGER_FILES:
        src = ui.content_dir / name
        if not src.exists():
            continue
        raw = rewrite_md_for_pack(src.read_text(encoding="utf-8"), ui.lang)
        onepager_parts.append(raw.rstrip() + "\n\n---\n\n")

    for path in sorted((PACK / "assets" / "diagrams").glob("D*.md")):
        raw = path.read_text(encoding="utf-8")
        if ui.lang == "en":
            m = MERMAID_BLOCK_RE.search(raw)
            if m:
                translated = mermaid_for_lang(m.group(1).strip(), "en")
                raw = (
                    raw[: m.start(1)]
                    + translated
                    + raw[m.end(1) :]
                )
            # Prefer EN title when known
            stem = path.stem
            en_title = DIAGRAM_TITLE_EN.get(stem)
            if en_title and raw.startswith("#"):
                first_nl = raw.find("\n")
                raw = f"# {en_title}" + (raw[first_nl:] if first_nl >= 0 else "")
            # Drop Russian sense lines in EN pack
            raw = re.sub(r"\n\*\*Смысл:\*\*[^\n]*", "", raw)
            raw = re.sub(r"\n\*\*Alt:\*\*[^\n]*", "", raw)
        (diagrams_out / path.name).write_text(raw, encoding="utf-8")
        diagrams_parts.append(raw.rstrip() + "\n\n---\n\n")

    brand = PACK / "assets" / "illustrations" / "brand"
    for name in ("emperyworld-logo.webp", "emperyworld-icon.svg", "logo_empery.png"):
        src = brand / name
        if src.exists():
            shutil.copy2(src, brand_out / name)
    ill_out = assets_dir / "illustrations"
    for stale in ill_out.glob("c0*.webp"):
        stale.unlink(missing_ok=True)

    (ui.out_md / "book.md").write_text("".join(book_parts), encoding="utf-8")
    (ui.out_md / "onepagers.md").write_text("".join(onepager_parts), encoding="utf-8")
    (ui.out_md / "diagrams.md").write_text("".join(diagrams_parts), encoding="utf-8")
    (ui.out_md / "README.md").write_text(ui.md_readme, encoding="utf-8")
    print("[OK] Markdown written under", ui.out_md, flush=True)


def build_md_root_readme() -> None:
    MD_DIR.mkdir(parents=True, exist_ok=True)
    (MD_DIR / "README.md").write_text(
        "# EliteEW product overview — Markdown\n\n"
        "- [Русский](ru/README.md)\n"
        "- [English](en/README.md)\n",
        encoding="utf-8",
    )


def trash_paths(paths: list[Path]) -> None:
    existing = [p for p in paths if p.exists()]
    if not existing:
        return
    repo_root = ROOT
    trash_script: Path | None = None
    while repo_root != repo_root.parent:
        cand = repo_root / "scripts" / "eliteew" / "trash-move.sh"
        if cand.is_file():
            trash_script = cand
            break
        repo_root = repo_root.parent
    if trash_script is None:
        print("[STEP] trash_skip: trash-move.sh missing", flush=True)
        return
    subprocess.run(
        ["bash", str(trash_script), *[str(p) for p in existing]],
        check=True,
    )


def build_share() -> Path:
    SHARE_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(UTC).strftime("%Y%m%d")
    bundle_name = f"eliteew-product-overview-share-{stamp}"
    bundle_dir = SHARE_DIR / bundle_name
    zip_path = SHARE_DIR / f"{bundle_name}.zip"
    retire: list[Path] = []
    if bundle_dir.exists():
        retire.append(bundle_dir)
    if zip_path.exists():
        retire.append(zip_path)
    # Soft-retire prior same-day rebuild + any legacy buyer-named shares.
    for old in SHARE_DIR.glob("eliteew-public-buyer-share-*"):
        if old not in retire:
            retire.append(old)
    trash_paths(retire)
    bundle_dir.mkdir(parents=True)

    shutil.copytree(HTML_DIR, bundle_dir / "html")
    shutil.copytree(MD_DIR, bundle_dir / "md")

    (bundle_dir / "OPEN.html").write_text(
        """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta http-equiv="refresh" content="0; url=html/index.html" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>EliteEW · open overview</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #0b0e14; color: #e8eef7;
           display: grid; place-items: center; min-height: 100vh; margin: 0; }
    a { color: #22d3ee; font-weight: 700; }
  </style>
</head>
<body>
  <p>Opening <a href="html/index.html">html/index.html</a>…</p>
</body>
</html>
""",
        encoding="utf-8",
    )

    (bundle_dir / "README.md").write_text(
        "# EliteEW product overview — share bundle\n\n"
        "## Open this pack\n\n"
        "1. Double-click **[`OPEN.html`](OPEN.html)** "
        "(or open [`html/index.html`](html/index.html)).\n"
        "2. Choose **Русский** or **English**.\n\n"
        "| Path | What |\n"
        "|------|------|\n"
        "| [`html/index.html`](html/index.html) | Language picker |\n"
        "| [`html/ru/`](html/ru/) | Russian HTML |\n"
        "| [`html/en/`](html/en/) | English HTML |\n"
        "| [`md/ru/`](md/ru/) · [`md/en/`](md/en/) | Markdown twins |\n\n"
        "Bilingual · handover layer · not an operations runbook · "
        "safe-to-share after review.\n",
        encoding="utf-8",
    )

    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for path in sorted(bundle_dir.rglob("*")):
            if path.is_file():
                archive_path = path.relative_to(SHARE_DIR).as_posix()
                info = zipfile.ZipInfo(archive_path, date_time=ZIP_EPOCH)
                info.compress_type = zipfile.ZIP_DEFLATED
                info.external_attr = (path.stat().st_mode & 0xFFFF) << 16
                zf.writestr(info, path.read_bytes())
    print(f"[OK] share {zip_path} ({zip_path.stat().st_size} bytes)", flush=True)
    return zip_path


def chromium_bin() -> str | None:
    for cand in (
        "/usr/bin/google-chrome",
        "/usr/bin/chromium-browser",
        "/usr/bin/chromium",
    ):
        if Path(cand).exists():
            return cand
    return None


def print_pdf(html_rel: str, pdf_name: str) -> bool:
    chrome = chromium_bin()
    if not chrome:
        print("[STEP] pdf_skip: no chromium", flush=True)
        return False
    PDF_DIR.mkdir(parents=True, exist_ok=True)
    src = HTML_DIR / html_rel
    dest = PDF_DIR / pdf_name
    uri = src.resolve().as_uri()
    cmd = [
        chrome,
        "--headless=new",
        "--disable-gpu",
        "--no-pdf-header-footer",
        "--run-all-compositor-stages-before-draw",
        "--virtual-time-budget=20000",
        f"--print-to-pdf={dest}",
        uri,
    ]
    print(f"[STEP] pdf {pdf_name}", flush=True)
    try:
        subprocess.run(cmd, check=True, capture_output=True, timeout=240)
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as exc:
        print(f"[STEP] pdf_fail {pdf_name}: {exc}", flush=True)
        return False
    ok = dest.exists() and dest.stat().st_size > 1000
    print(f"[OK] {dest} ({dest.stat().st_size if ok else 0} bytes)", flush=True)
    return ok


def retire_flat_export_pages() -> None:
    """Soft-retire pre-bilingual flat html pages (not the lang picker) and root md chapters."""
    # Keep html/index.html (lang picker). Only retire legacy flat chapter pages.
    flat_html = [
        HTML_DIR / name
        for name in ("book.html", "onepagers.html", "diagrams.html")
        if (HTML_DIR / name).is_file()
    ]
    # Root md/*.md chapters are legacy; keep only md/README.md + md/{ru,en}/.
    flat_md = [
        p
        for p in MD_DIR.glob("*.md")
        if p.is_file() and p.name != "README.md"
    ]
    trash_paths(flat_html + flat_md)


def _env_flag(*names: str) -> bool:
    for name in names:
        if os.environ.get(name, "").strip().lower() in {"1", "true", "yes"}:
            return True
    return False


def main() -> int:
    diagrams = load_diagrams()
    print(
        f"[OK] diagrams loaded: {len({d.stem for d in diagrams.values()})}", flush=True
    )
    retire_flat_export_pages()
    sync_assets()
    build_lang_picker()
    for lang in ("ru", "en"):
        ui = ui_for(lang)
        print(f"[STEP] build lang={lang}", flush=True)
        build_index(ui, diagrams)
        build_onepagers(ui, diagrams)
        build_diagrams_page(ui, diagrams)
        build_book(ui, diagrams)
        build_md_pack(ui)
        print(f"[OK] HTML written under {ui.out_html}", flush=True)
    build_md_root_readme()

    with_pdf = _env_flag("ELITEEW_OVERVIEW_WITH_PDF", "ELITEEW_BUYER_WITH_PDF")
    skip_pdf = _env_flag("ELITEEW_OVERVIEW_SKIP_PDF", "ELITEEW_BUYER_SKIP_PDF")
    if not skip_pdf and with_pdf:
        ok = True
        for lang in ("ru", "en"):
            ok = print_pdf(f"{lang}/onepagers.html", f"eliteew-overview-{lang}-onepagers.pdf") and ok
            ok = print_pdf(f"{lang}/book.html", f"eliteew-overview-{lang}-book.pdf") and ok
            ok = print_pdf(f"{lang}/diagrams.html", f"eliteew-overview-{lang}-diagrams.pdf") and ok
        if not ok:
            print("[STEP] pdf_partial_or_failed — HTML+MD remain primary", flush=True)
    else:
        print(
            "[STEP] pdf_skip (HTML+MD primary; set ELITEEW_OVERVIEW_WITH_PDF=1 to build PDF)",
            flush=True,
        )
    build_share()
    return 0


if __name__ == "__main__":
    sys.exit(main())
