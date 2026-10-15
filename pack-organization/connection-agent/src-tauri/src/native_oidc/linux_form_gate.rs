// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Linux WebKitGTK native form-submit gate for oidc-auth. JS preventDefault does
// not stop WebView::submit-form; empty POST /login-actions/authenticate becomes
// Keycloak error.ftl (userId=null).
// Invariants:
// - Does not log field values.
// - Blocking a submit extra-refs the request so dispose cannot auto-submit.
// - Non-IdP URIs are not gated.
// Related:
// - documentation/product/desktop/DESKTOP-ATOMIC-CONDITIONAL-ACCESS.md §9.13 / §9.14
// ---

/// Allow a Keycloak POST only when the listed fields prove a real login step.
/// Empty / GFALSE / hidden-only lists are **denied**: Keycloak WebAuthn auto-POSTs
/// a hidden form on login.ftl load (`form.submit()`, often without `submit-form`).
/// Username-only is denied (WebKit autofill of the Linux user without password).
/// OTP is allowed when `otp` is non-empty and login keys are absent.
pub fn keycloak_login_fields_allow_submit(fields: &[(String, String)]) -> bool {
    let mut user: Option<&str> = None;
    let mut pass: Option<&str> = None;
    let mut otp: Option<&str> = None;
    for (name, value) in fields {
        let key = name.trim().to_ascii_lowercase();
        if key == "username" || key == "email" {
            user = Some(value.as_str());
        } else if key == "password" {
            pass = Some(value.as_str());
        } else if key == "otp" {
            otp = Some(value.as_str());
        }
    }
    if let Some(code) = otp {
        return !code.trim().is_empty() && user.is_none() && pass.is_none();
    }
    match (user, pass) {
        (Some(u), Some(p)) => !u.trim().is_empty() && !p.is_empty(),
        _ => false,
    }
}

pub fn is_idp_form_uri(uri: &str) -> bool {
    let Ok(url) = url::Url::parse(uri) else {
        return false;
    };
    if url.scheme() != "https" {
        return false;
    }
    let Some(host) = url.host_str() else {
        return false;
    };
    let host_l = host.to_ascii_lowercase();
    let Ok(baked) = url::Url::parse(crate::native_oidc::urls::BAKED_AUTH) else {
        return false;
    };
    let Some(baked_host) = baked.host_str() else {
        return false;
    };
    let baked_l = baked_host.to_ascii_lowercase();
    host_l == baked_l || host_l.ends_with(&format!(".{baked_l}"))
}

pub fn error_page_detect_script() -> &'static str {
    r#"(function(){
try {
  var host = String(location.hostname || "").toLowerCase();
  if (host !== "auth.eliteew.ru" && host.indexOf(".auth.eliteew.ru") === -1) return "skip";
  var path = String(location.pathname || "");
  if (path.indexOf("/login-actions/error") !== -1) return "error";
  if (document.getElementById("kc-form-login")) return "login";
  if (document.querySelector("input[name='password']")) return "login";
  var t = (document.body && document.body.innerText) || "";
  if (t.indexOf("Назад в приложение") !== -1) return "error";
  if (t.indexOf("Back to Application") !== -1) return "error";
  if (t.indexOf("Мы сожалеем") !== -1) return "error";
  if (t.indexOf("We are sorry") !== -1) return "error";
  return "other";
} catch (e) {
  return "skip";
}
})()"#
}

pub fn is_error_page_detect_result(raw: &str) -> bool {
    let token = raw
        .trim()
        .trim_matches('"')
        .trim()
        .to_ascii_lowercase();
    token == "error"
}

#[cfg(target_os = "linux")]
pub fn attach_oidc_auth_native_form_gate(win: &tauri::WebviewWindow) {
    if let Err(e) = win.with_webview(|platform| {
        use webkit2gtk::{FormSubmissionRequestExt, WebViewExt};

        let webview = platform.inner();
        webview.connect_submit_form(move |view, request| {
            let uri = view.uri().map(|s| s.to_string()).unwrap_or_default();
            if !is_idp_form_uri(&uri) {
                request.submit();
                return;
            }
            let fields = unsafe { list_text_fields(request) };
            let allowed = keycloak_login_fields_allow_submit(&fields);
            eprintln!(
                "[STEP] oidc_auth_form_submit allowed={} fields={}",
                allowed as u8,
                fields.len()
            );
            if allowed {
                request.submit();
                return;
            }
            eprintln!(
                "[STEP] oidc_auth_form_block reason=empty_hidden_or_incomplete fields={}",
                fields.len()
            );
            // Dispose auto-submits when the last ref drops. Extra ref must never drop.
            std::mem::forget(request.clone());
        });
        eprintln!("[STEP] oidc_auth_form_gate attached=webkit_submit_form");
    }) {
        eprintln!("[STEP] oidc_auth_form_gate_fail err={e}");
    }
}

#[cfg(not(target_os = "linux"))]
pub fn attach_oidc_auth_native_form_gate(_win: &tauri::WebviewWindow) {}

