/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * FoFline (`foflineNative`) Start/catalog surface — mirrors install profile
 * `fofline-connected` (+ shell exempts). Fail-closed before/without API.
 *
 * Invariants:
 * - Must stay aligned with shared/apps/_profiles/fofline-connected.yaml resolve.
 * - Does not replace W5 API allowlist; only stops UI from opening denied apps.
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md §17.5
 * - utils/desktopInstallProfileFilter.ts
 */

/** Profile id returned by GET /desktop/install-profile for FoFline tokens. */
export const FOFLINE_CONNECTED_PROFILE_ID = 'fofline-connected';

/**
 * Enabled app_component set for FoFline connected surface (A3).
 * Keep in lockstep with `fofline-connected.yaml` + profiles.resolve.
 */
export const FOFLINE_CONNECTED_APP_COMPONENTS: ReadonlySet<string> = new Set([
	// Manifest allowlist
	'NotificationsApp',
	'ProjectAboutApp',
	'ClipboardManager',
	'MusicPlayer',
	'AppStore',
	/** Assistant FAQ (`AssistantApp`) — not Experts ensemble chat (`DesktopAiChatApp`). */
	'AssistantApp',
	'EWDeskApp',
	'PoemmaApp',
	// Selective legacy extras
	'EwaApp',
	'ContentManagerPro',
	'UGS',
	'UGSHubApp',
	'UserProfile',
	'VoiceStudio',
	/** Messenger. 1:1 calls are entered from a GAF dialog. */
	'GAFChatApp',
	/** Call window. Not a catalog-only tile; W5 allows `/api/v1/video-calls`. */
	'VideoCallApp',
	'CalendarApp',
	'DocEditorV2',
	/** Presentations tile (`EWRP`). Not `Presentations` / `PresentationsArchive`. */
	'EWRP',
	'ImageStudio',
	'SocialHubApp',
	'SurveyHubApp',
	'KursorinaApp',
	'EBrowserApp',
	'ProfessionalWorlds',
]);

/** Intersect API set with FoFline surface (defense-in-depth vs cloud-full). */
export function intersectFoflineConnectedSurface(
	enabled: ReadonlySet<string>
): ReadonlySet<string> {
	const out = new Set<string>();
	for (const id of enabled) {
		if (FOFLINE_CONNECTED_APP_COMPONENTS.has(id)) {
			out.add(id);
		}
	}
	return out;
}
