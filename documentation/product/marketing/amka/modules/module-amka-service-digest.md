# Модуль · `amka_service_digest.py`

## Расположение

`shared/api/services/marketing_cabinet/amka_service_digest.py`

## Назначение

- **`load_recent_amka_runs_digest`** — выборка кратких описаний последних прогонов AMKA по проекту (для промптов и UI).
- **`apply_entity_edit_bias_to_audits`** / связанные хелперы — корректировка аудита с учётом недавних правок сущностей (снижение ложного «всё хорошо» после свежих патчей).

## Связь

Вызывается из **`amka_phase_audit`** (bias после baseline) и при построении snapshot (дайджест для `recent_amka_runs_digest_markdown`).

## Инварианты

Bias **не** должен скрывать `strategy_integrity_issues`; только дополняет эвристики.
