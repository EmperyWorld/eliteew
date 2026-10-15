/**
 * User Profile Types
 * Aligned with backend api/schemas/user_profile.py (UserProfileResponse, SecuritySettings, etc.)
 */

// ============================================================================
// Profile Types
// ============================================================================

export interface UserProfileResponse {
	id: string;
	username: string;
	email: string;
	full_name: string | null;
	bio: string | null;
	avatar_url: string | null;
	role: string;
	is_active: boolean;
	is_verified: boolean;
	/** Метка админки: доверенный пользователь (бейдж в профиле и GAF). */
	is_trusted?: boolean;
	/** Дополнительный значок (текст задаёт админ в UGS Admin). */
	admin_badge_label?: string | null;
	admin_badge_hint?: string | null;
	preferences: Record<string, unknown>;
	created_at: string;
	last_login_at: string | null;
	login_count: number;
}

export interface ProfileUpdateData {
	full_name?: string;
	bio?: string;
}

/** Server-side profile privacy (GET/PATCH /profile/me/privacy). */
export type ProfileDiscoverability = 'public' | 'hidden';
export type ProfileFieldVisibility =
	| 'everyone'
	| 'friends_only'
	| 'none'
	| 'circle';

export interface ProfilePrivacySettings {
	discoverability: ProfileDiscoverability;
	avatar_visibility: ProfileFieldVisibility;
	avatar_circle_id: string | null;
	full_name_visibility: ProfileFieldVisibility;
	full_name_circle_id: string | null;
	bio_visibility: ProfileFieldVisibility;
	bio_circle_id: string | null;
	updated_at: string;
}

export type ProfilePrivacyUpdate = Partial<
	Omit<ProfilePrivacySettings, 'updated_at'>
>;

// ============================================================================
// Avatar Types
// ============================================================================

export interface AvatarUploadResponse {
	avatar_url: string;
	thumbnail_256_url?: string | null;
	thumbnail_64_url?: string | null;
	content_id?: string | null;
	file_size: number;
	mime_type: string;
	created_at: string; // Backend uses created_at, not upload_date
}

export interface AvatarHistoryItem {
	id: string;
	avatar_url: string;
	thumbnail_256_url?: string | null;
	thumbnail_64_url?: string | null;
	is_active: boolean;
	file_size?: number | null;
	mime_type?: string | null;
	created_at: string; // Backend uses created_at, not upload_date
}

// ============================================================================
// Preferences Types
// ============================================================================

export type Language = 'ru' | 'en' | 'es' | 'fr' | 'de' | 'zh';
export type Theme = 'light' | 'dark' | 'auto';
export type ProfileVisibility = 'public' | 'private' | 'friends_only';
export type EmailFrequency =
	| 'instant'
	| 'hourly'
	| 'daily'
	| 'weekly'
	| 'never';
export type DesktopSceneDepth = 'soft' | 'balanced' | 'immersive';

export type DesktopFontBodyId =
	| 'manrope'
	| 'poppins'
	| 'raleway'
	| 'montserrat';

export type DesktopFontDisplayId =
	| 'system'
	| 'cinzel'
	| 'playfair'
	| 'cormorant'
	| 'raleway';

export const DESKTOP_FONT_BODY_KEYS: readonly DesktopFontBodyId[] = [
	'manrope',
	'poppins',
	'raleway',
	'montserrat',
] as const;

export const DESKTOP_FONT_DISPLAY_KEYS: readonly DesktopFontDisplayId[] = [
	'system',
	'cinzel',
	'playfair',
	'cormorant',
	'raleway',
] as const;

export const DESKTOP_SCENE_DEPTH_KEYS: readonly DesktopSceneDepth[] = [
	'soft',
	'balanced',
	'immersive',
] as const;

export type DesktopShellMotionSpeed = 'slow' | 'normal' | 'fast';

export type DesktopShellParallaxIntensity = 'subtle' | 'normal' | 'strong';

/** Multimodal Start Menu interface (Пуск orchestrator). */
export type DesktopMenuMode =
	| 'legacy'
	| 'command_console'
	| 'workspace_dashboard';

export const DESKTOP_SHELL_MOTION_SPEED_KEYS: readonly DesktopShellMotionSpeed[] =
	['slow', 'normal', 'fast'] as const;

