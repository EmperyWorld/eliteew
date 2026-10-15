# Пошагово: Keenetic + MikroTik (текущая схема)

**Зафиксировано:** второй кабель **Keenetic ↔ ether5** **не** используется. Весь Keenetic ходит в дом и в интернет **только через WAN → MikroTik ether10** (**192.168.50.x**).

**Не путать контуры VPN:**

| Контур | Роль | Канон |
|--------|------|--------|
| **Meet WG** `10.77.77.0/24` | Public HTTP backhaul edge↔prod-core + Meet media | [docker-re_doc/WG-HTTP-BACKHAUL-PRIMARY.md](docker-re_doc/WG-HTTP-BACKHAUL-PRIMARY.md) |
| **Keenetic WireGuard** (опционально) | Home/operator VPN «только app» к **`.136:80/443`** | этот runbook §6 |
| **OpenVPN / SSTP / L2TP** | Не primary; компоненты на Keenetic **не** ставить | [KEENETIC-VPN-APP-ONLY-SETUP.md](KEENETIC-VPN-APP-ONLY-SETUP.md) §компоненты |

Исторический «VPS WireGuard hub» / OpenVPN home stacks — soft-retired или вне living канона; публичный вход = edge + Meet WG (SSH reverse = reserve).

---

## 1. Физика (актуально с 2026-07-03)

| Порт MikroTik | Что воткнуто | L3 на MikroTik |
|---------------|----------------|----------------|
| **ether1** | Провайдер WAN1 (ISP) | DHCP `10.32.4.x/23` → table `to_isp1` (primary для `.111`/`.136`) |
| **ether2** | **192.168.1.136** command-center | `bridge` **192.168.1.0/24** |
| **ether3** | **192.168.1.141** gpu141 | `bridge` **192.168.1.0/24** |
| **ether4** | **192.168.1.111** prod-core (сейчас **RTL8125** `enp5s0` MAC `30:C5:99:B5:A3:DD` → MikroTik) | `bridge` **192.168.1.0/24**. **Запрещено** менять `ether4` MAC на MAC хоста — вызывает `bridge RX looped packet` (HW видит src=port MAC). Factory MAC порта: `04:F4:1C:9F:36:B0`. Former **2.5G direct** `10.255.136.0/24` to `.136` — **retired**. |
| **ether5** | WAN5 MeagaON / mega_fon (второй uplink) | DHCP `client2` + GW `192.168.22.22%ether5`; **не** в LAN bridge. За GW — **Netcraze Hero 5G** (`192.168.22.22`, LTE Megafon → публичный IP пула AS31133, напр. `178.177.234.251`). |
| **ether8** | Оператор (trusted) | `br-trusted8` **192.168.8.9/30** → клиент **.10** → table `prefer_ether5` |
| **ether9** | Резерв admin | `br-admin` **192.168.9.1/30** → клиент **.2** |
| **ether10** | **Keenetic** (Wi‑Fi, изолирован от main LAN) | `br-guest` **192.168.50.198/31** → Keenetic **.199** → table `prefer_ether5` |

**Серверный LAN** — один `bridge` **192.168.1.0/24** (`.136`, `.141`, `.111`); DHCP на bridge **выключен**, IP статические.

**Изолированные порты** — не `/24`, а **point-to-point**: `/30` или `/31`, **один IP на устройство** (DHCP pool из одного адреса).

На MikroTik **не** должно остаться моста **`br-vpn-keenetic`** и адреса **192.168.60.1** на отдельном интерфейсе MT — Wi‑Fi **192.168.60.x** задаёшь **только на Keenetic**.

---

## 2. MikroTik — что уже должно быть (не ломай)

