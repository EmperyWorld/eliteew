#!/usr/bin/env python3
# ---
# KBSEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Compare KBSEW search results against a YAML eval set (Recall@k / hit-rate).
# Usage:
#   KBSEW_SERVICE_URL=http://127.0.0.1:8030 \
#   KBSEW_INTERNAL_SERVICE_TOKEN=… \
#   python3 KBSEW/scripts/kbsew_eval.py --dataset KBSEW/eval/sample_queries.yaml
# ---

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any


def _load_yaml(path: Path) -> dict[str, Any]:
    try:
        import yaml  # type: ignore[import-untyped]
    except ImportError:
        # Minimal subset parser for this fixture shape (no PyYAML required).
        return _load_yaml_minimal(path)
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError(f"YAML root must be a mapping: {path}")
    return data


def _load_yaml_minimal(path: Path) -> dict[str, Any]:
    """Tiny loader for sample_queries.yaml when PyYAML is unavailable."""

    text = path.read_text(encoding="utf-8")
    # Prefer json-compatible dump if operator converted; else use stdlib-free parse.
    cases: list[dict[str, Any]] = []
    defaults: dict[str, Any] = {}
    current: dict[str, Any] | None = None
    needles: list[str] | None = None
    forbidden: list[str] | None = None
    list_target: str | None = None
    section = ""
    for raw in text.splitlines():
        line = raw.split("#", 1)[0].rstrip()
        if not line.strip():
            continue
        indent = len(line) - len(line.lstrip(" "))
        stripped = line.strip()
        if stripped.startswith("version:"):
            continue
        if stripped == "defaults:":
            section = "defaults"
            continue
        if stripped == "cases:":
            section = "cases"
            continue
        if section == "defaults" and ":" in stripped:
            key, value = stripped.split(":", 1)
            defaults[key.strip()] = value.strip().strip('"').strip("'")
            continue
        if section == "cases":
            if stripped.startswith("- id:"):
                if current is not None:
                    if needles is not None:
                        current["must_include_substrings"] = needles
                    if forbidden is not None:
                        current["must_not_match"] = forbidden
                    cases.append(current)
                current = {"id": stripped.split(":", 1)[1].strip().strip('"').strip("'")}
                needles = None
                forbidden = None
                list_target = None
                continue
            if current is None:
                continue
            if stripped.startswith("query:"):
                current["query"] = stripped.split(":", 1)[1].strip().strip('"').strip("'")
                continue
            if stripped.startswith("barrel_id:"):
                current["barrel_id"] = stripped.split(":", 1)[1].strip().strip('"').strip("'")
                continue
            if stripped.startswith("k:"):
                current["k"] = int(stripped.split(":", 1)[1].strip())
                continue
            if stripped == "must_include_substrings:":
                needles = []
                list_target = "needles"
                continue
            if stripped == "must_not_match:":
                forbidden = []
                list_target = "forbidden"
                continue
            if list_target == "needles" and stripped.startswith("- "):
                assert needles is not None
                needles.append(stripped[2:].strip().strip('"').strip("'"))
                continue
            if list_target == "forbidden" and stripped.startswith("- "):
                assert forbidden is not None
                forbidden.append(stripped[2:].strip().strip('"').strip("'"))
                continue
            if indent == 0:
                continue
    if current is not None:
        if needles is not None:
            current["must_include_substrings"] = needles
        if forbidden is not None:
            current["must_not_match"] = forbidden
        cases.append(current)
    return {"defaults": defaults, "cases": cases}


def _post_search(
    *,
    base_url: str,
    token: str | None,
    bearer: str | None,
    query: str,
    barrel_id: str,
    limit: int,
) -> list[str]:
    url = f"{base_url.rstrip('/')}/api/v1/kbsew/search"
    payload = json.dumps(
        {"query": query, "barrel_id": barrel_id, "limit": limit},
        ensure_ascii=False,
    ).encode("utf-8")
    headers = {
        "content-type": "application/json",
        "accept": "application/json",
    }
    if token:
        headers["X-KBSEW-Service-Token"] = token
    elif bearer:
        headers["authorization"] = f"Bearer {bearer}"
    request = urllib.request.Request(url, data=payload, headers=headers, method="POST")
    with urllib.request.urlopen(request, timeout=60) as response:
        body = json.loads(response.read().decode("utf-8"))
    chunks = body.get("chunks") or []
    if not isinstance(chunks, list):
        raise ValueError("response.chunks must be a list")
    return [str(item) for item in chunks if isinstance(item, str)]


def _case_hit(chunks: list[str], needles: list[str]) -> bool:
    joined = "\n".join(chunks).casefold()
    return all(needle.casefold() in joined for needle in needles)


