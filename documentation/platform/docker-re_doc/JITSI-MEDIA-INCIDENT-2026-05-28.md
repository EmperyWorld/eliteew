# Jitsi media incident 2026-05-28 — как восстановили UDP-native связь

**Статус:** historical incident report + evidence-first методика (не living deploy runbook).  
**Живой путь Meet:** [MEET-MEDIA-UDP-NATIVE-PATH.md](MEET-MEDIA-UDP-NATIVE-PATH.md), [WG-HTTP-BACKHAUL-PRIMARY.md](WG-HTTP-BACKHAUL-PRIMARY.md). В тексте **punisher** = тогдашний home runtime; сейчас public runtime = **prod-core `.111`**.  
**Дата:** 2026-05-28.  
**Контур:** EliteEW GAF video calls, `meet.eliteew.ru`, stack11 Jitsi, Yandex edge, reversed WireGuard.  
**Итог:** аудио/видео восстановлены; финальный smoke `verify-meet-media.sh` — `PASS=15 FAIL=0 WARN=2`.

## Короткий вывод

Месяц проблема выглядела как «Jitsi/Android/WebView/ICE/Keycloak/туннель где-то ломаются». Реальная причина оказалась не в одном месте, а в цепочке нескольких транспортных дефектов:

1. Старый TCP/SSH media path давал признаки жизни, но разрушал VoIP качество.
2. Rootless Podman не мог надёжно создать host `wg0`.
3. Edge relay сначала отправлял RTP на LAN IP, недостижимый через WG.
4. Userland `socat` с `fork` падал на живом RTP.
5. После перехода на kernel NAT оставался stale host route.
6. Финальный блокер: firewalld на punisher резал `10.77.77.1 -> udp/34000`, что проявлялось как `ICMP admin prohibited filter`.

Решение стало возможным только после перехода от «чинить вероятные настройки» к evidence-first forensic трассировке: один слой, один ожидаемый побочный эффект, один пакетный факт.

## Влияние на пользователя

Пользовательский симптом:

- звонок открывался;
- UI показывал участников, mute/camera могли переключаться;
- аудио/видео отсутствовали или быстро пропадали;
- иногда были сильные лаги, «робот», обрывы.

Технический симптом:

- signaling мог быть живым;
- JVB часто писал `Starting the Agent without remote candidates`;
- endpoint уходил `Waiting -> Running -> Terminated`;
- до исправления firewalld edge видел входящие STUN/UDP, но не видел нормального ответа от JVB;
- после исправления JVB зафиксировал `ICE connected` и selected pair через `93.77.165.185:13400/udp`.

## Правильная архитектура после восстановления

```text
Клиент Meet
  └─ UDP 93.77.165.185:13400
      └─ Yandex edge kernel NAT
          └─ wg-meet-edge
              └─ 10.77.77.2:34000
                  └─ punisher host wg0
                      └─ JVB :34000/udp

Сигналинг:
Клиент -> https://meet.eliteew.ru -> edge nginx -> SSH -R 13402 -> meet-jwt-gate -> Jitsi web/prosody/jicofo
```

Критические инварианты:

- edge relay target: `10.77.77.2:34000`, не `192.168.1.136:34000`;
- host `wg0` на punisher через `wg-quick@wg0`, не rootless WG-контейнер;
- edge NAT: DNAT `:13400 -> 10.77.77.2:34000` + MASQUERADE;
- punisher firewalld: allow `10.77.77.1/32 -> udp/34000`;
- JVB advertises public ICE `93.77.165.185:13400/udp`;
- verification requires real call evidence: `ICE connected`, selected pair, bidirectional packets.

## Почему обычные гипотезы не помогали

