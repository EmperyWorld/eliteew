# Сегментация Docker-сетей (внутренний документ)

> **stack3** (VictoriaLogs/Vector) и **Airflow** в stack2 **сняты** — исторические тексты в `trash/` (не канон).

Соответствие нейтральных имён сетей и сервисов. В `docker network ls` и в compose видны только нейтральные имена; назначение сетей не раскрывать вовне.

**Периметр:** сегментация `ew_net_*` — **внутри prod-core** (public runtime). Вход из интернета — edge-VM → Meet WG primary (SSH reserve optional), не через проброс портов stack1 на WAN. Зоны доверия — [CONTAINER-SECURITY-THREAT-MODEL.md](CONTAINER-SECURITY-THREAT-MODEL.md).

## Сети (все `external: true`)

| Сеть (в compose) | Назначение | Кто подключается |
|------------------|------------|-------------------|
| **ew_net_6211** | Frontend ↔ API | stack0-eliteew-frontend-prod, stack0-eliteew-api-prod |
| **ew_net_2847** | Данные: Postgres, Redis, Chroma, Qdrant, SeaweedFS, Elasticsearch, RabbitMQ | API, stack2 (llama-chat/ComfyUI), Etherpad (stack11) |
| **ew_net_9O11** | Keycloak SSO (в имени буква O, не ноль) | stack6-keycloak, stack6-keycloak-postgres, API, Frontend (прокси /auth-proxy к Keycloak) |
| **ew_net_4532** | AI-сервисы (llama-chat, ComfyUI) | stack2-*, API |
| **ew_net_7198** | Документы (Tika, Gotenberg, ocrmypdf) | stack4-*, API |
| **ew_net_3365** | Голос (Whisper, Silero) | stack9-*, API |
| **ew_net_5402** | Jitsi + интеграция с API | stack11-*, API |
| **ew_net_monitor** | Мониторинг (Prometheus, Alertmanager, VictoriaLogs, Vector) — **stack3 снят** | stack3-* (исторически) |

## Подключение по стекам (кратко)

- **API** (stack/stack0_b.yml): ew_net_6211, ew_net_2847, ew_net_9O11, ew_net_4532, ew_net_7198, ew_net_3365, ew_net_5402.
- **Frontend** (stack/stack0_f.yml): ew_net_6211, ew_net_9O11.
- **Stack1** (stack/stack1.yml): только ew_net_2847.
- **Stack2** (stack/stack2.yml): ew_net_4532, ew_net_2847, ew_net_7198.
- **Stack4** (stack/stack4.yml): только ew_net_7198.
- **Stack6** (stack/stack6.yml): только ew_net_9O11.
- **Stack9** (stack/stack9.yml): только ew_net_3365.
- **Stack11** (stack/stack11.yml): ew_net_5402; контейнер **etherpad** дополнительно ew_net_2847 (Postgres).
- **Stack3** (stack/stack3.yml): **снят с prod** — сеть `ew_net_monitor` и scrape-матрица не в живом каноне.

## Создание сетей

Перед первым `up` любого стека выполнить:

```bash
./docker/scripts/networks-create.sh
```

Безопасность и переименование опасных команд — см. [SECURITY.md](SECURITY.md).

## Хостовый nftables (минимум, jobs.md)

Цель: если когда‑либо пробросятся порты БД/Redis шире `127.0.0.1`, с **docker bridge** (`br-*`, подсети `172.x`) **запретить** прямой доступ к **HOST_IP:порт_инфры** (Postgres 30000, Redis 30001 и т.д.), оставив разрешёнными только нужные пары стек↔стек через `ew_net_*`.

Пример заготовки (подставьте **LAN IP prod-core** и порты stack1; проверяйте порядок правил и политику по умолчанию):

```text
table inet filter {
  chain docker_to_host_db_guard {
    type filter hook forward priority -50; policy accept;
    # исходящий трафик из типичной подсети docker/podman bridge на LAN IP prod-core и порты инфры — DROP
    ip saddr 172.16.0.0/12 ip daddr <PROD_CORE_LAN_IP> tcp dport { 30000, 30001 } drop
    ip saddr 172.16.0.0/12 ip daddr <PROD_CORE_LAN_IP> udp dport { 30000, 30001 } drop
  }
}
```

Идеальный следующий шаг — матрица «кто может говорить с кем» по `ew_net_*` и скрипт применения; до неё достаточно явного запрета bridge→host DB.
