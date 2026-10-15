# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Lock display-name labeling for shared Desktop AI Chat (LLM history / current turn).
# Invariants:
# - Solo/non-shared keeps unlabeled body; shared uses Автор/Участник labels.
# Related:
# - api/services/desktop_chat/collaboration_authors.py
# - api/services/desktop_chat_ensemble/history.py
# ---

from __future__ import annotations

from types import SimpleNamespace
from uuid import uuid4

from api.services.desktop_chat.collaboration_authors import (
    SHARED_CHAT_SPEAKER_NUDGE,
    disambiguate_display_names,
    format_user_turn_for_llm,
    resolve_author_display_name,
    speaker_role_label,
)
from api.services.desktop_chat.service import messages_for_llama
from api.services.desktop_chat_ensemble.history import ensemble_messages_for_llama


def test_resolve_author_display_name_prefers_full_name() -> None:
    uid = uuid4()
    assert resolve_author_display_name(full_name=" Анна ", username="anna", user_id=uid) == "Анна"
    assert resolve_author_display_name(full_name="", username="anna", user_id=uid) == "anna"
    short = resolve_author_display_name(full_name=None, username=None, user_id=uid)
    assert short.startswith("user-")
    assert len(short) == 13


def test_disambiguate_duplicate_display_names() -> None:
    a, b = uuid4(), uuid4()
    out = disambiguate_display_names(
        {a: "Иван", b: "Иван"},
        usernames={a: "ivan1", b: "ivan2"},
    )
    assert out[a] == "Иван (@ivan1)"
    assert out[b] == "Иван (@ivan2)"


def test_format_user_turn_for_llm_shared_vs_solo() -> None:
    body = "привет"
    assert format_user_turn_for_llm(body, is_shared=False, speaker_label="Участник · Иван") == body
    labeled = format_user_turn_for_llm(
        body,
        is_shared=True,
        speaker_label=speaker_role_label(is_owner=False, display_name="Иван"),
    )
    assert labeled.startswith("[Сообщение от Участник · Иван]:")
    assert "привет" in labeled


def test_messages_for_llama_labels_two_humans_distinctly() -> None:
    owner = uuid4()
    guest = uuid4()
    labels = {
        owner: speaker_role_label(is_owner=True, display_name="Анна"),
        guest: speaker_role_label(is_owner=False, display_name="Иван"),
    }
    history = [
        SimpleNamespace(
            role="user",
            content="от Анны",
            author_user_id=owner,
            message_metadata=None,
            tool_calls=None,
        ),
        SimpleNamespace(
            role="assistant",
            content="ок",
            author_user_id=None,
            message_metadata=None,
            tool_calls=None,
        ),
        SimpleNamespace(
            role="user",
            content="от Ивана",
            author_user_id=guest,
            message_metadata=None,
            tool_calls=None,
        ),
    ]
    msgs = messages_for_llama(
        system_prompt="sys",
        history=history,
        user_content="текущий",
        is_shared=True,
        owner_id=owner,
        speaker_labels=labels,
    )
    user_bodies = [m["content"] for m in msgs if m["role"] == "user"]
    assert any("Автор чата · Анна" in c and "от Анны" in c for c in user_bodies)
    assert any("Участник · Иван" in c and "от Ивана" in c for c in user_bodies)
    assert SHARED_CHAT_SPEAKER_NUDGE  # nudge exists for stream wiring


def test_ensemble_messages_for_llama_labels_shared_history() -> None:
    owner = uuid4()
    guest = uuid4()
    labels = {
        owner: speaker_role_label(is_owner=True, display_name="Анна"),
        guest: speaker_role_label(is_owner=False, display_name="Иван"),
    }
    history = [
        SimpleNamespace(
            role="user",
            content="а",
            author_user_id=owner,
            message_metadata=None,
            tool_calls=None,
        ),
        SimpleNamespace(
            role="user",
            content="б",
            author_user_id=guest,
            message_metadata={"author_display_name": "Иван", "author_is_owner": False},
            tool_calls=None,
        ),
    ]
    msgs = ensemble_messages_for_llama(
        system_prompt="sys",
        history=history,
        user_content="now",
        is_shared=True,
        owner_id=owner,
        speaker_labels=labels,
    )
    user_hist = [m["content"] for m in msgs if m["role"] == "user" and m["content"] != "now"]
    assert any("Автор чата · Анна" in c for c in user_hist)
    assert any("Участник · Иван" in c for c in user_hist)


def test_ensemble_messages_solo_keeps_raw_user_text() -> None:
    history = [
        SimpleNamespace(
            role="user",
            content="plain",
            author_user_id=uuid4(),
            message_metadata={"author_display_name": "X", "author_is_owner": True},
            tool_calls=None,
        )
    ]
    msgs = ensemble_messages_for_llama(
        system_prompt="sys",
        history=history,
        user_content="now",
        is_shared=False,
    )
    assert msgs[1]["content"] == "plain"
