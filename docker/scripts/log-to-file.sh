#!/bin/sh
# Запуск команды с дублированием stdout+stderr в файл. Основной процесс — сама команда (получает SIGTERM).
# Использование: log-to-file.sh <путь_к_лог_файлу> <cmd> [аргументы...]
# Монтировать: ../scripts/log-to-file.sh:/usr/local/bin/log-to-file.sh:ro
set -e
LOG_FILE="$1"
shift
mkdir -p "$(dirname "$LOG_FILE")"
FIFO="/tmp/logfifo.$$"
rm -f "$FIFO"
mkfifo "$FIFO"
sed -E 's/([?&](jwt|token)=)[^[:space:]"&]+/\1<redacted>/g' < "$FIFO" | tee -a "$LOG_FILE" &
exec "$@" > "$FIFO" 2>&1
