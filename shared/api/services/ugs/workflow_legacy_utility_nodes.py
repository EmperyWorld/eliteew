#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# pyright: reportAttributeAccessIssue=false
# Mixin/composed attrs resolved on facade class at runtime.
# Purpose:
# Legacy workflow utility nodes (constant/merge/delay/split/pick/wrap/json/text).
# Invariants:
# - Child of WorkflowService decomposition; must not import workflow_service.
# Related:
# - api/services/ugs/workflow_legacy_node_runtime.py
# ---

import asyncio
import contextlib
import json
import re
from typing import Any


class WorkflowLegacyUtilityNodesMixin:
    """Mixin for WorkflowService — utility node applicators."""

    def _coerce_literal_value(self, raw: Any, kind: str) -> Any:
        normalized_kind = (kind or "auto").strip().lower()
        if normalized_kind == "json":
            if isinstance(raw, (dict, list)):
                return raw
            if isinstance(raw, str):
                stripped = raw.strip()
                if not stripped:
                    return {}
                return json.loads(stripped)
            return raw
        if normalized_kind == "number":
            if raw in (None, ""):
                return 0
            if isinstance(raw, (int, float)):
                return raw
            return float(str(raw).strip())
        if normalized_kind == "boolean":
            if isinstance(raw, bool):
                return raw
            return str(raw).strip().lower() in {"1", "true", "yes", "on"}
        if normalized_kind == "string":
            return "" if raw is None else str(raw)

        if raw is None:
            return None
        if isinstance(raw, (dict, list, int, float, bool)):
            return raw
        if not isinstance(raw, str):
            return str(raw)
        stripped = raw.strip()
        if not stripped:
            return ""
        low = stripped.lower()
        if low in {"true", "false"}:
            return low == "true"
        if low in {"null", "none"}:
            return None
        try:
            if stripped[0] in "{[":
                return json.loads(stripped)
        except (json.JSONDecodeError, IndexError):  # fmt: skip
            pass
        try:
            if re.fullmatch(r"-?\d+", stripped):
                return int(stripped)
            if re.fullmatch(r"-?\d+\.\d+([eE][-+]?\d+)?", stripped):
                return float(stripped)
        except ValueError:
            pass
        return stripped

    def _build_constant_node_output(self, *, node: dict[str, Any]) -> dict[str, Any]:
        node_data = node.get("data")
        config = node_data.get("config") if isinstance(node_data, dict) else {}
        if not isinstance(config, dict):
            config = {}
        kind = str(config.get("literalKind") or config.get("literal_kind") or "auto").strip()
        raw: Any = config.get("literalValue")
        if raw is None:
            raw = config.get("literal_value")
        value = self._coerce_literal_value(raw, kind)
        return {
            "__result__": value,
            "value": value,
            "output": value,
        }

    def _apply_merge_node(
        self,
        *,
        node: dict[str, Any],
        edges: list[dict[str, Any]],
        nodes_by_id: dict[str, dict[str, Any]],
        node_outputs: dict[str, Any],
    ) -> dict[str, Any]:
        node_id = str(node.get("id") or "").strip()
        incoming_edges = self._extract_incoming_edges(node_id=node_id, edges=edges)
        merged: dict[str, Any] = {}
        for edge in incoming_edges:
            context = self._resolve_source_context_for_edge(
                edge=edge, nodes_by_id=nodes_by_id, node_outputs=node_outputs
            )
            if context is None:
                continue
            handle = str(edge.get("targetHandle") or "").strip() or "a"
            if handle == "input" and not merged:
                handle = "a"
            payload: Any = context.get("__result__", context) if isinstance(context, dict) else context
            merged[handle] = payload

        return {
            "__result__": merged,
            "merged": merged,
            "value": merged,
        }

    async def _apply_delay_node(
        self,
        *,
        node: dict[str, Any],
        edges: list[dict[str, Any]],
        nodes_by_id: dict[str, dict[str, Any]],
        node_outputs: dict[str, Any],
    ) -> dict[str, Any]:
        node_data = node.get("data")
        config = node_data.get("config") if isinstance(node_data, dict) else {}
        if not isinstance(config, dict):
            config = {}
        try:
            delay_ms = int(config.get("delayMs") or config.get("delay_ms") or 0)
        except (TypeError, ValueError):  # fmt: skip
            delay_ms = 0
        delay_ms = max(0, min(delay_ms, 30_000))

        synthetic = dict(node)
        syn_data = dict(node_data) if isinstance(node_data, dict) else {}
        syn_cfg = dict(config)
        syn_cfg["transformType"] = "passthrough"
        syn_cfg.setdefault("sourceKey", "value")
        syn_cfg.setdefault("outputKey", "output")
        syn_data["config"] = syn_cfg
        synthetic["data"] = syn_data

        out = self._apply_transform_node(
            node=synthetic,
            edges=edges,
            nodes_by_id=nodes_by_id,
            node_outputs=node_outputs,
        )
        if delay_ms > 0:
            await asyncio.sleep(delay_ms / 1000.0)
        return out

    def _get_value_at_path(self, root: Any, path: str | None) -> Any:
        if root is None:
            return None
        if path is None or not str(path).strip():
            return root
        segments = [segment.strip() for segment in str(path).split(".") if segment.strip()]
        if not segments:
            return root
        current: Any = root
        for segment in segments:
            if current is None:
                return None
            if isinstance(current, dict):
                current = current.get(segment)
            elif isinstance(current, list):
                try:
                    idx = int(segment, 10)
                except (TypeError, ValueError):  # fmt: skip
                    return None
                current = current[idx] if 0 <= idx < len(current) else None
            else:
                return None
        return current

    def _apply_split_node(
        self,
        *,
        node: dict[str, Any],
        edges: list[dict[str, Any]],
        nodes_by_id: dict[str, dict[str, Any]],
        node_outputs: dict[str, Any],
    ) -> dict[str, Any]:
        node_id = str(node.get("id") or "").strip()
        inner = self._first_upstream_payload(
            node_id=node_id,
            edges=edges,
            nodes_by_id=nodes_by_id,
            node_outputs=node_outputs,
        )
        return {
            "__result__": inner,
            "value": inner,
            "output": inner,
            "out1": inner,
            "out2": inner,
        }

    def _apply_pick_node(
        self,
        *,
        node: dict[str, Any],
        edges: list[dict[str, Any]],
        nodes_by_id: dict[str, dict[str, Any]],
        node_outputs: dict[str, Any],
    ) -> dict[str, Any]:
        node_id = str(node.get("id") or "").strip()
        node_data = node.get("data")
        config = node_data.get("config") if isinstance(node_data, dict) else {}
        if not isinstance(config, dict):
            config = {}
        incoming_edges = self._extract_incoming_edges(node_id=node_id, edges=edges)
        primary_context = None
        for edge in incoming_edges:
            context = self._resolve_source_context_for_edge(
                edge=edge, nodes_by_id=nodes_by_id, node_outputs=node_outputs
            )
            if context is not None:
                primary_context = context
                break
        source_key = str(config.get("sourceKey") or "value").strip() or "value"
        path_raw = config.get("path") or config.get("pickPath") or config.get("pick_path") or ""
        path = str(path_raw).strip() if path_raw is not None else ""
        base = self._extract_value_from_context(primary_context, source_key)
        picked = self._get_value_at_path(base, path) if path else base
        out_key = str(config.get("outputKey") or "output").strip() or "output"
        return {
            "__result__": picked,
            "value": picked,
            "output": picked,
            out_key: picked,
        }

    def _apply_wrap_node(
        self,
        *,
        node: dict[str, Any],
        edges: list[dict[str, Any]],
        nodes_by_id: dict[str, dict[str, Any]],
        node_outputs: dict[str, Any],
    ) -> dict[str, Any]:
        node_id = str(node.get("id") or "").strip()
        node_data = node.get("data")
        config = node_data.get("config") if isinstance(node_data, dict) else {}
        if not isinstance(config, dict):
            config = {}
        incoming_edges = self._extract_incoming_edges(node_id=node_id, edges=edges)
        primary_context = None
        for edge in incoming_edges:
            context = self._resolve_source_context_for_edge(
                edge=edge, nodes_by_id=nodes_by_id, node_outputs=node_outputs
            )
            if context is not None:
                primary_context = context
                break
        source_key = str(config.get("sourceKey") or "value").strip() or "value"
        wrap_key = str(config.get("wrapKey") or config.get("wrap_key") or "data").strip() or "data"
        inner = self._extract_value_from_context(primary_context, source_key)
        wrapped = {wrap_key: inner}
        out_key = str(config.get("outputKey") or "output").strip() or "output"
        result: dict[str, Any] = {
            "__result__": wrapped,
            "value": wrapped,
            "output": wrapped,
            out_key: wrapped,
        }
        result[wrap_key] = inner
        return result

    def _apply_json_encode_node(
        self,
        *,
        node: dict[str, Any],
        edges: list[dict[str, Any]],
        nodes_by_id: dict[str, dict[str, Any]],
        node_outputs: dict[str, Any],
    ) -> dict[str, Any]:
        node_id = str(node.get("id") or "").strip()
        node_data = node.get("data")
        config = node_data.get("config") if isinstance(node_data, dict) else {}
        if not isinstance(config, dict):
            config = {}
        inner = self._first_upstream_payload(
            node_id=node_id,
            edges=edges,
            nodes_by_id=nodes_by_id,
            node_outputs=node_outputs,
        )
        if inner is None:
            text = "null"
        elif bool(config.get("pretty") or config.get("prettyPrint")):
            indent = int(config.get("indent") or 2)
            text = json.dumps(inner, ensure_ascii=False, indent=indent, default=str)
        else:
            text = json.dumps(inner, ensure_ascii=False, separators=(",", ":"), default=str)
        out_key = str(config.get("outputKey") or "text").strip() or "text"
        return {
            "__result__": text,
            "value": text,
            "output": text,
            out_key: text,
            "text": text,
        }

    def _apply_json_decode_node(
        self,
        *,
        node: dict[str, Any],
        edges: list[dict[str, Any]],
        nodes_by_id: dict[str, dict[str, Any]],
        node_outputs: dict[str, Any],
    ) -> dict[str, Any]:
        node_id = str(node.get("id") or "").strip()
        node_data = node.get("data")
        config = node_data.get("config") if isinstance(node_data, dict) else {}
        if not isinstance(config, dict):
            config = {}
        inner = self._first_upstream_payload(
            node_id=node_id,
            edges=edges,
            nodes_by_id=nodes_by_id,
            node_outputs=node_outputs,
        )
        if isinstance(inner, (dict, list)):
            parsed: Any = inner
        else:
            s = str(inner).strip() if inner is not None else ""
            parsed = {} if not s else json.loads(s)
        out_key = str(config.get("outputKey") or "value").strip() or "value"
        return {
            "__result__": parsed,
            "value": parsed,
            "output": parsed,
            out_key: parsed,
        }

    def _apply_text_case_node(
        self,
        *,
        node: dict[str, Any],
        edges: list[dict[str, Any]],
        nodes_by_id: dict[str, dict[str, Any]],
        node_outputs: dict[str, Any],
    ) -> dict[str, Any]:
        node_id = str(node.get("id") or "").strip()
        node_data = node.get("data")
        config = node_data.get("config") if isinstance(node_data, dict) else {}
        if not isinstance(config, dict):
            config = {}
        inner = self._first_upstream_payload(
            node_id=node_id,
            edges=edges,
            nodes_by_id=nodes_by_id,
            node_outputs=node_outputs,
        )
        s = "" if inner is None else str(inner)
        mode = str(config.get("caseMode") or config.get("case_mode") or "trim").strip().lower()
        if mode == "upper":
            out = s.upper()
        elif mode == "lower":
            out = s.lower()
        elif mode == "title":
            out = s.title()
        elif mode == "trim_lines":
            out = "\n".join(line.strip() for line in s.splitlines()).strip()
        else:
            out = s.strip()
        out_key = str(config.get("outputKey") or "text").strip() or "text"
        return {
            "__result__": out,
            "value": out,
            "output": out,
            "text": out,
            out_key: out,
        }

    def _apply_text_join_node(
        self,
        *,
        node: dict[str, Any],
        edges: list[dict[str, Any]],
        nodes_by_id: dict[str, dict[str, Any]],
        node_outputs: dict[str, Any],
    ) -> dict[str, Any]:
        node_id = str(node.get("id") or "").strip()
        node_data = node.get("data")
        config = node_data.get("config") if isinstance(node_data, dict) else {}
        if not isinstance(config, dict):
            config = {}

        def piece_str(val: Any) -> str:
            if val is None:
                return ""
            if isinstance(val, (dict, list)):
                try:
                    return json.dumps(val, ensure_ascii=False, default=str)
                except TypeError:
                    return str(val)
            return str(val)

        slots: dict[str, Any] = {}
        for edge in self._extract_incoming_edges(node_id=node_id, edges=edges):
            ctx = self._resolve_source_context_for_edge(edge=edge, nodes_by_id=nodes_by_id, node_outputs=node_outputs)
            if ctx is None:
                continue
            handle = str(edge.get("targetHandle") or "").strip() or "a"
            if handle == "input" and not slots:
                handle = "a"
            payload = ctx.get("__result__", ctx) if isinstance(ctx, dict) else ctx
            slots[handle] = payload

        sep = str(config.get("separator") if config.get("separator") is not None else "")
        left = piece_str(slots.get("a"))
        right = piece_str(slots.get("b"))
        joined = f"{left}{sep}{right}"
        out_key = str(config.get("outputKey") or "text").strip() or "text"
        return {
            "__result__": joined,
            "value": joined,
            "output": joined,
            "text": joined,
            out_key: joined,
        }

    def _build_output_node_result(
        self,
        *,
        node_id: str,
        edges: list[dict[str, Any]],
        nodes_by_id: dict[str, dict[str, Any]],
        node_outputs: dict[str, Any],
    ) -> Any:
        incoming_edges = self._extract_incoming_edges(node_id=node_id, edges=edges)
        for edge in incoming_edges:
            context = self._resolve_source_context_for_edge(
                edge=edge, nodes_by_id=nodes_by_id, node_outputs=node_outputs
            )
            if context is not None:
                return context
        return None

    def _build_generation_node_payload(
        self,
        *,
        node: dict[str, Any],
        runtime_type: str,
        edges: list[dict[str, Any]],
        nodes_by_id: dict[str, dict[str, Any]],
        node_outputs: dict[str, dict[str, Any]],
        execution_input_data: dict[str, Any],
    ) -> dict[str, Any]:
        node_data = node.get("data")
        payload: dict[str, Any] = {}
        if isinstance(node_data, dict):
            config = node_data.get("config")
            if isinstance(config, dict):
                payload.update(config)
            inputs = node_data.get("inputs")
            if isinstance(inputs, list):
                for input_key in inputs:
                    if isinstance(input_key, str) and input_key in execution_input_data and input_key not in payload:
                        payload[input_key] = execution_input_data[input_key]

        node_id = str(node.get("id") or "")
        for edge in edges:
            if not isinstance(edge, dict):
                continue
            if str(edge.get("target") or "") != node_id:
                continue

            source_context = self._resolve_source_context_for_edge(
                edge=edge,
                nodes_by_id=nodes_by_id,
                node_outputs=node_outputs,
            )
            if source_context is None:
                continue

            edge_data = edge.get("data")
            parameter_mappings = (edge_data.get("parameter_mappings") if isinstance(edge_data, dict) else None) or (
                edge_data.get("mapping") if isinstance(edge_data, dict) else None
            )

            if isinstance(parameter_mappings, dict) and parameter_mappings:
                for target_field, source_field in parameter_mappings.items():
                    if not isinstance(target_field, str):
                        continue
                    source_key = str(source_field) if source_field is not None else None
                    extracted = self._extract_value_from_context(source_context, source_key)
                    if extracted is not None:
                        payload[target_field] = extracted
                continue

            target_field = str(edge.get("targetHandle") or edge.get("sourceHandle") or "input")
            source_field = str(edge.get("sourceHandle") or target_field)
            extracted = self._extract_value_from_context(source_context, source_field)
            if extracted is not None:
                payload[target_field] = extracted

        if runtime_type == "text_chat_response":
            if "messages" in payload and "prompt" not in payload:
                prompt_from_messages = self._flatten_messages_to_prompt(payload.get("messages"))
                if prompt_from_messages:
                    payload["prompt"] = prompt_from_messages
            prompt_value = payload.get("prompt") or payload.get("text")
            if not isinstance(prompt_value, str) or not prompt_value.strip():
                prompt_value = self._build_default_legacy_prompt(runtime_type)
                payload["prompt"] = prompt_value
            user_text = str(prompt_value).strip()
            system_sp = payload.get("system_prompt") or payload.get("system")
            if isinstance(system_sp, str) and system_sp.strip():
                sys_clean = system_sp.strip()
                target_lang = payload.get("target_language")
                if isinstance(target_lang, str) and target_lang.strip():
                    sys_clean = f"{sys_clean}\nЦелевой язык перевода: {target_lang.strip()}."
                payload["prompt"] = f"{sys_clean}\n\n---\n\n{user_text}"
            else:
                payload["prompt"] = user_text

            opts: dict[str, Any] = {}
            if isinstance(payload.get("options"), dict):
                opts.update(payload["options"])
            temp_raw = payload.get("temperature")
            if temp_raw is not None:
                with contextlib.suppress(TypeError, ValueError):
                    opts["temperature"] = float(temp_raw)
            if payload.get("max_tokens") is not None:
                with contextlib.suppress(TypeError, ValueError):
                    opts["num_predict"] = int(payload["max_tokens"])
                opts.setdefault("num_predict", 8192)
            opts.setdefault("num_predict", 8192)
            payload["options"] = opts

        if runtime_type == "image_generation_comfyui":
            prompt_value = payload.get("prompt") or payload.get("text")
            if not isinstance(prompt_value, str) or not prompt_value.strip():
                payload["prompt"] = self._build_default_legacy_prompt(runtime_type)
            payload.setdefault("width", 512)
            payload.setdefault("height", 512)
            payload.setdefault("steps", 20)

        if runtime_type == "audio_generation_tts":
            text_value = payload.get("text") or payload.get("prompt")
            if not isinstance(text_value, str) or not text_value.strip():
                payload["text"] = self._build_default_legacy_prompt(runtime_type)
            payload.setdefault("voice", "default")
            payload.setdefault("format", "mp3")

        if runtime_type == "audio_transcription_faster_whisper" and not any(
            payload.get(key) for key in ("audio_data", "audio_url", "file_content", "file_path")
        ):
            msg = (
                "Для узла speech_to_text нужен входной аудиофайл. "
                "Legacy Workflow Builder пока не умеет подставлять его автоматически."
            )
            raise ValueError(msg)

        return payload
