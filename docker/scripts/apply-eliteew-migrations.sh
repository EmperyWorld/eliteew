#!/usr/bin/env bash
# Единая точка входа для применения миграций EliteEW (ai_services) с записью в schema_migrations.
# Запуск: из корня репо.
#
# Использование:
#   ./docker/scripts/apply-eliteew-migrations.sh
#   ENV_FILE=docker/env_file/.env.stack1 ./docker/scripts/apply-eliteew-migrations.sh
#
# По умолчанию psql выполняется **внутри** контейнера Postgres (USE_DOCKER=1, stack1-postgres).
# На хосте psql не нужен. Для прямого подключения с хоста: USE_DOCKER=0 и POSTGRES_HOST/PORT.
#
# Миграции из shared/api/migrations/ (корень или applied/) — список MIGRATIONS ниже.
# После успешного применения в schema_migrations записывается (version, name).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$REPO_ROOT/docker/env_file/.env.stack1}"
MIGRATIONS_DIR="${ELITEEW_MIGRATIONS_DIR:-${REPO_ROOT}/shared/api/migrations}"
CONTAINER_RUNTIME="${ELITEEW_CONTAINER_RUNTIME:-podman}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Env file not found: $ENV_FILE"
  exit 1
fi

SAVED_POSTGRES_HOST="${POSTGRES_HOST:-}"
SAVED_POSTGRES_PORT="${POSTGRES_PORT:-}"
SAVED_USE_DOCKER="${USE_DOCKER:-}"
SAVED_POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-}"

set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

[[ -n "$SAVED_POSTGRES_HOST" ]] && export POSTGRES_HOST="$SAVED_POSTGRES_HOST"
[[ -n "$SAVED_POSTGRES_PORT" ]] && export POSTGRES_PORT="$SAVED_POSTGRES_PORT"
[[ -n "$SAVED_USE_DOCKER" ]] && export USE_DOCKER="$SAVED_USE_DOCKER"
[[ -n "$SAVED_POSTGRES_CONTAINER" ]] && export POSTGRES_CONTAINER="$SAVED_POSTGRES_CONTAINER"

export POSTGRES_HOST="${POSTGRES_HOST:-127.0.0.1}"
export POSTGRES_PORT="${POSTGRES_PORT:-30000}"
export POSTGRES_USER="${POSTGRES_USER:-ai_user}"
export POSTGRES_DB="${POSTGRES_DB:-ai_services}"
export POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-stack1-postgres}"
export PGPASSWORD="${POSTGRES_PASSWORD:?POSTGRES_PASSWORD not set - check $ENV_FILE}"

# auto: container runtime if psql отсутствует на хосте, иначе host psql (legacy)
USE_DOCKER="${USE_DOCKER:-auto}"
if [[ "$USE_DOCKER" == "auto" ]]; then
  if command -v psql >/dev/null 2>&1; then
    USE_DOCKER=0
  else
    USE_DOCKER=1
  fi
fi
if [[ "$USE_DOCKER" == "1" ]] && ! command -v "${CONTAINER_RUNTIME}" >/dev/null 2>&1; then
  echo "Container runtime not found in PATH: ${CONTAINER_RUNTIME}"
  exit 1
fi

_psql() {
  if [[ "$USE_DOCKER" == "1" ]]; then
    if ! "${CONTAINER_RUNTIME}" ps --format '{{.Names}}' | grep -qx "$POSTGRES_CONTAINER"; then
      echo "Postgres container not running: $POSTGRES_CONTAINER"
      exit 1
    fi
    "${CONTAINER_RUNTIME}" exec -i "$POSTGRES_CONTAINER" psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$@"
  else
    psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 "$@"
  fi
}

_psql_file() {
  local filepath="$1"
  if [[ "$USE_DOCKER" == "1" ]]; then
    if ! "${CONTAINER_RUNTIME}" ps --format '{{.Names}}' | grep -qx "$POSTGRES_CONTAINER"; then
      echo "Postgres container not running: $POSTGRES_CONTAINER"
      exit 1
    fi
    cat "$filepath" | "${CONTAINER_RUNTIME}" exec -i "$POSTGRES_CONTAINER" psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f -
  else
    _psql -f "$filepath"
  fi
}