export const DESKTOP_SHELL_PARALLAX_INTENSITY_KEYS: readonly DesktopShellParallaxIntensity[] =
	['subtle', 'normal', 'strong'] as const;

export const DESKTOP_MENU_MODE_KEYS: readonly DesktopMenuMode[] = [
	'legacy',
	'command_console',
	'workspace_dashboard',
] as const;

export function normalizeDesktopMenuMode(
	raw: string | undefined | null
): DesktopMenuMode {
	if (raw == null || raw === '') return 'legacy';
	if ((DESKTOP_MENU_MODE_KEYS as readonly string[]).includes(raw)) {
		return raw as DesktopMenuMode;
	}
	return 'legacy';
}

export function normalizeDesktopShellMotionSpeed(
	raw: string | undefined | null
): DesktopShellMotionSpeed {
	if (raw == null || raw === '') return 'normal';
	if ((DESKTOP_SHELL_MOTION_SPEED_KEYS as readonly string[]).includes(raw)) {
		return raw as DesktopShellMotionSpeed;
	}
	return 'normal';
}

export function normalizeDesktopShellParallaxIntensity(
	raw: string | undefined | null
): DesktopShellParallaxIntensity {
	if (raw == null || raw === '') return 'normal';
	if (
		(DESKTOP_SHELL_PARALLAX_INTENSITY_KEYS as readonly string[]).includes(raw)
	) {
		return raw as DesktopShellParallaxIntensity;
	}
	return 'normal';
}

export function normalizeDesktopFontBody(
	raw: string | undefined | null
): DesktopFontBodyId {
	if (raw == null || raw === '') return 'manrope';
	if ((DESKTOP_FONT_BODY_KEYS as readonly string[]).includes(raw)) {
		return raw as DesktopFontBodyId;
	}
	return 'manrope';
}

export function normalizeDesktopFontDisplay(
	raw: string | undefined | null
): DesktopFontDisplayId {
	if (raw == null || raw === '') return 'system';
	if ((DESKTOP_FONT_DISPLAY_KEYS as readonly string[]).includes(raw)) {
		return raw as DesktopFontDisplayId;
	}
	return 'system';
}

export function normalizeDesktopSceneDepth(
	raw: string | undefined | null
): DesktopSceneDepth {
	if (raw == null || raw === '') return 'balanced';
	if ((DESKTOP_SCENE_DEPTH_KEYS as readonly string[]).includes(raw)) {
		return raw as DesktopSceneDepth;
	}
	return 'balanced';
}

export type DesktopWindowStyle =
	| 'glass'
	| 'framed'
	| 'minimal'
	| 'noir'
	| 'neon'
	| 'paper'
	| 'aurora'
	| 'chameleon'
	| 'premium';

/** Иконки-only: не являются пресетами окон — только для ярлыков / Пуск / панели. */
export type DesktopIconOnlyStyle =
	| 'prism'
	| 'mercury'
	| 'vhs'
	| 'slate'
	| 'clay'
	| 'ember';

/** Пресеты окон плюс отдельные стили только для иконок. Legacy `accent`→`aurora`, `graphite`→`noir`. */
export type DesktopIconStyle = DesktopWindowStyle | DesktopIconOnlyStyle;

/** Порядок карточек «Особые — только для иконок» в Центре управления. */
export const DESKTOP_ICON_ONLY_STYLE_KEYS: readonly DesktopIconOnlyStyle[] = [
	'prism',
	'mercury',
	'vhs',
	'slate',
	'clay',
	'ember',
] as const;

/** Тот же набор ключей, что и у окон; старые `clear` / `solid` нормализуются при чтении. */
export type DesktopTaskbarStyle = DesktopWindowStyle;

const LEGACY_DESKTOP_TASKBAR_STYLE: Record<string, DesktopTaskbarStyle> = {
	clear: 'glass',
	solid: 'framed',
};

export const DESKTOP_TASKBAR_STYLE_KEYS: readonly DesktopTaskbarStyle[] = [
	'glass',
	'framed',
	'minimal',
	'noir',
	'neon',
	'paper',
	'aurora',
	'chameleon',
	'premium',
] as const;

