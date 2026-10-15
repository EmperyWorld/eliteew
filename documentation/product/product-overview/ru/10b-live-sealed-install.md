# P10b — Live-носитель и sealed install

## Тезис

| Носитель | Смысл | Честный статус |
|----------|--------|----------------|
| **Sealed capsule / seat** | Файл доступа к месту (P9a) | Актуальный путь выдачи доступа для desktop-клиента |
| **Live USB / metal install** | Загрузочный носитель → установка sealed OS-носителя (Trusted Substrate) | Целевой контур разработки; массовый sealed-образ у всех организаций не заявляется |
| **Постоянная установка** | Kiosk-class OS + payload EliteEW | Target end-state; bootstrap payload может отличаться от финального Tauri |

**Не обещаем:** live USB = готовый air-gap без канала · Substrate = замена Connection Agent · «уже полностью заменил Fedora kiosk у Empery».

Сравнение «хост / DIY / EliteEW» — кратко в [P1](01-what-is-eliteew.md); границы обещаний — [P12](12-honest-limits.md).
