"""Имя файла для Content-Disposition: подпись из `name` + расширение из `original_filename`."""

from __future__ import annotations

import re
from pathlib import Path

_WIN_INVALID = re.compile(r'[<>:"/\\|?*\x00-\x1f]')


def display_name_for_content_download(title: str | None, name: str | None) -> str | None:
    """
    Подпись файла для пользователя: явный `title` (версии/восстановление), иначе `name`.
    Doc Editor хранит заголовок документа в `name`; отдельная колонка `title` может быть заполнена иначе.
    """
    t = (title or "").strip()
    if t:
        return t
    n = (name or "").strip()
    return n or None


def _sanitize_leaf(name: str) -> str:
    t = (name or "").strip()
    if not t:
        return ""
    leaf = Path(t).name
    leaf = _WIN_INVALID.sub(" ", leaf)
    return re.sub(r"\s+", " ", leaf).strip()


def build_content_disposition_filename(
    name: str | None,
    original_filename: str | None,
    *,
    max_len: int = 240,
) -> str:
    """
    Совпадает по смыслу с `resolvedContentDownloadFileName` на фронте:
    в списке показывают `name`, в хранилище slug в `original_filename`.
    """
    display = _sanitize_leaf(name or "")
    orig_raw = (original_filename or "").strip()
    if not display and not orig_raw:
        return "download"
    if not display:
        out = _sanitize_leaf(orig_raw) or "download"
        return out[:max_len]
    if not orig_raw:
        return display[:max_len]
    ext = Path(orig_raw).suffix
    if not ext:
        return display[:max_len]
    if display.lower().endswith(ext.lower()):
        return display[:max_len]
    base = Path(display).name
    if "." in base:
        return display[:max_len]
    return f"{display}{ext}"[:max_len]