#[cfg(target_os = "linux")]
unsafe fn list_text_fields(
    request: &webkit2gtk::FormSubmissionRequest,
) -> Vec<(String, String)> {
    use webkit2gtk::glib::translate::ToGlibPtr;

    let mut names: *mut webkit2gtk::glib::ffi::GPtrArray = std::ptr::null_mut();
    let mut values: *mut webkit2gtk::glib::ffi::GPtrArray = std::ptr::null_mut();
    let ok = webkit2gtk::ffi::webkit_form_submission_request_list_text_fields(
        request.to_glib_none().0,
        &mut names,
        &mut values,
    );
    if ok == webkit2gtk::glib::ffi::GFALSE {
        return Vec::new();
    }
    let name_vec = ptr_array_utf8(names);
    let value_vec = ptr_array_utf8(values);
    unref_ptr_array(names);
    unref_ptr_array(values);
    name_vec.into_iter().zip(value_vec).collect()
}

#[cfg(target_os = "linux")]
unsafe fn unref_ptr_array(arr: *mut webkit2gtk::glib::ffi::GPtrArray) {
    if !arr.is_null() {
        webkit2gtk::glib::ffi::g_ptr_array_unref(arr);
    }
}

#[cfg(target_os = "linux")]
unsafe fn ptr_array_utf8(arr: *mut webkit2gtk::glib::ffi::GPtrArray) -> Vec<String> {
    use std::ffi::CStr;
    if arr.is_null() {
        return Vec::new();
    }
    let arr_ref = &*arr;
    if arr_ref.pdata.is_null() {
        return Vec::new();
    }
    let mut out = Vec::with_capacity(arr_ref.len as usize);
    for i in 0..arr_ref.len {
        let p = *arr_ref.pdata.add(i as usize) as *const std::os::raw::c_char;
        if p.is_null() {
            out.push(String::new());
            continue;
        }
        out.push(CStr::from_ptr(p).to_string_lossy().into_owned());
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_username_and_password_are_blocked() {
        let fields = vec![
            ("username".into(), "".into()),
            ("password".into(), "".into()),
        ];
        assert!(!keycloak_login_fields_allow_submit(&fields));
    }

    #[test]
    fn webauth_success_payload_without_login_fields_is_blocked() {
        let fields = vec![
            ("credentialId".into(), "abc".into()),
            ("authenticatorData".into(), "xx".into()),
            ("clientDataJSON".into(), "yy".into()),
            ("signature".into(), "zz".into()),
        ];
        assert!(!keycloak_login_fields_allow_submit(&fields));
    }

    #[test]
    fn empty_field_list_is_blocked() {
        assert!(!keycloak_login_fields_allow_submit(&[]));
    }

    #[test]
    fn otp_required_action_without_login_fields_is_allowed() {
        let fields = vec![("otp".into(), "123456".into())];
        assert!(keycloak_login_fields_allow_submit(&fields));
    }

    #[test]
    fn empty_otp_is_blocked() {
        let fields = vec![("otp".into(), "".into())];
        assert!(!keycloak_login_fields_allow_submit(&fields));
    }

    #[test]
    fn webauth_hidden_form_without_login_fields_is_blocked() {
        let fields = vec![
            ("error".into(), "NotAllowedError".into()),
            ("credentialId".into(), "".into()),
        ];
        assert!(!keycloak_login_fields_allow_submit(&fields));
    }

    #[test]
    fn filled_username_and_password_are_allowed() {
        let fields = vec![
            ("username".into(), "poet@example.com".into()),
            ("password".into(), "secret".into()),
            ("credentialId".into(), "".into()),
        ];
        assert!(keycloak_login_fields_allow_submit(&fields));
    }

    #[test]
    fn username_only_non_empty_is_blocked() {
        let fields = vec![("username".into(), "poet@example.com".into())];
        assert!(!keycloak_login_fields_allow_submit(&fields));
    }

    #[test]
    fn whitespace_username_is_blocked() {
        let fields = vec![
            ("username".into(), "  ".into()),
            ("password".into(), "secret".into()),
        ];
        assert!(!keycloak_login_fields_allow_submit(&fields));
    }

    #[test]
    fn idp_host_matches_baked_auth() {
        assert!(is_idp_form_uri(
            "https://auth.eliteew.ru/realms/empery/login-actions/authenticate"
        ));
        assert!(!is_idp_form_uri("https://app.eliteew.ru/"));
        assert!(!is_idp_form_uri("http://auth.eliteew.ru/realms/empery/login-actions/authenticate"));
    }

    #[test]
    fn error_page_token_parses_json_string() {
        assert!(is_error_page_detect_result("\"error\""));
        assert!(is_error_page_detect_result("error"));
        assert!(!is_error_page_detect_result("\"login\""));
        assert!(!is_error_page_detect_result("skip"));
        assert!(error_page_detect_script().contains("kc-form-login"));
        assert!(error_page_detect_script().contains("Назад в приложение"));
    }
}
