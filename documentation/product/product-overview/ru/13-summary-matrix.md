# Сводная матрица (Хост | DIY | EliteEW)

Сжатие уже написанных глав; без новых обещаний.

| Ось | Хост | DIY | EliteEW | Глава |
|-----|------|-----|---------|-------|
| Роль в день | Хост-ОС + apps | Хост-ОС + packages | Рабочий **слой** поверх хоста | P1 |
| Shadow IT | Личные apps рядом | То же | Контур чата/файлов/ИИ | P2 |
| Endpoint-агент на BYOD | Типичен для DLP | Типичен | **Без** admin-агента на личной ОС | P2a |
| НПА / аттестация | Отдельный контур | Отдельный | Помогает контуру; **не** аттестат | P3 |
| День сотрудника | Разрозненный SaaS | То же | Один swimlane | P3a |
| Отрасль организация | Вертикали | DIY | Профили акцента | P3b |
| Исходники / экземпляр | Закрытая ОС | Ядро open | MIT-дар · self-host | P3c |
| Дар vs сопровождение | — | DIY | Код открыт; сопровождение опционально | P3e |
| Приёмка у себя | Volume / image | Distro + пакеты | Commit/tag + сборка + SBOM · Day‑0…90 | P3f |
| SI / миграция | Change apps | DIY cutover | Волны M0–M5 · PoC по реальным возможностям | P3g |
| Структура затрат | Лицензии+агенты | ФОТ DIY | Структура · Discovery | P3d |
| Файлы | Диск/облако | FS/DIY | PG + object store + ACL | P4a |
| Collab docs | 365 / сторонние | self-host офисный пакет DIY | Редактор контура | P4b |
| ИИ | Внешний чат | DIY LLM | EWA **≠** Experts | P5 |
| Роли | каталог учёток группы | LDAP DIY | Собственник/лид/участник | P5a |
| Генерации | Внешние SaaS | DIY GPU | Энергия / квоты | P5b |
| Mobile | MDM apps | То же | Спутник · subset | P7e |
| E2EE чат | Signal и др. | То же | Opt-in · ключ на телефоне | P7c |
| Edge доступ | VPN/firewall | DIY | Стена + выданное доверие | P7d |
| Native client | Store/установщик desktop-ОС | RPM/портативная сборка | Tauri + signed OTA | P8 |
| Conditional access | Entra CA | DIY | Atomic native scope | P8a |
| Сервисный доступ | Volume | DIY | Капсула/entitlement; MIT self-host не блокируется | P9a |
| Editions | SaaS/RDS | Self-host | cloud/onprem/client | P10 |
| FoFline air-gap | — | — | **Нет** (local+канал) | P10 |
| Live sealed OS | Image | Live USB | Substrate **target** | P10b |
| Стерильный диск | — | — | Не универсальное обещание | P12 |
| Аналог (фото) | Не закрыт ОС | Не закрыт | Минимизация · не 100% | P12 |

## Индекс one-pagers

| Файл | Аудитория |
|------|-----------|
| [13-onepager-executive.md](13-onepager-executive.md) | Комитет / организация |
| [13-onepager-ciso.md](13-onepager-ciso.md) | ИБ |
| [13-onepager-industry.md](13-onepager-industry.md) | Внедрение / отрасль |
| [13-onepager-dd-rfi.md](13-onepager-dd-rfi.md) | DD / RFI (внедрение + ИБ) |
| [03e-delivery-models.md](03e-delivery-models.md) | Дар миру: как пользоваться |
| [03f-transfer-bom-handover.md](03f-transfer-bom-handover.md) | Принять у себя · артефакты |
| [03g-si-migration-playbook.md](03g-si-migration-playbook.md) | SI · миграция · PoC |
| [glossary.md](glossary.md) | Термины |

**Перед внешней выдачей:** нет IP/портов/client id/ops-CLI; абсолюты ИБ только по [P12](12-honest-limits.md).