| Гипотеза | Почему казалась правдоподобной | Почему не закрывала проблему |
|----------|--------------------------------|-------------------------------|
| «Это Android/WebView» | Телефон был основным клиентом с чёрным экраном | Browser + Android одновременно показали ту же транспортную проблему |
| «Это Keycloak/JWT/API» | Звонок запускался из app, есть JWT gate | Комната создавалась, участники входили, значит проблема ниже app/session layer |
| «Это BOSH/WebSocket» | Были ответы `/xmpp-websocket` `200` вместо `101` | BOSH fallback нужен, но пакеты RTP всё равно упирались в WG/firewall |
| «Это JVB advertise» | Был drift в `JVB_ADVERTISE_IPS` | После исправления advertise ICE всё ещё не соединялся |
| «Это SG Yandex» | Edge публичный и SG реально фильтрует UDP | Edge получал STUN от клиента, значит пакет проходил до edge |
| «Это маршрут» | Был stale route `192.168.1.136 dev wg0` | Маршрут был реальной проблемой, но после его удаления остался `admin prohibited filter` |
| «Это socat» | `socat` падал с `Too many open files` | Замена на kernel NAT убрала crash, но не firewalld block |

Урок: правдоподобная гипотеза не равна доказанной причине. Каждый слой должен подтверждаться своим наблюдаемым эффектом.

## Хронология расследования

### 1. Разделили signaling и media

Первое важное разделение:

- signaling (`443`, WebSocket/BOSH, JWT, room join) может быть рабочим;
- media (`UDP 13400 -> JVB 34000`) может быть полностью сломан.

Это сняло ложный фокус с Keycloak/API и позволило смотреть на RTP/ICE отдельно.

### 2. Вернули хотя бы наблюдаемое состояние

TCP/SSH fallback давал `ICE connected`, но качество было плохим:

- `Received a suspiciously large buffer`;
- `bwe=-1`;
- лаги и обрывы.

Это доказало, что продуктовый слой и базовый Jitsi signaling живы. Проблема была в media transport.

### 3. Перешли с rootless WG на host/rootful WG

Rootless Podman не мог гарантированно создать host interface:

```text
RTNETLINK answers: Operation not permitted
wg-quick: not found
```

Поэтому рабочий инвариант стал жёстким:

```bash
bash docker/scripts/yandex-tunnel/meet-edge-wg/install-host-wg-client.sh
```

Ожидаемый результат:

- host `wg0` существует;
- `10.77.77.2/32` на punisher;
- handshake с edge;
- rootless `meet-edge-wg` остановлен как legacy.

### 4. Исправили relay target

Старый target:

```text
192.168.1.136:34000
```

Для edge через WG это неверно. Edge должен видеть JVB по WG IP:

```text
10.77.77.2:34000
```

Иначе edge ловит `No route to host` или отправляет в маршрут, который не существует для данного периметра.

### 5. Убрали userland `socat`

На живом RTP `socat` с `fork` упирался в file descriptors:

```text
Too many open files
```

Поэтому relay на edge был переведён на kernel NAT:

```text
PREROUTING  udp dpt:13400 DNAT       to:10.77.77.2:34000
POSTROUTING udp dpt:34000 MASQUERADE to 10.77.77.2
```

Это убрало отдельный класс обрывов.

### 6. Убрали stale route на punisher

После старого WG config в маршрутах оставался:

```text
192.168.1.136 dev wg0 scope link
```

Это пришло из старого `AllowedIPs`, где LAN IP punisher ошибочно попадал в peer. Генератор исправлен до:

```text
AllowedIPs = 10.77.77.1/32
```

После повторного `install-host-wg-client.sh` stale route исчез.

### 7. Нашли финальный блокер через tcpdump

Ключевой capture:

```text
eth0 In          client -> edge:13400
wg-meet-edge Out edge -> 10.77.77.2:34000
wg-meet-edge In  10.77.77.2 -> 10.77.77.1: ICMP admin prohibited filter
```

Это доказало:

- клиентский UDP до edge доходит;
- edge NAT работает;
- WG path до punisher есть;
- блокирует не Yandex SG и не route;
- блокирует host firewall на punisher.

Финальный фикс:

```bash
firewall-cmd --zone=FedoraServer \
  --add-rich-rule='rule family="ipv4" source address="10.77.77.1/32" port protocol="udp" port="34000" accept'

firewall-cmd --permanent --zone=FedoraServer \
  --add-rich-rule='rule family="ipv4" source address="10.77.77.1/32" port protocol="udp" port="34000" accept'
```