- **bridge** **192.168.1.1/24**: серверы на **ether2/3/4** (`.136`, `.141`, `.111`).
- **br-guest** на **ether10**: **192.168.50.198/31**, Keenetic WAN **192.168.50.199** (static lease).
- **br-trusted8** на **ether8**: **192.168.8.9/30**, оператор **192.168.8.10**.
- **br-admin** на **ether9** (резерв): **192.168.9.1/30**, клиент **192.168.9.2** при подключении.
- **DNS на MikroTik:** `77.88.8.8`, `1.1.1.1` (`/ip dns`); WAN DHCP **use-peer-dns=no**.
- **NTP на MikroTik:** `Asia/Vladivostok` (+10); клиент → **реальные NTP** `162.159.200.1` (Cloudflare) + `216.239.35.0` (Google), `/32` через ether1. **Не** использовать `1.1.1.1`/`8.8.8.8` как NTP (это DNS; ответы NTP не приходят → status `waiting`).
- **DNS на серверах `.136/.111/.141`:** не `1.1.1.1` — см. `docker/scripts/lan-workers/set-lan-dns-yandex.sh`.
- В **firewall** есть **accept** с **192.168.1.136** на **192.168.50.199:80,443** (веб Keenetic с сервера).
- Правила **guest ↔ main** (Keenetic WAN **192.168.50.199** не в **192.168.1.x**, кроме явных исключений).
- **Исключение (2026-08-24):** guest/Keenetic **`192.168.50.199` → `192.168.1.136` TCP `5180`,`8080`** (accept выше `guest to main blocked`). Скрипт: [`mikrotik-ether10-to-136-5180-8080.rsc`](../../docker/scripts/vps-wg-hub/mikrotik-ether10-to-136-5180-8080.rsc). На `.136` сервис должен слушать порт (иначе forward бесполезен).
- Зона **br-web** / **192.168.4.x** **снята** (не использовалась).
- **Management MikroTik (канон):** SSH / www / winbox — **только `192.168.8.10`** (ether8). Скрипт: [`mikrotik-mgmt-only-192.168.8.10.rsc`](../../docker/scripts/vps-wg-hub/mikrotik-mgmt-only-192.168.8.10.rsc). **Временно (сессия 2026-08-24):** input-drop `SSH only from 192.168.8.10` и `mgmt TCP only from 192.168.8.10` могут быть **disabled**, `/ip service ssh` + user `time` допускают `.136` — после работ вернуть enable drop и `address=192.168.8.10/32`.

### WAN failover (policy routing)

Два независимых контура (не путать приоритеты):

| Источник | Routing table | Primary | Failover |
|----------|---------------|---------|----------|
| `.111`, `.136` | `to_isp1` | **ether1** (DHCP `client1`, distance 1) | **ether5** recursive: `0.0.0.0/0 → 8.8.4.4` → `192.168.22.22%ether5` (distance 20; `22.22` = Meaga device) |
| ether8 `192.168.8.8/30`, ether10 `192.168.50.198/31` | `prefer_ether5` | **ether5** recursive: `→ 8.8.8.8` → `192.168.22.22%ether5` (d=1) | **ether1** recursive: `→ 1.1.1.1` → DHCP GW `%ether1` (d=20) |

Детали `prefer_ether5`:

- Probe-маршруты `/32` лежат в **`main`** (иначе `check-gateway=ping` из policy table не резолвится).
- `check-gateway=ping` бьёт в **интернет-probe** (`8.8.8.8` / `1.1.1.1`), не только в локальный GW.
- DHCP `client1` script при bind/renew обновляет `probe-ether1-prefer` (GW провайдера не захардкожен навечно).
- Firewall: явный **guest/keenetic to internet** (`192.168.50.199` → `WAN`), зеркало trusted8.

Правила выше по списку оставляют RFC1918 (`192.168.0.0/16`, `172.16.0.0/12`) в `main`.  
Скрипт: [`mikrotik-prefer-ether5-for-8-10.rsc`](../../docker/scripts/vps-wg-hub/mikrotik-prefer-ether5-for-8-10.rsc).

Проверка live:

```routeros
/ip route print where routing-table=prefer_ether5
/ip route print where comment~"probe-ether"
/routing rule print
/ping 1.1.1.1 count=3
```

