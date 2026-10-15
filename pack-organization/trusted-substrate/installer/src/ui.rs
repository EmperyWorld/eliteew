// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---

//! Branded multi-step installer UI — FHD wizard shell, palette v2 cyan/metal.

use std::path::{Path, PathBuf};
use std::sync::mpsc::Receiver;
use std::time::{Duration, Instant};

use eframe::egui::{
    self, Align, Align2, Color32, CornerRadius, FontFamily, FontId, Frame, Layout, ProgressBar,
    RichText, Sense, Stroke, TextureHandle, Vec2,
};
use egui_extras::install_image_loaders;

use crate::apply::{self, ApplyEvent, DiskInfo, StateRecoveryMode};
use crate::audio;
use crate::brand::{self, ACCENT, ACCENT_BRIGHT, DANGER, ELEVATED, HAIR, INK, LIME, LIME_SOFT, MUTED, PANEL, TEXT, TRACK};
use crate::logutil;
use crate::net::{self, NetMode, NetStatus, NetworkEvent, StaticForm, WifiNetwork};
use crate::regional::{self, Language};

/// Operator-facing install milestones (no package or tool names).
const ROADMAP_STEPS: &[&str] = &[
    "Проверка",
    "Разметка",
    "Том данных",
    "Система",
    "Загрузчик",
];

const WIZARD_STEPS: &[(&str, &str)] = &[
    ("Приветствие", "welcome"),
    ("Регион", "regional"),
    ("Сеть", "network"),
    ("Диск", "disk"),
    ("Ключ диска", "state-key"),
    ("Подтверждение", "confirm"),
    ("Установка", "progress"),
    ("Готово", "done"),
];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Step {
    Welcome,
    Regional,
    Network,
    Disk,
    StateKey,
    Confirm,
    Progress,
    Done,
    Failed,
}

pub struct InstallerApp {
    step: Step,
    logo: Option<TextureHandle>,
    splash: Option<TextureHandle>,
    net_mode: NetMode,
    static_form: StaticForm,
    net_status: NetStatus,
    net_error: Option<String>,
    net_message: Option<String>,
    network_rx: Option<Receiver<NetworkEvent>>,
    selected_interface: String,
    wifi_networks: Vec<WifiNetwork>,
    selected_wifi: Option<String>,
    wifi_passphrase: String,
    wifi_country: String,
    language: Language,
    timezone: String,
    clock_date: String,
    clock_time: String,
    regional_error: Option<String>,
    disks: Vec<DiskInfo>,
    selected_disk: Option<String>,
    confirm_typed: String,
    progress_lines: Vec<String>,
    /// Smoothed 0..1 bar (lerps toward [`Self::progress_target`]).
    progress_display: f32,
    progress_target: f32,
    apply_rx: Option<Receiver<ApplyEvent>>,
    fail_message: Option<String>,
    last_net_refresh: Instant,
    /// Wall clock when extract phase first observed (time-based bar creep).
    extract_started: Option<Instant>,
    first_boot_pin: Option<String>,
    state_recovery: Option<String>,
    pin_ack_typed: String,
    state_key_mode: StateRecoveryMode,
    state_key_secret: String,
    state_key_confirm: String,
    state_key_error: Option<String>,
    /// When set, save a viewport PNG after a few repaints (headless UX capture).
    capture_out: Option<String>,
    capture_frames: u32,
}

impl InstallerApp {
    pub fn new(cc: &eframe::CreationContext<'_>) -> Self {
        brand::apply_visuals(&cc.egui_ctx);
        install_system_fonts(&cc.egui_ctx);
        install_image_loaders(&cc.egui_ctx);
        let logo = load_logo(&cc.egui_ctx);
        let splash = load_splash(&cc.egui_ctx);
        // Session may already have fired power-on aplay (ELITEEW_TS_CHIME_ALREADY=1).
        if std::env::var_os("ELITEEW_TS_CHIME_ALREADY").is_none() {
            audio::play_chime();
        }
        let mut app = Self {
            step: Step::Welcome,
            logo,
            splash,
            net_mode: NetMode::Dhcp,
            static_form: StaticForm::default(),
            net_status: net::refresh_status(),
            net_error: None,
            net_message: None,
            network_rx: None,
            selected_interface: String::new(),
            wifi_networks: Vec::new(),
            selected_wifi: None,
            wifi_passphrase: String::new(),
            wifi_country: "RU".to_string(),
            language: Language::Russian,
            timezone: "Asia/Vladivostok".to_string(),
            clock_date: regional::host_date(),
            clock_time: regional::host_time(),
            regional_error: None,
            disks: apply::list_disks(),
            selected_disk: None,
            confirm_typed: String::new(),
            progress_lines: Vec::new(),
            progress_display: 0.0,
            progress_target: 0.0,
            apply_rx: None,
            fail_message: None,
            last_net_refresh: Instant::now(),
            extract_started: None,
            first_boot_pin: None,
            state_recovery: None,
            pin_ack_typed: String::new(),
            state_key_mode: StateRecoveryMode::Auto,
            state_key_secret: String::new(),
            state_key_confirm: String::new(),
            state_key_error: None,
            capture_out: std::env::var("ELITEEW_TS_INSTALLER_CAPTURE_OUT").ok(),
            capture_frames: 0,
        };
        app.select_mode_interface();
        app.apply_capture_env();
        app
    }

    /// Fixture data for `ELITEEW_TS_INSTALLER_STEP` + `EFRAME_SCREENSHOT_TO` captures.
    fn apply_capture_env(&mut self) {
        if std::env::var_os("ELITEEW_TS_INSTALLER_STEP").is_none() {
            return;
        }
        self.net_status = Self::capture_net_status();
        self.net_mode = NetMode::Dhcp;
        self.selected_interface = "enp0s3".to_string();
        self.static_form.iface = "enp0s3".to_string();
        if let Ok(step) = std::env::var("ELITEEW_TS_INSTALLER_STEP") {
            self.apply_capture_step(&step);
        }
    }

    fn capture_net_status() -> NetStatus {
        NetStatus {
            ifaces: vec![net::NetworkInterface {
                name: "enp0s3".to_string(),
                kind: "ethernet",
                carrier: true,
                driver: "e1000".to_string(),
                mac: "52:54:00:12:34:56".to_string(),
            }],
            pci_devices: Vec::new(),
            summary: "кабель подключён · enp0s3".to_string(),
        }
    }

    fn capture_mock_disk() -> DiskInfo {
        DiskInfo {
            path: "/dev/nvme0n1".to_string(),
            size: "512 GB".to_string(),
            model: "Example NVMe".to_string(),
            removable: false,
            serial: "CAPTURE0001".to_string(),
            firmware: "1.0".to_string(),
            logical_sector: 512,
            physical_sector: 512,
            rotational: false,
            health: "PASSED".to_string(),
            partitions: vec!["nvme0n1p1".to_string()],
            identity: "nvme-Example".to_string(),
            skip_reason: None,
        }
    }

    fn drain_capture_screenshot(&mut self, ctx: &egui::Context) -> bool {
        let mut ok = false;
        ctx.input(|input| {
            for event in &input.events {
                if let egui::Event::Screenshot { image, user_data, .. } = event {
                    let Some(data) = &user_data.data else {
                        continue;
                    };
                    let Some(path) = data.downcast_ref::<String>() else {
                        continue;
                    };
                    if save_rgba_png(path, image).is_ok() {
                        ok = true;
                    }
                }
            }
        });
        ok
    }

    fn apply_capture_step(&mut self, step: &str) {
        use Step::{
            Confirm, Disk, Done, Failed, Network, Progress, Regional, StateKey, Welcome,
        };
        match step {
            "Welcome" => self.step = Welcome,
            "Regional" => self.step = Regional,
            "Network" => self.step = Network,
            "Disk" => {
                self.step = Disk;
                self.disks = vec![Self::capture_mock_disk()];
                self.selected_disk = Some("/dev/nvme0n1".to_string());
            }
            "StateKey" => {
                self.step = StateKey;
                self.disks = vec![Self::capture_mock_disk()];
                self.selected_disk = Some("/dev/nvme0n1".to_string());
            }
            "Confirm" => {
                self.step = Confirm;
                self.disks = vec![Self::capture_mock_disk()];
                self.selected_disk = Some("/dev/nvme0n1".to_string());
                self.confirm_typed = "ERASE nvme0n1".to_string();
            }
            "Progress" => {
                self.step = Progress;
                self.progress_display = 0.62;
                self.progress_target = 0.62;
                self.progress_lines = vec!["[APPLY] extract rootfs.tar.gz".to_string()];
            }
            "Done" => {
                self.step = Done;
                self.first_boot_pin = Some("4827".to_string());
                self.state_recovery =
                    Some("e3e6-8083-eb13-5538-ea6b-5512-3ce3-03e7".to_string());
            }
            "Failed" => {
                self.step = Failed;
                self.fail_message = Some(
                    "Не удалось записать разметку: диск занят другой системой.".to_string(),
                );
                self.disks = vec![Self::capture_mock_disk()];
                self.selected_disk = Some("/dev/nvme0n1".to_string());
            }
            other => logutil::info(&format!("capture: unknown step {other:?}, keeping Welcome")),
        }
    }

