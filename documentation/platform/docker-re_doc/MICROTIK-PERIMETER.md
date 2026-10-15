# MikroTik и периметр EliteEW

Шаблон периметра: **один внешний вход для пользователей** — трафик из интернета приходит только на **edge VM в Yandex**, дальше **nginx → Meet WG HTTP backhaul (primary) / SSH reserve → prod-core `.111`**. Прямой **dst-nat с WAN MikroTik на сервер приложений** не использовать. Канон backhaul: [WG-HTTP-BACKHAUL-PRIMARY.md](WG-HTTP-BACKHAUL-PRIMARY.md).

## Принципы

1. **Нет двойного «дырявого» края**: не открывать одновременно публичный NAT на приложение и туннель без явного разделения ролей.
2. **SSH к VM Yandex**: разрешён с исходящего IP Server1 (security group облака); с интернета на Server1 SSH **не** нужен для публикации приложения.
3. **Jitsi медиа (JVB UDP/TCP)**: если клиенты из интернета должны иметь медиа напрямую, это отдельная глава NAT/firewall и **не** смешивается с моделью «только UI через туннель». Для LAN-only медиа — достаточно правил внутри сети; см. **`JITSI-MEET-YANDEX-REVERSE-TUNNEL.md`**, заголовок **`docker/stack/stack11.yml`** (порты **34000/udp**, **34001/tcp**).

## Связанные документы

- **`platform/docker-re_doc/YANDEX-VM-SSH-TUNNEL.md`**
- **`platform/docker-re_doc/INTERNAL-DNS.md`** (CoreDNS только внутренние зоны)
- **`platform/DOCKER-STACKS-PROD-OVERVIEW.md`**
