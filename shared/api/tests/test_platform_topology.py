# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Behavioral locks for platform topology catalog + graph builder + factory overlay (G1–G2).
# Related:
# - api/services/platform_topology/
# ---

from __future__ import annotations

from api.services.platform_topology.catalog import (
    load_topology_catalog,
    validate_catalog_integrity,
)
from api.services.platform_topology.factory_overlay import (
    build_factory_touches,
    resolve_pack_nodes,
)
from api.services.platform_topology.graph_builder import build_topology_graph


def test_topology_catalog_integrity() -> None:
    errors = validate_catalog_integrity()
    assert errors == [], errors


def test_build_topology_graph_honest_counts() -> None:
    catalog = load_topology_catalog()
    graph = build_topology_graph(intentions=[])
    assert graph["schema_version"] == 1
    assert graph["counts"]["nodes"] == len(catalog["nodes"])
    assert graph["counts"]["dependency_edges"] == len(catalog["dependencies"])
    assert graph["counts"]["event_edges"] >= 1
    assert graph["counts"]["event_edges"] <= sum(
        len(f.get("publishers") or []) * len(f.get("subscribers") or []) for f in catalog["event_flows"]
    )
    assert graph["counts"]["factory_active"] == 0
    assert graph["counts"]["factory_touched_nodes"] == 0
    api_node = next(n for n in graph["nodes"] if n["id"] == "stack0_api")
    assert api_node["health"] == "ok"
    assert api_node["factory_touch"] is False
    other = next(n for n in graph["nodes"] if n["id"] == "stack1_postgres")
    assert other["health"] == "unknown"
    kinds = {e["kind"] for e in graph["edges"]}
    assert kinds == {"dependency", "event"}


def test_event_edges_have_topics() -> None:
    graph = build_topology_graph(intentions=[])
    event_edges = [e for e in graph["edges"] if e["kind"] == "event"]
    assert event_edges
    assert all(isinstance(e.get("topics"), list) and e["topics"] for e in event_edges)


def test_factory_overlay_maps_active_packs() -> None:
    known = {"stack0_api", "comfyui", "stack0_celery_companion", "stack1_postgres"}
    nodes = resolve_pack_nodes(["music_forge"], known_nodes=known)
    assert "stack0_api" in nodes
    assert "comfyui" in nodes

    touches = build_factory_touches(
        [
            {
                "id": "int-1",
                "title": "Music pack",
                "status": "running",
                "stage": "verify",
                "pack_stems": ["music_forge"],
            },
            {
                "id": "int-done",
                "title": "Done",
                "status": "completed",
                "stage": "done",
                "pack_stems": ["music_forge"],
            },
        ],
        known_nodes=known,
    )
    assert "comfyui" in touches
    assert all(t["intention_id"] == "int-1" for t in touches["comfyui"])

    graph = build_topology_graph(
        intentions=[
            {
                "id": "int-1",
                "title": "Music pack",
                "status": "running",
                "stage": "verify",
                "pack_stems": ["music_forge"],
            }
        ]
    )
    comfy = next(n for n in graph["nodes"] if n["id"] == "comfyui")
    assert comfy["factory_touch"] is True
    assert comfy["factory_stage"] == "verify"
    assert graph["counts"]["factory_active"] == 1
    assert graph["counts"]["factory_touched_nodes"] >= 1


def test_unknown_pack_falls_back_to_stack0_api() -> None:
    nodes = resolve_pack_nodes(["no_such_pack"], known_nodes={"stack0_api", "comfyui"})
    assert nodes == ["stack0_api"]