    fn select_mode_interface(&mut self) {
        let want = match self.net_mode {
            NetMode::Wifi => "wifi",
            NetMode::Dhcp | NetMode::Static => "ethernet",
            NetMode::Skip => return,
        };
        if self
            .net_status
            .ifaces
            .iter()
            .any(|interface| interface.name == self.selected_interface && interface.kind == want)
        {
            return;
        }
        self.selected_interface = self
            .net_status
            .ifaces
            .iter()
            .find(|interface| interface.kind == want)
            .map(|interface| interface.name.clone())
            .unwrap_or_default();
        self.static_form.iface = self.selected_interface.clone();
    }

    fn go(&mut self, step: Step) {
        logutil::info(&format!("step -> {step:?}"));
        self.step = step;
        // Power-on already played in session when ELITEEW_TS_CHIME_ALREADY=1.
        // Skip Welcome chime to avoid overlap; Network/Done still chime (serial aplay).
        if matches!(step, Step::Done | Step::Network)
            || (matches!(step, Step::Welcome)
                && std::env::var_os("ELITEEW_TS_CHIME_ALREADY").is_none())
        {
            audio::play_chime();
        }
    }

    fn note_extract_phase(&mut self) {
        let blob = self.progress_lines.join("\n").to_ascii_lowercase();
        if blob.contains("extract")
            && !blob.contains("extract complete")
            && !blob.contains("grub-install")
            && self.extract_started.is_none()
        {
            self.extract_started = Some(Instant::now());
        }
    }
}

impl eframe::App for InstallerApp {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        if self.drain_capture_screenshot(ctx) {
            std::process::exit(0);
        }
        if self.capture_out.is_some() {
            self.capture_frames = self.capture_frames.saturating_add(1);
            if self.capture_frames == 12 {
                if let Some(path) = self.capture_out.clone() {
                    ctx.send_viewport_cmd(egui::ViewportCommand::Screenshot(
                        egui::UserData::new(path),
                    ));
                }
            } else if self.capture_frames < 12 {
                ctx.request_repaint();
            }
        }
        consume_dangerous_shortcuts(ctx);
        // No continuous animation loop — was ~8–30 FPS full redraw on CPU/pixman.
        // Repaint only on input, net poll, or apply progress.
        if self.last_net_refresh.elapsed() > Duration::from_secs(3)
            && matches!(self.step, Step::Network | Step::Welcome)
        {
            self.net_status = net::refresh_status();
            self.last_net_refresh = Instant::now();
            ctx.request_repaint_after(Duration::from_secs(3));
        }
        let network_event = self
            .network_rx
            .as_ref()
            .and_then(|receiver| receiver.try_recv().ok());
        if let Some(event) = network_event {
            self.network_rx = None;
            match event {
                NetworkEvent::Applied(Ok(message)) => {
                    self.net_error = None;
                    self.net_message = Some(message);
                    self.net_status = net::refresh_status();
                    self.disks = apply::list_disks();
                    self.go(Step::Disk);
                }
                NetworkEvent::Applied(Err(error)) => {
                    self.net_error = Some(error);
                }
                NetworkEvent::Scanned(Ok(networks)) => {
                    self.net_error = None;
                    self.net_message = Some(format!(
                        "Найдено сетей: {}. Выберите точку доступа.",
                        networks.len()
                    ));
                    self.wifi_networks = networks;
                    if !self
                        .selected_wifi
                        .as_deref()
                        .is_some_and(|ssid| self.wifi_networks.iter().any(|n| n.ssid == ssid))
                    {
                        self.selected_wifi = None;
                    }
                }
                NetworkEvent::Scanned(Err(error)) => {
                    self.net_error = Some(error);
                    self.wifi_networks.clear();
                    self.selected_wifi = None;
                }
            }
        }
        if self.network_rx.is_some() {
            ctx.request_repaint_after(Duration::from_millis(100));
        }
        if matches!(self.step, Step::Progress) || self.apply_rx.is_some() {
            // Smooth bar: ~60 Hz while installing.
            ctx.request_repaint_after(Duration::from_millis(16));
            self.note_extract_phase();
            let target = phase_fraction(&self.progress_lines, self.extract_started);
            self.progress_target = target;
            let dt = ctx.input(|i| i.stable_dt).clamp(1.0 / 120.0, 1.0 / 20.0);
            let speed = 1.85_f32; // approach rate (1/e seconds ≈ 0.54s)
            self.progress_display += (self.progress_target - self.progress_display) * (1.0 - (-speed * dt).exp());
            if self.progress_display > self.progress_target {
                self.progress_display = self.progress_target;
            }
        }

        let mut apply_done: Option<Result<(), String>> = None;
        let mut new_lines: Vec<String> = Vec::new();
        if let Some(rx) = &self.apply_rx {
            while let Ok(ev) = rx.try_recv() {
                match ev {
                    ApplyEvent::Line(line) => {
                        new_lines.push(sanitize_progress_line(&line));
                    }
                    ApplyEvent::Done(r) => apply_done = Some(r),
                }
            }
        }
        if !new_lines.is_empty() {
            self.progress_lines.extend(new_lines);
            self.note_extract_phase();
            self.progress_target = phase_fraction(&self.progress_lines, self.extract_started);
        }
        if let Some(r) = apply_done {
            self.apply_rx = None;
            self.progress_target = 1.0;
            self.progress_display = 1.0;
            match r {
                Ok(()) => match (apply::read_first_boot_pin(), apply::read_state_recovery()) {
                    (Ok(pin), Ok(recovery)) => {
                        self.first_boot_pin = Some(pin);
                        self.state_recovery = Some(recovery);
                        self.pin_ack_typed.clear();
                        logutil::info("first-boot PIN ready for operator reveal");
                        logutil::info("state recovery ready for operator reveal");
                        self.go(Step::Done);
                    }
                    (Err(error), _) | (_, Err(error)) => {
                        self.fail_message = Some(error);
                        self.go(Step::Failed);
                    }
                },
                Err(e) => {
                    self.fail_message = Some(e);
                    self.go(Step::Failed);
                }
            }
        }

        egui::CentralPanel::default()
            .frame(Frame::NONE.fill(INK))
            .show(ctx, |ui| {
                if std::env::var_os("ELITEEW_TS_INSTALL_SPLASH_BACKDROP").is_some() {
                    paint_splash_backdrop(ui, self.splash.as_ref());
                } else {
                    paint_subtle_grid(ui);
                }
                ui.add_space(18.0);
                wizard_topbar(ui, self.logo.as_ref(), self.step);
                ui.add_space(10.0);
                wizard_step_rail(ui, self.step);
                ui.add_space(22.0);
                let wizard_h = ui.available_height().max(320.0);
                egui::ScrollArea::vertical()
                    .id_salt("installer_wizard_body")
                    .max_height(wizard_h)
                    .auto_shrink([false; 2])
                    .show(ui, |ui| {
                        ui.horizontal(|ui| {
                            ui.add_space(48.0);
                            ui.vertical(|ui| {
                                ui.set_max_width(1040.0);
                                match self.step {
                                    Step::Welcome => self.ui_welcome(ui),
                                    Step::Regional => self.ui_regional(ui),
                                    Step::Network => self.ui_network(ui),
                                    Step::Disk => self.ui_disk(ui),
                                    Step::StateKey => self.ui_state_key(ui),
                                    Step::Confirm => self.ui_confirm(ui),
                                    Step::Progress => self.ui_progress(ui),
                                    Step::Done => self.ui_done(ui),
                                    Step::Failed => self.ui_failed(ui),
                                }
                            });
                            ui.add_space(48.0);
                            ui.vertical(|ui| {
                                ui.set_max_width(380.0);
                                self.ui_aside(ui);
                            });
                            ui.add_space(48.0);
                        });
                    });
            });
    }
}

