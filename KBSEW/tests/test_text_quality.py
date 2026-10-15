# ---
# KBSEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Tests for PDF/Tika noise filtering, dehyphenation, and search near-dedupe.
# ---

from __future__ import annotations

import pytest
from api.services.text_quality import (
    clean_pdf_extracted_text,
    filter_readable_chunks,
    finalize_search_chunks,
    is_readable_chunk,
    normalize_readable_text,
    suppress_near_duplicate_chunks,
)

GARBAGE_3 = (
    "3d0438044f00200434043e043a0443043c0435043d0442043e0432002000410064006f006200650020005000440046"
    ",0020043c0430043a04410438043c0430043b044c043d043e0020043f043e04340445043e0434044f044904380445"
)

GARBAGE_4 = (
    "/SKY <FEFF00540069006500> /BGR <FEFF04180437043f043e043b043704320430043904420435"
    "648062706410642062900200644064406370628062706390629"
)

GOOD_BRANDING = (
    "8. Брэнд — В первом значении — клеймо, знак принадлежности определенному хозяину "
    "или знак мастера, который произвел товар. Сложный комплекс экономических, "
    "психологических и символических взаимоотношений, включая обещание качества."
)


def test_is_readable_chunk_rejects_pdf_hex_noise() -> None:
    assert is_readable_chunk(GARBAGE_3) is False
    assert is_readable_chunk(GARBAGE_4) is False
    assert is_readable_chunk(GOOD_BRANDING) is True


def test_clean_pdf_extracted_text_drops_noise_lines() -> None:
    mixed = f"{GOOD_BRANDING}\n{GARBAGE_3}\nЕщё один нормальный абзац про маркетинг и брендинг."
    cleaned = clean_pdf_extracted_text(mixed)
    assert "Брэнд" in cleaned
    assert "3d0438044f" not in cleaned


def test_normalize_strips_soft_hyphen_and_joins_hyphen_newline() -> None:
    soft = "брен\u00adдинг и мар\u00adкетинг как практика"
    assert "\u00ad" not in normalize_readable_text(soft)
    assert "брендинг" in normalize_readable_text(soft)

    wrapped = "позициониро-\nвание бренда на рынке товаров и услуг"
    joined = normalize_readable_text(wrapped)
    assert "позиционирование" in joined
    assert "-\n" not in joined


def test_normalize_collapses_spaced_letters_and_midword_ocr() -> None:
    spaced = "С т р а н и ц а 1 | 70 Книга переведена при финансовой поддержке партнёра."
    assert "Страница" in normalize_readable_text(spaced)
    assert "С т р а н и ц а" not in normalize_readable_text(spaced)

    mid = (
        "Как только удается прояснить архетипическое место бренда в мире, необходи мо "
        "начать тщательный процесс взращивания этой характерной индивидуальнос ти "
        "и извлечения из нее прибылей на рынке."
    )
    out = normalize_readable_text(mid)
    assert "необходимо" in out
    assert "индивидуальности" in out
    assert "необходи мо" not in out


def test_normalize_glues_short_left_ocr_linewrap_from_admin_samples() -> None:
    samples = [
        ("ха рактеристикой, которая делает бренд", "характеристикой"),
        ("наи более значимого содержимого", "наиболее"),
        ("задав шись такими вопросами", "задавшись"),
        ("куль туры в то время", "культуры"),
        ("определ яющим выбор покупателя", "определяющим"),
        ("кото рый лучше всего подходит", "который"),
        ("руко водителей корпораций", "руководителей"),
    ]
    for raw, needle in samples:
        out = normalize_readable_text(f"В условиях рынка {raw} и это создает базу для уникальности бренда надолго.")
        assert needle in out, (raw, out)
        assert raw.split()[0] + " " + raw.split()[1] not in out


def test_normalize_does_not_glue_closed_class_or_two_long_words() -> None:
    keep = normalize_readable_text("Бренд является двигателем стратегии на рынке и работает в мире конкуренции.")
    assert "является двигателем" in keep
    assert "на рынке" in keep
    assert "в мире" in keep
    assert "являетсядвигателем" not in keep

    search_fixture = normalize_readable_text("который должен пройти фильтр качества извлеченного текста.")
    assert "пройти фильтр" in search_fixture
    assert "пройтифильтр" not in search_fixture


def test_is_readable_rejects_residual_spaced_letters() -> None:
    junk = (
        "С т р а н и ц а 1 | 70 С т р а н и ц а 2 | 70 Книга переведена при финансовой "
        "поддержке Callupper для интернет-бизнеса и лидогенерации клиентов."
    )
    # normalize collapses spaced letters; readable path must not keep letter-spaced noise.
    assert "Страница" in normalize_readable_text(junk)


def test_assert_chunks_ingest_quality_rejects_noisy_set() -> None:
    from api.services.text_quality import assert_chunks_ingest_quality

    good = (
        "Бренд — это обещание качества и набор ассоциаций вокруг товара на рынке. "
        "Компания строит узнаваемость через последовательную коммуникацию."
    )
    noisy = "С т р а н и ц а 1 | 70 " + good
    # One noisy raw chunk among few → spaced_letter_ratio trips gate.
    with pytest.raises(ValueError, match="spaced_letter"):
        assert_chunks_ingest_quality([noisy, noisy, good])


