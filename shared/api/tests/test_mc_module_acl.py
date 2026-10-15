# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit tests for marketing cabinet mc_module mutation ACL helpers.
# Invariants:
# - Empty permissions deny gated mutations; IMC aliases accept either slug.
# Related:
# - api/services/marketing_cabinet/mc_module_acl.py
# - api/routers/marketing_cabinet/common.py
# ---

from __future__ import annotations

from uuid import uuid4

import pytest

from api.routers.marketing_cabinet.common import _marketing_project_row_allows_mutation
from api.services.marketing_cabinet.mc_module_acl import (
    member_permissions_grant_mc_module,
    normalize_required_mc_module,
)


def test_normalize_required_mc_module_rejects_unknown() -> None:
    with pytest.raises(ValueError, match="unknown mc_module slug"):
        normalize_required_mc_module("not_a_module")


def test_member_permissions_grant_funnel() -> None:
    assert member_permissions_grant_mc_module(["mc_module:funnel"], "funnel") is True
    assert member_permissions_grant_mc_module([], "funnel") is False
    assert member_permissions_grant_mc_module(["mc_module:jtbd"], "funnel") is False


def test_member_permissions_imc_aliases() -> None:
    assert member_permissions_grant_mc_module(["mc_module:imc_research"], "imc") is True
    assert member_permissions_grant_mc_module(["mc_module:imc"], "imc_research") is True


def test_mutation_lead_bypasses_module_gate() -> None:
    lead = uuid4()
    owner = uuid4()
    row = {
        "company_user_id": owner,
        "created_by": lead,
        "active_member_id": None,
        "member_permissions": None,
        "company_representative_user_id": None,
    }

    class Rec(dict):
        def get(self, key, default=None):  # noqa: ANN001
            return super().get(key, default)

    assert (
        _marketing_project_row_allows_mutation(
            Rec(row),
            lead,
            required_mc_module="funnel",
        )
        is True
    )


def test_mutation_member_requires_mc_module() -> None:
    owner = uuid4()
    lead = uuid4()
    member = uuid4()

    class Rec(dict):
        def get(self, key, default=None):  # noqa: ANN001
            return super().get(key, default)

    base = {
        "company_user_id": owner,
        "created_by": lead,
        "active_member_id": uuid4(),
        "company_representative_user_id": None,
    }
    deny = Rec({**base, "member_permissions": []})
    allow = Rec({**base, "member_permissions": ["mc_module:funnel"]})
    assert _marketing_project_row_allows_mutation(deny, member, required_mc_module="funnel") is False
    assert _marketing_project_row_allows_mutation(allow, member, required_mc_module="funnel") is True
