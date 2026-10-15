// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Defense-in-depth caller checks for Tauri commands after capability ACL evaluation.
// Invariants:
// - Privileged launcher actions accept only the local `main` window.
// - Product-scoped actions accept only the local `main` or `product` windows.
// Related:
// - documentation/product/desktop/DESKTOP-CLIENT-SECURITY-BOUNDARIES.md
// ---

use tauri::Window;

fn require_label(label: &str, allowed: &[&str]) -> Result<(), String> {
    if allowed.contains(&label) {
        return Ok(());
    }
    eprintln!("[STEP] caller_context_deny window={label}");
    Err("caller_context_denied".into())
}

pub fn require_main_window(window: &Window) -> Result<(), String> {
    require_label(window.label(), &["main"])
}

pub fn require_product_window(window: &Window) -> Result<(), String> {
    require_label(window.label(), &["product"])
}

pub fn require_main_or_product(window: &Window) -> Result<(), String> {
    require_label(window.label(), &["main", "product"])
}

#[cfg(test)]
mod tests {
    use super::require_label;

    #[test]
    fn main_only_rejects_product_and_remote_labels() {
        assert!(require_label("main", &["main"]).is_ok());
        assert_eq!(
            require_label("product", &["main"]).unwrap_err(),
            "caller_context_denied"
        );
        assert!(require_label("oauth", &["main"]).is_err());
    }

    #[test]
    fn product_scope_rejects_unknown_labels() {
        assert!(require_label("main", &["main", "product"]).is_ok());
        assert!(require_label("product", &["main", "product"]).is_ok());
        assert!(require_label("remote", &["main", "product"]).is_err());
    }
}