/** Нормализует сохранённые значения (`clear`→`glass`, `solid`→`framed`) и неизвестные строки. */
export function normalizeDesktopTaskbarStyle(
	raw: string | undefined | null
): DesktopTaskbarStyle {
	if (raw == null || raw === '') return 'framed';
	const mapped = LEGACY_DESKTOP_TASKBAR_STYLE[raw];
	if (mapped) return mapped;
	if ((DESKTOP_TASKBAR_STYLE_KEYS as readonly string[]).includes(raw)) {
		return raw as DesktopTaskbarStyle;
	}
	return 'framed';
}
/** Те же пресеты, что у окон; legacy `board`→`framed`, `compact`→`minimal`. */
export type DesktopWidgetsStyle = DesktopWindowStyle;

const LEGACY_DESKTOP_WIDGETS_STYLE: Record<string, DesktopWidgetsStyle> = {
	board: 'framed',
	compact: 'minimal',
};

const DESKTOP_WIDGETS_STYLE_KEYS: readonly DesktopWidgetsStyle[] = [
	'glass',
	'framed',
	'minimal',
	'noir',
	'neon',
	'paper',
	'aurora',
	'chameleon',
	'premium',
] as const;

export function normalizeDesktopWidgetsStyle(
	raw: string | undefined | null
): DesktopWidgetsStyle {
	if (raw == null || raw === '') return 'framed';
	const mapped = LEGACY_DESKTOP_WIDGETS_STYLE[raw];
	if (mapped) return mapped;
	if ((DESKTOP_WIDGETS_STYLE_KEYS as readonly string[]).includes(raw)) {
		return raw as DesktopWidgetsStyle;
	}
	return 'framed';
}

const LEGACY_DESKTOP_ICON_STYLE: Record<string, DesktopIconStyle> = {
	accent: 'aurora',
	graphite: 'noir',
};

/** Полный порядок ключей стиля иконок (9 пресетов окон + icon-only packs). */
export const DESKTOP_ICON_STYLE_KEYS: readonly DesktopIconStyle[] = [
	'glass',
	'framed',
	'minimal',
	'noir',
	'neon',
	'paper',
	'aurora',
	'chameleon',
	'premium',
	...DESKTOP_ICON_ONLY_STYLE_KEYS,
] as const;

/** Нормализует сохранённые значения (`accent`→`aurora`, `graphite`→`noir`) и неизвестные строки. */
export function normalizeDesktopIconStyle(
	raw: string | undefined | null
): DesktopIconStyle {
	if (raw == null || raw === '') return 'framed';
	const mapped = LEGACY_DESKTOP_ICON_STYLE[raw];
	if (mapped) return mapped;
	if ((DESKTOP_ICON_STYLE_KEYS as readonly string[]).includes(raw)) {
		return raw as DesktopIconStyle;
	}
	return 'framed';
}

/** Прозрачность «панелей» (панель задач, фон плавающего виджета): 0.35…1, по умолчанию 1. */
export const DESKTOP_PANEL_OPACITY_MIN = 0.35;
export const DESKTOP_PANEL_OPACITY_MAX = 1;
export const DESKTOP_PANEL_OPACITY_DEFAULT = 1;

export function clampDesktopPanelOpacity(raw: unknown): number {
	const n = typeof raw === 'number' ? raw : Number(raw);
	if (!Number.isFinite(n)) return DESKTOP_PANEL_OPACITY_DEFAULT;
	return Math.min(
		DESKTOP_PANEL_OPACITY_MAX,
		Math.max(DESKTOP_PANEL_OPACITY_MIN, n)
	);
}

/** UGS task lifecycle: per-block enable + in-app vs OS browser (server preferences.notifications.ugs). */
export interface UgsNotificationBlockSettings {
	enabled: boolean;
	in_app: boolean;
	browser: boolean;
}

export interface UgsNotificationPreferences {
	task_completed: UgsNotificationBlockSettings;
	task_queued: UgsNotificationBlockSettings;
	task_started: UgsNotificationBlockSettings;
}

export const DEFAULT_UGS_NOTIFICATION_BLOCK: UgsNotificationBlockSettings = {
	enabled: true,
	in_app: true,
	browser: false,
};

