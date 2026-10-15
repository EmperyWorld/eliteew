# VPS WireGuard hub (доступ «снаружи» без белого IP на доме)

**Чеклист запуска и ключи:** [`LAUNCH.md`](LAUNCH.md) · **`./launch.sh first`** / **`./launch.sh update`** · мониторинг: **`./watch-wg-hub.sh`**

Схема: **VPS с публичным IP** — единственная точка входа (UDP `WG_PORT`). Дом за CGNAT поднимает **клиентский** туннель к VPS; удалённые пользователи — peer’ы на том же сервере. Трафик к `HOME_STACK12_NET` (например `172.29.12.0/24`) маршрутизируется на peer «дом» по правилам WireGuard.

## Требования

- Локально: `bash`, `ssh`, `scp`, при желании `wg` (иначе ключи генерируются **на VPS** после шага bootstrap).
- На VPS (пользователь из `config.env`, по умолчанию `punisher`): **`sudo` без пароля** для установки пакетов и `wg-quick`, либо выполни команды из раздела «Ручной bootstrap» один раз.
- Дом: Alma/Fedora с `wg-quick`, подсеть stack12 в `.env.stack12` совпадает с `HOME_STACK12_NET`.

## Быстрый старт

```bash
cd docker/scripts/vps-wg-hub
cp -n config.env.example config.env
# поправь VPS_SSH_HOST при смене сервера
nano config.env
./launch.sh first
# то же по смыслу, что ./setup-all.sh, плюс подсказки дальше
```

Подробный порядок (дом, dnsmasq, клиенты): **[`LAUNCH.md`](LAUNCH.md)**.

На **домашнем** сервере (где репозиторий или скопирован `output/home/`):

```bash
sudo ./05-install-home-local.sh
```

Конфиги для телефонов/ноутбуков: `output/peers/peer-1.conf`, …

**Второй ПК / другая сеть:** пошагово — [`PEER-SECOND-PC.md`](PEER-SECOND-PC.md) (файл **`peer-2.conf`**).

## `app.eliteew.ru` с клиента VPN (без цепочки DNS до CoreDNS на доме)

Цель: после подключения WG открыть **`https://app.eliteew.ru`** — резолв через **dnsmasq на VPS** (`10.66.66.1`), статический **A** на LAN-IP хоста с приложением; трафик к этому IP идёт через туннель (**`AllowedIPs`** содержит **`VPN_APP_TARGET_IP/32`**, по умолчанию = **`WG_HOME_SNAT_TO`**).

1. В **`config.env`**: `WG_HOME_SNAT_TO` (как **`INTERNAL_DNS_BIND_ADDRESS`** на доме), при другом IP фронта — **`VPN_APP_HOSTNAME`**, **`VPN_APP_TARGET_IP`**.
2. **`./02-render-configs.sh`** → **`./04-deploy-vps.sh`** (обновить **`wg0`** на VPS с маршрутом к **`…/32`**).
3. На VPS: **`./09-vps-dnsmasq.sh`** (пишет **`address=/app.eliteew.ru/…`** в dnsmasq).
4. Раздай клиентам обновлённые **`output/peers/*.conf`** и переподключи VPN.

Остальные имена по-прежнему уходят **форвардом** в **`DNS_FORWARD_TARGET`** (CoreDNS на доме), если тот доступен с VPS.

## Смена внешнего сервера

1. Правки в `config.env`: `VPS_SSH_HOST` (и при необходимости `VPS_SSH_USER`, `VPS_SSH_KEY_FILE`).
2. `./setup-all.sh` — пересоберёт конфиги и задеплоит на новый VPS.
3. На доме: снова `sudo ./05-install-home-local.sh` (новый `Endpoint` в конфиге).
4. Раздай обновлённые `output/peers/*.conf` клиентам.

При компрометации ключей: `REGENERATE_KEYS=1` в `config.env`, затем `./setup-all.sh`.

## Если `dig @172.29.12.53` с VPS таймаутится

