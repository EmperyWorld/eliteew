# Internal DNS EliteEW (stack12 CoreDNS)

Операторский канон после жёсткого режима «без утечки на публичные резолверы» (`docker/scripts/internal-sites/coredns/Corefile`, [MICROTIK-PERIMETER.md](MICROTIK-PERIMETER.md)).

## Назначение

- Авторитетно обслуживать зоны **`sites.eliteew.ru`** (и split-horizon вариант **`*.vpn.db`**) из файлов в `docker/scripts/internal-sites/coredns/`.
- **Не** выполнять рекурсию и **не** форвардить на 1.1.1.1 / 8.8.8.8 и т.п.
- Запросы вне известных зон — **NXDOMAIN** (плагин `template` в конце цепочки).

## Compose

```bash
docker compose -f docker/stack/stack12.yml --env-file docker/env_file/.env.stack12 up -d
```

WireGuard **не** входит в `stack12.yml` с 2026-05 (VPN — отдельно: MikroTik, хост или VPS-хаб; см. **`MICROTIK-PERIMETER.md`**, **`INTERNAL-SITES-ACCESS.md`**).

## Проверка

С хоста или клиента LAN, подставив IP из `INTERNAL_DNS_BIND_ADDRESS`:

```bash
dig @<dns-ip> app.eliteew.ru A +short
dig @<dns-ip> google.com A +short
```

Ожидание: первая команда даёт записи из ваших zone-файлов; вторая — **NXDOMAIN** и **нет** ответов с публичных NS (можно сравнить с `dig @8.8.8.8 google.com` с другого узла).

## View `vpn-clients`

Выражение `incidr(client_ip(), …)` в **`Corefile`** нужно поддерживать в актуальном виде под ваши VPN/LAN подсети. После SNAT до `INTERNAL_DNS_BIND_ADDRESS` добавьте соответствующий `/32`, иначе клиент попадёт в «не тот» view.

## Связанные документы

- **`platform/docker-re_doc/INTERNAL-SITES-ACCESS.md`**
- **`platform/docker-re_doc/SEGMENTATION.md`** (хостовый nftables к `ew_net_*`)
- **`platform/docker-re_doc/MICROTIK-PERIMETER.md`**
