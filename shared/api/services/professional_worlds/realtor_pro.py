# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Thin re-export barrel for Realtor Pro domain modules (Layer E import stability).
# Invariants:
# - Public import path `api.services.professional_worlds.realtor_pro` stays stable (Layer E).
# Related:
# - api/services/professional_worlds/realtor_pro_*.py
# - api/services/professional_worlds/service_realtor_delegations.py
# ---

"""Public API: re-exports domain helpers. Prefer importing from this module."""

from __future__ import annotations

from api.services.professional_worlds.realtor_pro_buyers_sellers import (  # noqa: F401
    create_buyer_requirement,
    create_seller_profile,
    list_buyer_requirements,
    list_seller_profiles,
    update_buyer_requirement,
    update_seller_profile,
)
from api.services.professional_worlds.realtor_pro_deals_docs import (  # noqa: F401
    append_deal_event,
    create_realtor_document,
    list_deal_events,
    list_realtor_documents,
    update_realtor_document,
)
from api.services.professional_worlds.realtor_pro_marketing_comms import (  # noqa: F401
    create_communication_log,
    create_marketing_campaign,
    list_communication_logs,
    list_marketing_campaigns,
    list_objection_replies,
    list_publication_channels,
    update_marketing_campaign,
    update_publication_channel_meta,
    upsert_objection_reply,
    upsert_publication_channel,
)
from api.services.professional_worlds.realtor_pro_pricing_quality import (  # noqa: F401
    create_price_snapshot,
    list_listing_quality_scores,
    list_price_snapshots,
    recompute_listing_quality,
)
from api.services.professional_worlds.realtor_pro_showings_tasks import (  # noqa: F401
    create_property_showing,
    create_realtor_task,
    delete_property_showing,
    delete_realtor_task,
    get_property_showing,
    get_realtor_task,
    list_property_showings,
    list_realtor_tasks,
    update_property_showing,
    update_realtor_task,
)

__all__ = [
    "append_deal_event",
    "create_buyer_requirement",
    "create_communication_log",
    "create_marketing_campaign",
    "create_price_snapshot",
    "create_property_showing",
    "create_realtor_document",
    "create_realtor_task",
    "create_seller_profile",
    "delete_property_showing",
    "delete_realtor_task",
    "get_property_showing",
    "get_realtor_task",
    "list_buyer_requirements",
    "list_communication_logs",
    "list_deal_events",
    "list_listing_quality_scores",
    "list_marketing_campaigns",
    "list_objection_replies",
    "list_price_snapshots",
    "list_property_showings",
    "list_publication_channels",
    "list_realtor_documents",
    "list_realtor_tasks",
    "list_seller_profiles",
    "recompute_listing_quality",
    "update_buyer_requirement",
    "update_marketing_campaign",
    "update_property_showing",
    "update_publication_channel_meta",
    "update_realtor_document",
    "update_realtor_task",
    "update_seller_profile",
    "upsert_objection_reply",
    "upsert_publication_channel",
]