export const DEFAULT_UGS_NOTIFICATION_PREFERENCES: UgsNotificationPreferences =
	{
		task_completed: { ...DEFAULT_UGS_NOTIFICATION_BLOCK },
		task_queued: { ...DEFAULT_UGS_NOTIFICATION_BLOCK },
		task_started: { ...DEFAULT_UGS_NOTIFICATION_BLOCK },
	};

/** GAF Chat: входящие сообщения (preferences.notifications.gaf). */
export interface GafNotificationPreferences {
	incoming_message: UgsNotificationBlockSettings;
}

export const DEFAULT_GAF_NOTIFICATION_PREFERENCES: GafNotificationPreferences =
	{
		incoming_message: { ...DEFAULT_UGS_NOTIFICATION_BLOCK },
	};

export interface NotificationPreferences {
	email: boolean;
	push: boolean;
	in_app: boolean;
	desktop: boolean;
	email_frequency: EmailFrequency;
	categories: {
		security: boolean;
		updates: boolean;
		marketing: boolean;
	};
	// Desktop-specific notification settings
	desktop_sound_enabled?: boolean;
	desktop_sound_theme?: string;
	/**
	 * Optional per-source sound overrides for desktop notifications.
	 * Key examples: `gaf_chat`, `ugs`, `doc_editor`, `default`.
	 */
	desktop_sound_theme_by_source?: Record<string, string>;
	/**
	 * Optional per-source sound on/off map.
	 * Key examples: `gaf_chat`, `ugs`, `doc_editor`, `default`.
	 */
	desktop_sound_enabled_by_source?: Record<string, boolean>;
	desktop_do_not_disturb?: boolean;
	/**
	 * If true, every socket `notification` event is added to the tray list (not only persistent/high/urgent).
	 */
	desktop_notification_center_all_socket_events?: boolean;
	/** UGS Hub / tray task notifications (API-driven, no localStorage). */
	ugs?: UgsNotificationPreferences;
	/** GAF Chat входящие сообщения (API-driven). */
	gaf?: GafNotificationPreferences;
}

export interface PrivacyPreferences {
	profile_visibility: ProfileVisibility;
	show_email: boolean;
	show_activity: boolean;
	show_stats: boolean;
	allow_messaging: boolean;
}

export interface UIPreferences {
	compact_mode: boolean;
	animations_enabled: boolean;
	sidebar_collapsed: boolean;
	default_view: string;
	desktop_open_apps_maximized: boolean;
	desktop_floating_widget_visible: boolean;
	desktop_icon_style: DesktopIconStyle;
	desktop_scene_depth: DesktopSceneDepth;
	/** Body UI font (loaded via @fontsource). */
	desktop_font_body: DesktopFontBodyId;
	/** Display/heading font; `system` uses body stack. */
	desktop_font_display: DesktopFontDisplayId;
	/** Smooth wallpaper background transition on `#desktop-main`. */
	desktop_wallpaper_crossfade_enabled: boolean;
	/** Prefer styled TooltipV2 over native `title` hints in shell chrome. */
	desktop_styled_tooltips: boolean;
	/** Desktop shell: minimal motion (windows, taskbar, morph) regardless of OS setting. */
	desktop_shell_reduce_motion: boolean;
	/** Desktop shell: pointer wallpaper parallax on `#desktop-main`. */
	desktop_shell_parallax_enabled: boolean;
	/** Multiplier on scene-depth parallax strength. */
	desktop_shell_parallax_intensity: DesktopShellParallaxIntensity;
	/** Desktop shell: layoutId morph between window title icon and taskbar. */
	desktop_shell_window_morph_enabled: boolean;
	/** Desktop shell: spring/minimize timing preset. */
	desktop_shell_motion_speed: DesktopShellMotionSpeed;
	/**
	 * Start Menu interface mode: legacy Пуск, command console, or workspace dashboard.
	 * Orchestrator: `pages/Desktop/components/StartMenu.tsx`.
	 */
	desktop_menu_mode: DesktopMenuMode;
	desktop_taskbar_style: DesktopTaskbarStyle;
	desktop_window_style: DesktopWindowStyle;
	/** Если true, `--desktop-accent-rgb` берётся из палитры выбранного стиля окон, а не из пресета акцента конфига. */
	desktop_accent_follows_window_style: boolean;
	desktop_widgets_style: DesktopWidgetsStyle;
	/** Прозрачность фона панели задач и виджета (0.35–1). */
	desktop_panel_opacity: number;
	/**
	 * Масштаб контента рабочего стола (окна, иконки, панель), как грубый аналог DPI / «разрешения».
	 * 1 = 100%, меньше — мельче интерфейс визуально, больше — крупнее.
	 */
	desktop_ui_scale: number;
	/** Ослабить backdrop-blur в оболочке стола (легче для GPU). */
	desktop_reduce_backdrop_blur: boolean;
	/** GAF Chat: узкая колонка диалогов (только аватары) vs полный список. */
	desktop_gaf_chat_sidebar_collapsed: boolean;
}

