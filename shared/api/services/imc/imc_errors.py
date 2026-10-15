"""IMC domain errors surfaced to HTTP layer."""


class ImcDeprecatedTypeKeyError(Exception):
    """User referenced a removed IMC generation type; successor_type_key suggests replacement."""

    def __init__(self, *, deprecated_type_key: str, successor_type_key: str) -> None:
        self.deprecated_type_key = deprecated_type_key
        self.successor_type_key = successor_type_key
        super().__init__(
            f"Тип исследования «{deprecated_type_key}» снят с поддержки. "
            f"Выберите в кабинете тип «{successor_type_key}» или эквивалент из списка."
        )


class ImcInsufficientProjectContextError(Exception):
    """imc_rag_project_only run would proceed with no project RAG/PG context."""

    def __init__(self, *, type_key: str) -> None:
        self.type_key = type_key
        super().__init__(
            "Недостаточно контекста проекта для этого типа отчёта: загрузите документы в проект, "
            "включите их в семантический индекс (RAG) и дождитесь индексации, затем повторите запуск."
        )
