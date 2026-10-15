"""
Redis DB allocation for stack2 (AI services) and other caches.

Каждому потребителю — отдельная база для изоляции и независимой инвалидации.
Stack1-redis: 16 DB (0–15). Заняты: 0,1,2,3,4,11,14,15.
Свободные для stack2-кэшей: 5, 6, 7, 8, 9, 10, 12, 13.
"""

# Stack2 (Llama, ComfyUI, BI Airflow) — отдельная база на сервис
REDIS_DB_LLAMA_CACHE = 5  # Список моделей /api/tags, реже запросы к stack2-llama
REDIS_DB_COMFYUI_CACHE = 6  # Checkpoints, object_info — реже запросы к stack2-comfyui
REDIS_DB_BI_AIRFLOW_CACHE = 7  # Результаты Llama-анализа в BI Airflow (зарезервировано)

# TTL для stack2-кэшей (секунды)
STACK2_CACHE_TTL_LLAMA_MODELS = 300  # 5 мин
STACK2_CACHE_TTL_COMFYUI_CHECKPOINTS = 300  # 5 мин
