// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Persist non-secret ai.third_party settings (base URL + model) under app data.
// Invariants:
// - Never stores API keys (origin-bound keyring only).
// Related:
// - commands/ai_third_party.rs
// ---

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

const REL: &str = "ai_third_party_settings.json";

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ThirdPartyAiSettings {
    #[serde(default)]
    pub base_url: String,
    #[serde(default)]
    pub model: String,
}

pub fn settings_path(app_data: &Path) -> PathBuf {
    app_data.join(REL)
}

pub fn load(app_data: &Path) -> Result<ThirdPartyAiSettings, String> {
    let path = settings_path(app_data);
    if !path.exists() {
        return Ok(ThirdPartyAiSettings::default());
    }
    let raw = fs::read_to_string(&path).map_err(|e| format!("read_settings: {e}"))?;
    serde_json::from_str(&raw).map_err(|e| format!("parse_settings: {e}"))
}

pub fn save(app_data: &Path, settings: &ThirdPartyAiSettings) -> Result<(), String> {
    fs::create_dir_all(app_data).map_err(|e| format!("app_data: {e}"))?;
    let path = settings_path(app_data);
    let raw = serde_json::to_string_pretty(settings).map_err(|e| format!("serialize: {e}"))?;
    fs::write(&path, raw).map_err(|e| format!("write_settings: {e}"))
}

/// Local factory-reset (W5b): remove non-secret AI settings file. Idempotent when absent.
pub fn clear(app_data: &Path) -> Result<(), String> {
    let path = settings_path(app_data);
    match fs::remove_file(&path) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(format!("clear_ai_third_party_settings: {e}")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    #[test]
    fn roundtrip_settings() {
        let dir = env::temp_dir().join(format!(
            "eliteew-ai3p-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let s = ThirdPartyAiSettings {
            base_url: "https://api.openai.com/v1".into(),
            model: "gpt-4o-mini".into(),
        };
        save(&dir, &s).unwrap();
        let loaded = load(&dir).unwrap();
        assert_eq!(loaded.base_url, s.base_url);
        assert_eq!(loaded.model, s.model);
        let _ = fs::remove_dir_all(&dir);
    }
}