impl InstallerApp {
    fn ui_aside(&self, ui: &mut egui::Ui) {
        match self.step {
            Step::Welcome => {
                aside_heading(ui, "ПУТЬ");
                ui.label(
                    RichText::new(
                        "8 шагов: регион и сеть, диск, ключ LUKS, подтверждение ERASE, запись системы, PIN и ключ диска один раз.",
                    )
                    .size(13.5)
                    .color(MUTED),
                );
            }
            Step::Regional => {
                aside_heading(ui, "ЗАЧЕМ ВРУЧНУЮ");
                ui.label(
                    RichText::new(
                        "NTP и интернет не подстраивают часы в установщике.\nПояс влияет на журналы и первую загрузку.\nЯзык применится к установщику и системе.",
                    )
                    .size(13.5)
                    .color(MUTED),
                );
            }
            Step::Network => {
                aside_heading(ui, "РЕЖИМЫ");
                ui.label(
                    RichText::new(
                        "Авто — DHCP на выбранном интерфейсе.\nВручную — IP / шлюз / DNS.\nWi‑Fi — SSID и пароль.\nПропустить — офлайн; настройки не переносятся.",
                    )
                    .size(13.5)
                    .color(MUTED),
                );
            }
            Step::Disk => {
                aside_heading(ui, "ВНИМАНИЕ");
                ui.label(
                    RichText::new(
                        "Носитель установщика не выбирается.\nФактическое стирание — только после typed ERASE на шаге 6.",
                    )
                    .size(13.5)
                    .color(MUTED),
                );
            }
            Step::StateKey => {
                aside_heading(ui, "ТРИ СЕКРЕТА");
                ui.label(
                    RichText::new("PIN · вход после первой загрузки")
                        .size(13.5)
                        .color(ACCENT_BRIGHT),
                );
                ui.label(
                    RichText::new("Ключ диска · LUKS recovery (этот шаг)")
                        .size(13.5)
                        .color(MUTED),
                );
                ui.label(
                    RichText::new("Ключ сети · Wi‑Fi PSK, не путать с PIN")
                        .size(13.5)
                        .color(MUTED),
                );
            }
            Step::Confirm => {
                aside_heading(ui, "ПЕРЕД УСТАНОВКОЙ");
                ui.label(
                    RichText::new(
                        "Проверьте диск и сводку. После «Установить» разметка необратима.",
                    )
                    .size(13.5)
                    .color(MUTED),
                );
            }
            Step::Progress => {
                aside_heading(ui, "ФАЗЫ");
                for title in ROADMAP_STEPS {
                    ui.label(RichText::new(format!("· {title}")).size(13.0).color(MUTED));
                }
            }
            Step::Done => {
                aside_heading(ui, "КУДА ВВОДИТЬ");
                ui.label(
                    RichText::new("PIN — экран разблокировки после установки.")
                        .size(13.5)
                        .color(MUTED),
                );
                ui.label(
                    RichText::new("Ключ диска — консоль LUKS recovery (не PIN).")
                        .size(13.5)
                        .color(MUTED),
                );
            }
            Step::Failed => {
                aside_heading(ui, "ЧТО ДЕЛАТЬ");
                ui.label(
                    RichText::new(
                        "Диск после сбоя может быть частично записан.\nЖурнал: install-fail.log на носителе.\nПовтор или выбор другого диска.",
                    )
                    .size(13.5)
                    .color(MUTED),
                );
            }
        }
    }

    fn ui_welcome(&mut self, ui: &mut egui::Ui) {
        card(ui, |ui| {
            ui.label(
                RichText::new("EMPIIEROS")
                    .size(13.0)
                    .color(LIME)
                    .strong(),
            );
            ui.add_space(6.0);
            ui.label(
                RichText::new("Установка системы")
                    .size(30.0)
                    .color(Color32::WHITE)
                    .strong(),
            );
            ui.add_space(10.0);
            ui.label(
                RichText::new(
                    "Внутренний диск и при необходимости сеть. PIN и ключ диска покажем один раз на экране «Готово».",
                )
                .size(15.0)
                .color(MUTED),
            );
            ui.add_space(14.0);
            network_status_chip(ui, &net_summary_plain(&self.net_status.summary));
            ui.add_space(28.0);
            if primary_button(ui, "Начать").clicked() {
                self.go(Step::Regional);
            }
        });
    }

    fn ui_regional(&mut self, ui: &mut egui::Ui) {
        card(ui, |ui| {
            ui.label(
                RichText::new("Язык, пояс и время")
                    .size(26.0)
                    .color(Color32::WHITE),
            );
            ui.label(
                RichText::new("Укажите местное время. Интернет его не подстраивает.")
                    .size(14.0)
                    .color(MUTED),
            );
            ui.add_space(16.0);
            ui.label(RichText::new("Язык интерфейса").color(MUTED));
            ui.horizontal(|ui| {
                for language in [Language::Russian, Language::English] {
                    if ui
                        .selectable_label(self.language == language, language.label())
                        .clicked()
                    {
                        self.language = language;
                    }
                }
            });
            ui.add_space(12.0);
            ui.label(RichText::new("Часовой пояс").color(MUTED));
            egui::ComboBox::from_id_salt("timezone")
                .selected_text(&self.timezone)
                .width(320.0)
                .show_ui(ui, |ui| {
                    for timezone in regional::TIMEZONES {
                        ui.selectable_value(
                            &mut self.timezone,
                            (*timezone).to_string(),
                            *timezone,
                        );
                    }
                });
            ui.add_space(12.0);
            ui.label(RichText::new("Дата и время (местное)").color(MUTED));
            labeled_field(ui, "Дата", &mut self.clock_date);
            labeled_field(ui, "Время", &mut self.clock_time);
            ui.label(
                RichText::new("Формат даты: ГГГГ-ММ-ДД, времени: ЧЧ:ММ.")
                    .size(13.0)
                    .color(MUTED),
            );
            if let Some(error) = &self.regional_error {
                ui.add_space(8.0);
                ui.colored_label(DANGER, error);
            }
            ui.add_space(20.0);
            ui.horizontal(|ui| {
                if secondary_button(ui, "Назад").clicked() {
                    self.regional_error = None;
                    self.go(Step::Welcome);
                }
                if primary_button(ui, "Далее").clicked() {
                    self.regional_error = None;
                    match regional::wall_clock(&self.clock_date, &self.clock_time)
                        .and_then(|stamp| regional::apply(self.language, &self.timezone, &stamp))
                    {
                        Ok(()) => self.go(Step::Network),
                        Err(error) => self.regional_error = Some(error),
                    }
                }
            });
        });
    }

