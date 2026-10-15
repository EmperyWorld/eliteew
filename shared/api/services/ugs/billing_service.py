#!/usr/bin/env python3
"""
🔥 BILLING SERVICE 🔥
Управление кредитами и лимитами использования в UGS (Unified Generation System)

Основные функции:
- Проверка лимитов и доступных кредитов
- Списание кредитов за генерации
- Возврат кредитов при отмене
- Отчетность по использованию
"""

# Critical Info:
# - Управляет лимитами и очисткой зависших заявок перед запуском генераций UGS.
# - Требует активного подключения к PostgreSQL и использует таблицы generation_requests/generation_queue.
# - release_stale_requests должен вызываться перед выдачей новых слотов, особенно для текстовых типов (тайм-аут 5 мин).

from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.services.ugs.billing.limits import LimitsMixin
from api.services.ugs.billing.packages import PackagesMixin


class BillingService(LimitsMixin, PackagesMixin):
    """
    🔥 SERVICE FOR BILLING MANAGEMENT 🔥
    Управляет кредитами пользователей и лимитами использования

    Thin facade: LimitsMixin → StatsMixin → CreditsMixin; plus PackagesMixin.
    """

    def __init__(self, db: AsyncSession):
        self.db = db

        # Конфигурация лимитов (можно вынести в настройки)
        self.default_limits = {
            "daily_credits": 10000,
            "monthly_credits": 10000,
            "concurrent_requests": 20,  # одновременных запросов - increased for better UX
        }
