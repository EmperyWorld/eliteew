/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Preload Desktop app chunks before restored or hovered windows need to render them.
 *
 * Invariants:
 * - Preload keys mirror registered `appComponent` names and never instantiate app side effects directly.
 * - Priority apps start first when many windows restore at once.
 * - Heavy apps in {@link DESKTOP_PRELOAD_DEFER_ON_RESTORE} are skipped on restore batch preload.
 *
 * Related:
 * - src/pages/Desktop/components/desktopWindowAppContent.tsx
 * - src/pages/Desktop/hooks/useWindowManager.ts
 */

/**
 * When many apps preload at once (e.g. window restore), start these dynamic imports
 * first so their chunks compete first for the network/parse queue — primary chat UX.
 */
const DESKTOP_PRELOAD_PRIORITY_FIRST = new Set<string>(['GAFChatApp']);

/**
 * Heavy app chunks (~0.5–1MB+) — do not batch-preload on session restore.
 * Suspense loads them when the restored window paints; hover/open still warms via
 * {@link preloadDesktopApp}.
 */
export const DESKTOP_PRELOAD_DEFER_ON_RESTORE = new Set<string>([
	'EwaApp',
	'ContentManagerPro',
	'DocEditor',
	'DocEditorV2',
	'ImageStudio',
	'VideoStudio',
	'MusicForgeApp',
	'Presentations',
	'PresentationsArchive',
	'EWRP',
	'StudioGU',
	'UnifiedAdminApp',
	'MarketingCabinet',
	'CustomerCabinet',
	'PoemmaApp',
]);

function orderDesktopAppsForPreload(apps: string[]): string[] {
	const first: string[] = [];
	const rest: string[] = [];
	for (const id of apps) {
		if (DESKTOP_PRELOAD_PRIORITY_FIRST.has(id)) {
			first.push(id);
		} else {
			rest.push(id);
		}
	}
	return [...first, ...rest];
}

