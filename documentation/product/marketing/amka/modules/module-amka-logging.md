# Модуль · `amka_logging.py`

## Расположение

`shared/api/services/marketing_cabinet/amka_logging.py`

## Назначение

Единообразные **однострочные** сообщения для grep/ELK: префикс **`[AMKA]`**, поле **`event=`**, стабильные пары `key=value`.

## API

`amka_log_line(event: str, *, run_id=..., step_id=..., section=..., project_id=..., user_id=..., **extra) -> str`

- Фиксированный порядок заголовка: `event`, затем при наличии `run_id`, `step_id`, `section`, `project_id`, `user_id`.
- **`extra`** сортируется по ключу и выводится как `k=v` (значение `None` пропускается).

## Использование

Во всех фазах AMKA вместо ad-hoc f-string: `logger.info(amka_log_line("audit.per_section_done", run_id=..., ...))`.

## Инварианты

Не логировать секреты и полные промпты — только метрики длины/хеши по политике вызывающего кода.