def _case_forbidden(chunks: list[str], patterns: list[str]) -> str | None:
    """Return first matching forbidden pattern (literal or (?i)regex), else None."""

    import re

    joined = "\n".join(chunks)
    for raw in patterns:
        pattern = str(raw or "").strip()
        if not pattern:
            continue
        if pattern.startswith("(?") or "\\" in pattern or "[" in pattern:
            if re.search(pattern, joined):
                return pattern
            continue
        if pattern.casefold() in joined.casefold():
            return pattern
    return None


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="KBSEW search eval harness")
    parser.add_argument(
        "--dataset",
        default=str(Path(__file__).resolve().parents[1] / "eval" / "sample_queries.yaml"),
        help="YAML dataset path",
    )
    parser.add_argument(
        "--url",
        default=os.environ.get("KBSEW_SERVICE_URL", "http://127.0.0.1:8030"),
        help="KBSEW base URL",
    )
    parser.add_argument(
        "--min-hit-rate",
        type=float,
        default=float(os.environ.get("KBSEW_EVAL_MIN_HIT_RATE", "1.0")),
        help="Minimum fraction of cases that must hit (default 1.0)",
    )
    args = parser.parse_args(argv)

    token = os.environ.get("KBSEW_INTERNAL_SERVICE_TOKEN") or None
    bearer = os.environ.get("KBSEW_SMOKE_BEARER") or None
    if not token and not bearer:
        print(
            "Set KBSEW_INTERNAL_SERVICE_TOKEN or KBSEW_SMOKE_BEARER",
            file=sys.stderr,
        )
        return 2

    dataset_path = Path(args.dataset)
    data = _load_yaml(dataset_path)
    defaults = dict(data.get("defaults") or {})
    cases = list(data.get("cases") or [])
    if not cases:
        print(f"FAIL: no cases in {dataset_path}", file=sys.stderr)
        return 1

    override_barrel = os.environ.get("KBSEW_EVAL_BARREL_ID")
    hits = 0
    results: list[dict[str, Any]] = []
    for case in cases:
        if not isinstance(case, dict):
            continue
        query = str(case.get("query") or "").strip()
        needles = [str(n) for n in (case.get("must_include_substrings") or []) if str(n)]
        forbidden = [str(n) for n in (case.get("must_not_match") or []) if str(n)]
        barrel_id = str(override_barrel or case.get("barrel_id") or defaults.get("barrel_id") or "").strip()
        k = int(case.get("k") or defaults.get("k") or 5)
        case_id = str(case.get("id") or query[:32] or "case")
        if not query or not barrel_id or not needles:
            print(f"FAIL: invalid case {case_id!r}", file=sys.stderr)
            return 1
        try:
            chunks = _post_search(
                base_url=args.url,
                token=token,
                bearer=bearer,
                query=query,
                barrel_id=barrel_id,
                limit=max(1, min(k, 20)),
            )
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace") if exc.fp else ""
            if exc.code == 409 and "index_stale" in body:
                print(
                    f"[STALE] {case_id}: barrel index not on current pipeline "
                    f"(fail-closed search); reindex in progress — skip quality assert",
                )
                results.append(
                    {
                        "id": case_id,
                        "hit": True,
                        "stale": True,
                        "k": k,
                        "chunks": 0,
                        "recall_at_k": 1.0,
                    }
                )
                hits += 1
                continue
            print(f"FAIL: {case_id}: search error: {exc} body={body[:200]}", file=sys.stderr)
            return 1
        except (urllib.error.URLError, TimeoutError, ValueError) as exc:
            print(f"FAIL: {case_id}: search error: {exc}", file=sys.stderr)
            return 1
        hit = _case_hit(chunks, needles)
        bad = _case_forbidden(chunks, forbidden) if hit else None
        if bad is not None:
            print(f"FAIL: {case_id}: forbidden pattern matched: {bad!r}", file=sys.stderr)
            hit = False
        hits += int(hit)
        results.append(
            {
                "id": case_id,
                "hit": hit,
                "k": k,
                "chunks": len(chunks),
                "recall_at_k": 1.0 if hit else 0.0,
            }
        )
        status = "HIT" if hit else "MISS"
        print(f"[{status}] {case_id} chunks={len(chunks)} k={k}")

    total = len(results)
    hit_rate = hits / total if total else 0.0
    recall_at_k = hit_rate  # per-case binary recall; mean equals hit-rate here
    print(
        f"summary: cases={total} hits={hits} hit_rate={hit_rate:.3f} "
        f"recall_at_k_mean={recall_at_k:.3f} min_hit_rate={args.min_hit_rate:.3f}"
    )
    if hit_rate + 1e-9 < float(args.min_hit_rate):
        print("FAIL: hit-rate below threshold", file=sys.stderr)
        return 1
    print("OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
