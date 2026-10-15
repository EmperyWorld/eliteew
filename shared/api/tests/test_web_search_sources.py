# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Behavioral tests for Desktop AI Chat web-search source parsing helpers.
# Invariants:
# - URL required; title/snippet optional only.
# Related:
# - api/services/desktop_chat/web_search_sources.py
# ---

from api.services.desktop_chat.web_search_sources import (
    parse_web_search_prompt_block,
    web_search_hits_to_sources,
    web_search_sources_from_tool_trace,
)


def test_web_search_hits_to_sources_dedup_and_snippet_cap():
    hits = [
        {"url": "https://a.test", "title": "A", "content": "x" * 500},
        {"url": "https://a.test", "title": "dup"},
    ]
    out = web_search_hits_to_sources(hits)
    assert len(out) == 1
    assert out[0]["url"] == "https://a.test"
    assert out[0]["title"] == "A"
    assert len(out[0]["snippet"]) == 400


def test_parse_web_search_prompt_block_numbered_format():
    block = """[1] Title one
Snippet one
URL: https://one.test

[2] Title two
Snippet two
URL: https://two.test"""
    out = parse_web_search_prompt_block(block)
    assert len(out) == 2
    assert out[0]["url"] == "https://one.test"
    assert out[0]["title"] == "Title one"


def test_web_search_sources_from_tool_trace_merges_preview_tools():
    trace = [
        {
            "preview": "[1] Router hit\nSnip\nURL: https://router.test",
            "tools": [
                {
                    "name": "web_search",
                    "preview": "[1] Loop hit\nLoop snip\nURL: https://loop.test",
                }
            ],
        }
    ]
    out = web_search_sources_from_tool_trace(trace)
    urls = {row["url"] for row in out}
    assert urls == {"https://router.test", "https://loop.test"}