export const DEFAULT_UI_PREFERENCES: UIPreferences = {
	compact_mode: false,
	animations_enabled: true,
	sidebar_collapsed: true,
	default_view: 'dashboard',
	desktop_open_apps_maximized: true,
	desktop_floating_widget_visible: true,
	desktop_icon_style: 'framed',
	desktop_scene_depth: 'balanced',
	desktop_font_body: 'manrope',
	desktop_font_display: 'system',
	desktop_wallpaper_crossfade_enabled: true,
	desktop_styled_tooltips: true,
	desktop_shell_reduce_motion: false,
	desktop_shell_parallax_enabled: true,
	desktop_shell_parallax_intensity: 'normal',
	desktop_shell_window_morph_enabled: true,
	desktop_shell_motion_speed: 'normal',
	desktop_menu_mode: 'legacy',
	desktop_taskbar_style: 'framed',
	desktop_window_style: 'framed',
	desktop_accent_follows_window_style: false,
	desktop_widgets_style: 'framed',
	desktop_panel_opacity: DESKTOP_PANEL_OPACITY_DEFAULT,
	desktop_ui_scale: 1,
	desktop_reduce_backdrop_blur: false,
	desktop_gaf_chat_sidebar_collapsed: true,
};

export interface AccessibilityPreferences {
	high_contrast: boolean;
	large_text: boolean;
	reduce_motion: boolean;
	screen_reader: boolean;
}

/** Incoming video-call ring target (Связи → Телефон). */
export type VideoCallTarget = 'both' | 'desktop_only' | 'mobile_only';

export interface VideoCallsPreferences {
	call_target: VideoCallTarget;
}

export interface UserPreferences {
	language: Language;
	theme: Theme;
	timezone?: string;
	notifications: NotificationPreferences;
	privacy: PrivacyPreferences;
	ui: UIPreferences;
	accessibility: AccessibilityPreferences;
	video_calls?: VideoCallsPreferences;
}

export interface UserPreferencesUpdate {
	language?: Language;
	theme?: Theme;
	timezone?: string;
	notifications?: Partial<NotificationPreferences>;
	privacy?: Partial<PrivacyPreferences>;
	ui?: Partial<UIPreferences>;
	accessibility?: Partial<AccessibilityPreferences>;
	video_calls?: Partial<VideoCallsPreferences>;
}

// ============================================================================
// Security Types
// ============================================================================

export interface SecuritySettings {
	two_factor_enabled: boolean;
	last_password_change: string | null;
	active_sessions_count: number;
	failed_login_attempts: number;
	locked_until: string | null;
}

export interface PasswordChangeData {
	current_password: string;
	new_password: string;
}

export interface UserSessionInfo {
	id: string;
	ip_address: string | null;
	user_agent: string | null;
	device_info: Record<string, unknown>;
	last_used_at: string;
	created_at: string;
	is_current: boolean;
}

// ============================================================================
// Statistics Types
// ============================================================================

export interface UserStatistics {
	account_age_days: number;
	total_logins: number;
	last_login: string | null;
	total_chat_sessions: number;
	active_chat_sessions: number;
	total_chat_messages: number;
	total_chat_tokens: number;
	total_ai_generations: number;
	completed_ai_generations: number;
	failed_ai_generations: number;
	ai_success_rate: number;
	total_content_items: number;
	storage_used_bytes: number;
	storage_used_mb: number;
	storage_quota_mb: number;
}

// ============================================================================
// Activity Log Types
// ============================================================================

export interface ActivityLogEntry {
	id: string;
	action: string;
	description: string | null;
	ip_address: string | null;
	user_agent: string | null;
	metadata: Record<string, unknown>;
	created_at: string;
}

