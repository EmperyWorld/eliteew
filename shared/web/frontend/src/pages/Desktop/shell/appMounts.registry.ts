/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Declarative Desktop window mount catalog (Gen/Forge Wave F1) — SoT for which
 * `app_component` ids resolve to window content (vs empty state).
 *
 * Invariants:
 * - Scaffold appends primary ids between markers; aliases stay explicit.
 * - API-known ids without a mount must appear in APP_UNMOUNTED_COMPONENTS.
 * - Shell-only mounts are listed here and in SHELL_ONLY_DESKTOP_APP_COMPONENTS.
 *
 * Related:
 * - shell/appMounts.resolve.tsx
 * - shell/desktopKnownAppComponents.ts
 * - documentation/platform/ELITEEW-GENEW-FACTORY-HARVEST.md §Wave F1
 */

/** Intentional API-known components with no Desktop window mount (legacy / peer-only). */
export const APP_UNMOUNTED_COMPONENTS = [
	'AudioTranscriptionPro',
	'ComfyUI',
	'VoiceCommand',
	'VoiceStudio',
] as const;

/**
 * Primary + alias `app_component` values that `resolveAppMount` handles.
 * @scaffold:app-mounts-start
 */
export const APP_MOUNTED_COMPONENTS = [
	'ContentManagerPro',
	'UGS',
	'UGSHubApp',
	'Presentations',
	'PresentationsArchive',
	'EWRP',
	'StudioGU',
	'MusicGenerator',
	'MusicEvolutionApp',
	'MusicForgeApp',
	'PoemmaApp',
	'ProjectAboutApp',
	'EBrowserApp',
	'EmperyNexusChronicleApp',
	'ImageStudio',
	'VideoStudio',
	'MusicPlayer',
	'NotificationsApp',
	'CalendarApp',
	'DesktopWidgetShelfApp',
	'DesktopDashboardFavoritesApp',
	'EWDeskApp',
	'FeedbackHubApp',
	'SurveyHubApp',
	'AssistantApp',
	'ProfessionalWorlds',
	'DocEditor',
	'DocEditorV2',
	'ClipboardManager',
	'GAFChatApp',
	'VideoCallApp',
	'DesktopAiChatApp',
	'SocialHubApp',
	'FriendsApp',
	'UserProfile',
	'AppStore',
	'DesktopShellSettings',
	'DesktopAppMaintenance',
	'UnifiedAdminApp',
	'MarketingCabinet',
	'EwaApp',
	'CustomerCabinet',
	'UserSiteStudio',
	'SiteManagerOps',
	'LocalServiceIframeApp',
	'KirsCuration',
	'KirsClientSite',
	'KursorinaApp',
] as const;
// @scaffold:app-mounts-end

export const APP_MOUNTED_COMPONENT_SET: ReadonlySet<string> = new Set(
	APP_MOUNTED_COMPONENTS
);

export const APP_UNMOUNTED_COMPONENT_SET: ReadonlySet<string> = new Set(
	APP_UNMOUNTED_COMPONENTS
);

export function isDesktopAppMounted(appComponent: string): boolean {
	return APP_MOUNTED_COMPONENT_SET.has(appComponent);
}
