# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Single stack0 PDF engine (PyMuPDF/fitz): text, page count, merge, split, thumbnails, embedded images.
# Invariants:
# - Sync-only; callers in async paths must use run_blocking_work / asyncio.to_thread.
# Related:
# - api.services.document_processor; api.services.doc_converter_service
# ---
from __future__ import annotations

import logging
import re
from io import BytesIO
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

try:
    import fitz  # PyMuPDF  # type: ignore[import-not-found]
except ImportError:
    fitz = None  # type: ignore[assignment,misc]

PDF_ENGINE_AVAILABLE = fitz is not None

_DEFAULT_SECTION_PATTERN = re.compile(
    r"^(Chapter|Section|Part|Глава|Раздел|Часть)\s+\d+",
    re.MULTILINE | re.IGNORECASE,
)


def _require_fitz() -> Any:  # noqa: ANN401
    if fitz is None:
        msg = "PyMuPDF (fitz) is not installed"
        raise RuntimeError(msg)
    return fitz


def extract_text_from_bytes(file_data: bytes) -> str:
    """Extract plain text from an in-memory PDF."""
    fz = _require_fitz()
    with fz.open(stream=file_data, filetype="pdf") as doc:
        parts = [page.get_text() for page in doc]
    return "\n\n".join(part for part in parts if part)


def extract_text_from_path(file_path: str | Path) -> str:
    """Extract plain text from a PDF file path."""
    fz = _require_fitz()
    with fz.open(str(file_path)) as doc:
        parts = [page.get_text() for page in doc]
    return "\n\n".join(part for part in parts if part)


def page_count_from_bytes(file_data: bytes) -> int:
    fz = _require_fitz()
    with fz.open(stream=file_data, filetype="pdf") as doc:
        return doc.page_count


def page_count_from_path(file_path: str | Path) -> int:
    fz = _require_fitz()
    with fz.open(str(file_path)) as doc:
        return doc.page_count


def merge_pdf_paths(file_paths: list[str | Path], output_path: str | Path) -> str:
    """Merge PDF files on disk into output_path."""
    fz = _require_fitz()
    merged = fz.open()
    try:
        for path in file_paths:
            src = fz.open(str(path))
            merged.insert_pdf(src)
            src.close()
        merged.save(str(output_path))
    finally:
        merged.close()
    return str(output_path)


def merge_pdf_bytes(buffers: list[bytes]) -> bytes:
    """Merge in-memory PDF buffers into one PDF byte string."""
    fz = _require_fitz()
    merged = fz.open()
    try:
        for data in buffers:
            src = fz.open(stream=data, filetype="pdf")
            merged.insert_pdf(src)
            src.close()
        return merged.tobytes()
    finally:
        merged.close()


def split_page_to_bytes(file_data: bytes, page_index: int) -> bytes:
    """Extract a single page (0-based) into a new PDF buffer."""
    fz = _require_fitz()
    src = fz.open(stream=file_data, filetype="pdf")
    out = fz.open()
    try:
        if page_index < 0 or page_index >= src.page_count:
            msg = f"Page index out of range: {page_index}"
            raise ValueError(msg)
        out.insert_pdf(src, from_page=page_index, to_page=page_index)
        return out.tobytes()
    finally:
        out.close()
        src.close()


def split_by_pages_from_path(file_path: str | Path, pages_per_file: int) -> list[str]:
    """Split a PDF file into multiple files with up to pages_per_file pages each."""
    fz = _require_fitz()
    base = Path(file_path)
    outputs: list[str] = []
    with fz.open(str(file_path)) as src:
        total = src.page_count
        for part_index, start in enumerate(range(0, total, pages_per_file), start=1):
            end = min(start + pages_per_file - 1, total - 1)
            out = fz.open()
            out.insert_pdf(src, from_page=start, to_page=end)
            out_path = str(base.parent / f"{base.stem}_part{part_index}.pdf")
            out.save(out_path)
            out.close()
            outputs.append(out_path)
    return outputs


def split_by_sections_from_path(
    file_path: str | Path,
    section_pattern: re.Pattern[str] | None = None,
) -> list[str]:
    """Split PDF at detected section headers; returns original path when none found."""
    fz = _require_fitz()
    pattern = section_pattern or _DEFAULT_SECTION_PATTERN
    base = Path(file_path)

    with fz.open(str(file_path)) as src:
        section_pages: list[int] = []
        for page_num in range(src.page_count):
            text = src[page_num].get_text()
            if pattern.search(text):
                section_pages.append(page_num)

        if not section_pages:
            return [str(file_path)]

        outputs: list[str] = []
        for i, start_page in enumerate(section_pages):
            end_page = section_pages[i + 1] - 1 if i + 1 < len(section_pages) else src.page_count - 1
            out = fz.open()
            out.insert_pdf(src, from_page=start_page, to_page=end_page)
            out_path = str(base.parent / f"{base.stem}_section{i + 1}.pdf")
            out.save(out_path)
            out.close()
            outputs.append(out_path)
    return outputs


def render_page_thumbnail_jpeg(
    file_data: bytes,
    *,
    page_index: int = 0,
    zoom: float = 2.0,
    max_size: tuple[int, int] | None = None,
    quality: int = 85,
) -> bytes | None:
    """Render a PDF page to JPEG bytes; optional PIL resize when max_size is set."""
    fz = _require_fitz()
    with fz.open(stream=file_data, filetype="pdf") as doc:
        if doc.page_count == 0 or page_index >= doc.page_count:
            return None
        pix = doc[page_index].get_pixmap(matrix=fz.Matrix(zoom, zoom))
        jpeg_bytes = pix.tobytes("jpeg")

    if max_size is None:
        return jpeg_bytes

    from PIL import Image  # noqa: PLC0415 - optional resize after render

    image = Image.open(BytesIO(jpeg_bytes))
    image.thumbnail(max_size, Image.Resampling.LANCZOS)
    out = BytesIO()
    image.convert("RGB").save(out, format="JPEG", quality=quality)
    return out.getvalue()


def render_page_thumbnail_png_from_path(file_path: str | Path, *, page: int = 1, zoom: float = 1.5) -> bytes:
    """Render a page from disk PDF to PNG bytes (page is 1-based)."""
    fz = _require_fitz()
    with fz.open(str(file_path)) as doc:
        if doc.page_count == 0:
            return b""
        page_index = max(0, min(page - 1, doc.page_count - 1))
        pix = doc[page_index].get_pixmap(matrix=fz.Matrix(zoom, zoom))
        return pix.tobytes("png")


def extract_embedded_images_from_path(file_path: str | Path, output_dir: str | Path) -> list[str]:
    """Extract embedded images from a PDF into output_dir."""
    fz = _require_fitz()
    out_dir = Path(output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    extracted: list[str] = []

    with fz.open(str(file_path)) as pdf:
        for page_num in range(pdf.page_count):
            page = pdf[page_num]
            for img_index, img in enumerate(page.get_images()):
                xref = img[0]
                base_image = pdf.extract_image(xref)
                image_bytes = base_image["image"]
                ext = "jpg" if base_image["ext"] == "jpeg" else base_image["ext"]
                image_path = out_dir / f"page{page_num}_img{img_index}.{ext}"
                image_path.write_bytes(image_bytes)
                extracted.append(str(image_path))
    return extracted
