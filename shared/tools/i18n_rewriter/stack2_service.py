# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Batch-rewrite nested i18n JSON via stack2 llama-chat; neutral stdlib-only shared contract.
# Invariants:
# - Preserves {{interpolation}} when spec.preserve_placeholders is true.
# - No imports from EliteEW api.* or DEWA app.*; repo paths via I18N_REWRITE_REPO_ROOT.
# Related:
# - docker/scripts/i18n-rewrite-stack2.py
# - DEWA/backend/app/services/i18n_rewrite_plane.py
# - shared/api/services/i18n_rewrite_stack2_service.py (compat shim)
# ---

from __future__ import annotations

import json
import logging
import os
import re
import time
import urllib.error
import urllib.request
from copy import deepcopy
from dataclasses import dataclass
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

PLACEHOLDER_RE = re.compile(r"\{\{[^{}]+\}\}")
CYRILLIC_RE = re.compile(r"[\u0400-\u04FF]")

PRESET_SPECS: dict[str, str] = {
    "marketing-hall-ru": "docker/scripts/i18n-rewrite-specs/marketing-hall.example.json",
    "marketing-hall-en": "docker/scripts/i18n-rewrite-specs/marketing-hall-en.example.json",
    "marketing-cabinet-user-friendly-ru": "docker/scripts/i18n-rewrite-specs/marketing-cabinet-user-friendly.ru.json",
}

PRESET_TARGETS: dict[str, str] = {
    "marketing-ru": "shared/web/frontend/src/i18n/locales/ru/marketing.json",
    "marketing-en": "shared/web/frontend/src/i18n/locales/en/marketing.json",
    "blocks-ru": "shared/web/frontend/src/pages/MarketingCabinet/help/blocks.ru.json",
    "blocks-en": "shared/web/frontend/src/pages/MarketingCabinet/help/blocks.en.json",
}


def resolve_repo_root() -> Path | None:
    env = (os.environ.get("I18N_REWRITE_REPO_ROOT") or "").strip()
    if env:
        root = Path(env).resolve()
        if _repo_has_tooling(root):
            return root
    # shared/tools/i18n_rewriter/stack2_service.py → monorepo root
    candidate = Path(__file__).resolve().parents[2]
    if _repo_has_tooling(candidate):
        return candidate
    return None


def _repo_has_tooling(root: Path) -> bool:
    return (root / "docker/scripts/i18n-rewrite-specs").is_dir() and (
        root / "shared/web/frontend/src/i18n/locales/ru/marketing.json"
    ).is_file()


def resolve_preset_path(repo: Path, presets: dict[str, str], preset_id: str) -> Path:
    rel = presets.get(preset_id)
    if not rel:
        msg = f"Unknown preset id: {preset_id}"
        raise ValueError(msg)
    path = (repo / rel).resolve()
    if not path.is_file():
        msg = f"Preset file missing: {rel}"
        raise FileNotFoundError(msg)
    if repo not in path.parents and path != repo:
        msg = "Preset path escapes repo root"
        raise ValueError(msg)
    return path


def admin_meta() -> dict[str, Any]:
    repo = resolve_repo_root()
    enabled = repo is not None
    stack2 = probe_stack2_health()
    return {
        "enabled": enabled,
        "repo_root": str(repo) if repo else None,
        "allow_write": os.environ.get("I18N_REWRITE_ALLOW_WRITE", "").strip().lower() in {"1", "true", "yes", "on"},
        "specs": [{"id": k, "path": v} for k, v in PRESET_SPECS.items()],
        "targets": [{"id": k, "path": v} for k, v in PRESET_TARGETS.items()],
        "stack2": stack2,
        "doc_path": "documentation/platform/I18N-REWRITE-STACK2.md",
    }


def probe_stack2_health() -> dict[str, Any]:
    base_url = default_stack2_url().rstrip("/")
    try:
        http_json(f"{base_url}/health", timeout=8.0)
        model = resolve_model(base_url, None)
        return {"ok": True, "url": base_url, "model": model}
    except Exception as exc:  # noqa: BLE001 — operator surface
        logger.debug("[STEP] i18n_rewrite_stack2_health_skip: %s", exc)
        return {"ok": False, "url": base_url, "error": str(exc)}