    fn ui_network(&mut self, ui: &mut egui::Ui) {
        let interfaces = self.net_status.ifaces.clone();
        let busy = self.network_rx.is_some();
        card(ui, |ui| {
            ui.label(RichText::new("Сеть").size(26.0).color(Color32::WHITE));
            ui.label(
                RichText::new("Настройки сети перенесутся на установленное устройство.")
                    .size(14.0)
                    .color(MUTED),
            );
            ui.add_space(12.0);
            ui.horizontal(|ui| {
                let previous_mode = self.net_mode;
                mode_chip(ui, &mut self.net_mode, NetMode::Dhcp, "Авто");
                mode_chip(ui, &mut self.net_mode, NetMode::Static, "Вручную");
                mode_chip(ui, &mut self.net_mode, NetMode::Wifi, "Wi‑Fi");
                mode_chip(ui, &mut self.net_mode, NetMode::Skip, "Пропустить");
                if self.net_mode != previous_mode {
                    self.select_mode_interface();
                    self.net_error = None;
                }
            });
            ui.add_space(12.0);
            ui.label(RichText::new(&self.net_status.summary).color(LIME_SOFT));
            if !self.net_status.pci_devices.is_empty() {
                ui.add_space(6.0);
                ui.label(RichText::new("PCI сеть").size(13.0).color(MUTED));
                for device in &self.net_status.pci_devices {
                    ui.label(RichText::new(device).size(12.0).color(MUTED));
                }
            }

            if self.net_mode != NetMode::Skip {
                ui.add_space(10.0);
                ui.label(RichText::new("Сетевой интерфейс").color(MUTED));
                for interface in &interfaces {
                    let applicable = match self.net_mode {
                        NetMode::Wifi => interface.kind == "wifi",
                        NetMode::Dhcp | NetMode::Static => interface.kind == "ethernet",
                        NetMode::Skip => false,
                    };
                    if !applicable {
                        continue;
                    }
                    let selected = self.selected_interface == interface.name;
                    let state = if interface.carrier {
                        "подключён"
                    } else {
                        "нет кабеля"
                    };
                    let label = format!(
                        "{} · {} · {} · {} · {}",
                        interface.name,
                        if interface.kind == "wifi" {
                            "Wi‑Fi"
                        } else {
                            "Ethernet"
                        },
                        state,
                        interface.driver,
                        interface.mac
                    );
                    if ui.selectable_label(selected, label).clicked() {
                        self.selected_interface = interface.name.clone();
                        self.static_form.iface = interface.name.clone();
                        self.net_error = None;
                    }
                }
                let has_applicable = interfaces.iter().any(|interface| match self.net_mode {
                    NetMode::Wifi => interface.kind == "wifi",
                    NetMode::Dhcp | NetMode::Static => interface.kind == "ethernet",
                    NetMode::Skip => false,
                });
                if !has_applicable {
                    ui.colored_label(
                        DANGER,
                        if self.net_mode == NetMode::Wifi {
                            "Wi‑Fi адаптер не найден. Проверьте оборудование или выберите «Пропустить»."
                        } else {
                            "Проводной интерфейс не найден."
                        },
                    );
                }
            }

            if self.net_mode == NetMode::Static {
                ui.add_space(8.0);
                labeled_field(ui, "Адрес (CIDR)", &mut self.static_form.address_cidr);
                labeled_field(ui, "Шлюз", &mut self.static_form.gateway);
                labeled_field(ui, "DNS", &mut self.static_form.dns);
            }

            if self.net_mode == NetMode::Wifi {
                ui.add_space(10.0);
                ui.horizontal(|ui| {
                    ui.add_enabled_ui(!busy && !self.selected_interface.is_empty(), |ui| {
                        if secondary_button(ui, "Сканировать").clicked() {
                            self.net_error = None;
                            self.net_message = Some("Сканирование Wi‑Fi…".to_string());
                            self.network_rx =
                                Some(net::start_wifi_scan(self.selected_interface.clone()));
                        }
                    });
                    labeled_field(ui, "Страна", &mut self.wifi_country);
                });
                egui::ScrollArea::vertical().max_height(150.0).show(ui, |ui| {
                    for network in &self.wifi_networks {
                        let selected = self.selected_wifi.as_deref() == Some(network.ssid.as_str());
                        let label = format!("{} · {}%", network.ssid, network.signal_percent);
                        if ui.selectable_label(selected, label).clicked() {
                            if self.selected_wifi.as_deref() != Some(network.ssid.as_str()) {
                                self.wifi_passphrase.clear();
                            }
                            self.selected_wifi = Some(network.ssid.clone());
                        }
                    }
                });
                if let Some(ssid) = &self.selected_wifi {
                    ui.label(
                        RichText::new(format!("Выбрана сеть: {ssid}"))
                            .size(14.0)
                            .color(LIME_SOFT),
                    );
                } else if !self.wifi_networks.is_empty() {
                    ui.colored_label(DANGER, "Кликните сеть в списке. Сама она не выбирается.");
                }
                let selected_is_open = self
                    .wifi_networks
                    .iter()
                    .find(|network| {
                        self.selected_wifi.as_deref() == Some(network.ssid.as_str())
                    })
                    .is_some_and(|network| network.security == "open");
                if self.selected_wifi.is_some() && !selected_is_open {
                    ui.horizontal(|ui| {
                        ui.set_min_width(140.0);
                        ui.label(RichText::new("Пароль Wi‑Fi").color(MUTED));
                        ui.add_sized(
                            [360.0, 32.0],
                            egui::TextEdit::singleline(&mut self.wifi_passphrase).password(true),
                        );
                    });
                    ui.label(
                        RichText::new(
                            "8–63 латинских символа. Alt+Shift переключает EN/RU.",
                        )
                        .size(13.0)
                        .color(MUTED),
                    );
                }
            }

            if let Some(message) = &self.net_message {
                ui.add_space(8.0);
                ui.colored_label(LIME_SOFT, message);
            }
            if let Some(err) = &self.net_error {
                ui.colored_label(DANGER, err);
            }
            if busy {
                ui.label(RichText::new("Операция выполняется…").color(LIME));
            }

            ui.add_space(20.0);
            ui.horizontal(|ui| {
                if secondary_button(ui, "Назад").clicked() {
                    self.net_error = None;
                    self.go(Step::Regional);
                }
                ui.add_enabled_ui(!busy, |ui| {
                    if primary_button(ui, "Далее").clicked() {
                        self.net_error = None;
                        self.net_message = None;
                        match self.net_mode {
                            NetMode::Skip => {
                                self.disks = apply::list_disks();
                                self.go(Step::Disk);
                            }
                            NetMode::Dhcp => {
                                if self.selected_interface.is_empty() {
                                    self.net_error =
                                        Some("Выберите проводной интерфейс".to_string());
                                } else {
                                    self.network_rx =
                                        Some(net::start_dhcp(self.selected_interface.clone()));
                                }
                            }
                            NetMode::Static => {
                                if self.static_form.address_cidr.trim().is_empty() {
                                    self.net_error =
                                        Some("Укажите адрес (CIDR). Лабораторный адрес не подставляется.".to_string());
                                } else {
                                    self.static_form.iface = self.selected_interface.clone();
                                    self.network_rx =
                                        Some(net::start_static(self.static_form.clone()));
                                }
                            }
                            NetMode::Wifi => {
                                let Some(ssid) = self.selected_wifi.clone() else {
                                    self.net_error =
                                        Some("Сначала просканируйте и выберите Wi‑Fi сеть".to_string());
                                    return;
                                };
                                if self.selected_interface.is_empty() {
                                    self.net_error =
                                        Some("Выберите Wi‑Fi интерфейс".to_string());
                                    return;
                                }
                                let security = self
                                    .wifi_networks
                                    .iter()
                                    .find(|network| network.ssid == ssid)
                                    .map(|network| network.security.clone())
                                    .unwrap_or_else(|| "wpa2".to_string());
                                self.net_message = Some(format!(
                                    "Подключаю «{ssid}» на {}…",
                                    self.selected_interface
                                ));
                                self.network_rx = Some(net::start_wifi_connect(
                                    self.selected_interface.clone(),
                                    ssid,
                                    self.wifi_passphrase.clone(),
                                    security,
                                    self.wifi_country.trim().to_ascii_uppercase(),
                                ));
                            }
                        }
                    }
                });
            });
        });
    }

    fn ui_disk(&mut self, ui: &mut egui::Ui) {
        card(ui, |ui| {
            ui.label(RichText::new("Диск").size(28.0).color(TEXT));
            ui.label(
                RichText::new("Выберите внутренний диск для EmpiierOS.")
                    .size(15.0)
                    .color(MUTED),
            );
            ui.add_space(16.0);
            let selectable_count = self.disks.iter().filter(|d| d.skip_reason.is_none()).count();
            if self.disks.is_empty() {
                ui.colored_label(DANGER, "Диски не обнаружены. Проверьте накопитель и перезагрузите с носителя.");
            } else if selectable_count == 0 {
                ui.colored_label(
                    DANGER,
                    "Нет диска для установки — все найденные заняты или это носитель установщика.",
                );
                ui.add_space(8.0);
                for d in &self.disks {
                    let why = d.skip_reason.as_deref().unwrap_or("");
                    ui.label(
                        RichText::new(format!("{} · {} — {why}", d.path, d.size))
                            .size(13.0)
                            .color(MUTED),
                    );
                }
            } else {
                egui::ScrollArea::vertical().max_height(280.0).show(ui, |ui| {
                    for d in &self.disks {
                        if let Some(why) = &d.skip_reason {
                            ui.add_enabled_ui(false, |ui| {
                                ui.label(
                                    RichText::new(format!(
                                        "{}  ·  {}  ·  {} — {why}",
                                        d.path,
                                        d.size,
                                        if d.model.is_empty() {
                                            "диск"
                                        } else {
                                            &d.model
                                        }
                                    ))
                                    .size(14.0)
                                    .color(MUTED),
                                );
                            });
                            continue;
                        }
                        let selected = self.selected_disk.as_deref() == Some(d.path.as_str());
                        let label = format!(
                            "{}  ·  {}  ·  {}{}  ·  sn {}  ·  {}/{} B{}",
                            d.path,
                            d.size,
                            if d.model.is_empty() { "диск" } else { &d.model },
                            if d.removable { "  (съёмный)" } else { "" },
                            d.serial,
                            d.logical_sector,
                            d.physical_sector,
                            if d.partitions.is_empty() {
                                String::new()
                            } else {
                                format!("  ·  pt {}", d.partitions.len())
                            }
                        );
                        let resp = ui.selectable_label(selected, RichText::new(label).size(15.0));
                        if resp.clicked() {
                            self.selected_disk = Some(d.path.clone());
                        }
                    }
                });
            }
            if let Some(selected) = self
                .selected_disk
                .as_deref()
                .and_then(|path| self.disks.iter().find(|disk| disk.path == path))
            {
                ui.add_space(12.0);
                ui.separator();
                let kind = if selected.rotational {
                    "HDD"
                } else {
                    "SSD / NVMe"
                };
                ui.label(
                    RichText::new(format!(
                        "{} · {} · fw {} · health {}",
                        if selected.model.is_empty() {
                            "Накопитель"
                        } else {
                            selected.model.as_str()
                        },
                        kind,
                        selected.firmware,
                        selected.health
                    ))
                    .size(14.0)
                    .color(MUTED),
                );
                if selected.health.contains("FAILED") {
                    ui.colored_label(DANGER, "Диск сообщает о проблеме — лучше выбрать другой.");
                }
                danger_callout(
                    ui,
                    "Будет создана новая разметка; старые разделы и данные на диске исчезнут.",
                );
            }
            ui.add_space(12.0);
            ui.horizontal(|ui| {
                if secondary_button(ui, "Обновить").clicked() {
                    self.disks = apply::list_disks();
                }
                if secondary_button(ui, "Назад").clicked() {
                    self.go(Step::Network);
                }
                let can = self.selected_disk.is_some();
                ui.add_enabled_ui(can, |ui| {
                    if primary_button(ui, "Продолжить").clicked() {
                        self.state_key_error = None;
                        self.go(Step::StateKey);
                    }
                });
            });
        });
    }