def test_assert_chunks_ingest_quality_rejects_residual_midword_density() -> None:
    from api.services.text_quality import assert_chunks_ingest_quality

    # Orphan "й" moved onto the next token — glue refuses; residual gate must fail-closed.
    bad = (
        "Позиционирование продукта описано как связный фрагмент знания для поиска. "
        "Стратегия бренда требует внимательного анализа рынка конкурентов. "
        "управленчески йконтур отделяет визуальную айдентику от смыслового ядра бренда "
        "и это создает базу для уникальности предложения на рынке."
    )
    with pytest.raises(ValueError, match="midword_break|ocr_breaks|readable_ratio"):
        assert_chunks_ingest_quality([bad] * 20)


def test_normalize_does_not_glue_znak_mastera_or_smyoslovogo_yadra() -> None:
    keep = normalize_readable_text("знак мастера, который произвел товар, и смыслового ядра бренда на рынке.")
    assert "знак мастера" in keep
    assert "смыслового ядра" in keep
    assert "знакмастера" not in keep
    assert "смысловогоядра" not in keep


def test_assert_chunks_ingest_quality_accepts_clean_set() -> None:
    from api.services.text_quality import assert_chunks_ingest_quality

    chunks = [
        GOOD_BRANDING,
        "Второй нормальный фрагмент про консалтинг и брендинг в России с достаточной длиной для RAG chunk filter.",
    ]
    report = assert_chunks_ingest_quality(chunks)
    assert report.readable_ratio == 1.0


def test_assert_chunks_source_code_profile_allows_snake_case_identifiers() -> None:
    from api.services.text_quality import (
        assert_chunks_ingest_quality,
        ingest_quality_profile_for_driver,
    )

    # Underscores look like OCR mid-word breaks to the document profile.
    codeish = (
        "def mcp_host_enabled(defaults=None):\n"
        "    return load_mcp_server_configs()\n"
        "async def knowledge_base_search(barrel_id, query):\n"
        "    return await search_service.run(barrel_id, query)\n"
    )
    assert ingest_quality_profile_for_driver("code_python") == "source_code"
    assert ingest_quality_profile_for_driver("code_typescript") == "source_code"
    assert ingest_quality_profile_for_driver("pdf") == "document"
    report = assert_chunks_ingest_quality([codeish] * 12, profile="source_code")
    assert report.total == 12
    with pytest.raises(ValueError, match="midword_break|ocr_breaks|readable_ratio|spaced_letter"):
        assert_chunks_ingest_quality([codeish] * 12, profile="document")


def test_clean_pdf_dehyphenates_before_noise_filter() -> None:
    raw = "Брен-\nдинг как система обещаний качества.\n" + GARBAGE_3
    cleaned = clean_pdf_extracted_text(raw)
    assert "Брендинг" in cleaned
    assert "\u00ad" not in cleaned


def test_filter_readable_chunks_preserves_order_and_limit() -> None:
    raw = [
        GOOD_BRANDING,
        GARBAGE_3,
        GARBAGE_4,
        "Второй нормальный фрагмент про консалтинг и брендинг в России с достаточной длиной для RAG chunk filter.",
    ]
    out = filter_readable_chunks(raw, limit=2)
    assert len(out) == 2
    assert "Брэнд" in out[0]
    assert "консалтинг" in out[1]


def test_suppress_near_duplicate_chunks_collapses_near_identical() -> None:
    base = (
        "Бренд — это обещание качества и набор ассоциаций вокруг товара на рынке. "
        "Компания строит узнаваемость через последовательную коммуникацию."
    )
    near = (
        "Бренд — это обещание качества и набор ассоциаций вокруг товара на рынке. "
        "Компания строит узнаваемость через последовательную коммуникацию и рекламу."
    )
    other = (
        "Позиционирование описывает место продукта среди конкурентов и целевую аудиторию. "
        "Это отдельный управленческий контур от визуальной айдентики."
    )
    out = suppress_near_duplicate_chunks([base, near, other])
    assert len(out) == 2
    assert out[0] == normalize_readable_text(base)
    assert "Позиционирование" in out[1]


def test_finalize_search_chunks_dedupes_then_limits(caplog) -> None:
    import logging

    base = (
        "Бренд — это обещание качества и набор ассоциаций вокруг товара на рынке. "
        "Компания строит узнаваемость через последовательную коммуникацию."
    )
    near = base + " Дополнение почти то же."
    other = (
        "Позиционирование описывает место продукта среди конкурентов и целевую аудиторию. "
        "Это отдельный управленческий контур от визуальной айдентики."
    )
    third = (
        "Нейминг задаёт звучание марки и юридическую охраноспособность названия. "
        "Выбор имени влияет на восприятие и запоминаемость бренда."
    )
    with caplog.at_level(logging.DEBUG, logger="api.services.text_quality"):
        out = finalize_search_chunks([base, near, other, third], limit=2)
    assert len(out) == 2
    assert "Бренд" in out[0]
    assert "Позиционирование" in out[1]
    assert any("kbsew_search_dedupe_drop" in rec.message for rec in caplog.records)