def build_preview(
    *,
    spec_id: str,
    target_id: str,
    only_prefix: str | None,
    batch_size: int,
) -> dict[str, Any]:
    repo = _require_repo()
    spec_path = resolve_preset_path(repo, PRESET_SPECS, spec_id)
    source_path = resolve_preset_path(repo, PRESET_TARGETS, target_id)
    spec = load_spec(spec_path)
    tree = _load_json(source_path)
    if not isinstance(tree, dict):
        msg = "Source locale root must be a JSON object"
        raise TypeError(msg)
    exclude = set(spec.get("exclude_top_level_keys") or [])
    include_raw = spec.get("include_top_level_keys")
    include = set(include_raw) if include_raw else None
    all_strings = flatten_string_leaves(
        tree,
        exclude_roots=exclude,
        include_roots=include,
        only_prefix=only_prefix or None,
    )
    pending = dict(all_strings)
    batches = chunk_items(list(pending.items()), max(1, batch_size))
    batch_previews = [
        {"index": i, "size": len(batch), "keys": [k for k, _ in batch]} for i, batch in enumerate(batches, start=1)
    ]
    return {
        "spec_id": spec_id,
        "target_id": target_id,
        "spec_name": spec.get("name"),
        "target_language": spec.get("target_language"),
        "total_keys": len(all_strings),
        "pending_keys": len(pending),
        "batch_size": batch_size,
        "batch_count": len(batches),
        "batches": batch_previews[:12],
        "batches_truncated": len(batches) > 12,
        "cli_command": build_cli_command(
            repo=repo,
            spec_path=spec_path,
            source_path=source_path,
            only_prefix=only_prefix,
            batch_size=batch_size,
        ),
    }


@dataclass(frozen=True)
class SingleBatchResult:
    batch_index: int
    keys: list[str]
    before: dict[str, str]
    after: dict[str, str]


def run_single_batch(
    *,
    spec_id: str,
    target_id: str,
    only_prefix: str | None,
    batch_size: int,
    batch_index: int,
    stack2_url: str | None = None,
    model: str | None = None,
    temperature: float = 0.35,
    timeout: float = 360.0,
    max_retries: int = 2,
) -> dict[str, Any]:
    repo = _require_repo()
    spec_path = resolve_preset_path(repo, PRESET_SPECS, spec_id)
    source_path = resolve_preset_path(repo, PRESET_TARGETS, target_id)
    spec = load_spec(spec_path)
    tree = _load_json(source_path)
    if not isinstance(tree, dict):
        msg = "Source locale root must be a JSON object"
        raise TypeError(msg)
    exclude = set(spec.get("exclude_top_level_keys") or [])
    include_raw = spec.get("include_top_level_keys")
    include = set(include_raw) if include_raw else None
    all_strings = flatten_string_leaves(
        tree,
        exclude_roots=exclude,
        include_roots=include,
        only_prefix=only_prefix or None,
    )
    batches = chunk_items(list(all_strings.items()), max(1, batch_size))
    if batch_index < 1 or batch_index > len(batches):
        msg = f"batch_index must be 1..{len(batches)}"
        raise ValueError(msg)
    batch_pairs = batches[batch_index - 1]
    batch = dict(batch_pairs)

    base_url = (stack2_url or default_stack2_url()).rstrip("/")
    http_json(f"{base_url}/health", timeout=15.0)
    resolved_model = resolve_model(base_url, model)
    system_prompt = build_system_prompt(spec)
    user_prompt = build_user_prompt(batch, spec)

    last_err: Exception | None = None
    rewrites: dict[str, str] = {}
    for attempt in range(max_retries + 1):
        try:
            raw = call_stack2_chat(
                base_url,
                resolved_model,
                system_prompt,
                user_prompt,
                temperature=temperature,
                timeout=timeout,
            )
            rewrites = parse_rewrites(raw)
            errors = validate_batch(batch, rewrites, spec)
            if errors:
                raise RuntimeError("; ".join(errors[:6]))
            break
        except Exception as exc:  # noqa: BLE001 — retry surface
            last_err = exc
            if attempt < max_retries:
                time.sleep(1.5 * (attempt + 1))
    else:
        raise RuntimeError(str(last_err)) from last_err

    return {
        "batch_index": batch_index,
        "batch_count": len(batches),
        "model": resolved_model,
        "stack2_url": base_url,
        "keys": list(batch.keys()),
        "before": batch,
        "after": rewrites,
    }