    fn ui_state_key(&mut self, ui: &mut egui::Ui) {
        card(ui, |ui| {
            ui.label(RichText::new("Ключ диска").size(28.0).color(TEXT));
            ui.label(
                RichText::new(
                    "Нужен для LUKS recovery тома данных. Это не код входа в систему (не PIN).",
                )
                .size(15.0)
                .color(MUTED),
            );
            ui.add_space(16.0);
            if ui
                .selectable_label(
                    self.state_key_mode == StateRecoveryMode::Auto,
                    "Выдать ключ автоматически",
                )
                .clicked()
            {
                self.state_key_mode = StateRecoveryMode::Auto;
                self.state_key_secret.clear();
                self.state_key_confirm.clear();
                self.state_key_error = None;
            }
            ui.label(
                RichText::new("Ключ сгенерируем сами и покажем один раз на экране «Готово».")
                    .size(13.0)
                    .color(MUTED),
            );
            ui.add_space(8.0);
            if ui
                .selectable_label(
                    self.state_key_mode == StateRecoveryMode::User,
                    "Задать свой ключ",
                )
                .clicked()
            {
                self.state_key_mode = StateRecoveryMode::User;
                self.state_key_error = None;
            }
            ui.label(
                RichText::new("От 12 символов. Не используйте четырёхзначный код входа.")
                    .size(13.0)
                    .color(MUTED),
            );
            if self.state_key_mode == StateRecoveryMode::User {
                ui.add_space(10.0);
                ui.horizontal(|ui| {
                    ui.set_min_width(140.0);
                    ui.label(RichText::new("Ключ").color(MUTED));
                    ui.add_sized(
                        [360.0, 32.0],
                        egui::TextEdit::singleline(&mut self.state_key_secret).password(true),
                    );
                });
                ui.horizontal(|ui| {
                    ui.set_min_width(140.0);
                    ui.label(RichText::new("Ещё раз").color(MUTED));
                    ui.add_sized(
                        [360.0, 32.0],
                        egui::TextEdit::singleline(&mut self.state_key_confirm).password(true),
                    );
                });
            }
            if let Some(error) = &self.state_key_error {
                ui.add_space(8.0);
                ui.colored_label(DANGER, error);
            }
            ui.add_space(20.0);
            ui.horizontal(|ui| {
                if secondary_button(ui, "Назад").clicked() {
                    self.state_key_error = None;
                    self.go(Step::Disk);
                }
                if primary_button(ui, "Продолжить").clicked() {
                    if let Err(error) = self.stage_selected_state_key() {
                        self.state_key_error = Some(error);
                    } else {
                        self.state_key_error = None;
                        self.confirm_typed.clear();
                        self.go(Step::Confirm);
                    }
                }
            });
        });
    }

    fn stage_selected_state_key(&self) -> Result<(), String> {
        match self.state_key_mode {
            StateRecoveryMode::Auto => apply::stage_state_recovery(StateRecoveryMode::Auto, ""),
            StateRecoveryMode::User => {
                if self.state_key_secret != self.state_key_confirm {
                    return Err("Ключи не совпадают".to_string());
                }
                apply::validate_user_state_secret(&self.state_key_secret)?;
                apply::stage_state_recovery(StateRecoveryMode::User, &self.state_key_secret)
            }
        }
    }

    fn begin_install(&mut self, disk: &DiskInfo) -> Result<(), String> {
        self.stage_selected_state_key()?;
        self.progress_lines.clear();
        self.progress_display = 0.0;
        self.progress_target = 0.02;
        self.extract_started = None;
        self.apply_rx = Some(apply::start_apply(disk, true));
        Ok(())
    }

    fn ui_confirm(&mut self, ui: &mut egui::Ui) {
        let disk = self.selected_disk.clone().unwrap_or_default();
        let selected_disk = self
            .disks
            .iter()
            .find(|candidate| candidate.path == disk)
            .cloned();
        let confirmation = format!(
            "ERASE {}",
            disk.rsplit('/').next().unwrap_or("disk")
        );
        card(ui, |ui| {
            ui.label(
                RichText::new("Подтверждение очистки диска")
                    .size(26.0)
                    .color(TEXT),
            );
            ui.add_space(10.0);
            danger_callout(
                ui,
                &format!("Будет полностью очищен диск {disk}. Это действие нельзя отменить."),
            );
            ui.add_space(14.0);
            summary_row(ui, "Язык", self.language.label());
            summary_row(ui, "Пояс", &self.timezone);
            let network_summary = match self.net_mode {
                NetMode::Skip => "пропущена".to_string(),
                NetMode::Dhcp => format!("DHCP · {}", self.selected_interface),
                NetMode::Static => format!(
                    "static {} · {}",
                    self.static_form.address_cidr, self.selected_interface
                ),
                NetMode::Wifi => format!(
                    "Wi‑Fi {} · {}",
                    self.selected_wifi.as_deref().unwrap_or("—"),
                    self.selected_interface
                ),
            };
            summary_row(ui, "Сеть", &network_summary);
            summary_row(
                ui,
                "Ключ диска",
                match self.state_key_mode {
                    StateRecoveryMode::Auto => "авто (покажем на «Готово»)",
                    StateRecoveryMode::User => "задан вами",
                },
            );
            ui.add_space(14.0);
            ui.label(
                RichText::new(format!("Введите `{confirmation}`, чтобы продолжить"))
                    .color(MUTED),
            );
            ui.add_sized(
                [420.0, 40.0],
                egui::TextEdit::singleline(&mut self.confirm_typed)
                    .hint_text(&confirmation)
                    .font(FontId::monospace(16.0)),
            );
            ui.add_space(20.0);
            ui.horizontal(|ui| {
                if secondary_button(ui, "Назад").clicked() {
                    self.go(Step::StateKey);
                }
                let ok = self.confirm_typed.trim() == confirmation;
                ui.add_enabled_ui(ok, |ui| {
                    if primary_button(ui, "Установить").clicked() {
                        if let Some(ref disk_info) = selected_disk {
                            match self.begin_install(disk_info) {
                                Ok(()) => self.go(Step::Progress),
                                Err(error) => {
                                    self.fail_message = Some(error);
                                    self.go(Step::Failed);
                                }
                            }
                        }
                    }
                });
            });
        });
    }

    fn ui_progress(&mut self, ui: &mut egui::Ui) {
        card(ui, |ui| {
            ui.label(
                RichText::new("Установка")
                    .size(28.0)
                    .color(Color32::WHITE)
                    .strong(),
            );
            ui.label(
                RichText::new(
                    "Не выключайте питание и не извлекайте носитель. Обычно это занимает несколько минут.",
                )
                .size(14.0)
                .color(MUTED),
            );
            ui.add_space(22.0);
            let active = roadmap_step_index(self.progress_display, &self.progress_lines);
            paint_install_roadmap(ui, active, self.progress_display);
            ui.add_space(20.0);
            let pct = (self.progress_display * 100.0).clamp(0.0, 100.0);
            ui.horizontal(|ui| {
                ui.label(
                    RichText::new(format!("{pct:.0}%"))
                        .size(15.0)
                        .color(LIME)
                        .strong(),
                );
                ui.label(
                    RichText::new(phase_caption_ru(&self.progress_lines, active))
                        .size(14.0)
                        .color(MUTED),
                );
            });
            ui.add_space(10.0);
            ui.add(
                ProgressBar::new(self.progress_display.clamp(0.0, 1.0))
                    .desired_height(8.0)
                    .desired_width(ui.available_width())
                    .fill(LIME)
                    .corner_radius(CornerRadius::ZERO),
            );
            ui.add_space(12.0);
            ui.label(RichText::new("Журнал").size(13.0).color(MUTED));
            egui::ScrollArea::vertical().max_height(120.0).show(ui, |ui| {
                for line in self.progress_lines.iter().rev().take(8).rev() {
                    ui.label(
                        RichText::new(line)
                            .size(12.0)
                            .color(MUTED)
                            .family(FontFamily::Monospace),
                    );
                }
            });
        });
    }

