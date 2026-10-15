"""Marketing cabinet domain: tenancy foundation and connected strategy routers."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from fastapi import FastAPI  # type: ignore[import-untyped]


def register_domain_marketing(app: FastAPI) -> None:
    """Register company/project tenancy and marketing cabinet routers."""
    from api.routers.companies import router as companies_router  # noqa: PLC0415
    from api.routers.marketing_cabinet import (  # noqa: PLC0415
        ai_router,
        amka_router,
        analysis_router,
        campaigns_router,
        chat_router,
        client_interaction_router,
        competitors_router,
        customer_diagnostic_router,
        dashboard_layout_templates_router,
        dashboard_router,
        document_autofill_router,
        funnels_router,
        imc_router,
        jtbd_router,
        live_jobs_summary_router,
        operations_router,
        project_rag_sources_router,
        researches_router,
        segments_router,
        value_proposition_router,
    )
    from api.routers.marketing_cabinet import (
        projects_router as marketing_projects_router,
    )
    from api.routers.projects import router as projects_router  # noqa: PLC0415

    app.include_router(
        companies_router,
        prefix="/api/v1",
        tags=["Companies - Tenant Management"],
    )
    app.include_router(
        projects_router,
        prefix="/api/v1",
        tags=["Projects - Tenant Project Management"],
    )
    app.include_router(
        companies_router,
        prefix="/api",
        tags=["Companies - Tenant Management (Legacy)"],
    )
    app.include_router(
        projects_router,
        prefix="/api",
        tags=["Projects - Tenant Project Management (Legacy)"],
    )

    marketing_prefixes = (
        ("/api/v1/marketing-cabinet", False),
        ("/api/marketing-cabinet", True),
    )
    for prefix, legacy in marketing_prefixes:
        legacy_suffix = " (Legacy)" if legacy else ""
        app.include_router(
            marketing_projects_router,
            prefix=prefix,
            tags=[f"Marketing Cabinet - Project Insights{legacy_suffix}"],
        )
        app.include_router(
            dashboard_layout_templates_router,
            prefix=prefix,
            tags=[f"Marketing Cabinet - Dashboard layout templates{legacy_suffix}"],
        )
        app.include_router(
            dashboard_router,
            prefix=prefix,
            tags=[f"Marketing Cabinet - Overview Dashboard{legacy_suffix}"],
        )
        app.include_router(
            jtbd_router,
            prefix=prefix,
            tags=[f"Marketing Cabinet - JTBD{legacy_suffix}"],
        )
        app.include_router(
            value_proposition_router,
            prefix=prefix,
            tags=[f"Marketing Cabinet - Value Proposition{legacy_suffix}"],
        )
        app.include_router(
            analysis_router,
            prefix=prefix,
            tags=[f"Marketing Cabinet - Analysis{legacy_suffix}"],
        )
        app.include_router(
            competitors_router,
            prefix=prefix,
            tags=[f"Marketing Cabinet - Competitors{legacy_suffix}"],
        )
        app.include_router(
            document_autofill_router,
            prefix=prefix,
            tags=[f"Marketing Cabinet - Document Autofill{legacy_suffix}"],
        )
        app.include_router(
            researches_router,
            prefix=prefix,
            tags=[f"Marketing Cabinet - Researches{legacy_suffix}"],
        )
        app.include_router(
            segments_router,
            prefix=prefix,
            tags=[f"Marketing Cabinet - Segments{legacy_suffix}"],
        )
        app.include_router(
            campaigns_router,
            prefix=prefix,
            tags=[f"Marketing Cabinet - Campaigns{legacy_suffix}"],
        )
        app.include_router(
            funnels_router,
            prefix=prefix,
            tags=[f"Marketing Cabinet - Funnels{legacy_suffix}"],
        )
        app.include_router(
            operations_router,
            prefix=prefix,
            tags=[f"Marketing Cabinet - Operations{legacy_suffix}"],
        )
        app.include_router(
            project_rag_sources_router,
            prefix=prefix,
            tags=[f"Marketing Cabinet - Project RAG Sources{legacy_suffix}"],
        )
        app.include_router(
            chat_router,
            prefix=prefix,
            tags=[f"Marketing Cabinet - Context Chat{legacy_suffix}"],
        )
        app.include_router(
            client_interaction_router,
            prefix=prefix,
            tags=[f"Marketing Cabinet - Client interaction{legacy_suffix}"],
        )
        app.include_router(
            customer_diagnostic_router,
            prefix=prefix,
            tags=[f"Marketing Cabinet - Customer diagnostic{legacy_suffix}"],
        )
        app.include_router(
            amka_router,
            prefix=prefix,
            tags=[f"Marketing Cabinet - AMKA{legacy_suffix}"],
        )
        app.include_router(
            ai_router,
            prefix=prefix,
            tags=[f"Marketing Cabinet - AI Studio{legacy_suffix}"],
        )
        app.include_router(
            imc_router,
            prefix=prefix,
            tags=[f"Marketing Cabinet - IMC{legacy_suffix}"],
        )
        app.include_router(
            live_jobs_summary_router,
            prefix=prefix,
            tags=[f"Marketing Cabinet - Live jobs{legacy_suffix}"],
        )