const DESKTOP_APP_PRELOADERS: Record<string, () => Promise<unknown>> = {
	ContentManagerPro: () => import('../../ContentManager/ContentManagerPro'),
	UGS: () =>
		import('../components/UGSDesktopContainer').then((m) => ({
			default: m.UGSDesktopContainer,
		})),
	UGSHubApp: () =>
		import('../components/UGSDesktopContainer').then((m) => ({
			default: m.UGSDesktopContainer,
		})),
	Presentations: () =>
		import('../../../components/EWRP/EWRPGenerator').then((m) => ({
			default: m.default,
		})),
	PresentationsArchive: () =>
		import('../../../components/EWRP/EWRPGenerator').then((m) => ({
			default: m.default,
		})),
	EWRP: () =>
		import('../../../components/EWRP/EWRPGenerator').then((m) => ({
			default: m.default,
		})),
	StudioGU: () => import('../../StudioGU/StudioGUPage'),
	DocEditor: () =>
		import('../../../components/UltimateDocEditor/UltimateDocEditor').then(
			(m) => ({ default: m.UltimateDocEditor })
		),
	DocEditorV2: () =>
		import('../../../features/documentEditorV2/DocEditorV2').then((m) => ({
			default: m.DocEditorV2,
		})),
	ClipboardManager: () => import('../components/ClipboardManager'),
	// Default messaging app; also listed in DESKTOP_PRELOAD_PRIORITY_FIRST for batch restore.
	GAFChatApp: () => import('../components/GAFChat/GAFChatApp'),
	VideoCallApp: () => import('../components/VideoCall/VideoCallApp'),
	DesktopAiChatApp: () =>
		import('../../../features/desktop-ai-chat/DesktopAiChatApp'),
	SocialHubApp: () =>
		import('../../../features/friends/components/SocialHubApp'),
	FriendsApp: () => import('../../../features/friends/components/SocialHubApp'),
	UserProfile: () =>
		import('../../../features/friends/components/SocialHubApp'),
	AppStore: () =>
		import('../components/AppStoreWindowContent').then((m) => ({
			default: m.AppStoreWindowContent,
		})),
	DesktopShellSettings: () =>
		import('../components/DesktopShellSettingsWindowContent'),
	DesktopAppMaintenance: () =>
		import('../components/DesktopAppMaintenance').then((m) => ({
			default: m.DesktopAppMaintenance,
		})),
	UnifiedAdminApp: () =>
		import('../../Admin/UnifiedAdminPage').then((m) => ({
			default: m.UnifiedAdminPage,
		})),
	MarketingCabinet: () => import('../../MarketingCabinet/MarketingCabinetPage'),
	EwaApp: () =>
		import('../../../features/ewa/EwaDesktopApp').then((m) => ({
			default: m.EwaDesktopApp,
		})),
	CustomerCabinet: () => import('../../CustomerCabinet/CustomerCabinetPage'),
	NotificationsApp: () =>
		import('../components/NotificationsDesktopApp').then((m) => ({
			default: m.default,
		})),
	CalendarApp: () => import('../apps/CalendarApp'),
	DesktopWidgetShelfApp: () => import('../components/DesktopWidgetShelfApp'),
	DesktopDashboardFavoritesApp: () =>
		import('../components/DesktopDashboardFavoritesApp'),
	UserSiteStudio: () => import('../apps/UserSiteStudio'),
	LocalServiceIframeApp: () => import('../apps/LocalServiceIframeApp'),
	MusicForgeApp: () =>
		import('../../MusicForge/MusicForgeApp').then((m) => ({
			default: m.MusicForgeApp,
		})),
	PoemmaApp: () =>
		import('../../../features/poemma/PoemmaApp').then((m) => ({
			default: m.PoemmaApp,
		})),
	ProjectAboutApp: () => import('../apps/ProjectAboutApp'),
	KursorinaApp: () => import('../apps/KursorinaApp'),
	EmperyNexusChronicleApp: () => import('../apps/EmperyNexusChronicleApp'),
	ImageStudio: () =>
		import('../../ImageStudio/ImageStudioPage').then((m) => ({
			default: m.ImageStudioPage,
		})),
	VideoStudio: () =>
		import('../../VideoStudio/VideoStudioPage').then((m) => ({
			default: m.VideoStudioPage,
		})),
	MusicPlayer: () =>
		import('../../MusicPlayer/MusicPlayerPage').then((m) => ({
			default: m.MusicPlayerPage,
		})),
	KirsClientSite: () => import('../../Kirs/KirsClientSitePage'),
	KirsCuration: () => import('../../Kirs/KirsPage'),
	FeedbackHubApp: () => import('../components/FeedbackHubApp'),
	SurveyHubApp: () => import('../apps/SurveyHub/SurveyHubApp'),
	AssistantApp: () => import('../components/AssistantApp'),
	EWDeskApp: () => import('../components/EWDeskApp'),
};

export function filterDesktopAppsForRestorePreload(
	appComponents: readonly string[]
): string[] {
	return appComponents.filter(
		(id) => !DESKTOP_PRELOAD_DEFER_ON_RESTORE.has(id)
	);
}

export function preloadDesktopApp(
	appComponent: string | null | undefined
): Promise<unknown> | null {
	if (!appComponent) {
		return null;
	}
	const preload = DESKTOP_APP_PRELOADERS[appComponent];
	return preload ? preload() : null;
}

export async function preloadDesktopApps(
	appComponents: Iterable<string | null | undefined>,
	options?: { deferHeavy?: boolean }
): Promise<void> {
	const unique = Array.from(new Set(appComponents)).filter(
		(c): c is string => c != null && c !== ''
	);
	const eligible =
		options?.deferHeavy === true
			? filterDesktopAppsForRestorePreload(unique)
			: unique;
	const ordered = orderDesktopAppsForPreload(eligible);
	const pending = ordered
		.map((appComponent) => preloadDesktopApp(appComponent))
		.filter((promise): promise is Promise<unknown> => promise != null);

	if (pending.length === 0) {
		return;
	}

	await Promise.allSettled(pending);
}
