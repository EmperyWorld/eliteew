# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---

from __future__ import annotations

import pytest

from api.services.stack4.paperless_gateway import (
    PaperlessGateway,
    PaperlessNotConfigured,
    _parse_summary,
)


def test_parse_summary_minimal() -> None:
    summary = _parse_summary(
        {
            "id": 7,
            "title": "Invoice",
            "created": "2026-06-19T00:00:00Z",
            "modified": "2026-06-19T01:00:00Z",
            "file_type": "pdf",
            "tags": [1, 2],
        }
    )
    assert summary.id == 7
    assert summary.title == "Invoice"
    assert summary.file_type == "pdf"
    assert summary.tags == [1, 2]


@pytest.mark.asyncio
async def test_download_requires_token(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PAPERLESS_URL", "http://stack4-paperless:8000")
    monkeypatch.delenv("PAPERLESS_API_TOKEN", raising=False)
    gateway = PaperlessGateway(base_url="http://stack4-paperless:8000", api_token="")
    with pytest.raises(PaperlessNotConfigured):
        await gateway.get_document(1)
