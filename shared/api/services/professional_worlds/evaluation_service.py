# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Admin AI evaluation persistence: datasets (JSON cases), synthetic/run rows, playbook vs action probes via UGS.
# Invariants:
# - SQL matches `professional_ai_eval_*` tables; richer API fields serialize inside cases/scores JSONB envelopes.
# - Live runs require `admin_user_id` (UGS billed as admin); simulate skips UGS and records stub payloads.
# - Sample `rubric_details` exposed as dict (`steps`: list when playbook traced); legacy list blobs normalize on read.
# Related:
# - api/routers/professional_worlds_admin.py
# - api/services/professional_worlds/playbook_service.py (`_ugs_stream_to_text`, `eval_run_playbook_steps`)
# ---

from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import text  # type: ignore[import-not-found]
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.services.professional_worlds.ai_actions import ProfessionalWorldsAiActionService
from api.services.professional_worlds.playbook_service import (
    ProfessionalWorldsPlaybookService,
    _ugs_stream_to_text,
)
from api.services.professional_worlds.service import ProfessionalWorldsService
from api.services.ugs.unified_generation_service import UnifiedGenerationService

_JSON_AGG_KEY = "__pw_aggregate__"
_JSON_SAMPLES_KEY = "__pw_samples__"
_JSON_NOTE_KEY = "__pw_human_review_notes__"
_JSON_ADMIN_KEY = "__pw_admin_user_id__"
_JSON_STARTED_KEY = "__pw_started_at__"
_JSON_COMPLETED_KEY = "__pw_completed_at__"
_JSON_ERROR_KEY = "__pw_error__"
_JSON_VERTICAL_KEY = "__pw_vertical_slug__"
_JSON_DATASET_NAME_KEY = "__pw_dataset_name__"


def _json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, default=str)


def _utc_naive_now() -> datetime:
    """Match Naive UTC used across Professional Worlds timestamps."""
    return datetime.now(tz=UTC).replace(tzinfo=None)


def _rubric_envelope(meta: Any) -> dict[str, Any]:
    """Schemas expect rubric_details as dict; playbook returns a list of step dicts."""
    if isinstance(meta, dict):
        return meta
    if isinstance(meta, list):
        return {"steps": meta}
    return {}


def _encode_cases_payload(cases: list[dict[str, Any]], *, description: str | None, is_active: bool) -> str:
    if description is None and is_active:
        return _json(cases)
    return _json({"_pw_cases": cases, "_pw_description": description, "_pw_is_active": bool(is_active)})


def _decode_cases_payload(blob: Any) -> tuple[list[dict[str, Any]], str | None, bool]:
    if isinstance(blob, list):
        return [dict(row) if isinstance(row, dict) else {} for row in blob], None, True
    if isinstance(blob, dict):
        raw_cases = blob.get("_pw_cases")
        if isinstance(raw_cases, list):
            desc_raw = blob.get("_pw_description")
            description = str(desc_raw) if desc_raw is not None else None
            ia = blob.get("_pw_is_active")
            return (
                [dict(row) if isinstance(row, dict) else {} for row in raw_cases],
                description,
                bool(ia) if ia is not None else True,
            )
        return (
            [],  # legacy empty object
            str(blob["description"]) if blob.get("description") is not None else None,
            bool(blob.get("is_active", True)),
        )
    return [], None, True


