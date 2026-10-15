/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop storage keys, API endpoints, polling, performance targets, and feature flags.
 *
 * Invariants:
 * - Symbol names and values unchanged from pre-P38 constants barrel; structural split only.
 *
 * Related:
 * - constants/index.ts (re-export barrel)
 * - src/pages/Desktop/utils/desktopAppRegistry.ts
 */
export const STORAGE_KEYS = {
	CONFIG: 'elite_desktop_config',
	ITEMS: 'elite_desktop_items',
	WINDOWS: 'elite_desktop_windows',
	ACCENT: 'elite_desktop_accent',
	VIRTUAL_DESKTOPS: 'elite_desktop_virtual_desktops',
	CLOCK_SECONDS: 'elite_desktop_clock_seconds',
	WIDGET_NOTES: 'elite_desktop_widget_notes',
	WIDGET_TODOS: 'elite_desktop_widget_todos',
	WIDGET_FAVORITES: 'elite_desktop_widget_favorites',
	RECENT_APPS: 'elite_desktop_recent_apps',
	RECENT_FILES: 'elite_desktop_recent_files',
	/** После первого переноса плавающего виджета мышью — не считать координаты семенным пресетом. */
	FLOATING_WIDGET_USER_POSITIONED:
		'eliteew-desktop-floating-widget-user-positioned-v1',
	/** Serialized notification center rows (no React icons) */
	NOTIFICATION_CENTER: 'elite_notification_center_v1',
	/** First-visit desktop onboarding overlay dismissed permanently. */
	ONBOARDING_DISMISSED: 'eliteew-desktop-onboarding-dismissed-v1',
	/** Show cloud icon when sync is idle (opt-in, default off). */
	SHOW_IDLE_SYNC_ICON: 'eliteew-desktop-show-idle-sync-icon-v1',
	/** Virtual desktops first-use hint dismissed permanently. */
	VD_FIRST_USE_HINT_DISMISSED: 'eliteew-desktop-vd-first-use-hint-v1',
	/** Maintenance recovery chip dismissed for this session (reopen via Start). */
	MAINTENANCE_RECOVERY_DISMISSED:
		'eliteew-desktop-maintenance-recovery-dismissed-v1',
} as const;

export const API_ENDPOINTS = {
	CONFIG: '/desktop/config',
	ITEMS: '/desktop/items',
	ITEM: (id: string) => `/desktop/items/${id}`,
} as const;

// Base URL for desktop API
export const DESKTOP_API_BASE = '/api/v1';

/** Polling intervals (ms). Min 5s for UI/monitoring per performance rules; avoid 1–2s cycles. */
export const DESKTOP_POLLING = {
	SYSTEM_METRICS_MS: 5000,
	CLIPBOARD_MS: 5000,
	WIDGET_STATE_MS: 5000,
	GPU_MS: 15000,
	VOICE_SERVICES_MS: 30000,
	MEMORY_CHECK_MS: 30000,
	CLOCK_MS: 1000,
	/** Weather widget: avoid frequent calls (Open-Meteo free tier). */
	WEATHER_MS: 600_000,
} as const;

/** Target performance metrics for Desktop (for monitoring/regression). */
export const DESKTOP_PERFORMANCE_TARGETS = {
	/** Window open (click to first paint) ms */
	WINDOW_OPEN_LATENCY_MS: 500,
	/** Target FPS for desktop interactions */
	TARGET_FPS: 60,
	/** Early warning threshold for interaction smoothness */
	FPS_WARN: 45,
	/** Critical threshold where shell should aggressively reduce work */
	FPS_CRITICAL: 30,
	/** Healthy upper bound for average frame time */
	RENDER_WARN_MS: 18,
	/** Max memory growth (MB) before warning */
	MEMORY_WARN_MB: 200,
	/** Soft warning for high count of simultaneously open windows */
	WINDOW_WARN_COUNT: 12,
	/** Auto quiet telemetry / aggressive background suspend when open windows exceed this count */
	WINDOW_AUTO_QUIET_COUNT: 8,
	/** Historical threshold; icon layer always skips Framer enter/exit (kept for prefs/docs) */
	ICON_MOTION_DISABLE_COUNT: 0,
} as const;

/**
 * Feature flags for Desktop. Enable large changes behind flags for staged rollout.
 * Override in code or via env (e.g. VITE_DESKTOP_TELEMETRY=false) for testing/rollback.
 */
export const DESKTOP_FEATURE_FLAGS = {
	/** Use centralized notification context (default on). */
	NOTIFICATIONS_CONTEXT: true,
	/** Preload lazy apps on icon hover/focus (default on). */
	PRELOAD_ON_HOVER: true,
	/** Emit desktop-telemetry custom events (default on). Set VITE_DESKTOP_TELEMETRY=false to disable. */
	TELEMETRY: true,
	/** Taskbar groups same-app windows into one button to preserve density in desktop workflows. */
	TASKBAR_GROUP_BY_APP: false,
	/** Hover window button shows live thumbnail preview (experimental). */
	TASKBAR_WINDOW_PREVIEW: false,
} as const;

/**
 * Governance rules for the desktop-first visual system.
 * New desktop UI should consume shared primitives instead of reintroducing local chrome bundles.
 */
export const DESKTOP_STYLE_GOVERNANCE = {
	rules: [
		'Desktop app chrome must be composed from shared DesktopApp primitives.',
		'Hardcoded desktop surface bundles like bg-slate-* and border-white/10 are treated as tech debt (track: documentation/platform/TECH-DEBT-EXECUTION-TRACKER.md).',
		'Desktop root tokens are written only at DesktopWorkspaceContent level.',
		'Embedded and passthrough apps must opt out intentionally instead of bypassing the wrapper by default.',
	],
	checklist: [
		'Header and toolbar use semantic desktop surfaces and spacing.',
		'Panels and cards use shared panel/soft surface patterns.',
		'Primary, neutral, and danger actions use shared button variants.',
		'Inputs and search fields use shared desktop field styling.',
		'Modal, empty, error, and skeleton states follow shared primitives.',
		'Window minimize/maximize behavior remains correct in desktop mode.',
		'No double scroll containers or clipped first paint in wrapped apps.',
	],
} as const;