1. На **VPS** маршрут: `ip route get 172.29.12.53` — должно быть `dev wg0`, `src` около `10.66.66.1`. Иначе правь `AllowedIPs` / деплой `wg0.conf`.
2. **Если установлен firewalld** (`firewall-cmd` есть): интерфейс `wg0` часто в зоне `public`, ответы с дома режутся. Попробуй:  
   `sudo firewall-cmd --zone=trusted --add-interface=wg0`  
   затем снова `dig`. В сгенерённом `output/vps/wg0.conf` PostUp уже вызывает этот `firewall-cmd` (игнорируется, если пакета нет).
3. **Если firewalld нет** (минимальный Alma/VPS): зона `trusted` не применима — смотри, что реально режет трафик:  
   `sudo iptables -L INPUT -n -v` и при необходимости `sudo nft list ruleset | less` — должны быть правила из PostUp `wg0` (`INPUT`/`FORWARD` для `wg0`). Если PostUp не отработал, подними интерфейс заново: `sudo wg-quick down wg0 && sudo wg-quick up wg0`.
4. **`ss` показывает `SYN-SENT` на `10.66.66.1 → 172.29.12.53:53`** — TCP SYN ушёл, ответа на рукопожатие нет: обрыв на доме (Docker/FORWARD/SNAT) или фильтр на VPS. Разруливание: на **доме** во время `dig` с VPS:  
   `sudo tcpdump -ni wg-empery-hub -nn 'host 172.29.12.53 and port 53'`  
   — видно ли входящий DNS на туннель и уходят ли ответы.
5. Дом (firewalld + Docker): `11-home-firewalld-forward.sh`, `12-home-docker-user.sh`, подробности — `BUG-REPORT-DNS-VPS-HOME-TIMEOUT.md`.
6. **Нет ответов в tcpdump / таймаут с VPS:** нужны **оба** элемента: **`WG_HOME_SNAT_TO`** обычно **LAN** (`INTERNAL_DNS_BIND_ADDRESS`, напр. `192.168.1.136`), **не** `172.29.12.1` — при SNAT на gw моста ответ CoreDNS идёт на `172.29.12.1`, правило обхода MASQUERADE (см. п.7) по `dst 10.66.66.0/24` **не матчится**, снова ломается путь. Плюс скрипт **`12-home-docker-user.sh`**.
7. **Docker `MASQUERADE`** для `172.29.12.0/24` при `! -o br-stack12` подменяет **src** ответов из stack12, если пакет уходит не на `br`. В **`12-home-docker-user.sh`**: **DOCKER-USER** `wg` ↔ stack12 и в **nat POSTROUTING** **ACCEPT** для `172.29.12.0/24 → 10.66.66.0/24` и `→ WG_HOME_SNAT_TO` **до** MASQUERADE (см. ниже про счётчики).

### Почему в `nft` у ACCEPT **0 packets**, а у MASQUERADE **растёт** — это не «сломано»

- **MASQUERADE** считает в том числе **исходящий** трафик CoreDNS **к апстриму** (например `8.8.8.8:53`): **src** `172.29.12.x`, **dst** **не** ваш хаб и **не** `SNAT_TO`. Такие пакеты **должны** попасть в MASQUERADE и **не** должны совпадать с узкими **ACCEPT** — поэтому счётчик MASQUERADE **увеличивается**, а у **двух** правил **ACCEPT** остаётся **0**.
- **ACCEPT** нужны для **ответов** «в сторону VPN / hairpin», когда **dst** как раз `10.66.66.0/24` или `WG_HOME_SNAT_TO`. Это **другой** поток, чем апстрим; его мало или он идёт иначе по стеку — **нельзя** сравнивать «0 vs 95» как признак поломки.
- Строка **SNAT** `10.66.66.0/24 → 172.29.12.0/24` → `192.168.1.136` с **1** пакетом — это в первую очередь **запросы** в подсеть Docker, не «вся DNS-жизнь».
- **Ориентир:** работает ли **`dig @172.29.12.53`** с VPS, а не рост счётчика именно на **ACCEPT**.

## Ручной bootstrap VPS (если нет passwordless sudo)

Под `punisher` на VPS:

