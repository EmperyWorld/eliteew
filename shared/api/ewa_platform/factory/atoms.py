# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Factory memory atoms (Wave F6) — plan/verify decisions with intention provenance.
# Invariants:
# - Parallel to companion ewa_atom PG (no principal FK required for F6).
# - kind ∈ factory_decision|factory_verify|factory_context; intention_id required.
# Related:
# - documentation/platform/ELITEEW-GENEW-FACTORY-HARVEST.md §8.5
# ---

from __future__ import annotations

import json
import logging
import os
import threading
import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import StrEnum
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


class FactoryAtomKind(StrEnum):
    DECISION = "factory_decision"
    VERIFY = "factory_verify"
    CONTEXT = "factory_context"


def _utcnow() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


@dataclass
class FactoryAtom:
    id: str
    kind: FactoryAtomKind
    intention_id: str
    summary: str
    payload: dict[str, Any] = field(default_factory=dict)
    tags: list[str] = field(default_factory=list)
    created_at: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "kind": str(self.kind),
            "intention_id": self.intention_id,
            "summary": self.summary,
            "payload": dict(self.payload),
            "tags": list(self.tags),
            "created_at": self.created_at,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> FactoryAtom:
        return cls(
            id=str(data["id"]),
            kind=FactoryAtomKind(str(data.get("kind") or FactoryAtomKind.CONTEXT)),
            intention_id=str(data.get("intention_id") or ""),
            summary=str(data.get("summary") or ""),
            payload=dict(data.get("payload") or {}),
            tags=[str(t) for t in (data.get("tags") or [])],
            created_at=str(data.get("created_at") or ""),
        )


class FactoryAtomStore:
    def list_for_intention(self, intention_id: str) -> list[FactoryAtom]:
        raise NotImplementedError

    def append(self, atom: FactoryAtom) -> FactoryAtom:
        raise NotImplementedError

    def clear(self) -> None:
        raise NotImplementedError


class MemoryFactoryAtomStore(FactoryAtomStore):
    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._rows: list[FactoryAtom] = []

    def list_for_intention(self, intention_id: str) -> list[FactoryAtom]:
        iid = str(intention_id or "").strip()
        with self._lock:
            return [a for a in self._rows if a.intention_id == iid]

    def append(self, atom: FactoryAtom) -> FactoryAtom:
        with self._lock:
            self._rows.append(atom)
            return atom

    def clear(self) -> None:
        with self._lock:
            self._rows.clear()


class FileFactoryAtomStore(FactoryAtomStore):
    def __init__(self, path: Path) -> None:
        self._path = path
        self._memory = MemoryFactoryAtomStore()
        self._lock = threading.RLock()
        self._load()

    def _load(self) -> None:
        if not self._path.is_file():
            return
        try:
            raw = json.loads(self._path.read_text(encoding="utf-8"))
            rows = raw.get("atoms") if isinstance(raw, dict) else None
            if not isinstance(rows, list):
                return
            for item in rows:
                if isinstance(item, dict) and item.get("id"):
                    self._memory.append(FactoryAtom.from_dict(item))
        except Exception as exc:
            logger.warning("[STEP] factory_atom_store_load_skip err=%s", exc)

    def _persist(self) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        with self._memory._lock:
            payload = {"atoms": [a.to_dict() for a in self._memory._rows]}
        tmp = self._path.with_suffix(self._path.suffix + ".tmp")
        tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        tmp.replace(self._path)

    def list_for_intention(self, intention_id: str) -> list[FactoryAtom]:
        return self._memory.list_for_intention(intention_id)

    def append(self, atom: FactoryAtom) -> FactoryAtom:
        with self._lock:
            out = self._memory.append(atom)
            try:
                self._persist()
            except Exception as exc:
                logger.warning("[STEP] factory_atom_store_persist_skip err=%s", exc)
            return out

    def clear(self) -> None:
        with self._lock:
            self._memory.clear()
            try:
                if self._path.is_file():
                    self._path.unlink()
            except Exception as exc:
                logger.debug("[STEP] factory_atom_store_clear_skip err=%s", exc)


def default_atom_store_path() -> Path | None:
    raw = os.environ.get("ELITEEW_FACTORY_ATOMS_PATH", "").strip()
    if raw:
        return Path(raw)
    for candidate in (Path.cwd().resolve(), *Path.cwd().resolve().parents):
        if (candidate / "EliteEW").is_dir() and (candidate / ".cursor").is_dir():
            return candidate / "EliteEW" / "runtime" / "factory" / "atoms.json"
    return None


def build_atom_store(*, force_memory: bool = False) -> FactoryAtomStore:
    if force_memory:
        return MemoryFactoryAtomStore()
    path = default_atom_store_path()
    if path is None:
        return MemoryFactoryAtomStore()
    return FileFactoryAtomStore(path)


def record_factory_atom(
    store: FactoryAtomStore,
    *,
    kind: FactoryAtomKind,
    intention_id: str,
    summary: str,
    payload: dict[str, Any] | None = None,
    tags: list[str] | None = None,
) -> FactoryAtom:
    atom = FactoryAtom(
        id=str(uuid.uuid4()),
        kind=kind,
        intention_id=str(intention_id),
        summary=(summary or "")[:500],
        payload=dict(payload or {}),
        tags=list(tags or []),
        created_at=_utcnow(),
    )
    return store.append(atom)


_ATOM_STORE: FactoryAtomStore | None = None


def get_factory_atom_store() -> FactoryAtomStore:
    global _ATOM_STORE
    if _ATOM_STORE is None:
        _ATOM_STORE = build_atom_store()
    return _ATOM_STORE


def reset_factory_atom_store_for_tests(
    store: FactoryAtomStore | None = None,
) -> FactoryAtomStore:
    global _ATOM_STORE
    _ATOM_STORE = store or MemoryFactoryAtomStore()
    return _ATOM_STORE