echo "Migration runner: USE_DOCKER=$USE_DOCKER runtime=${CONTAINER_RUNTIME} container=${POSTGRES_CONTAINER:-—} db=$POSTGRES_DB user=$POSTGRES_USER migrations_dir=$MIGRATIONS_DIR"

# Убедиться, что таблица schema_migrations есть (version, name)
_psql -t -A -c "
CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  PRIMARY KEY (version, name)
);
" 2>/dev/null || true

# Упорядоченный список: version|name|relative_path_under_migrations/
MIGRATIONS=(
  "20260315_01|get_encryption_key_no_fallback|get_encryption_key_no_fallback.sql"
  "20260524_01|content_user_library_removals|applied/20260524_content_user_library_removals.sql"
  "20260524_02|ewa_companion_folder_backfill|applied/20260524_ewa_companion_folder_backfill.sql"
  "20260525_01|pw_generation_recipes_ugs_type_key_repair|applied/20260525_pw_generation_recipes_ugs_type_key_repair.sql"
  "20260529_00|site_studio_lifecycle_jobs|applied/20260529_site_studio_lifecycle_jobs.sql"
  "20260529_01|site_studio_domain_bindings|applied/20260529_site_studio_domain_bindings.sql"
  "20260529_02|site_manager_ops_audit_events|applied/20260529_site_manager_ops_audit_events.sql"
  "20260529_03|friend_circles_visual_metadata|applied/20260529_01_friend_circles_visual_metadata.sql"
  "20260529_04|social_user_reports|applied/20260529_02_social_user_reports.sql"
  "20260602_03|mobile_support_reports|applied/20260602_03_mobile_support_reports.sql"
  "20260603_01|desktop_app_catalog_poemma|applied/20260603_01_desktop_app_catalog_poemma.sql"
  "20260603_02|poemma_workspace_domain|applied/20260603_02_poemma_workspace_domain.sql"
  "20260606_01|desktop_app_catalog_doc_editor_v2|applied/20260606_01_desktop_app_catalog_doc_editor_v2.sql"
  "20260606_02|gemma4_31b_chat_model|applied/20260606_02_gemma4_31b_chat_model.sql"
  "20260606_03|gemma4_e4b_ud_q8_k_xl_chat_model|applied/20260606_03_gemma4_e4b_ud_q8_k_xl_chat_model.sql"
  "20260614|gemma4_26b_chat_model|applied/20260614_gemma4_26b_chat_model.sql"
  "20260617_01|llama_contract_cutover|applied/20260617_01_llama_contract_cutover.sql"
  "20260617_02|mobile_trusted_devices|20260617_mobile_trusted_devices.sql"
  "20260617_03|gaf_e2ee_consent|20260617_gaf_e2ee_consent.sql"
  "20260618_01|video_calls_ringing_delivery|applied/20260618_video_calls_ringing_delivery.sql"
  "20260606_04|desktop_app_catalog_about_project|applied/20260606_04_desktop_app_catalog_about_project.sql"
  "20260606_05|music_evolution_duration_300|applied/20260606_05_music_evolution_duration_300.sql"
  "20260620_01|marketing_structured_llm_generation_types|applied/20260620_marketing_structured_llm_generation_types.sql"
  "20260620_02|music_promo_script_generation_type|applied/20260620_music_promo_script_generation_type.sql"
  "20260621_01|imc_rag_research_types_curated|applied/20260621_imc_rag_research_types_curated.sql"
  "20260621_02|evidence_research_types_curated|applied/20260621_02_evidence_research_types_curated.sql"
  "20260621_03|imc_deactivate_deep_market_showcase_repair|applied/20260621_03_imc_deactivate_deep_market_showcase_repair.sql"
  "20260621_04|amka_preset_template_ensemble_synthesis|applied/20260621_04_amka_preset_template_ensemble_synthesis.sql"
  "20260621_05|assistant_settings_llama_model_default|applied/20260621_assistant_settings_llama_model_default.sql"
  "20260621_06|imc_rag_orchestrate_reenable|applied/20260621_06_imc_rag_orchestrate_reenable.sql"
  "20260628_01|music_forge_mvp|applied/20260628_01_music_forge_mvp.sql"
  "20260628_02|music_forge_catalog_access|applied/20260628_02_music_forge_catalog_access.sql"
  "20260628_03|music_forge_llm_provider_repair|applied/20260628_03_music_forge_llm_provider_repair.sql"
  "20260628_04|video_studio_cost_and_prompt_ugs|applied/20260628_04_video_studio_cost_and_prompt_ugs.sql"
  "20260628_05|video_studio_image_prompt_llama_provider_repair|applied/20260628_05_video_studio_image_prompt_llama_provider_repair.sql"
  "20260628_06|music_studio_single_desktop_app|applied/20260628_06_music_studio_single_desktop_app.sql"
  "20260629_01|web_search_user_quota|applied/20260629_01_web_search_user_quota.sql"
  "20260630_01|user_referral_codes|applied/20260630_user_referral_codes.sql"
  "20260701_01|search_runtime_config|applied/20260701_01_search_runtime_config.sql"
  "20260702_01|web_search_yandex_only_and_events|applied/20260702_web_search_yandex_only_and_events.sql"
  "20260703_01|kbsew_schema|applied/20260703_01_kbsew_schema.sql"
  "20260703_02|survey_hub|applied/20260703_02_survey_hub.sql"
  "20260702_02|kbsew_search_settings_defaults|applied/20260702_kbsew_search_settings_defaults.sql"
  "20260704_01|kbsew_agent_surfaces_defaults|applied/20260704_kbsew_agent_surfaces_defaults.sql"
  "20260705_01|kbsew_retrieval_settings_defaults|applied/20260705_kbsew_retrieval_settings_defaults.sql"
  "20260706_01|kbsew_durable_ingestion_jobs|applied/20260706_01_kbsew_durable_ingestion_jobs.sql"
  "20260707_01|unified_content_content_payload|applied/20260707_unified_content_content_payload.sql"
  "20260714_01|desktop_app_catalog_empery_nexus_chronicle|applied/20260714_01_desktop_app_catalog_empery_nexus_chronicle.sql"
  "20260715_01|desktop_site_studio_catalog_access_nores|applied/20260715_desktop_site_studio_catalog_access_nores.sql"
  "20260716_01|desktop_app_catalog_site_manager_ops|applied/20260716_01_desktop_app_catalog_site_manager_ops.sql"
  "20260720_01|music_forge_duration_240|applied/20260720_01_music_forge_duration_240.sql"
  "20260720_02|music_forge_config|applied/20260720_02_music_forge_config.sql"
  "20260720_03|music_forge_config_generation|applied/20260720_03_music_forge_config_generation.sql"
  "20260720_04|music_forge_audio_type_key|applied/20260720_04_music_forge_audio_type_key.sql"
  "20260720_05|music_forge_pipeline_modes|applied/20260720_05_music_forge_pipeline_modes.sql"
  "20260720_06|music_forge_mode_display_labels|applied/20260720_06_music_forge_mode_display_labels.sql"
  "20260722_01|kbsew_asset_revisions|applied/20260722_01_kbsew_asset_revisions.sql"
  "20260724_01|voice_command_audit|applied/20260724_01_voice_command_audit.sql"
  "20260728_01|ugs_piper_tts_provider|applied/20260728_01_ugs_piper_tts_provider.sql"
  "20260801_01|kbsew_one_active_job_per_asset|applied/20260801_01_kbsew_one_active_job_per_asset.sql"
  "20260801_02|desktop_ai_chat_collaboration|applied/20260801_02_desktop_ai_chat_collaboration.sql"
  "20260801_03|desktop_ai_memory_cells|applied/20260801_03_desktop_ai_memory_cells.sql"
  "20260805_01|desktop_ai_chat_generation_budgets|applied/20260805_desktop_ai_chat_generation_budgets.sql"
  "20260807_01|desktop_ai_discussion|applied/20260807_desktop_ai_discussion.sql"
  "20260807_02|desktop_ai_discussion_participant|applied/20260807_02_desktop_ai_discussion_participant.sql"
  "20260807_03|desktop_client_licenses|applied/20260807_desktop_client_licenses.sql"
  "20260807_04|sso_client_class_desktop|applied/20260807_sso_client_class_desktop.sql"
  "20260808_01|desktop_client_license_capabilities|applied/20260808_desktop_client_license_capabilities.sql"
  "20260808_02|system_maintenance_deploy_defaults|applied/20260808_system_maintenance_deploy_defaults.sql"
  "20260808_03|desktop_client_soft_revokes|applied/20260808_desktop_client_soft_revokes.sql"
  "20260808_04|desktop_client_runtime_presence|applied/20260808_desktop_client_runtime_presence.sql"
  "20260809_01|sso_client_class_fofline|applied/20260809_sso_client_class_fofline.sql"
  "20260809_02|desktop_client_allow_fofline|applied/20260809_desktop_client_allow_fofline.sql"
  "20260809_03|fofline_runtime_build_channel|applied/20260809_03_fofline_runtime_build_channel.sql"
  "20260811_01|desktop_client_enrollment_requests|applied/20260811_desktop_client_enrollment_requests.sql"
  "20260812_01|desktop_client_enrollment_activation|applied/20260812_desktop_client_enrollment_activation.sql"
  "20260813_01|desktop_client_fleet_migration|applied/20260813_desktop_client_fleet_migration.sql"
  "20260813_02|desktop_client_atomic_auth_binding|applied/20260813_02_desktop_client_atomic_auth_binding.sql"
  "20260814_01|desktop_client_auth_risk|applied/20260814_01_desktop_client_auth_risk.sql"
  "20260814_02|desktop_client_identity_bindings_live_unique|applied/20260814_02_desktop_client_identity_bindings_live_unique.sql"
  "20260816_01|music_forge_duration_default_220|applied/20260816_01_music_forge_duration_default_220.sql"
  "20260817_01|music_forge_lyrics_craft|applied/20260817_01_music_forge_lyrics_craft.sql"
  "20260817_02|music_forge_lyrics_craft_w2|applied/20260817_02_music_forge_lyrics_craft_w2.sql"
  "20260818_01|user_notification_center_dismissed_ids|applied/20260818_01_user_notification_center_dismissed_ids.sql"
  "20260819_01|desktop_calendar_events|applied/20260819_01_desktop_calendar_events.sql"
  "20260826_01|ewrp_jobs_first_slide_style|applied/20260826_ewrp_jobs_first_slide_style.sql"
  "20260830_01|web_sso_recovery_capsules|applied/20260830_01_web_sso_recovery_capsules.sql"
  "20260901_01|unified_content_broken_quarantine|applied/20260901_unified_content_broken_quarantine.sql"
  "20260902_01|image_studio_queue_enabled|applied/20260902_image_studio_queue_enabled.sql"
  "20260903_01|gaf_user_public_keys|applied/20260903_01_gaf_user_public_keys.sql"
  "20260904_01|desktop_ai_chat_rag_budget_phase3|applied/20260904_01_desktop_ai_chat_rag_budget_phase3.sql"
  "20260905_01|kursorina_missions|applied/20260905_01_kursorina_missions.sql"
  "20260905_02|desktop_app_catalog_kursorina|applied/20260905_02_desktop_app_catalog_kursorina.sql"
  "20260913_01|desktop_app_catalog_descriptions_rewrite|applied/20260913_01_desktop_app_catalog_descriptions_rewrite.sql"
  "20260915_01|desktop_app_catalog_descriptions_mode1|applied/20260915_01_desktop_app_catalog_descriptions_mode1.sql"
)

for entry in "${MIGRATIONS[@]}"; do
  IFS='|' read -r version name relpath <<< "$entry"
  if [[ -z "$version" || -z "$name" || -z "$relpath" ]]; then continue; fi
  filepath="$MIGRATIONS_DIR/$relpath"
  if [[ ! -f "$filepath" ]]; then
    echo "Skip (file missing): $relpath"
    continue
  fi
  already=$(_psql -t -A -c "SELECT 1 FROM schema_migrations WHERE version = '$version' AND name = '$name' LIMIT 1;" 2>/dev/null || echo "")
  if [[ -n "$already" ]]; then
    echo "Already applied: $version $name"
    continue
  fi
  echo "Applying: $relpath (version=$version name=$name) ..."
  if _psql_file "$filepath"; then
    _psql -t -A -c "INSERT INTO schema_migrations (version, name) VALUES ('$version', '$name');"
    echo "  OK — записано в schema_migrations"
  else
    echo "  ОШИБКА — остановка."
    exit 1
  fi
done

echo "Done."