export interface ActivityLogResponse {
	activities: ActivityLogEntry[];
	total: number;
	page: number;
	per_page: number;
	total_pages: number;
}

// ============================================================================
// Component Props Types
// ============================================================================

export interface ProfileTabProps {
	profile: UserProfileResponse;
	onProfileUpdate: (profile: UserProfileResponse) => void;
}

export interface PreferencesTabProps {
	preferences: UserPreferences;
	onPreferencesUpdate: (preferences: UserPreferences) => void;
}

export interface SecurityTabProps {
	security: SecuritySettings;
	onSecurityUpdate: (security: SecuritySettings) => void;
}

// ============================================================================
// UI State Types
// ============================================================================

export type ProfileTab = 'profile' | 'statistics' | 'activity';

export interface ProfileState {
	activeTab: ProfileTab;
	profile: UserProfileResponse | null;
	preferences: UserPreferences | null;
	security: SecuritySettings | null;
	statistics: UserStatistics | null;
	isLoading: boolean;
	error: string | null;
}

// ============================================================================
// Language Labels
// ============================================================================

export const LANGUAGE_LABELS: Record<
	Language,
	{ label: string; flag: string }
> = {
	ru: { label: 'Русский', flag: '🇷🇺' },
	en: { label: 'English', flag: '🇬🇧' },
	es: { label: 'Español', flag: '🇪🇸' },
	fr: { label: 'Français', flag: '🇫🇷' },
	de: { label: 'Deutsch', flag: '🇩🇪' },
	zh: { label: '中文', flag: '🇨🇳' },
};

// ============================================================================
// Validation Constants
// ============================================================================

export const VALIDATION_RULES = {
	FULL_NAME_MAX_LENGTH: 24,
	BIO_MAX_LENGTH: 1000,
	AVATAR_MAX_SIZE: 5 * 1024 * 1024, // 5MB
	AVATAR_ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
	PASSWORD_MIN_LENGTH: 8,
	PASSWORD_PATTERN:
		/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
};

// ============================================================================
// Helper Functions
// ============================================================================

export function validatePassword(password: string): {
	isValid: boolean;
	errors: string[];
	strength: number;
} {
	const errors: string[] = [];
	let strength = 0;

	if (password.length < VALIDATION_RULES.PASSWORD_MIN_LENGTH) {
		errors.push('Минимум 8 символов');
	} else {
		strength++;
	}

	if (!/[A-Z]/.test(password)) {
		errors.push('Требуется заглавная буква');
	} else {
		strength++;
	}

	if (!/[a-z]/.test(password)) {
		errors.push('Требуется строчная буква');
	} else {
		strength++;
	}

	if (!/\d/.test(password)) {
		errors.push('Требуется цифра');
	} else {
		strength++;
	}

	if (!/[@$!%*?&]/.test(password)) {
		errors.push('Требуется специальный символ (@$!%*?&)');
	} else {
		strength++;
	}

	return {
		isValid: errors.length === 0,
		errors,
		strength,
	};
}

export function formatFileSize(bytes: number): string {
	if (bytes < 1024) {
		return `${bytes} B`;
	}
	if (bytes < 1024 * 1024) {
		return `${(bytes / 1024).toFixed(2)} KB`;
	}
	return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatDate(dateString: string | null): string {
	if (!dateString) {
		return 'Никогда';
	}
	const date = new Date(dateString);
	return new Intl.DateTimeFormat('ru-RU', {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	}).format(date);
}

export function formatRelativeTime(dateString: string): string {
	const date = new Date(dateString);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffMins = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMs / 3600000);
	const diffDays = Math.floor(diffMs / 86400000);

	if (diffMins < 1) {
		return 'только что';
	}
	if (diffMins < 60) {
		return `${diffMins} мин назад`;
	}
	if (diffHours < 24) {
		return `${diffHours} ч назад`;
	}
	if (diffDays < 7) {
		return `${diffDays} дн назад`;
	}
	return formatDate(dateString);
}

// ============================================================================
// Extended Types for Enhanced Profile Features
// ============================================================================

