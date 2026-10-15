# ---
# KBSEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit tests for code chunking and code_* ingestion drivers.
# Related:
# - api/drivers/code_chunking.py
# - api/drivers/code_python.py
# - api/drivers/code_typescript.py
# ---

from __future__ import annotations

import pytest
from api.drivers.code_chunking import chunk_source_lines
from api.drivers.code_python import CodePythonIngestionDriver
from api.drivers.code_typescript import CodeTypescriptIngestionDriver
from api.drivers.registry import list_driver_types


def test_registry_includes_code_drivers() -> None:
    types = set(list_driver_types())
    assert "code_python" in types
    assert "code_typescript" in types
    assert "markdown" in types


def test_chunk_source_lines_python_symbol() -> None:
    src = "\n".join(
        [
            "import os",
            "",
            "def hello_world(name: str) -> str:",
            "    return f'hi {name}'",
            "",
            "class Foo:",
            "    pass",
        ]
    )
    parts = chunk_source_lines(src, path="api/demo.py", lang="python", max_lines=40, overlap_lines=2)
    assert parts
    assert "file: api/demo.py" in parts[0].text
    assert parts[0].symbol in {"hello_world", "Foo", None} or parts[0].symbol == "hello_world"


@pytest.mark.asyncio
async def test_code_python_process_bytes() -> None:
    driver = CodePythonIngestionDriver()
    body = (
        "def alpha():\n    return 1\n\n"
        + ("# comment line with enough letters for embedding context\n" * 30)
        + "def beta():\n    return 2\n"
    ).encode()
    assert await driver.validate_bytes(body, "mod.py") is True
    chunks = await driver.process_and_chunk_bytes(
        body,
        "shared/api/mod.py",
        source_url="kbsew-upload://b/hash/mod.py",
    )
    assert len(chunks) >= 1
    assert chunks[0].metadata["lang"] == "python"
    assert chunks[0].metadata["path"] == "shared/api/mod.py"
    assert "start_line" in chunks[0].metadata


@pytest.mark.asyncio
async def test_code_typescript_process_bytes() -> None:
    driver = CodeTypescriptIngestionDriver()
    body = (
        "export function greet(name: string): string {\n  return name;\n}\n\n"
        + ("// note " * 40 + "\n") * 10
        + "export class Panel {}\n"
    ).encode()
    assert await driver.validate_bytes(body, "Panel.tsx") is True
    chunks = await driver.process_and_chunk_bytes(
        body,
        "src/Panel.tsx",
        source_url="kbsew-upload://b/hash/Panel.tsx",
    )
    assert len(chunks) >= 1
    assert chunks[0].metadata["lang"] == "typescript"
