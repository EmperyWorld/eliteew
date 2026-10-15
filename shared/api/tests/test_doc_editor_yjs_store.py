"""Behavioral tests for Doc Editor Yjs persistence store."""

import asyncio

from api.services.doc_editor_yjs_store import (
    DocEditorYjsStore,
    _memory_updates,
    is_yjs_update_message,
)


def test_is_yjs_update_message() -> None:
    assert is_yjs_update_message(bytes([2, 1, 2, 3])) is True
    assert is_yjs_update_message(bytes([0, 1])) is False
    assert is_yjs_update_message(b"") is False


async def _memory_fallback_append_and_load_async() -> None:
    store = DocEditorYjsStore()
    doc_id = "test-doc-yjs-memory"
    _memory_updates.pop(doc_id, None)

    payload = bytes([2, 9, 8, 7])
    await store.append_update(doc_id, payload)
    await store.append_update(doc_id, bytes([0, 1]))
    loaded = await store.load_updates(doc_id)

    assert loaded == [payload]

    await store.clear_document(doc_id)
    assert await store.load_updates(doc_id) == []


def test_memory_fallback_append_and_load() -> None:
    asyncio.run(_memory_fallback_append_and_load_async())