Ожидание при **ether5 down**: в `prefer_ether5` активен failover `→ 1.1.1.1` (через ether1).  
При **ether5 up** и живом интернете через Meaga: primary `→ 8.8.8.8` distance 1.

### MeagaON (192.168.22.22) — anti-abuse на Megafon egress

**Устройство:** Netcraze Hero 5G (NDMS), CLI telnet **порт 22** (не SSH). Единственный активный L3-клиент Home — **MikroTik RB4011** `192.168.22.50` (MAC `04:f4:1c:9f:36:b1`).

**Симптом (2026-08-29):** публичный Megafon IP в **Spamhaus XBL** (+ PBL/Barracuda/UCEPROTECT L2/L3). Prod (`.111`/`.136`) исходят через **Podryad** (`217.150.75.33`), не через Meaga. Причина XBL — трафик **guest/Keenetic → prefer_ether5 → ether5 → Meaga → Megafon** (в т.ч. SOCKS `:1080`).

**Cause-layer (Meaga, living):**

| Правило | Назначение |
|---------|------------|
| ACL `EGRESS_ABUSE_GUARD` on `Home` + `Bridge1` **in** | drop TCP **25, 465, 587, 1080, 3128** → WAN |
| `ip telnet` **security-level private** | CLI только с private-сегментов, не из интернета |

Сохранение: `system configuration save` после правок CLI.

**MikroTik (с ether8 `192.168.8.10`):** [`mikrotik-ether5-egress-abuse-guard.rsc`](../../docker/scripts/vps-wg-hub/mikrotik-ether5-egress-abuse-guard.rsc) — mirror drop на `forward out-interface=ether5` для тех же портов.