class ProfessionalWorldsEvaluationService:
    """CRUD-lite + blocking eval runner for PW admin dashboards."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list_datasets(self, vertical_slug: str | None = None) -> list[dict[str, Any]]:
        filt = ""
        params: dict[str, Any] = {}
        if vertical_slug:
            filt = "WHERE vertical_slug = :vs "
            params["vs"] = vertical_slug
        res = await self.db.execute(
            text(
                f"""
                SELECT id, vertical_slug, name, cases,
                       created_at, updated_at
                FROM professional_ai_eval_datasets
                {filt}
                ORDER BY updated_at DESC NULLS LAST, created_at DESC
                LIMIT 300
                """
            ),
            params,
        )
        rows: list[dict[str, Any]] = []
        for mapping in res.mappings().all():
            row_dict = dict(mapping)
            blob = row_dict.get("cases")
            cases_payload, description, active = _decode_cases_payload(blob)
            row_dict.pop("cases", None)
            rows.append(
                {
                    **row_dict,
                    "cases": cases_payload,
                    "description": description,
                    "is_active": active,
                }
            )
        return rows

    async def create_dataset(
        self,
        *,
        vertical_slug: str,
        name: str,
        description: str | None,
        cases: list[dict[str, Any]],
        is_active: bool,
    ) -> dict[str, Any]:
        cases_blob = _encode_cases_payload(list(cases or []), description=description, is_active=is_active)
        res = await self.db.execute(
            text(
                """
                INSERT INTO professional_ai_eval_datasets (vertical_slug, name, cases)
                VALUES (:vertical_slug, :name, CAST(:cases AS jsonb))
                RETURNING id, vertical_slug, name, cases, created_at, updated_at
                """
            ),
            {"vertical_slug": vertical_slug, "name": name, "cases": cases_blob},
        )
        row = dict(res.mappings().one())
        cs, desc_dec, ia = _decode_cases_payload(row.pop("cases"))
        row["cases"] = cs
        row["description"] = desc_dec if desc_dec is not None else description
        row["is_active"] = ia
        await self.db.commit()
        return row

    async def update_dataset(
        self,
        dataset_id: UUID,
        *,
        name: str | None,
        description: str | None,
        cases: list[dict[str, Any]] | None,
        is_active: bool | None,
    ) -> dict[str, Any] | None:
        cur_res = await self.db.execute(
            text(
                """
                SELECT vertical_slug, name, cases
                FROM professional_ai_eval_datasets
                WHERE id = :dataset_id
                """
            ),
            {"dataset_id": dataset_id},
        )
        current = cur_res.mappings().one_or_none()
        if current is None:
            await self.db.rollback()
            return None

        decoded_cases, desc_existing, ia_existing = _decode_cases_payload(dict(current)["cases"])

        merged_desc = description if description is not None else desc_existing
        merged_ia = bool(is_active) if is_active is not None else ia_existing

        merged_cases = list(cases if cases is not None else decoded_cases)
        merged_name = name if name is not None else str(dict(current)["name"])

        blob = _encode_cases_payload(
            merged_cases,
            description=merged_desc if merged_desc else None,
            is_active=merged_ia,
        )
        upd = await self.db.execute(
            text(
                """
                UPDATE professional_ai_eval_datasets
                SET name = :name,
                    cases = CAST(:cases AS jsonb),
                    updated_at = now()
                WHERE id = :dataset_id
                RETURNING id, vertical_slug, name, cases, created_at, updated_at
                """
            ),
            {"name": merged_name, "cases": blob, "dataset_id": dataset_id},
        )
        row = dict(upd.mappings().one())
        cs, dd, aa = _decode_cases_payload(row.pop("cases"))
        row["cases"] = cs
        row["description"] = dd if dd is not None else merged_desc
        row["is_active"] = aa
        await self.db.commit()
        return row

    async def delete_dataset(self, dataset_id: UUID) -> bool:
        res = await self.db.execute(
            text("DELETE FROM professional_ai_eval_datasets WHERE id = :dataset_id RETURNING id"),
            {"dataset_id": dataset_id},
        )
        deleted = res.scalar_one_or_none() is not None
        await self.db.commit()
        return deleted

    async def list_runs(self, vertical_slug: str | None, *, limit: int) -> list[dict[str, Any]]:
        params: dict[str, Any] = {"limit": limit}
        where = ""
        if vertical_slug:
            where = "WHERE d.vertical_slug = :vertical_slug"
            params["vertical_slug"] = vertical_slug
        stmt = text(
            f"""
            SELECT r.id,
                   r.dataset_id,
                   d.vertical_slug AS vertical_slug,
                   d.name AS dataset_name,
                   r.target_type,
                   r.target_key,
                   r.status,
                   r.scores,
                   r.notes,
                   r.created_at,
                   r.updated_at
            FROM professional_ai_eval_runs r
            JOIN professional_ai_eval_datasets d ON d.id = r.dataset_id
            {where}
            ORDER BY r.updated_at DESC
            LIMIT :limit
            """
        )
        res = await self.db.execute(stmt, params)

        assembled: list[dict[str, Any]] = []
        for row in res.mappings().all():
            payload = dict(row)
            agg, meta = self._split_scores(dict(payload.pop("scores") or {}))
            payload["scores"] = agg
            payload["human_review_notes"] = meta.get(_JSON_NOTE_KEY)
            aid = meta.get(_JSON_ADMIN_KEY)
            payload["admin_user_id"] = UUID(str(aid)) if aid else None
            payload["error"] = meta.get(_JSON_ERROR_KEY)
            payload["started_at"] = meta.get(_JSON_STARTED_KEY)
            payload["completed_at"] = meta.get(_JSON_COMPLETED_KEY)
            assembled.append(payload)
        return assembled

    @staticmethod
    def _merge_scores(existing: dict[str, Any], **meta: Any) -> dict[str, Any]:
        """Merge shadow metadata alongside aggregate KPIs."""
        out = dict(existing)
        for slot_key, payload in meta.items():
            if payload is None:
                continue
            out[slot_key] = payload
        return out

    @staticmethod
    def _split_scores(blob: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
        agg = blob.get(_JSON_AGG_KEY)
        aggregate = agg if isinstance(agg, dict) else {}
        meta = {
            _JSON_SAMPLES_KEY: blob.get(_JSON_SAMPLES_KEY) or [],
            _JSON_NOTE_KEY: blob.get(_JSON_NOTE_KEY),
            _JSON_ADMIN_KEY: blob.get(_JSON_ADMIN_KEY),
            _JSON_STARTED_KEY: blob.get(_JSON_STARTED_KEY),
            _JSON_COMPLETED_KEY: blob.get(_JSON_COMPLETED_KEY),
            _JSON_ERROR_KEY: blob.get(_JSON_ERROR_KEY),
            _JSON_VERTICAL_KEY: blob.get(_JSON_VERTICAL_KEY),
            _JSON_DATASET_NAME_KEY: blob.get(_JSON_DATASET_NAME_KEY),
        }
        return aggregate, meta

    async def get_run(self, run_id: UUID) -> dict[str, Any] | None:
        res = await self.db.execute(
            text(
                """
                SELECT r.id,
                       r.dataset_id,
                       d.vertical_slug AS vertical_slug,
                       d.name AS dataset_name,
                       r.target_type,
                       r.target_key,
                       r.status,
                       r.scores,
                       r.notes,
                       r.created_at,
                       r.updated_at
                FROM professional_ai_eval_runs r
                JOIN professional_ai_eval_datasets d ON d.id = r.dataset_id
                WHERE r.id = :run_id
                """
            ),
            {"run_id": run_id},
        )
        row = res.mappings().one_or_none()
        if row is None:
            return None

        snapshot = dict(row)
        agg, meta = self._split_scores(dict(snapshot.pop("scores") or {}))

        snapshot["scores"] = agg
        snapshot["human_review_notes"] = meta[_JSON_NOTE_KEY]
        snapshot["admin_user_id"] = UUID(str(meta[_JSON_ADMIN_KEY])) if meta.get(_JSON_ADMIN_KEY) else None
        snapshot["error"] = meta.get(_JSON_ERROR_KEY)
        snapshot["started_at"] = meta.get(_JSON_STARTED_KEY)
        snapshot["completed_at"] = meta.get(_JSON_COMPLETED_KEY)

        samples_out: list[dict[str, Any]] = []
        raw_samples = meta.get(_JSON_SAMPLES_KEY) or []
        if isinstance(raw_samples, list):
            for bucket in raw_samples:
                if not isinstance(bucket, dict):
                    continue
                copied = dict(bucket)
                hid = copied.get("id") or uuid4()
                copied["id"] = UUID(str(hid))
                copied["run_id"] = snapshot["id"]
                hrb = copied.get("human_reviewed_by")
                copied["human_reviewed_by"] = UUID(str(hrb)) if hrb else None
                copied["rubric_details"] = _rubric_envelope(copied.get("rubric_details"))
                if isinstance(copied.get("created_at"), str):
                    pass  # pydantic coercion may handle ISO strings from JSON
                elif copied.get("created_at") is None:
                    copied["created_at"] = snapshot["created_at"]
                samples_out.append(copied)

        snapshot["samples"] = samples_out
        return snapshot

    async def patch_run_human_notes(self, run_id: UUID, notes: str | None) -> dict[str, Any] | None:
        current = await self._load_scores(run_id)
        if current is None:
            return None
        agg, shadow = self._split_scores(dict(current))
        shadow[_JSON_NOTE_KEY] = notes
        merged_scores = {_JSON_AGG_KEY: agg, **{k: v for k, v in shadow.items() if v is not None}}
        return await self._persist_scores(run_id, merged_scores)

    async def patch_sample_human_notes(
        self,
        sample_id: UUID,
        *,
        notes: str | None,
        admin_user_id: UUID | None,
    ) -> dict[str, Any] | None:
        run_row = await self.db.execute(
            text(
                """
                SELECT id, scores FROM professional_ai_eval_runs
                WHERE CAST(scores AS text) LIKE :needle
                """
            ),
            {"needle": f"%{str(sample_id)}%"},
        )
        hit = None
        for cand in run_row.mappings().all():
            blob = dict(cand.get("scores") or {})
            samples = blob.get(_JSON_SAMPLES_KEY)
            if not isinstance(samples, list):
                continue
            found = False
            for samp in samples:
                if isinstance(samp, dict) and str(samp.get("id")) == str(sample_id):
                    samp["human_review_notes"] = notes
                    samp["human_reviewed_by"] = str(admin_user_id) if admin_user_id else None
                    samp["human_reviewed_at"] = _utc_naive_now().isoformat()
                    found = True
                    break
            if found:
                hit = (cand["id"], blob)
                break
        if hit is None:
            return None

        rid, blob_scores = hit
        await self._persist_scores(UUID(str(rid)), blob_scores)

        rebuilt = await self.get_run(UUID(str(rid)))
        assert rebuilt is not None
        for sample in rebuilt.get("samples", []):
            if str(sample["id"]) == str(sample_id):
                return dict(sample)
        return None

    async def _load_scores(self, run_id: UUID) -> dict[str, Any] | None:
        res = await self.db.execute(
            text("SELECT scores FROM professional_ai_eval_runs WHERE id=:rid"),
            {"rid": run_id},
        )
        row = res.mappings().one_or_none()
        if row is None:
            return None
        return dict(row["scores"]) if isinstance(row["scores"], dict) else {}

    async def _persist_scores(self, run_id: UUID, scores: dict[str, Any]) -> dict[str, Any] | None:
        payload = dict(scores or {})
        res = await self.db.execute(
            text(
                """
                UPDATE professional_ai_eval_runs
                SET scores = CAST(:scores AS jsonb),
                    updated_at = now()
                WHERE id = :rid
                RETURNING id
                """
            ),
            {"scores": _json(payload), "rid": run_id},
        )
        if res.scalar_one_or_none() is None:
            await self.db.commit()
            return None
        await self.db.commit()
        rebuilt = await self.get_run(run_id)
        assert rebuilt is not None
        return rebuilt

    async def execute_run(
        self,
        *,
        worlds: ProfessionalWorldsService,
        playbook_svc: ProfessionalWorldsPlaybookService,
        ugs_service: UnifiedGenerationService | None,
        admin_user_id: UUID | None,
        dataset_id: UUID,
        target_type: str,
        target_key: str,
        simulate: bool,
        notes: str | None,
        idempotency_prefix: str | None,
    ) -> dict[str, Any]:
        dataset_row = await self.db.execute(
            text(
                """
                SELECT vertical_slug, name, cases
                FROM professional_ai_eval_datasets
                WHERE id = :dataset_id
                """
            ),
            {"dataset_id": dataset_id},
        )
        ds = dataset_row.mappings().one_or_none()
        if ds is None:
            raise ValueError("dataset_not_found")
        ds_dict = dict(ds)
        vertical_slug = str(ds_dict["vertical_slug"])
        dataset_name = str(ds_dict["name"])
        cases_blob = ds_dict.get("cases")
        cases_payload, _, _active = _decode_cases_payload(cases_blob)

        if not cases_payload:
            raise ValueError("dataset_has_no_cases")

        if admin_user_id is None and simulate is False:
            raise ValueError("admin_required")

        inserted = await self.db.execute(
            text(
                """
                INSERT INTO professional_ai_eval_runs (
                    dataset_id, target_type, target_key, status, scores, notes
                )
                VALUES (
                    :dataset_id,
                    :target_type,
                    :target_key,
                    :status,
                    CAST(:scores AS jsonb),
                    :notes
                )
                RETURNING id, dataset_id, target_type, target_key, status, scores, notes, created_at, updated_at
                """
            ),
            {
                "dataset_id": dataset_id,
                "target_type": target_type,
                "target_key": target_key,
                "status": "running",
                "scores": _json(
                    {
                        _JSON_AGG_KEY: {},
                        _JSON_SAMPLES_KEY: [],
                        _JSON_VERTICAL_KEY: vertical_slug,
                        _JSON_DATASET_NAME_KEY: dataset_name,
                        _JSON_ADMIN_KEY: str(admin_user_id) if admin_user_id else None,
                        _JSON_STARTED_KEY: _utc_naive_now().isoformat(),
                        _JSON_NOTE_KEY: None,
                    }
                ),
                "notes": notes,
            },
        )
        run_row = inserted.mappings().one()
        await self.db.commit()
        run_uuid = UUID(str(run_row["id"]))

        error_text: str | None = None
        samples_accum: list[dict[str, Any]] = []

        executor_user = admin_user_id or uuid4()  # simulate-only token path

        try:
            for idx, case in enumerate(cases_payload):
                variables = case if isinstance(case, dict) else {}
                prompt_preview = None
                if target_type == "playbook":
                    outline: dict[str, Any] | list[dict[str, Any]]
                    if simulate:
                        combined = f"[simulated playbook output]\ncase #{idx}"
                        outline = [{"step": 1, "simulated": True, "stub": combined[:400]}]
                    else:
                        assert ugs_service is not None
                        combined, step_details = await playbook_svc.eval_run_playbook_steps(
                            user_id=executor_user,
                            vertical_slug=vertical_slug,
                            playbook_key=target_key,
                            variables=variables,
                            ugs_service=ugs_service,
                            idempotency_prefix=f"{idempotency_prefix or 'eval'}:{run_uuid}:{idx}",
                        )
                        outline = step_details
                        prompt_preview = json.dumps(step_details, ensure_ascii=False)[:2400]

                elif target_type == "ai_action":
                    ai_svc = ProfessionalWorldsAiActionService(worlds)
                    action_row, prompt = await ai_svc.build_prompt(
                        vertical_slug=vertical_slug,
                        action_key=target_key,
                        variables=variables,
                        fallback_prompt=str(variables),
                    )
                    prompt_preview = (prompt or "")[:4000]
                    if not action_row:
                        raise ValueError(f"missing_action:{target_key}")
                    ugs_key = str(action_row.get("ugs_type_key") or "")
                    if simulate:
                        combined = "[simulated ai_action output]"
                        outline = {"ugs_type_key": ugs_key}
                    else:
                        assert ugs_service is not None
                        combined, ugs_rid = await _ugs_stream_to_text(
                            user_id=executor_user,
                            ugs_service=ugs_service,
                            worlds=worlds,
                            type_key=ugs_key,
                            prompt=prompt,
                            idempotency_key=f"{idempotency_prefix or 'eval'}:{run_uuid}:{idx}",
                        )
                        outline = {"ugs_request_id": str(ugs_rid) if ugs_rid else None, "ugs_type_key": ugs_key}
                else:
                    raise ValueError("unsupported_target_type")

                sample_scores = {"chars": len(combined)}
                rubric_blob = _rubric_envelope(outline)
                bucket = {
                    "id": uuid4(),
                    "run_id": run_uuid,
                    "case_index": idx,
                    "label": variables.get("label") if isinstance(variables.get("label"), str) else None,
                    "input_redacted": {k: v for k, v in variables.items() if k != "instruction"},
                    "prompt_sample": prompt_preview,
                    "output_sample": {"text": combined, "meta": outline},
                    "scores": sample_scores,
                    "rubric_details": rubric_blob,
                    "human_review_notes": None,
                    "human_reviewed_by": None,
                    "human_reviewed_at": None,
                    "created_at": _utc_naive_now().isoformat(),
                }
                samples_accum.append(bucket)

            aggregate_scores = {
                "case_count": len(samples_accum),
                "avg_chars": sum(int(s["scores"]["chars"]) for s in samples_accum) / max(len(samples_accum), 1),
                "simulate": bool(simulate),
            }

            scores_payload = {
                _JSON_AGG_KEY: aggregate_scores,
                _JSON_SAMPLES_KEY: samples_accum,
                _JSON_NOTE_KEY: None,
                _JSON_ADMIN_KEY: str(admin_user_id) if admin_user_id else None,
                _JSON_VERTICAL_KEY: vertical_slug,
                _JSON_DATASET_NAME_KEY: dataset_name,
                _JSON_STARTED_KEY: samples_accum[0]["created_at"],
                _JSON_COMPLETED_KEY: _utc_naive_now().isoformat(),
                _JSON_ERROR_KEY: None,
            }
            await self.db.execute(
                text(
                    """
                    UPDATE professional_ai_eval_runs
                    SET scores = CAST(:scores AS jsonb),
                        status = :status,
                        updated_at = now()
                    WHERE id = :rid
                    """
                ),
                {"scores": _json(scores_payload), "status": "completed", "rid": run_uuid},
            )
            await self.db.commit()

        except (ValueError, RuntimeError, AssertionError, TypeError, KeyError) as exc:
            error_text = str(exc)
            await self.db.execute(
                text(
                    """
                    UPDATE professional_ai_eval_runs
                    SET status = :status,
                        scores = CAST(:scores AS jsonb),
                        updated_at = now()
                    WHERE id = :rid
                    """
                ),
                {
                    "status": "failed",
                    "scores": _json(
                        {
                            _JSON_AGG_KEY: {},
                            _JSON_SAMPLES_KEY: samples_accum,
                            _JSON_ERROR_KEY: error_text,
                            _JSON_VERTICAL_KEY: vertical_slug,
                            _JSON_DATASET_NAME_KEY: dataset_name,
                            _JSON_NOTE_KEY: None,
                            _JSON_ADMIN_KEY: str(admin_user_id) if admin_user_id else None,
                            _JSON_COMPLETED_KEY: _utc_naive_now().isoformat(),
                        }
                    ),
                    "rid": run_uuid,
                },
            )
            await self.db.commit()

        final = await self.get_run(run_uuid)
        assert final is not None
        if error_text:
            final["execution_error"] = error_text
        else:
            final["execution_error"] = None
        return final