def build_cli_command(
    *,
    repo: Path,
    spec_path: Path,
    source_path: Path,
    only_prefix: str | None,
    batch_size: int,
    output_rel: str | None = None,
) -> str:
    spec_rel = spec_path.relative_to(repo)
    source_rel = source_path.relative_to(repo)
    parts = [
        "bash docker/scripts/i18n-rewrite-stack2.sh",
        f"--spec {spec_rel}",
        f"--source {source_rel}",
    ]
    if output_rel:
        parts.append(f"--output {output_rel}")
    if only_prefix:
        parts.append(f"--only-prefix {only_prefix}")
    parts.append(f"--batch-size {batch_size}")
    parts.append("--backup")
    return " ".join(parts)


def _require_repo() -> Path:
    repo = resolve_repo_root()
    if repo is None:
        msg = "i18n rewrite tooling unavailable: set I18N_REWRITE_REPO_ROOT to monorepo on this host"
        raise RuntimeError(msg)
    return repo


def _load_json(path: Path) -> Any:
    with path.open(encoding="utf-8") as fh:
        return json.load(fh)


def _is_index_segment(seg: str) -> bool:
    return seg.isdigit()


def flatten_string_leaves(
    obj: Any,
    *,
    prefix: str = "",
    exclude_roots: set[str] | None = None,
    include_roots: set[str] | None = None,
    only_prefix: str | None = None,
) -> dict[str, str]:
    out: dict[str, str] = {}

    def allowed(path: str) -> bool:
        if not path:
            return True
        root = path.split(".", 1)[0]
        if exclude_roots and root in exclude_roots:
            return False
        if include_roots and root not in include_roots:
            return False
        if only_prefix:
            return path == only_prefix or path.startswith(f"{only_prefix}.")
        return True

    def walk(value: Any, path: str) -> None:
        if not allowed(path):
            return
        if isinstance(value, str):
            if path:
                out[path] = value
            return
        if isinstance(value, list):
            for idx, item in enumerate(value):
                child = f"{path}.{idx}" if path else str(idx)
                walk(item, child)
            return
        if isinstance(value, dict):
            for key, item in value.items():
                child = f"{path}.{key}" if path else key
                walk(item, child)

    walk(obj, prefix)
    return out


def _parse_path(path: str) -> list[str]:
    return path.split(".") if path else []


def set_by_path(root: dict[str, Any], path: str, value: str) -> None:
    parts = _parse_path(path)
    if not parts:
        return
    cur: Any = root
    for i, seg in enumerate(parts[:-1]):
        nxt_seg = parts[i + 1]
        if _is_index_segment(seg):
            if isinstance(cur, list):
                idx = int(seg)
                while len(cur) <= idx:
                    cur.append({})
                cur = cur[idx]
            elif isinstance(cur, dict):
                if seg not in cur:
                    cur[seg] = {}
                cur = cur[seg]
            else:
                msg = f"Expected list or object at {path}"
                raise TypeError(msg)
        else:
            if not isinstance(cur, dict):
                msg = f"Expected object at {path}"
                raise TypeError(msg)
            if seg not in cur:
                cur[seg] = {} if not _is_index_segment(nxt_seg) else {}
            cur = cur[seg]
    last = parts[-1]
    if _is_index_segment(last):
        if isinstance(cur, list):
            idx = int(last)
            while len(cur) <= idx:
                cur.append("")
            cur[idx] = value
        elif isinstance(cur, dict):
            cur[last] = value
        else:
            msg = f"Expected list or object at {path}"
            raise TypeError(msg)
    else:
        if not isinstance(cur, dict):
            msg = f"Expected object at {path}"
            raise TypeError(msg)
        cur[last] = value


