"""Deprecated IMC type_key values (pre-RAG cabinet) and their RAG successors."""

from __future__ import annotations

# Keys deactivated in 20260329_01_imc_rag_research_provider_and_types.sql — successor is the RAG report to run instead.
# imc_rag_deep_market_showcase: applied/20260621_03_imc_deactivate_deep_market_showcase_repair.sql
LEGACY_IMC_TYPE_SUCCESSORS: dict[str, str] = {
    "imc_competitive_landscape": "imc_rag_competitive",
    "imc_audience_deep_dive": "imc_rag_target_audience",
    "imc_gtm_channels": "imc_rag_channel_partner_rf",
    "imc_pricing_packaging": "imc_rag_pricing_packaging_rf",
    "imc_content_messaging": "imc_rag_marketing_gtm_plan",
    "imc_brand_positioning": "imc_rag_positioning_messaging",
    "imc_rag_deep_market_showcase": "imc_rag_cabinet_analysis",
    # 20260621_imc_rag_research_types_curated.sql — сняты с кабинета, rerun через successor:
    "imc_rag_stakeholder_decision_raci": "imc_rag_cabinet_analysis",
    "imc_rag_cx_service_ops_recovery": "imc_rag_cx_journey",
    "imc_rag_customer_diagnostic_answers": "imc_rag_customer_diagnostic",
    "imc_rag_rf_operating_context": "imc_rag_trends_signals",
    "imc_rag_brand_identity_compliance": "imc_rag_positioning_messaging",
    "imc_rag_content_comms_strategy": "imc_rag_marketing_gtm_plan",
}


def successor_for_deprecated_imc_type(type_key: str) -> str | None:
    k = (type_key or "").strip()
    return LEGACY_IMC_TYPE_SUCCESSORS.get(k)
