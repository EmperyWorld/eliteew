"""
🔥 WEB SEARCH SERVICE 🔥
Клиент для Termux Search API (веб-поисковик)

Интеграция с API веб-поиска для МИСО (Маркетинговый Исследователь Создатель Онлайн)

Features:
✅ Поиск через Bing/Brave
✅ Поиск по конкретным сайтам
✅ Presets для разных типов контента
✅ Кэширование результатов
✅ Обработка ошибок

Created: 2025-01-XX
Version: 1.0.0
"""

import logging
from typing import Any

import httpx  # type: ignore[import-not-found]

logger = logging.getLogger(__name__)


class WebSearchService:
    """
    🔥 WEB SEARCH SERVICE 🔥

    Клиент для Termux Search API
    Base URL: http://192.168.1.61:8080
    """

    def __init__(self, base_url: str = "http://192.168.1.61:8080"):
        """Initialize web search service"""
        self.base_url = base_url.rstrip("/")
        self.client: httpx.AsyncClient | None = None
        self.timeout = httpx.Timeout(30.0, connect=10.0)

        # Presets для поиска по сайтам
        self.presets = {
            "programming": ["stackoverflow.com", "github.com", "developer.mozilla.org"],
            "news": ["bbc.com", "reuters.com", "apnews.com"],
            "tech": ["techcrunch.com", "theverge.com", "wired.com"],
            "russian": ["vc.ru", "habr.com", "rb.ru"],
            "ai_ml": ["arxiv.org", "huggingface.co", "paperswithcode.com"],
        }

    async def initialize(self) -> None:
        """Initialize HTTP client"""
        if not self.client:
            self.client = httpx.AsyncClient(
                timeout=self.timeout,
                limits=httpx.Limits(max_keepalive_connections=5, max_connections=10),
            )
        logger.info("Web Search Service initialized at %s", self.base_url)

    async def close(self) -> None:
        """Close HTTP client"""
        if self.client:
            await self.client.aclose()
            self.client = None

    async def get_status(self) -> dict[str, Any]:
        """
        Проверка статуса сервера

        Returns:
            (dict[str, Any]) с информацией о статусе
        """
        try:
            if not self.client:
                await self.initialize()

            if not self.client:
                msg = "WebSearchService client not initialized"
                raise RuntimeError(msg)
            response = await self.client.get(f"{self.base_url}/status")
            response.raise_for_status()
            status_data = response.json()
            return dict(status_data) if isinstance(status_data, dict) else {}
        except Exception:
            logger.exception("Failed to get search service status: ")
            raise

    async def search(self, query: str, engine: str = "bing", max_results: int = 10) -> dict[str, Any]:
        """
        Основной поиск через поисковую систему

        Args:
            query: Поисковый запрос
            engine: Поисковая система (bing, brave)
            max_results: Максимальное количество результатов

        Returns:
            (dict[str, Any]) с результатами поиска:
            {
                "status": "success",
                "query": "...",
                "engine": "...",
                "results_count": 8,
                "results": [...]
            }
        """
        try:
            if not self.client:
                await self.initialize()

            payload = {"query": query, "engine": engine, "max_results": max_results}

            if not self.client:
                msg = "WebSearchService client not initialized"
                raise RuntimeError(msg)
            logger.info("Searching: '%s' via %s", query, engine)
            response = await self.client.post(f"{self.base_url}/search", json=payload)
            response.raise_for_status()
            result = response.json()
            result_dict = dict(result) if isinstance(result, dict) else {}
            logger.info("Found %s results for '%s'", result_dict.get("results_count", 0), query)
            return result_dict

        except httpx.HTTPStatusError as e:
            logger.exception(
                "❌ HTTP error during search: %s - %s",
                e.response.status_code,
                e.response.text,
            )
            raise
        except Exception:
            logger.exception("Search failed: ")
            raise

    async def search_sites(
        self,
        query: str,
        sites: list[str] | None = None,
        preset: str | None = None,
        max_results: int = 15,
    ) -> dict[str, Any]:
        """
        Поиск по конкретным сайтам

        Args:
            query: Поисковый запрос
            sites: Список доменов для поиска
            preset: Предустановленный набор сайтов (programming, news, tech, russian, ai_ml)
            max_results: Максимальное количество результатов

        Returns:
            (dict[str, Any]) с результатами поиска по сайтам
        """
        try:
            # Проверка query перед отправкой запроса
            if not query or not query.strip():
                logger.warning("Empty query provided to search_sites, returning empty results")
                return {
                    "status": "error",
                    "query": query or "",
                    "sites": sites,
                    "preset": preset,
                    "results_count": 0,
                    "results": [],
                    "error": "No query provided",
                }

            if not self.client:
                await self.initialize()

            # Использовать preset если указан
            if preset and preset in self.presets:
                sites = self.presets[preset]
                logger.info("Using preset '%s': %s", preset, sites)
            elif not sites:
                msg = "Either 'sites' or 'preset' must be provided"
                raise ValueError(msg)

            payload = {"query": query.strip(), "sites": sites, "max_results": max_results}

            if preset:
                payload["preset"] = preset

            if not self.client:
                msg = "WebSearchService client not initialized"
                raise RuntimeError(msg)
            logger.info("Searching sites: '%s' on %s sites", query, len(sites))
            response = await self.client.post(f"{self.base_url}/search_sites", json=payload)

            # Если endpoint не найден (404), возвращаем пустой результат
            if response.status_code == 404:
                logger.warning("search_sites endpoint not found (404), returning empty results")
                return {
                    "status": "success",
                    "query": query,
                    "sites": sites,
                    "preset": preset,
                    "results_count": 0,
                    "results": [],
                }

            response.raise_for_status()
            result = response.json()
            result_dict = dict(result) if isinstance(result, dict) else {}
            logger.info("Found %s results on sites", result_dict.get("results_count", 0))
            return result_dict

        except httpx.HTTPStatusError as e:
            # Для других HTTP ошибок тоже возвращаем пустой результат вместо падения
            logger.exception(
                "❌ HTTP error during site search: %s - %s",
                e.response.status_code,
                e.response.text,
            )
            return {
                "status": "error",
                "query": query,
                "sites": sites,
                "preset": preset,
                "results_count": 0,
                "results": [],
                "error": f"HTTP {e.response.status_code}",
            }
        except Exception as e:
            logger.exception("Site search failed: ")
            # Возвращаем пустой результат вместо падения
            return {
                "status": "error",
                "query": query,
                "sites": sites,
                "preset": preset,
                "results_count": 0,
                "results": [],
                "error": str(e),
            }

    async def browser_search(self, query: str, engine: str = "bing") -> dict[str, Any]:
        """
        Открыть поиск в браузере на устройстве (для отладки)

        Args:
            query: Поисковый запрос
            engine: Поисковая система

        Returns:
            (dict[str, Any]) с информацией о запросе
        """
        try:
            if not self.client:
                await self.initialize()

            payload = {"query": query, "engine": engine}

            if not self.client:
                msg = "WebSearchService client not initialized"
                raise RuntimeError(msg)
            response = await self.client.post(f"{self.base_url}/browser_search", json=payload)
            response.raise_for_status()
            result = response.json()
            return dict(result) if isinstance(result, dict) else {}

        except Exception:
            logger.exception("Browser search failed: ")
            raise
