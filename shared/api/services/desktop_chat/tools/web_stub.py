"""Web search tool (stub): external search stack disabled."""

TOOL_NAME = "desktop_web_search"
LLAMA_TOOL = {
    "type": "function",
    "function": {
        "name": TOOL_NAME,
        "description": "Поиск в интернете по запросу. В текущем контуре может быть отключён.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Поисковый запрос"},
            },
            "required": ["query"],
        },
    },
}


def run_stub(query: str, *, enabled: bool) -> str:
    q = (query or "").strip()
    if not enabled:
        return (
            "Веб-поиск отключён в конфигурации оператора (нет интеграции SearXNG/Crawl4AI в этом контуре). "
            f"Запрос не выполнен: {q[:200]!r}"
        )
    return (
        "Веб-поиск в этом контуре не подключён к внешним поисковикам; верни пользователю, что нужны локальные "
        f"данные или вложения. Запрос: {q[:200]!r}"
    )
