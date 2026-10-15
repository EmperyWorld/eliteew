// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Earliest possible: before any Tauri/WebKit init in run().
    desktop_client_lib::ensure_w_transport_packaged_default();
    desktop_client_lib::apply_linux_graphics_before_webview();
    desktop_client_lib::run()
}