    fn ui_done(&mut self, ui: &mut egui::Ui) {
        let pin = self.first_boot_pin.clone().unwrap_or_default();
        let recovery = self.state_recovery.clone().unwrap_or_default();
        let ack = pin_ack_accepted(&self.pin_ack_typed);
        card(ui, |ui| {
            ui.label(
                RichText::new("Запишите PIN и ключ диска")
                    .size(26.0)
                    .color(ACCENT_BRIGHT),
            );
            ui.label(
                RichText::new(
                    "Это разные значения: PIN — вход после установки; ключ диска — LUKS recovery.",
                )
                .size(15.0)
                .color(MUTED),
            );
            ui.add_space(16.0);
            secret_card(ui, ACCENT, "PIN · вход", |ui| {
                ui.label(
                    RichText::new(pin)
                        .size(52.0)
                        .color(ACCENT_BRIGHT)
                        .family(FontFamily::Monospace)
                        .strong(),
                );
            });
            ui.add_space(12.0);
            let recovery_label = if apply::is_auto_state_recovery(&recovery) {
                "Ключ диска · LUKS recovery (авто)"
            } else {
                "Ключ диска · LUKS recovery (ваш)"
            };
            secret_card(ui, Color32::from_rgb(0x2a, 0x34, 0x40), recovery_label, |ui| {
                ui.label(
                    RichText::new(&recovery)
                        .size(if recovery.len() > 48 { 16.0 } else { 22.0 })
                        .color(TEXT)
                        .family(FontFamily::Monospace)
                        .strong(),
                );
            });
            ui.add_space(12.0);
            ui.label(
                RichText::new(
                    "Чтобы перезагрузить, наберите ЗАПИСАЛ (Alt+Shift — русская раскладка) или ZAPISAL",
                )
                .size(14.0)
                .color(MUTED),
            );
            ui.add_space(8.0);
            ui.add(
                egui::TextEdit::singleline(&mut self.pin_ack_typed)
                    .desired_width(220.0)
                    .hint_text("ЗАПИСАЛ")
                    .font(egui::FontId::monospace(18.0)),
            );
            ui.add_space(24.0);
            if ack {
                if primary_button(ui, "Перезагрузить").clicked() {
                    apply::reboot_now();
                }
            } else {
                ui.label(
                    RichText::new("Перезагрузка закрыта, пока PIN и ключ диска не записаны")
                        .size(14.0)
                        .color(DANGER),
                );
            }
        });
    }

    fn ui_failed(&mut self, ui: &mut egui::Ui) {
        let msg = self
            .fail_message
            .clone()
            .unwrap_or_else(|| "Неизвестная ошибка".into());
        card(ui, |ui| {
            ui.label(RichText::new("Установка не завершена").size(26.0).color(DANGER));
            ui.label(RichText::new(msg).size(14.0).color(MUTED));
            ui.add_space(8.0);
            ui.label(
                RichText::new(
                    "Технический журнал: install-fail.log на носителе. Диск может быть частично записан.",
                )
                .size(13.0)
                .color(MUTED),
            );
            ui.add_space(20.0);
            ui.horizontal(|ui| {
                if secondary_button(ui, "К выбору диска").clicked() {
                    self.fail_message = None;
                    self.go(Step::Disk);
                }
                if primary_button(ui, "Повторить").clicked() {
                    if let Some(disk) = self
                        .selected_disk
                        .as_deref()
                        .and_then(|path| self.disks.iter().find(|disk| disk.path == path))
                        .cloned()
                    {
                        match self.begin_install(&disk) {
                            Ok(()) => self.go(Step::Progress),
                            Err(error) => self.fail_message = Some(error),
                        }
                    }
                }
            });
        });
    }
}

fn wizard_step_number(step: Step) -> usize {
    match step {
        Step::Welcome => 1,
        Step::Regional => 2,
        Step::Network => 3,
        Step::Disk => 4,
        Step::StateKey => 5,
        Step::Confirm => 6,
        Step::Progress => 7,
        Step::Done => 8,
        Step::Failed => 7,
    }
}

fn wizard_step_slug(step: Step) -> &'static str {
    let idx = wizard_step_number(step).saturating_sub(1);
    WIZARD_STEPS.get(idx).map(|(_, slug)| *slug).unwrap_or("install")
}

fn paint_subtle_grid(ui: &mut egui::Ui) {
    let rect = ui.max_rect();
    let painter = ui.painter();
    painter.rect_filled(rect, 0.0, INK);
    let step = 48.0_f32;
    let grid = Color32::from_rgba_unmultiplied(255, 255, 255, 8);
    let mut x = rect.min.x;
    while x <= rect.max.x {
        painter.line_segment(
            [egui::pos2(x, rect.min.y), egui::pos2(x, rect.max.y)],
            Stroke::new(1.0, grid),
        );
        x += step;
    }
    let mut y = rect.min.y;
    while y <= rect.max.y {
        painter.line_segment(
            [egui::pos2(rect.min.x, y), egui::pos2(rect.max.x, y)],
            Stroke::new(1.0, grid),
        );
        y += step;
    }
}

fn wizard_topbar(ui: &mut egui::Ui, logo: Option<&TextureHandle>, step: Step) {
    ui.horizontal(|ui| {
        ui.with_layout(Layout::left_to_right(Align::Center), |ui| {
            brand_orb(ui, logo);
            ui.add_space(14.0);
            ui.vertical(|ui| {
                ui.label(
                    RichText::new("EMPERY WORLD")
                        .size(18.0)
                        .color(TEXT)
                        .strong(),
                );
                ui.label(
                    RichText::new("EmpiierOS · установка")
                        .size(13.0)
                        .color(MUTED),
                );
            });
        });
        ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
            let n = wizard_step_number(step);
            let title = WIZARD_STEPS
                .get(n.saturating_sub(1))
                .map(|(label, _)| *label)
                .unwrap_or("Установка");
            ui.label(
                RichText::new(format!("Шаг {n} из 8 · {title}"))
                    .size(14.0)
                    .color(MUTED)
                    .family(FontFamily::Monospace),
            );
            let _ = wizard_step_slug(step);
        });
    });
}

fn brand_orb(ui: &mut egui::Ui, logo: Option<&TextureHandle>) {
    if let Some(tex) = logo {
        let size = Vec2::splat(44.0);
        ui.add(egui::Image::from_texture((tex.id(), size)));
        return;
    }
    let (rect, _) = ui.allocate_exact_size(Vec2::splat(44.0), Sense::hover());
    let center = rect.center();
    let painter = ui.painter();
    painter.circle_filled(center, 20.0, Color32::from_rgba_unmultiplied(46, 196, 198, 90));
    painter.circle_filled(center, 14.0, ACCENT_BRIGHT);
    painter.circle_stroke(center, 20.0, Stroke::new(1.0, ACCENT));
}

fn wizard_step_rail(ui: &mut egui::Ui, step: Step) {
    let current = wizard_step_number(step);
    let width = ui.available_width().min(1824.0);
    ui.allocate_ui_with_layout(Vec2::new(width, 44.0), Layout::left_to_right(Align::Center), |ui| {
        ui.set_width(width);
        ui.horizontal(|ui| {
            for (idx, (label, _slug)) in WIZARD_STEPS.iter().enumerate() {
                let n = idx + 1;
                let (fill, stroke, text) = if n < current {
                    (Color32::from_rgb(0x12, 0x28, 0x2c), ACCENT, ACCENT_BRIGHT)
                } else if n == current {
                    (Color32::from_rgb(0x14, 0x2a, 0x2e), ACCENT_BRIGHT, TEXT)
                } else {
                    (ELEVATED, HAIR, MUTED)
                };
                let resp = ui.add(
                    egui::Button::new(
                        RichText::new(format!("{n} {label}"))
                            .size(12.5)
                            .color(text),
                    )
                    .fill(fill)
                    .stroke(Stroke::new(1.0, stroke))
                    .corner_radius(CornerRadius::same(6)),
                );
                if resp.hovered() {
                    ui.ctx().set_cursor_icon(egui::CursorIcon::Default);
                }
                ui.add_space(6.0);
            }
            if matches!(step, Step::Failed) {
                ui.label(
                    RichText::new("· установка прервана")
                        .size(12.0)
                        .color(DANGER),
                );
            }
        });
    });
}

fn aside_heading(ui: &mut egui::Ui, title: &str) {
    ui.label(
        RichText::new(title)
            .size(11.0)
            .color(MUTED)
            .strong()
            .family(FontFamily::Monospace),
    );
    ui.add_space(8.0);
}

fn danger_callout(ui: &mut egui::Ui, text: &str) {
    Frame::new()
        .fill(Color32::from_rgba_unmultiplied(255, 59, 74, 28))
        .stroke(Stroke::new(1.0, DANGER))
        .corner_radius(CornerRadius::same(8))
        .inner_margin(egui::Margin::symmetric(14, 10))
        .show(ui, |ui| {
            ui.label(RichText::new(text).size(14.0).color(DANGER));
        });
}

fn summary_row(ui: &mut egui::Ui, label: &str, value: &str) {
    ui.horizontal(|ui| {
        ui.set_min_width(140.0);
        ui.label(RichText::new(label).size(13.0).color(MUTED));
        ui.label(
            RichText::new(value)
                .size(13.0)
                .color(TEXT)
                .family(FontFamily::Monospace),
        );
    });
}

fn secret_card(
    ui: &mut egui::Ui,
    border: Color32,
    title: &str,
    body: impl FnOnce(&mut egui::Ui),
) {
    Frame::new()
        .fill(ELEVATED)
        .stroke(Stroke::new(1.5, border))
        .corner_radius(CornerRadius::same(10))
        .inner_margin(egui::Margin::symmetric(18, 14))
        .show(ui, |ui| {
            ui.label(RichText::new(title).size(13.0).color(MUTED));
            ui.add_space(6.0);
            body(ui);
        });
}

fn network_status_chip(ui: &mut egui::Ui, summary: &str) {
    ui.horizontal(|ui| {
        let (rect, _) = ui.allocate_exact_size(Vec2::splat(8.0), Sense::hover());
        ui.painter().circle_filled(rect.center(), 4.0, ACCENT_BRIGHT);
        ui.label(
            RichText::new(format!("Сеть: {summary}"))
                .size(13.0)
                .color(ACCENT_BRIGHT),
        );
    });
}

