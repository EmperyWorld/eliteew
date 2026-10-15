# P10 — Editions: cloud / on-prem / client

**Схема:** [D08](../assets/diagrams/D08-editions.md)  
**FoFline:** ≠ air-gap (ниже)

## Три формы одного продукта

| Edition | Кто держит инфраструктуру | Смысл |
|---------|---------------------------|-------|
| **Cloud** | Hosted-контур | Работа в общем hosted-слое (доступ к месту — отдельно от MIT) |
| **On-prem** | Организация | Self-host дара по MIT или контур с опциональным сопровождением |
| **Client** | В основном устройство | Offline-capable subset; remote tools — по allowlist и entitlement |

**Не обещаем:** «on-prem — одна кнопка для любого без профиля».

## FoFline (client-adjacent)

Свободный **локальный** пакет + опциональный защищённый канал к тому же API.
Локальный self-host профиль запускается **без** сервисной капсулы; hosted /
доверенный канал может требовать entitlement. **Не** чистый air-gap.
**Не** второй независимый backend.

Foundation (entitlement, SSO, shell OTA, local Start) — shipped.
Остаточный live-smoke / pack parity не маскируем под «Done» для всего контура.
