use crate::ask::AskRequest;

/// Only answer systemd-cryptsetup prompts for the state mapper volume.
pub fn is_state_luks_ask(req: &AskRequest) -> bool {
    if !req.id.starts_with("cryptsetup:") {
        return false;
    }
    let id_lower = req.id.to_ascii_lowercase();
    let msg_lower = req.message.to_ascii_lowercase();
    id_lower.contains("empiieros-state")
        || id_lower.contains("empiieros_state")
        || msg_lower.contains("empiieros-state")
        || msg_lower.contains("empiieros_state")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ask::{parse_ask_file, AskRequest};
    use std::path::PathBuf;

    fn assert_fixture_allowlisted(path: PathBuf) {
        let text = std::fs::read_to_string(&path).unwrap_or_else(|_| panic!("read {}", path.display()));
        let body = text
            .lines()
            .filter(|line| !line.starts_with('#'))
            .collect::<Vec<_>>()
            .join("\n");
        let req = parse_ask_file(&body).unwrap_or_else(|| panic!("parse {}", path.display()));
        assert!(is_state_luks_ask(&req), "allowlist reject {}", path.display());
    }

    #[test]
    fn fixture_sample_is_allowlisted() {
        assert_fixture_allowlisted(
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("fixtures/ask-cryptsetup-sample.ini"),
        );
    }

    #[test]
    fn captured_qemu_fixtures_are_allowlisted() {
        let dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("fixtures");
        let mut any = false;
        for entry in std::fs::read_dir(&dir).expect("fixtures dir") {
            let entry = entry.expect("entry");
            let name = entry.file_name();
            let name = name.to_string_lossy();
            if name.starts_with("ask-captured-") && name.ends_with(".ini") {
                any = true;
                assert_fixture_allowlisted(entry.path());
            }
        }
        if !any {
            eprintln!("skip: no ask-captured-*.ini yet (Phase 0 QEMU capture)");
        }
    }

    fn sample(id: &str, message: &str) -> AskRequest {
        AskRequest {
            id: id.to_string(),
            message: message.to_string(),
            pid: Some(1),
            socket: "/run/systemd/ask-password/sck.test".into(),
            echo: false,
            silent: false,
            not_after_us: 0,
        }
    }

    #[test]
    fn accepts_cryptsetup_state_by_message() {
        assert!(is_state_luks_ask(&sample(
            "cryptsetup:UUID=abc",
            "Please enter passphrase for disk empiieros-state"
        )));
    }

    #[test]
    fn rejects_polkit() {
        assert!(!is_state_luks_ask(&sample(
            "polkit-1:foo",
            "empiieros-state"
        )));
    }

    #[test]
    fn rejects_other_cryptsetup_disks() {
        assert!(!is_state_luks_ask(&sample(
            "cryptsetup:root",
            "Please enter passphrase for disk root"
        )));
    }
}
