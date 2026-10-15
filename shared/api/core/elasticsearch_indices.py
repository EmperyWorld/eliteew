"""
Single source of truth for Elasticsearch index names.

Service -> index mapping (used by document_search_service, elasticsearch_service,
business_intelligence.elasticsearch_service, unified_content.content_search_service).
See STACK1_DATABASE_AUDIT_REPORT.md "Elasticsearch: маппинг сервис → индекс".
"""

# Document search (document editor, general docs)
INDEX_DOCUMENTS = "eliteew_documents"

# Legacy document search index (Elasticsearch). Rename / reindex cluster-side to match when ready.
INDEX_EMPERYWORLD_DOCUMENTS = "emperyworld_documents"

# Business Intelligence (BI Airflow, analyses)
INDEX_BUSINESS_DOCUMENTS = "business_documents"
INDEX_BUSINESS_ANALYSES = "business_analyses"
INDEX_BUSINESS_SESSIONS = "business_sessions"

# Unified content (content manager, storage search)
INDEX_UNIFIED_CONTENT = "unified_content"

# Config-style indices (database_manager / index manager)
INDEX_LOGS = "eliteew_logs"
INDEX_CHATS = "eliteew_chats"
INDEX_METRICS = "eliteew_metrics"

# Registry for documentation and tooling
SERVICE_TO_INDEX: dict[str, str] = {
    "document_search": INDEX_DOCUMENTS,
    "elasticsearch_service_emperyworld": INDEX_EMPERYWORLD_DOCUMENTS,
    "business_intelligence": INDEX_BUSINESS_DOCUMENTS,
    "business_intelligence_analyses": INDEX_BUSINESS_ANALYSES,
    "business_intelligence_sessions": INDEX_BUSINESS_SESSIONS,
    "unified_content_search": INDEX_UNIFIED_CONTENT,
}