**Delist:** после 24–48 ч без SMTP/proxy через Megafon — [check.spamhaus.org](https://check.spamhaus.org) для XBL; PBL на ISP/cloud — политический, не блокер для prod (SMTP = `mail.hosting.reg.ru`).

Проверка:

```routeros
/ip dhcp-server lease print where server~"guest"
```

Запомни IP Keenetic (**192.168.50.X**) — нужен для проброса WireGuard с WAN.

Бэкап перед правками:

```routeros
/export hide-sensitive file=backup-$(/system clock get time)
```

---

## 3. Keenetic — первый запуск (веб)

1. Подключись к Keenetic (**Wi‑Fi** с наклейки или **LAN** порт к ноуту).
2. Пройди **мастер**: задай пароль админа, **часовой пояс**.
3. **Интернет (WAN):** тип **Ethernet** / **получить IP автоматически** (DHCP) — кабель в **ether10** MikroTik → Keenetic получает **192.168.50.199** (шлюз **192.168.50.198**, `/31`).
4. Убедись, что **интернет есть** (страница проверки в мастере или ping).

---

## 4. Keenetic — компоненты

Минимум: **Wi‑Fi**, **DHCP**, **WireGuard VPN** + **WireGuard VPN-сервер**.
**UPnP — не** включать. **SSH** — по желанию. Подробнее: раздел «Компоненты» в [KEENETIC-VPN-APP-ONLY-SETUP.md](KEENETIC-VPN-APP-ONLY-SETUP.md).

---

## 5. Keenetic — твои сегменты (в веб-интерфейсе)

Настраиваешь **на самом Keenetic** (не на MikroTik):

| Сеть | Назначение | Кратко |
|------|------------|--------|
| **192.168.60.0/24** | Wi‑Fi рабочего ноута, **интернет** | Это **внутренняя** сеть + NAT в **WAN**; **не** «второй WAN». |
| **192.168.70.x** (шлюз **.1**) | IoT EWHome, доступ к **192.168.1.136** | См. **§5.1** — сегмент, маршрут, фаервол. |
| **172.16.2.x** | Админка только настройки Keenetic | Без выхода в интернет, если так задумано. |

### 5.1 Сегмент 192.168.70.0/24 (EWHome, шлюз 192.168.70.1)

**Где в веб-интерфейсе (KeeneticOS):** страница **«Мои сети и Wi‑Fi»** / **My networks and Wi‑Fi** → кнопка **«+»** — **добавить сегмент** (см. [Network segments](https://support.keenetic.com/eu/skipper-dsl/kn-2112/en/14628-network-segments.html)). Имя, например: **EWHome**.

1. **Адресация:** подсеть **192.168.70.0**, маска **255.255.255.0**. IP роутера в этом сегменте (**шлюз для клиентов**) — **192.168.70.1** (Keenetic сам назначает себе первый адрес сегмента — проверь в настройках сегмента).
2. **DHCP:** пул, например **192.168.70.2–192.168.70.200**.
3. **Wi‑Fi:** привяжи к этому сегменту отдельный **SSID** (только IoT). При необходимости включи **изоляцию клиентов** в настройках этой Wi‑Fi-сети (устройства не видят друг друга), если политика это допускает.
4. **Доступ в «дом» MikroTik (192.168.1.136):** подсеть **192.168.1.0/24** находится **за** WAN Keenetic (у тебя WAN — **192.168.50.x** на **MikroTik br-guest**). Без маршрута трафик к **192.168.1.x** не пойдёт правильно. Добавь **статический маршрут**:
   - **Назначение:** **192.168.1.0/24**
   - **Шлюз:** **192.168.50.198** (адрес **MikroTik** на **br-guest** `/31`; Keenetic WAN **192.168.50.199**)

   Раздел в веб-интерфейсе: **Интернет** → **Маршруты** / **Static routes** (или **Маршрутизация** — зависит от версии NDMS).

5. **На MikroTik** должно быть разрешено **forward** с **192.168.50.199** (WAN Keenetic) к **192.168.1.136** на нужные **TCP/UDP** порты.

**Фаервол Keenetic — только к 136 и не «весь интернет»**

- Между **основной** домашней сетью и **дополнительным** сегментом по умолчанию обмен **запрещён**; для **доступа к хосту в другой подсети** используют **правила межсетевого экрана** ([Firewall](https://support.keenetic.com/eu/skipper-dsl/kn-2112/en/15597-firewall.html)). Для **доступа к 192.168.1.136** (не из «своей» подсети Keenetic, а **через** шлюз **192.168.50.1**) логика та же: **разрешающие** правила **выше** запрещающих.
- В настройках **сегмента** EWHome задай политику **интернета:** **запретить** или **ограничить** (если в интерфейсе есть «не пускать в интернет» / лимиты — так и задумано для IoT). Официальная справка: у сегмента можно **ограничить или полностью запретить доступ в интернет**.
- Затем **Добавить правило** фаервола (интерфейс — **входящий** трафик с **сегмента EWHome** / «домашняя сеть EWHome»): **Разрешить**, протокол **TCP** (и отдельно **UDP**, если нужен **NTP** и т.д.), **назначение** **192.168.1.136**, порты по списку (пример: **80, 443** — веб/API; **1883** — MQTT; остальное — по факту сервисов на **136**).
- Общий запрет «в интернет» для сегмента оставь **ниже** или включи запрет по умолчанию и **исключения** только для **136** — как удобнее в твоей версии NDMS (**важно:** запрещающие правила не должны перекрывать разрешение к **136**).

**Замечание про NAT:** в справке Keenetic указано, что часть правил учитывает адреса **после** NAT; для трафика **внутри сегмента → 192.168.1.136** указывай **внутренние** адреса (**192.168.70.x** → **192.168.1.136**). Если что-то не матчится — смотри [Firewall CLI](https://support.keenetic.com/eu/skipper-dsl/kn-2112/en/22346-configuring-firewall-rules-from-the-command-line-interface.html) или точные примеры для твоей версии OS.

**Порты на 136** согласуй с реальными сервисами: не открывай весь **192.168.1.0/24**, только **136** и нужные порты.

---

## 6. WireGuard на Keenetic (вторая точка входа к app)

1. **Сервер WireGuard:** порт, например **51822** (не пересекай с другими WG).
2. Пул клиентов, например **10.200.0.0/24**.
3. У **peer** в **Allowed IPs** укажи **только** **192.168.1.136/32** (не **0.0.0.0/0** — иначе появится полный туннель в интернет).
4. Изоляция клиентов VPN друг от друга — в политиках Keenetic / фаерволе.

**Вход с интернета по домену:** на Keenetic включи **KeenDNS / DDNS** (если нужен). На **MikroTik** на **WAN** dst-nat UDP → **192.168.50.199:51822**.

---

## 7. MikroTik — проброс WireGuard (когда нужен доступ извне)

Подставь **IP Keenetic** и порт:

```routeros
/ip firewall nat add chain=dstnat protocol=udp dst-port=51822 in-interface-list=WAN action=dst-nat to-addresses=192.168.50.199 to-ports=51822 comment="WG Keenetic"
```

---

## 8. Проверки

- С Wi‑Fi Keenetic: интернет открывается.
- С **192.168.1.136** в браузере: **https://192.168.50.199** (веб Keenetic), если правило **forward** есть.
- С VPN-клиента WireGuard: открывается **https://192.168.1.136/** (или имя **app**), **не** открывается произвольный сайт в интернете, если политика «только app» соблюдена.

---

## 9. Файлы в репозитории

| Файл | Зачем |
|------|--------|
| [mikrotik-point-to-point-port-map.rsc](../../docker/scripts/vps-wg-hub/mikrotik-point-to-point-port-map.rsc) | Point-to-point `/30`/`/31` на изолированных портах (2026-07-03) |
| [mikrotik-prefer-ether5-for-8-10.rsc](../../docker/scripts/vps-wg-hub/mikrotik-prefer-ether5-for-8-10.rsc) | ether8/10 → `prefer_ether5`: WAN5 primary, WAN1 failover |
| [mikrotik-ether5-egress-abuse-guard.rsc](../../docker/scripts/vps-wg-hub/mikrotik-ether5-egress-abuse-guard.rsc) | Drop SMTP/proxy egress via ether5 (Megafon XBL guard) |
| [mikrotik-allow-136-apply-ether5-guard.rsc](../../docker/scripts/vps-wg-hub/mikrotik-allow-136-apply-ether5-guard.rsc) | С ether8: временно открыть SSH для `.136` + поставить ether5 guard |
| [mikrotik-ether4-restore-factory-mac.rsc](../../docker/scripts/vps-wg-hub/mikrotik-ether4-restore-factory-mac.rsc) | Вернуть factory MAC ether4 (анти-`RX looped packet`) |
| [mikrotik-mgmt-only-192.168.8.10.rsc](../../docker/scripts/vps-wg-hub/mikrotik-mgmt-only-192.168.8.10.rsc) | Admin UI/SSH только с `192.168.8.10` |
| [mikrotik-dump-settings-for-review.rsc](../../docker/scripts/vps-wg-hub/mikrotik-dump-settings-for-review.rsc) | Снять дамп MikroTik для разбора |
| [mikrotik-diag-149-to-111-llama-chat.rsc](../../docker/scripts/lan-workers/mikrotik-diag-149-to-111-llama-chat.rsc) | ROS 7.24: diagnose `.149` → `.111:8080` (llama-chat L2 / horizon); optional horizon clear |
| [mikrotik-remove-br-vpn-keenetic.rsc](../../docker/scripts/vps-wg-hub/mikrotik-remove-br-vpn-keenetic.rsc) | Удалить старый **br-vpn-keenetic** (уже сделано — не повторять) |
| [KEENETIC-VPN-APP-ONLY-SETUP.md](KEENETIC-VPN-APP-ONLY-SETUP.md) | Детали, компоненты, старые черновики |
| [KDE-LAN-136-AND-KEENETIC.md](KDE-LAN-136-AND-KEENETIC.md) | LAN на `.136` + Keenetic |

---

*Ключи WireGuard и пароли в git не коммить.*