fn pin_ack_accepted(typed: &str) -> bool {
    let typed = typed.trim();
    typed == "ЗАПИСАЛ" || typed.eq_ignore_ascii_case("ZAPISAL")
}

fn card(ui: &mut egui::Ui, add: impl FnOnce(&mut egui::Ui)) {
    Frame::new()
        .fill(PANEL)
        .stroke(Stroke::new(1.0_f32, HAIR))
        .corner_radius(CornerRadius::same(10))
        .inner_margin(egui::Margin::symmetric(32, 28))
        .show(ui, |ui| {
            ui.set_min_width(720.0);
            ui.set_max_width(1040.0);
            add(ui);
        });
}

fn primary_button(ui: &mut egui::Ui, label: &str) -> egui::Response {
    ui.add(
        egui::Button::new(RichText::new(label).color(INK).size(15.0).strong())
            .fill(ACCENT_BRIGHT)
            .corner_radius(CornerRadius::same(8))
            .min_size(Vec2::new(168.0, 44.0))
            .stroke(Stroke::new(1.0_f32, ACCENT_BRIGHT)),
    )
}

fn secondary_button(ui: &mut egui::Ui, label: &str) -> egui::Response {
    ui.add(
        egui::Button::new(RichText::new(label).color(TEXT).size(14.0))
            .fill(ELEVATED)
            .corner_radius(CornerRadius::same(8))
            .min_size(Vec2::new(140.0, 44.0))
            .stroke(Stroke::new(1.0_f32, HAIR)),
    )
}

fn mode_chip(ui: &mut egui::Ui, current: &mut NetMode, value: NetMode, label: &str) {
    let selected = *current == value;
    let fill = if selected {
        Color32::from_rgb(0x12, 0x28, 0x2c)
    } else {
        ELEVATED
    };
    let stroke = if selected {
        Stroke::new(1.0_f32, ACCENT_BRIGHT)
    } else {
        Stroke::new(1.0_f32, HAIR)
    };
    let text = if selected { ACCENT_BRIGHT } else { MUTED };
    if ui
        .add(
            egui::Button::new(
                RichText::new(label)
                    .color(text)
                    .size(13.0)
                    .family(FontFamily::Monospace),
            )
            .fill(fill)
            .corner_radius(CornerRadius::ZERO)
            .stroke(stroke),
        )
        .clicked()
    {
        *current = value;
    }
}

fn labeled_field(ui: &mut egui::Ui, label: &str, value: &mut String) {
    ui.horizontal(|ui| {
        ui.set_min_width(140.0);
        ui.label(RichText::new(label).color(MUTED));
        ui.add_sized([360.0, 32.0], egui::TextEdit::singleline(value));
    });
}

fn load_logo(ctx: &egui::Context) -> Option<TextureHandle> {
    let path = logo_path();
    let bytes = std::fs::read(&path).ok()?;
    let img = image::load_from_memory(&bytes).ok()?.into_rgba8();
    let size = [img.width() as usize, img.height() as usize];
    let color = egui::ColorImage::from_rgba_unmultiplied(size, img.as_raw());
    Some(ctx.load_texture("eliteew-logo", color, Default::default()))
}

fn load_splash(ctx: &egui::Context) -> Option<TextureHandle> {
    let path = splash_path();
    let bytes = std::fs::read(&path).ok()?;
    let img = image::load_from_memory(&bytes).ok()?.into_rgba8();
    let size = [img.width() as usize, img.height() as usize];
    let color = egui::ColorImage::from_rgba_unmultiplied(size, img.as_raw());
    Some(ctx.load_texture("eliteew-boot-splash", color, Default::default()))
}

fn splash_path() -> PathBuf {
    if let Some(p) = std::env::var_os("ELITEEW_TS_INSTALL_SPLASH") {
        return PathBuf::from(p);
    }
    for c in [
        "/usr/local/share/eliteew-ts-installer/boot-splash.png",
        "/usr/share/eliteew-ts-installer/boot-splash.png",
    ] {
        let p = PathBuf::from(c);
        if p.is_file() {
            return p;
        }
    }
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("assets/boot-splash.png")
}

fn paint_splash_backdrop(ui: &mut egui::Ui, splash: Option<&TextureHandle>) {
    let Some(tex) = splash else {
        return;
    };
    let rect = ui.max_rect();
    // Cover-fit with dark scrim so cards stay readable.
    let size = tex.size_vec2();
    let scale = (rect.width() / size.x).max(rect.height() / size.y);
    let draw = size * scale;
    let origin = rect.center() - draw * 0.5;
    let img_rect = egui::Rect::from_min_size(origin, draw);
    egui::Image::from_texture((tex.id(), draw))
        .tint(Color32::from_rgba_unmultiplied(255, 255, 255, 55))
        .paint_at(ui, img_rect);
    ui.painter()
        .rect_filled(rect, 0.0, Color32::from_rgba_unmultiplied(6, 10, 16, 210));
}

/// Map apply log phases → coarse target fraction (display lerps toward this).
/// Extract uses wall-clock asymptote because gzip|tar is otherwise silent between heartbeats.
fn phase_fraction(lines: &[String], extract_started: Option<Instant>) -> f32 {
    if lines.is_empty() {
        return 0.02;
    }
    let blob = lines.join("\n").to_ascii_lowercase();
    if blob.contains("disk-install complete") || blob.contains("install complete") {
        return 1.0;
    }
    if blob.contains("grub-install") || blob.contains("installation finished") {
        return 0.93;
    }
    if blob.contains("ssh-keygen") {
        return 0.86;
    }
    if blob.contains("extract") {
        let t = extract_started
            .map(|t0| t0.elapsed().as_secs_f32())
            .unwrap_or(0.0);
        // Approach 0.80 over ~2–3 minutes of extract (heartbeats every 3s keep log alive).
        let creep = 1.0 - (-t / 90.0_f32).exp();
        return (0.35 + 0.45 * creep).min(0.80);
    }
    if blob.contains("luks") || blob.contains("state recovery") {
        return 0.32;
    }
    if blob.contains("mkfs") {
        return 0.28;
    }
    if blob.contains("wipe") || blob.contains("partition") || blob.contains("sfdisk") {
        return 0.14;
    }
    if blob.contains("network") {
        return 0.06;
    }
    0.08
}

fn save_rgba_png(path: &str, image: &egui::ColorImage) -> Result<(), String> {
    let [w, h] = image.size;
    if w == 0 || h == 0 {
        return Err("empty screenshot".into());
    }
    let mut rgba = Vec::with_capacity(image.pixels.len() * 4);
    for pixel in &image.pixels {
        rgba.extend_from_slice(&pixel.to_array());
    }
    image::save_buffer(
        path,
        &rgba,
        w as u32,
        h as u32,
        image::ColorType::Rgba8,
    )
    .map_err(|err| err.to_string())
}

fn roadmap_step_index(display: f32, lines: &[String]) -> usize {
    let blob = lines.join("\n").to_ascii_lowercase();
    if blob.contains("disk-install complete") || blob.contains("install complete") || display >= 0.995
    {
        return ROADMAP_STEPS.len().saturating_sub(1);
    }
    if display >= 0.93 || blob.contains("grub-install") {
        return 4;
    }
    if display >= 0.35 || blob.contains("extract") {
        return 3;
    }
    if display >= 0.22 || blob.contains("luks") || blob.contains("mkfs") {
        return 2;
    }
    if display >= 0.10 || blob.contains("wipe") || blob.contains("partition") {
        return 1;
    }
    0
}

fn phase_caption_ru(lines: &[String], active: usize) -> String {
    if active + 1 < ROADMAP_STEPS.len() {
        return format!("Сейчас: {}", ROADMAP_STEPS[active]);
    }
    let blob = lines.join("\n").to_ascii_lowercase();
    if blob.contains("install complete") {
        return "Готово".to_string();
    }
    format!("Сейчас: {}", ROADMAP_STEPS[active.min(ROADMAP_STEPS.len() - 1)])
}