def extract_placeholders(text: str) -> list[str]:
    return PLACEHOLDER_RE.findall(text)


def placeholders_preserved(old: str, new: str) -> bool:
    return sorted(extract_placeholders(old)) == sorted(extract_placeholders(new))


def load_spec(path: Path) -> dict[str, Any]:
    spec = _load_json(path)
    for key in ("target_language", "tone_brief"):
        if key not in spec:
            msg = f"Spec missing required field: {key}"
            raise ValueError(msg)
    return spec


def build_system_prompt(spec: dict[str, Any]) -> str:
    persona = (spec.get("persona") or "").strip()
    if not persona:
        persona = "You are a senior UX copywriter for Empery World (premium dark fantasy product UI)."
    lines = [
        persona,
        f"Target language: {spec['target_language']}.",
        f"Tone: {spec['tone_brief']}",
    ]
    brand = spec.get("brand_terms") or {}
    if brand:
        lines.append("Brand terms (use consistently):")
        for src, dst in brand.items():
            lines.append(f"- {src} → {dst}")
    forbidden = spec.get("forbidden_phrases") or []
    if forbidden:
        lines.append("Forbidden phrases / patterns: " + "; ".join(forbidden))
    extra = (spec.get("extra_instructions") or "").strip()
    if extra:
        lines.append(f"Extra: {extra}")
    lines.extend(
        [
            "Rules:",
            '- Shape: {"rewrites": {"dot.path.key": "new string", ...}}.',
            "- Keep every input key; do not add or drop keys.",
            "- Copy each dot-path key EXACTLY as given in input (same spelling and segments).",
            "- Preserve {{placeholders}} exactly when present in the source string.",
        ]
    )
    return "\n".join(lines)


def build_user_prompt(batch: dict[str, str], spec: dict[str, Any]) -> str:
    src_lang = spec.get("source_language") or spec["target_language"]
    payload = {
        "task": "rewrite_ui_copy",
        "source_language": src_lang,
        "target_language": spec["target_language"],
        "strings": batch,
    }
    return json.dumps(payload, ensure_ascii=False, indent=2)


def chunk_items(items: list[tuple[str, str]], size: int) -> list[list[tuple[str, str]]]:
    return [items[i : i + size] for i in range(0, len(items), size)]


def default_stack2_url() -> str:
    env_url = (os.environ.get("I18N_REWRITE_STACK2_URL") or "").strip().rstrip("/")
    if env_url:
        return env_url
    host = os.environ.get("LLAMA_CHAT_CLIENT_BIND", "127.0.0.1")
    port = os.environ.get("LLAMA_CHAT_HOST_PORT", "31000")
    return f"http://{host}:{port}"


def http_json(
    url: str,
    *,
    method: str = "GET",
    body: dict[str, Any] | None = None,
    timeout: float = 300.0,
) -> Any:
    data = None
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw) if raw.strip() else {}
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        msg = f"HTTP {exc.code} {url}: {detail[:800]}"
        raise RuntimeError(msg) from exc
    except urllib.error.URLError as exc:
        msg = f"Request failed {url}: {exc}"
        raise RuntimeError(msg) from exc


def resolve_model(base_url: str, explicit: str | None) -> str:
    if explicit and explicit.strip():
        return explicit.strip()
    env_model = (os.environ.get("I18N_REWRITE_STACK2_MODEL") or "").strip()
    if env_model:
        return env_model
    models = http_json(f"{base_url}/v1/models", timeout=30.0)
    data = models.get("data") or []
    if not data:
        msg = f"No models from {base_url}/v1/models"
        raise RuntimeError(msg)
    first = data[0].get("id")
    if not first:
        raise RuntimeError("Model id missing in /v1/models response")
    return str(first)