Теперь это делает `install-host-wg-client.sh`.

## Доказательство восстановления

Финальная проверка:

```text
PASS: firewalld пропускает 10.77.77.1 → udp/34000
PASS: kernel NAT relay :13400 → 10.77.77.2:34000
PASS: JVB слушает :34000/udp на punisher
PASS: в логах есть ICE connected
PASS: Selected pair на 93.77.165.185:13400
Итог: PASS=15 FAIL=0 WARN=2
```

Packet evidence:

```text
client-to-edge packets: 5964
JVB return packets:     3535
blocked packets:        0
```

JVB evidence:

```text
Selected pair ... 93.77.165.185:13400/udp/srflx -> .../udp/prflx
ICE state changed from Running to Completed
ICE connected
```

Operator evidence:

```text
есть связь!!!!!
```

## Методика, которая сработала

Эту методику нужно применять не только к Jitsi, а ко всем сложным сбоям EliteEW, где несколько слоёв могут давать один и тот же симптом.

### Принцип 1. Сначала контракт пути

До правок надо записать ожидаемый путь:

```text
input -> proxy/normalizer -> transport -> service -> side effect -> observable output
```

Для Jitsi:

```text
client STUN -> edge UDP 13400 -> DNAT -> wg-meet-edge -> punisher wg0 -> firewalld -> JVB 34000 -> response back
```

Если путь не записан, нельзя понять, какой слой уже доказан, а какой только предположен.

### Принцип 2. Один слой — один наблюдаемый факт

Примеры:

| Слой | Факт |
|------|------|
| Client -> edge | `tcpdump eth0 In UDP :13400` |
| Edge NAT | `wg-meet-edge Out 10.77.77.1 -> 10.77.77.2:34000` |
| Punisher firewall | нет `admin prohibited filter` |
| JVB receive/respond | `wg-meet-edge In 10.77.77.2:34000 -> 10.77.77.1:<port>` |
| ICE | `Selected pair` + `ICE connected` |
| Product | пользователь слышит/видит |

Нельзя считать слой исправленным без факта на его выходе.

### Принцип 3. Не смешивать разные оси

В этом incident были минимум две оси:

- media transport;
- ICE/trickle/signaling.

Пока не доказан transport, нельзя делать выводы по WebSocket/BOSH. Пока не доказан room join, нельзя делать выводы по RTP.

### Принцип 4. Ложные успехи тоже полезны

TCP/SSH fallback был плохим решением для качества, но он доказал:

- app flow работает;
- JWT/room/signaling не являются первичной причиной;
- JVB способен доходить до `ICE connected`.

Ложный успех сужает область поиска, если правильно записать, что именно он доказал.

### Принцип 5. Прогнозировать ошибки до правок

Перед изменением нужно записывать:

- что должно измениться в логах;
- какой счётчик должен вырасти;
- какой packet direction должен появиться;
- какой старый симптом должен исчезнуть.

Пример прогноза перед firewalld fix:

```text
Если причина firewalld, то после allow-rule:
- исчезнет ICMP admin prohibited filter;
- появятся пакеты 10.77.77.2:34000 -> 10.77.77.1:<client-port>;
- JVB начнёт писать Selected pair / ICE connected.
```

Именно это произошло.

### Принцип 6. Не доверять одному smoke

Финальное «починили» должно иметь минимум два класса доказательств:

- machine evidence: logs, packet capture, counters, health checks;
- user evidence: оператор реально видит/слышит результат.

Для Jitsi были оба.

## Что делать при похожих симптомах Jitsi

### Симптом: звонок открывается, но аудио/видео нет

1. Не начинать с UI, Keycloak, JWT.
2. Запустить:

```bash
bash scripts/run-meet-media-verify.sh
```

3. Если `FAIL > 0`, сначала чинить fail.
4. Если `FAIL=0`, сделать новый звонок и смотреть:

```bash
podman logs --since 5m stack11-jitsi-jvb-elite 2>&1 \
  | rg -i 'ICE connected|Selected pair|without remote candidates|Terminated|large jump|bwe='
```