fn paint_install_roadmap(ui: &mut egui::Ui, active: usize, display: f32) {
    let steps = ROADMAP_STEPS.len();
    let width = ui.available_width().min(680.0);
    ui.allocate_ui_with_layout(Vec2::new(width, 72.0), Layout::top_down(Align::Center), |ui| {
        ui.set_width(width);
        let row_h = 36.0;
        let (row, _) = ui.allocate_exact_size(Vec2::new(width, row_h), Sense::hover());
        let gap = width / steps as f32;
        let cy = row.center().y;
        let painter = ui.painter();
        for i in 0..steps.saturating_sub(1) {
            let x0 = row.min.x + gap * (i as f32 + 0.5);
            let x1 = row.min.x + gap * (i as f32 + 1.5);
            let done = i < active;
            let color = if done { ACCENT } else { TRACK };
            painter.line_segment(
                [egui::pos2(x0, cy), egui::pos2(x1, cy)],
                Stroke::new(if done { 2.5_f32 } else { 1.5_f32 }, color),
            );
        }
        for i in 0..steps {
            let cx = row.min.x + gap * (i as f32 + 0.5);
            let center = egui::pos2(cx, cy);
            let r = 9.0_f32;
            let (fill, stroke) = if i < active {
                (ACCENT, ACCENT)
            } else if i == active {
                (Color32::from_rgb(0x12, 0x28, 0x2c), ACCENT_BRIGHT)
            } else {
                (PANEL, HAIR)
            };
            painter.circle_filled(center, r, fill);
            painter.circle_stroke(center, r, Stroke::new(1.5_f32, stroke));
            if i < active {
                painter.text(
                    center,
                    Align2::CENTER_CENTER,
                    "✓",
                    FontId::new(11.0, FontFamily::Proportional),
                    INK,
                );
            }
        }
        ui.add_space(8.0);
        ui.horizontal_wrapped(|ui| {
            ui.set_width(width);
            for (i, title) in ROADMAP_STEPS.iter().enumerate() {
                let color = if i < active {
                    ACCENT_BRIGHT
                } else if i == active {
                    TEXT
                } else {
                    MUTED
                };
                let w = width / steps as f32;
                ui.allocate_ui_with_layout(Vec2::new(w, 28.0), Layout::top_down(Align::Center), |ui| {
                    ui.label(RichText::new(*title).size(11.5).color(color));
                });
            }
        });
    });
    let _ = display; // reserved for future intra-step shimmer
}

fn net_summary_plain(summary: &str) -> String {
    summary
        .replace("link up", "кабель подключён")
        .replace("link down", "кабель не подключён")
        .replace("dhcp", "автонастройка")
        .replace("wifi", "Wi‑Fi")
}

/// Drop VT/terminal/super chords at the compositor; mirror in GUI for focus safety.
fn consume_dangerous_shortcuts(ctx: &egui::Context) {
    ctx.input_mut(|input| {
        input.events.retain(|event| !matches_blocked_installer_event(event));
    });
}

fn matches_blocked_installer_event(event: &egui::Event) -> bool {
    let egui::Event::Key {
        key,
        modifiers,
        pressed: true,
        ..
    } = event
    else {
        return false;
    };
    if modifiers.alt && *key == egui::Key::F4 {
        return true;
    }
    if modifiers.ctrl && modifiers.alt {
        if *key == egui::Key::Delete || *key == egui::Key::T {
            return true;
        }
        return ctrl_alt_function_key_blocked(key);
    }
    modifiers.command && !modifiers.ctrl && !modifiers.alt
}

fn ctrl_alt_function_key_blocked(key: &egui::Key) -> bool {
    matches!(
        key,
        egui::Key::F1
            | egui::Key::F2
            | egui::Key::F3
            | egui::Key::F4
            | egui::Key::F5
            | egui::Key::F6
            | egui::Key::F7
            | egui::Key::F8
            | egui::Key::F9
            | egui::Key::F10
            | egui::Key::F11
            | egui::Key::F12
    )
}

fn logo_path() -> PathBuf {
    if let Some(p) = std::env::var_os("ELITEEW_TS_INSTALL_LOGO") {
        return PathBuf::from(p);
    }
    for c in [
        "/usr/local/share/eliteew-ts-installer/logo.png",
        "/usr/share/eliteew-ts-installer/logo.png",
    ] {
        let p = PathBuf::from(c);
        if p.is_file() {
            return p;
        }
    }
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("assets/logo.png")
}

fn sanitize_progress_line(line: &str) -> String {
    // mkfs/sfdisk emit CR/backspace progress that becomes tofu squares in egui.
    let mut out = String::with_capacity(line.len());
    for ch in line.chars() {
        match ch {
            '\u{08}' | '\r' | '\u{7f}' => {}
            c if c.is_control() && c != '\t' => {}
            c => out.push(c),
        }
    }
    out.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// Load system DejaVu (BR2_PACKAGE_DEJAVU_SANS). No embedded egui default_fonts
/// under the operator MIT-only lock — missing fonts must fail loudly.
fn install_system_fonts(ctx: &egui::Context) {
    let sans_candidates = [
        "/usr/share/fonts/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/dejavu-sans-fonts/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/TTF/DejaVuSans.ttf",
    ];
    let bold_candidates = [
        "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/dejavu-sans-fonts/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",
    ];
    let mono_candidates = [
        "/usr/share/fonts/dejavu/DejaVuSansMono.ttf",
        "/usr/share/fonts/dejavu-sans-fonts/DejaVuSansMono.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
        "/usr/share/fonts/TTF/DejaVuSansMono.ttf",
    ];
    let Some(sans_path) = sans_candidates.iter().find(|p| Path::new(p).is_file()) else {
        logutil::error("fonts: DejaVuSans required but not found — refusing silent non-MIT font fallback");
        std::process::exit(2);
    };
    let Ok(sans_bytes) = std::fs::read(sans_path) else {
        logutil::error(&format!("fonts: cannot read {sans_path}"));
        std::process::exit(2);
    };
    let mut fonts = egui::FontDefinitions {
        font_data: Default::default(),
        families: Default::default(),
    };
    fonts.font_data.insert(
        "dejavu".into(),
        std::sync::Arc::new(egui::FontData::from_owned(sans_bytes)),
    );
    fonts
        .families
        .entry(egui::FontFamily::Proportional)
        .or_default()
        .insert(0, "dejavu".into());
    // RichText::strong() needs a real bold face — synthetic bold often tofus Cyrillic.
    if let Some(bold_path) = bold_candidates.iter().find(|p| Path::new(p).is_file()) {
        if let Ok(bold_bytes) = std::fs::read(bold_path) {
            fonts.font_data.insert(
                "dejavu_bold".into(),
                std::sync::Arc::new(egui::FontData::from_owned(bold_bytes)),
            );
            // Prefer bold when egui walks the family for strong text.
            fonts
                .families
                .entry(egui::FontFamily::Proportional)
                .or_default()
                .push("dejavu_bold".into());
            logutil::info(&format!("fonts: bold {bold_path}"));
        }
    }
    if let Some(mono_path) = mono_candidates.iter().find(|p| Path::new(p).is_file()) {
        if let Ok(mono_bytes) = std::fs::read(mono_path) {
            fonts.font_data.insert(
                "dejavu_mono".into(),
                std::sync::Arc::new(egui::FontData::from_owned(mono_bytes)),
            );
            fonts
                .families
                .entry(egui::FontFamily::Monospace)
                .or_default()
                .insert(0, "dejavu_mono".into());
            logutil::info(&format!("fonts: loaded {sans_path} + {mono_path}"));
        }
    }
    if !fonts.families.contains_key(&egui::FontFamily::Monospace) {
        fonts
            .families
            .entry(egui::FontFamily::Monospace)
            .or_default()
            .insert(0, "dejavu".into());
        logutil::info(&format!("fonts: loaded {sans_path} (mono fallback to sans)"));
    } else if fonts.font_data.len() == 1 {
        logutil::info(&format!("fonts: loaded {sans_path}"));
    }
    ctx.set_fonts(fonts);
}

#[cfg(test)]
mod tests {
    use super::{matches_blocked_installer_event, pin_ack_accepted, roadmap_step_index};
    use eframe::egui::{Event, Key, Modifiers};

    #[test]
    fn pin_ack_accepts_cyrillic_and_latin_fallback() {
        assert!(pin_ack_accepted("ЗАПИСАЛ"));
        assert!(pin_ack_accepted("  ЗАПИСАЛ  "));
        assert!(pin_ack_accepted("ZAPISAL"));
        assert!(pin_ack_accepted("zapisal"));
        assert!(!pin_ack_accepted("ЗАПИСАЛИ"));
        assert!(!pin_ack_accepted("OK"));
    }

    #[test]
    fn shortcuts_block_vt_including_tty2() {
        let block = |key: Key, ctrl: bool, alt: bool, cmd: bool| {
            matches_blocked_installer_event(&Event::Key {
                key,
                physical_key: None,
                modifiers: Modifiers {
                    ctrl,
                    alt,
                    command: cmd,
                    ..Default::default()
                },
                pressed: true,
                repeat: false,
            })
        };
        assert!(block(Key::F1, true, true, false));
        assert!(block(Key::F2, true, true, false));
        assert!(block(Key::F3, true, true, false));
        assert!(block(Key::F4, false, true, false));
        assert!(block(Key::W, false, false, true));
        assert!(!block(Key::A, true, true, false));
        assert!(!block(Key::A, false, true, false));
    }

    #[test]
    fn roadmap_advances_with_fraction() {
        assert_eq!(roadmap_step_index(0.05, &[]), 0);
        assert_eq!(roadmap_step_index(0.12, &[]), 1);
        assert_eq!(roadmap_step_index(0.40, &[]), 3);
        assert_eq!(roadmap_step_index(0.95, &[]), 4);
    }
}
