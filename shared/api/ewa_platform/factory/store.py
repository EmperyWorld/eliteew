# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Intention store: process memory + optional JSON file durability (Wave F5).
# Invariants:
# - Not ewa_agentic_* tables; parallel Gen/Forge store.
# - File path from ELITEEW_FACTORY_STORE_PATH when set.
# Related:
# - documentation/platform/ELITEEW-GENEW-FACTORY-HARVEST.md
# ---

from __future__ import annotations

import json
import logging
import os
import threading
from pathlib import Path

from api.ewa_platform.factory.models import IntentionRecord

logger = logging.getLogger(__name__)


class IntentionStore:
    def list(self) -> list[IntentionRecord]:
        raise NotImplementedError

    def get(self, intention_id: str) -> IntentionRecord | None:
        raise NotImplementedError

    def upsert(self, record: IntentionRecord) -> IntentionRecord:
        raise NotImplementedError


class MemoryIntentionStore(IntentionStore):
    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._rows: dict[str, IntentionRecord] = {}

    def list(self) -> list[IntentionRecord]:
        with self._lock:
            return sorted(self._rows.values(), key=lambda r: r.created_at, reverse=True)

    def get(self, intention_id: str) -> IntentionRecord | None:
        with self._lock:
            return self._rows.get(intention_id)

    def upsert(self, record: IntentionRecord) -> IntentionRecord:
        with self._lock:
            self._rows[record.id] = record
            return record

    def clear(self) -> None:
        with self._lock:
            self._rows.clear()


class FileIntentionStore(IntentionStore):
    """JSON file durability for API restart without EWA PG (F5 lite)."""

    def __init__(self, path: Path) -> None:
        self._path = path
        self._memory = MemoryIntentionStore()
        self._lock = threading.RLock()
        self._load()

    def _load(self) -> None:
        if not self._path.is_file():
            return
        try:
            raw = json.loads(self._path.read_text(encoding="utf-8"))
            rows = raw.get("intentions") if isinstance(raw, dict) else None
            if not isinstance(rows, list):
                return
            for item in rows:
                if isinstance(item, dict) and item.get("id"):
                    self._memory.upsert(IntentionRecord.from_dict(item))
        except Exception as exc:
            logger.warning("[STEP] factory_store_load_skip err=%s", exc)

    def _persist(self) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        payload = {"intentions": [r.to_dict() for r in self._memory.list()]}
        tmp = self._path.with_suffix(self._path.suffix + ".tmp")
        tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        tmp.replace(self._path)

    def list(self) -> list[IntentionRecord]:
        return self._memory.list()

    def get(self, intention_id: str) -> IntentionRecord | None:
        return self._memory.get(intention_id)

    def upsert(self, record: IntentionRecord) -> IntentionRecord:
        with self._lock:
            out = self._memory.upsert(record)
            try:
                self._persist()
            except Exception as exc:
                logger.warning("[STEP] factory_store_persist_skip err=%s", exc)
            return out

    def clear(self) -> None:
        with self._lock:
            self._memory.clear()
            try:
                if self._path.is_file():
                    self._path.unlink()
            except Exception as exc:
                logger.debug("[STEP] factory_store_clear_skip err=%s", exc)


def default_store_path() -> Path | None:
    raw = os.environ.get("ELITEEW_FACTORY_STORE_PATH", "").strip()
    if raw:
        return Path(raw)
    # Prefer monorepo runtime when present; else memory-only.
    for candidate in (
        Path.cwd().resolve(),
        *Path.cwd().resolve().parents,
    ):
        if (candidate / "EliteEW").is_dir() and (candidate / ".cursor").is_dir():
            return candidate / "EliteEW" / "runtime" / "factory" / "intentions.json"
    return None


def build_intention_store(*, force_memory: bool = False) -> IntentionStore:
    if force_memory:
        return MemoryIntentionStore()
    path = default_store_path()
    if path is None:
        return MemoryIntentionStore()
    return FileIntentionStore(path)