5. Если JVB не пишет `ICE connected`, запускать packet capture на edge:

```bash
ssh eliteew-edge@93.77.165.185 \
  "sudo timeout 100s tcpdump -tttt -n -i any '(udp port 13400 or udp port 34000 or host 10.77.77.2)'"
```

### Как читать tcpdump

| Наблюдение | Значение | Действие |
|------------|----------|----------|
| Нет `eth0 In ... :13400` | клиент не дошёл до edge | SG Yandex / клиентская сеть / IP allowlist |
| Есть `eth0 In`, нет `wg-meet-edge Out` | сломан edge NAT | проверить `eliteew-jvb-media-relay-udp-wg` и iptables |
| Есть `wg-meet-edge Out`, есть `admin prohibited filter` | punisher firewalld режет JVB | rerun `install-host-wg-client.sh` с sudo |
| Есть `wg-meet-edge In 10.77.77.2:34000` | JVB отвечает | смотреть ICE/trickle/signaling |
| Есть selected pair, но качество плохое | transport жив, проблема качества/BWE | смотреть bitrate, MTU, packet loss, WebRTC stats |

### Быстрый recovery

```bash
bash docker/scripts/yandex-tunnel/meet-edge-wg/install-host-wg-client.sh
bash scripts/run-meet-media-verify.sh
```

Ожидание:

```text
PASS: firewalld пропускает 10.77.77.1 → udp/34000
PASS: Selected pair на 93.77.165.185:13400
PASS: в логах есть ICE connected
```

## Как применять методику к другим проблемам

### API / backend

Записать путь:

```text
request -> auth -> router -> schema/normalizer -> service -> DB/queue -> response/event
```

Проверять не только HTTP 200, а фактический side effect:

- запись в БД;
- событие в Redis/Socket.IO;
- задача в Celery/RabbitMQ;
- idempotency ledger;
- audit log.

### Frontend

Записать путь:

```text
user action -> state/store -> API call -> cache invalidation -> render -> visible result
```

Не считать UI исправленным, если:

- запрос прошёл, но cache показывает stale;
- state обновился, но visible result не изменился;
- component test зелёный, но real browser smoke не проверен.

### Docker / runtime

Записать путь:

```text
container config -> bind/listen -> host firewall -> proxy/tunnel -> remote client
```

Проверять:

- `ss` на нужном namespace/host;
- firewall rules;
- proxy logs;
- packet direction, если TCP/UDP path сложный.

### Auth / Keycloak / access gate

Записать путь:

```text
browser redirect -> OAuth callback -> token exchange -> userinfo -> allowlist -> session/SG side effect
```

Проверять отдельно:

- redirect URI;
- code exchange;
- userinfo;
- allowlist;
- side effect (например, SG rule);
- отсутствие secret/token leakage в logs.

## Anti-patterns, которые теперь запрещены в расследованиях

- Чинить пять слоёв одновременно без baseline.
- Делать вывод «не помогло» без сравнения ожидаемого факта.
- Считать отсутствие ошибки в логах доказательством успеха.
- Считать `curl 443 OK` доказательством UDP media OK.
- Считать healthcheck контейнера доказательством доступности host firewall path.
- Игнорировать packet capture, когда проблема сетевого уровня.
- Продолжать крутить UI/config, если packet path уже показывает drop ниже.

## Операционная памятка

Перед серией правок:

```text
1. Симптом пользователя.
2. Ожидаемый полный путь данных/пакета.
3. Первый недоказанный слой.
4. Команда, которая докажет вход в слой.
5. Команда, которая докажет выход из слоя.
6. Прогноз: что изменится после фикса.
7. Rollback.
```

После фикса:

```text
1. Machine evidence.
2. User evidence.
3. Обновить verify/smoke, чтобы следующий агент поймал этот класс ошибки автоматически.
4. Обновить docs и worklog.
```

В этом incident самый важный результат не только рабочий Jitsi. Важнее то, что методика превратила «магическую» проблему месяца в проверяемую цепочку фактов.