// Active Session with detailed info
export interface ActiveSession {
	id: string;
	device_name: string;
	device_type: 'desktop' | 'mobile' | 'tablet' | 'unknown';
	browser: string;
	ip_address: string;
	location: string;
	last_activity: string;
	is_current: boolean;
}

// Security Event
export interface SecurityEvent {
	id: string;
	event_type:
		| 'login'
		| 'logout'
		| 'password_change'
		| '2fa_enabled'
		| '2fa_disabled'
		| 'failed_login';
	description: string;
	ip_address: string;
	location: string;
	timestamp: string;
	severity: 'info' | 'warning' | 'critical';
}

// Extended Security Settings
export interface ExtendedSecuritySettings extends SecuritySettings {
	two_factor_method: '2fa_app' | 'sms' | 'email' | null;
	password_strength: 'weak' | 'medium' | 'strong';
	active_sessions: ActiveSession[];
	recent_security_events: SecurityEvent[];
	backup_codes_count: number;
}

// 2FA Setup Response
export interface Enable2FAResponse {
	secret: string;
	qr_code_url: string;
	backup_codes: string[];
}

// Data Export Types
export interface DataExportRequest {
	include_profile: boolean;
	include_chat_history: boolean;
	include_content: boolean;
	include_ai_generations: boolean;
	include_activity_log: boolean;
	format: 'json' | 'csv' | 'pdf';
}

export interface DataExportResponse {
	export_id: string;
	status: 'pending' | 'processing' | 'completed' | 'failed';
	download_url: string | null;
	created_at: string;
	expires_at: string;
	file_size?: number;
}

// Theme Configuration
export interface ThemeConfig {
	name: string;
	colors: {
		primary: string;
		secondary: string;
		accent: string;
		background: string;
		surface: string;
		text: string;
	};
	fonts: {
		heading: string;
		body: string;
		mono: string;
	};
}

// Timezone Info
export interface TimezoneInfo {
	value: string;
	label: string;
	offset: string;
}

// Helper Functions
export function getDeviceIcon(deviceType: string | undefined): string {
	const icons: Record<string, string> = {
		desktop: '💻',
		mobile: '📱',
		tablet: '📱',
		unknown: '🖥️',
	};
	if (deviceType && deviceType in icons) {
		return icons[deviceType] ?? icons.unknown;
	}
	return icons.unknown;
}

export function getSeverityColor(severity: string | undefined): string {
	const colors: Record<string, string> = {
		info: 'blue',
		warning: 'yellow',
		critical: 'red',
	};
	if (severity && severity in colors) {
		return colors[severity] ?? colors.info;
	}
	return colors.info;
}

export function getPasswordStrength(
	password: string
): 'weak' | 'medium' | 'strong' {
	const validation = validatePassword(password);

	if (validation.strength <= 2) {
		return 'weak';
	}
	if (validation.strength <= 3) {
		return 'medium';
	}
	return 'strong';
}

export function getStrengthColor(
	strength: 'weak' | 'medium' | 'strong' | undefined
): string {
	const colors: Record<string, string> = {
		weak: 'red',
		medium: 'yellow',
		strong: 'green',
	};
	if (strength && strength in colors) {
		return colors[strength] ?? colors.weak;
	}
	return colors.weak;
}

export function getThemeIcon(theme: Theme): string {
	const icons: Record<Theme, string> = {
		light: '☀️',
		dark: '🌙',
		auto: '🔄',
	};
	return icons[theme];
}

// Common Timezones
export const COMMON_TIMEZONES: TimezoneInfo[] = [
	{ value: 'Europe/Moscow', label: 'Москва (UTC+3)', offset: '+03:00' },
	{ value: 'Europe/London', label: 'Лондон (UTC+0)', offset: '+00:00' },
	{ value: 'America/New_York', label: 'Нью-Йорк (UTC-5)', offset: '-05:00' },
	{
		value: 'America/Los_Angeles',
		label: 'Лос-Анджелес (UTC-8)',
		offset: '-08:00',
	},
	{ value: 'Asia/Tokyo', label: 'Токио (UTC+9)', offset: '+09:00' },
	{ value: 'Asia/Shanghai', label: 'Шанхай (UTC+8)', offset: '+08:00' },
	{ value: 'Australia/Sydney', label: 'Сидней (UTC+11)', offset: '+11:00' },
];
