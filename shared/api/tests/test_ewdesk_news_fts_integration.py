# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Optional Postgres integration test for EWDesk full-text search_vector column.
# Invariants:
# - Skips when DATABASE_URL is unset or search_vector column is missing.
# Related:
# - api/migrations/applied/20260528_ewdesk_news_search_vector.sql
# ---
from __future__ import annotations

import asyncio
import os

import pytest

from api.services.product_desktop.ewdesk_news_contract import news_fulltext_search_params


@pytest.mark.integration
def test_ewdesk_search_vector_plainto_tsquery_on_postgres() -> None:
    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        pytest.skip("DATABASE_URL not set")

    async def body() -> None:
        import asyncpg

        conn = await asyncpg.connect(dsn)
        try:
            has_column = await conn.fetchval(
                """
                SELECT EXISTS (
                  SELECT 1
                  FROM information_schema.columns
                  WHERE table_name = 'company_news_posts'
                    AND column_name = 'search_vector'
                )
                """
            )
            if not has_column:
                pytest.skip("company_news_posts.search_vector not migrated")

            params = news_fulltext_search_params("новости")
            count = await conn.fetchval(
                "SELECT COUNT(*)::int FROM company_news_posts WHERE search_vector @@ plainto_tsquery($1, $2)",
                params["ts_config"],
                params["search"],
            )
            assert isinstance(count, int)
            assert count >= 0
        finally:
            await conn.close()

    asyncio.run(body())
