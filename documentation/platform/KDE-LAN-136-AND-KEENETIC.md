# Сервер 192.168.1.136 (KDE): локальная сеть и Keenetic

## 1. Грамотное проводное подключение (основной LAN)

Идея: **один** стабильный профиль **Ethernet** с **статикой** (или резервацией DHCP на MikroTik), шлюз **192.168.1.1**, DNS сначала **роутер** (там статика `*.eliteew.ru` → 136), потом публичный резерв.

### Узнать имя интерфейса

```bash
nmcli device status
```

Ищи устройство типа `ethernet` в состоянии `connected` — например `enp3s0`, `eno1`.

### Вариант A: новый профиль `lan-empery` (если хочешь отделить от «автоматики»)

Подставь **`IFACE`** вместо реального имени (из шага выше):

```bash
IFACE=enp3s0   # <-- поменяй на своё

sudo nmcli connection add type ethernet con-name lan-empery ifname "$IFACE" \
  ipv4.method manual \
  ipv4.addresses 192.168.1.136/24 \
  ipv4.gateway 192.168.1.1 \
  ipv4.dns "192.168.1.1 1.1.1.1" \
  ipv4.ignore-auto-dns yes \
  ipv6.method disabled \
  connection.autoconnect yes \
  connection.interface-name "$IFACE"
```

Активировать:

```bash
sudo nmcli connection up lan-empery
```

Старый профиль для этого же интерфейса лучше **отключить автоподключение**, чтобы не было двух конфигов на один порт:

```bash
nmcli connection show
# sudo nmcli connection modify "старое-имя" connection.autoconnect no
```

### Вариант B: правка существующего подключения в KDE

**Параметры системы → Сеть → соединения** → твой **Ethernet** → **IPv4**:

- **Способ**: вручную
- **Адрес**: `192.168.1.136` / маска `255.255.255.0`
- **Шлюз**: `192.168.1.1`
- **DNS**: `192.168.1.1`, `1.1.1.1`
- Отключи **«Только автоматические»** для DNS, если NM подсовывает левые сервера.

### Проверка

```bash
ip -4 route
ping -c2 192.168.1.1
getent hosts app.eliteew.ru
```

Ожидаемо: маршрут по умолчанию через **192.168.1.1**, имя резолвится (через роутер или локальный bind — как у тебя заведено).

---

## 2. Несколько WiFi-профилей на этом же ПК (кратко)

Когда дойдёшь до WiFi к Keenetic:

- Отдельное **сохранённое соединение** WiFi (SSID Keenetic), **автоподключение** можно выключить, чтобы не отрывало основной **Ethernet**.
- У проводного профиля оставь **приоритет**: в NM у **ethernet** обычно ниже **metric**, трафик в локалку пойдёт через **136**-LAN; WiFi — для интернета у Кинетика, если так задумано (детальнее настроим с **metric** и политиками маршрутов, когда будешь готов).

Пока достаточно **не** включать два дефолтных шлюза без разбора — иначе половина пакетов уедет не туда.

---

## 2.5. Direct 2.5G к prod-core — **retired 2026-07-30**

Больше не используется. Deploy SSH = LAN `192.168.1.111`. See [PRODUCTION-TOPOLOGY-STATE.md](PRODUCTION-TOPOLOGY-STATE.md) §Current (historical 2.5G pointer soft-retired → `trash/`).

## См. также

- Keenetic + MikroTik: [`KEENETIC-MIKROTIK-RUNBOOK.md`](KEENETIC-MIKROTIK-RUNBOOK.md)
- Deploy SSH (LAN only; 2.5G retired): [`PRODUCTION-TOPOLOGY-STATE.md`](PRODUCTION-TOPOLOGY-STATE.md) §Current

## 3. Keenetic: что выгрузить, чтобы «люто настроить» дальше

Без секретов в открытый чат. Удобно так:

1. **Снимок настроек** (если в веб-морде есть **Сохранение конфигурации** / **Резервная копия**) — храни **локально**, в чат лучше **не** класть целиком, если там пароли.
2. **Текстом / скринами** (без паролей WiFi в полном виде):
   - модель прошивки, раздел **Интернет** (WAN, тип подключения);
   - **LAN** и **гостевые сегменты** (подсети, DHCP);
   - **WiFi**: SSID, изоляция клиентов, гостевая сеть;
   - **Межсетевой экран / фильтрация** между сегментами;
   - **Порт forwarding / UPnP**, если включал;
   - схема: **что в WAN Кинетика** (кабель с MikroTik **ether10** в порт WAN Keenetic?) — одной фразой.

3. Если в Keenetic есть **экспорт в файл** без чувствительных полей — можно приложить **очищенный** вариант.

Когда опишешь **задумку** (кто куда ходит: только интернет, гостевой WiFi, доступ к LAN или нет), по этим данным можно собрать конкретный чеклист правил.

---

## Связь с VPN / публичным входом

| Контур | Где настраивается | Заметка |
|--------|-------------------|---------|
| **Meet WG** (public HTTP + Meet media) | edge + prod-core (`10.77.77.0/24`) | [docker-re_doc/WG-HTTP-BACKHAUL-PRIMARY.md](docker-re_doc/WG-HTTP-BACKHAUL-PRIMARY.md) — **не** Keenetic |
| **Keenetic WireGuard** (опционально, «только app») | Keenetic + dst-nat на MikroTik WAN | [KEENETIC-MIKROTIK-RUNBOOK.md](KEENETIC-MIKROTIK-RUNBOOK.md) §6 |
| **OpenVPN** | — | Не primary; не ставить на Keenetic для этой схемы |

Профиль **Ethernet 136 + DNS через 192.168.1.1** эти пути **не ломает**.