```bash
sudo dnf install -y wireguard-tools
echo 'net.ipv4.ip_forward = 1' | sudo tee /etc/sysctl.d/99-wg-hub-forward.conf
sudo sysctl -p /etc/sysctl.d/99-wg-hub-forward.conf
sudo firewall-cmd --permanent --add-port=51820/udp   # или свой WG_PORT; пропусти, если firewalld не установлен
sudo firewall-cmd --reload
# без firewalld: sudo iptables -I INPUT 1 -p udp --dport 51820 -j ACCEPT
```

Дальше локально: `./01-generate-keys.sh` … `./04-deploy-vps.sh` или снова `./setup-all.sh`.

## Файлы

| Скрипт | Назначение |
|--------|------------|
| `LAUNCH.md` | Чеклист запуска, ключи на человека, мониторинг |
| `launch.sh` | `first` = как `setup-all.sh`; `update` = 02→04→09 после правок `config.env` |
| `watch-wg-hub.sh` | `watch` + `sudo wg show` на VPS (нужен `config.env`) |
| `add-remote-peers.sh N` | Добавить **N** peer’ов: бэкап `config.env`, `REMOTE_PEER_COUNT+=N`, `01`→`02`→`04` — старым конфиги не перевыдавать |
| `mikrotik-cleanup.rsc` | На **MikroTik**: SSH/Winbox/www только **192.168.1.136** + **192.168.9.0/24**; gpu141 `.141` (embed/rerank/tools + Comfy `:31003`) доступен только по prod/ops allowlist (см. `mikrotik-dedup-firewall.md`) |
| `mikrotik-prefer-ether5-for-8-10.rsc` | ether8 / ether10 → table `prefer_ether5`: WAN **ether5** primary, **ether1** failover (отдельно от `to_isp1` для `.111`/`.136`) |
| `mikrotik-mgmt-only-192.168.8.10.rsc` | Management (SSH/www/winbox/api) **только** с `192.168.8.10`; MAC discovery off |
| `mikrotik-dump-settings-for-review.rsc` | Снять **сводку** настроек + **`/export hide-sensitive file=audit-mt-hide`** — для точных правок по твоему конфигу |
| `mikrotik-remove-br-vpn-keenetic.rsc` | Удалить **`br-vpn-keenetic`** / **192.168.60.1** на MT, если кабель со **2-го** LAN Keenetic с **ether5** снят |
| `setup-all.sh` | bootstrap VPS → ключи → рендер → деплой |
| `01-generate-keys.sh` | ключи `keys/` |
| `02-render-configs.sh` | `output/vps/`, `output/home/`, `output/peers/` |
| `03-vps-bootstrap-remote.sh` | dnf, sysctl, firewalld на VPS |
| `04-deploy-vps.sh` | `/etc/wireguard/wg0.conf` на VPS |
| `09-vps-dnsmasq.sh` | **на VPS** dnsmasq: локальный **A** для `VPN_APP_HOSTNAME` → `VPN_APP_TARGET_IP`, остальное → `DNS_FORWARD_TARGET` |
| `05-install-home-local.sh` | **на доме**, `/etc/wireguard/wg-empery-hub.conf` |
| `10-home-apply-snat-now.sh` | **на доме с sudo**, SNAT + при **firewalld** вызов `11` |
| `11-home-firewalld-forward.sh` | **firewalld:** `direct` FORWARD + **nat POSTROUTING SNAT** (без SNAT в nft — dig с VPS таймаут) |
| `12-home-docker-user.sh` | **Docker:** `iptables` **DOCKER-USER** (только **после** старта Docker; **не** в firewalld permanent — иначе `iptables-restore` падает, пока нет цепочки) |
| `13-home-dns-timeout-check.sh` | Диагностика таймаута `dig`: локальный DNS, DOCKER-USER, SNAT, тест без SNAT |
| `14-home-vpn-dns-verify.sh` | **На доме:** короткий **PASS/FAIL** — wg, Docker/DOCKER-USER, `dig` к CoreDNS, наличие NAT-правил |
| `FIREWALLD-UPSTREAM.md` | Ссылки на issue firewalld, policy objects, SNAT/DIRECT caveats |
| `BUG-REPORT-DNS-VPS-HOME-TIMEOUT.md` | Баг-репорт: таймаут `dig` с VPS, firewalld/Docker/SNAT (2026-04) |

Секреты: каталоги `keys/`, `output/`, `config.env` в `.gitignore`.