def call_stack2_chat(
    base_url: str,
    model: str,
    system: str,
    user: str,
    *,
    temperature: float,
    timeout: float,
) -> str:
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": temperature,
        "stream": False,
        "response_format": {"type": "json_object"},
    }
    data = http_json(
        f"{base_url}/v1/chat/completions",
        method="POST",
        body=payload,
        timeout=timeout,
    )
    choices = data.get("choices") or []
    if not choices:
        raise RuntimeError("Empty choices from stack2 chat")
    message = choices[0].get("message") or {}
    content = (message.get("content") or "").strip()
    if not content:
        raise RuntimeError("Empty content from stack2 chat")
    return content


def align_rewrite_keys(source: dict[str, str], rewritten: dict[str, str]) -> dict[str, str]:
    """Re-bind typo'd dot-path keys to the source keys when counts match."""
    if len(source) == 1 and len(rewritten) == 1:
        src_key = next(iter(source))
        out_key = next(iter(rewritten))
        if src_key != out_key:
            return {src_key: rewritten[out_key]}
        return rewritten

    if not source:
        return rewritten

    aligned = {k: v for k, v in rewritten.items() if k in source}
    missing = [k for k in source if k not in aligned]
    extra = [k for k in rewritten if k not in source]
    if not missing or not extra:
        return aligned

    from difflib import get_close_matches

    used_extra: set[str] = set()
    for miss in missing:
        candidates = [k for k in extra if k not in used_extra]
        match = get_close_matches(miss, candidates, n=1, cutoff=0.82)
        if match:
            aligned[miss] = rewritten[match[0]]
            used_extra.add(match[0])
    return aligned


def split_batch_accepted(
    source: dict[str, str],
    rewritten: dict[str, str],
    spec: dict[str, Any],
) -> tuple[dict[str, str], dict[str, str]]:
    """Return accepted rewrites and source entries that still need another pass."""
    accepted: dict[str, str] = {}
    pending: dict[str, str] = {}
    for key, old in source.items():
        new = rewritten.get(key)
        if new is None:
            pending[key] = old
            continue
        if (
            spec.get("preserve_placeholders", True)
            and extract_placeholders(old)
            and not placeholders_preserved(old, new)
        ):
            pending[key] = old
            continue
        if spec.get("forbid_cyrillic_in_output") and CYRILLIC_RE.search(new):
            pending[key] = old
            continue
        accepted[key] = new
    return accepted, pending


def parse_rewrites(raw: str) -> dict[str, str]:
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
            cleaned = re.sub(r"\s*```$", "", cleaned)
            parsed = json.loads(cleaned)
        else:
            raise RuntimeError(f"Model returned non-JSON: {raw[:400]}") from exc
    rewrites = parsed.get("rewrites")
    if not isinstance(rewrites, dict):
        raise RuntimeError('Expected JSON object with "rewrites" map')
    out: dict[str, str] = {}
    for key, value in rewrites.items():
        if isinstance(key, str) and isinstance(value, str):
            out[key] = value
    return out


def validate_batch(
    source: dict[str, str],
    rewritten: dict[str, str],
    spec: dict[str, Any],
) -> list[str]:
    errors: list[str] = []
    for key, old in source.items():
        if key not in rewritten:
            errors.append(f"missing key: {key}")
            continue
        new = rewritten[key]
        if spec.get("preserve_placeholders", True) and not placeholders_preserved(old, new):
            errors.append(f"placeholder mismatch {key}")
        if spec.get("forbid_cyrillic_in_output") and CYRILLIC_RE.search(new):
            errors.append(f"cyrillic in output: {key}")
    return errors


def apply_rewrites(tree: dict[str, Any], flat: dict[str, str]) -> dict[str, Any]:
    result = deepcopy(tree)
    for path, value in flat.items():
        set_by_path(result, path, value)
    return result
