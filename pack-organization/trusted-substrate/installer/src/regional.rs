// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---

use std::process::Command;

use crate::apply;
use crate::logutil;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Language {
    Russian,
    English,
}

impl Language {
    pub fn locale(self) -> &'static str {
        match self {
            Self::Russian => "ru_RU.UTF-8",
            Self::English => "en_US.UTF-8",
        }
    }

    pub fn label(self) -> &'static str {
        match self {
            Self::Russian => "Русский",
            Self::English => "English",
        }
    }
}

pub const TIMEZONES: &[&str] = &[
    "Europe/Moscow",
    "Europe/Kaliningrad",
    "Europe/Samara",
    "Asia/Yekaterinburg",
    "Asia/Omsk",
    "Asia/Novosibirsk",
    "Asia/Irkutsk",
    "Asia/Yakutsk",
    "Asia/Vladivostok",
    "Asia/Magadan",
    "Asia/Kamchatka",
    "Etc/UTC",
];

pub fn host_date() -> String {
    command_stdout(["date", "+%Y-%m-%d"]).unwrap_or_else(|| "2026-01-01".to_string())
}

pub fn host_time() -> String {
    command_stdout(["date", "+%H:%M"]).unwrap_or_else(|| "00:00".to_string())
}

pub fn wall_clock(date: &str, time: &str) -> Result<String, String> {
    let value = format!("{} {}", date.trim(), time.trim());
    if !valid_wall_clock(&value) {
        return Err("Дата и время: ГГГГ-ММ-ДД и ЧЧ:ММ, без NTP".to_string());
    }
    Ok(value)
}

pub fn valid_wall_clock(value: &str) -> bool {
    let bytes = value.as_bytes();
    if bytes.len() != 16 {
        return false;
    }
    let Some((date, time)) = value.split_once(' ') else {
        return false;
    };
    let date_parts: Vec<&str> = date.split('-').collect();
    let time_parts: Vec<&str> = time.split(':').collect();
    if date_parts.len() != 3 || time_parts.len() != 2 {
        return false;
    }
    let Ok(year) = date_parts[0].parse::<u16>() else {
        return false;
    };
    let Ok(month) = date_parts[1].parse::<u8>() else {
        return false;
    };
    let Ok(day) = date_parts[2].parse::<u8>() else {
        return false;
    };
    let Ok(hour) = time_parts[0].parse::<u8>() else {
        return false;
    };
    let Ok(minute) = time_parts[1].parse::<u8>() else {
        return false;
    };
    (2024..=2100).contains(&year)
        && (1..=12).contains(&month)
        && (1..=31).contains(&day)
        && hour <= 23
        && minute <= 59
        && date_parts.iter().all(|part| part.bytes().all(|b| b.is_ascii_digit()))
        && time_parts.iter().all(|part| part.bytes().all(|b| b.is_ascii_digit()))
        && date_parts[0].len() == 4
        && date_parts[1].len() == 2
        && date_parts[2].len() == 2
        && time_parts[0].len() == 2
        && time_parts[1].len() == 2
}

pub fn apply(language: Language, timezone: &str, wall_clock: &str) -> Result<(), String> {
    if !TIMEZONES.contains(&timezone) {
        return Err("Выбранный часовой пояс не поддерживается образом".to_string());
    }
    if !valid_wall_clock(wall_clock) {
        return Err("Дата и время: ГГГГ-ММ-ДД и ЧЧ:ММ, без NTP".to_string());
    }
    let output = apply::installer_helper_command()
        .args([
            "regional",
            "--locale",
            language.locale(),
            "--timezone",
            timezone,
            "--datetime",
            wall_clock,
        ])
        .output()
        .map_err(|error| format!("Не удалось сохранить региональные настройки: {error}"))?;
    if output.status.success() {
        logutil::info(&format!(
            "regional staged locale={} timezone={timezone} datetime={wall_clock}",
            language.locale()
        ));
        return Ok(());
    }
    let detail = format!(
        "{}{}",
        String::from_utf8_lossy(&output.stderr),
        String::from_utf8_lossy(&output.stdout)
    )
    .trim()
    .to_string();
    let error = if detail.is_empty() {
        format!("Региональные настройки завершились с кодом {}", output.status)
    } else {
        detail
    };
    logutil::error(&format!("regional staging failed: {error}"));
    Err(error)
}

fn command_stdout<const N: usize>(args: [&str; N]) -> Option<String> {
    let output = Command::new(args[0]).args(&args[1..]).output().ok()?;
    if !output.status.success() {
        return None;
    }
    let value = String::from_utf8(output.stdout).ok()?;
    let value = value.trim();
    if value.is_empty() {
        None
    } else {
        Some(value.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::valid_wall_clock;

    #[test]
    fn wall_clock_accepts_local_stamp_and_rejects_ntp_junk() {
        assert!(valid_wall_clock("2026-09-20 22:41"));
        assert!(!valid_wall_clock(""));
        assert!(!valid_wall_clock("now"));
        assert!(!valid_wall_clock("2026-13-20 22:41"));
        assert!(!valid_wall_clock("2026-09-20 24:00"));
    }
}
