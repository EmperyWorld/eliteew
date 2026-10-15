/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * React.lazy registry for desktop window apps — keeps idle #desktop off heavy bundles.
 *
 * Invariants:
 * - UGS/UGSHub stay behind lazy() so idle desktop does not sync-pull UGSDesktopContainer.
 * - No static imports of window app interiors from this module.
 *
 * Related:
 * - desktopWindowAppContent/renderDesktopWindowAppContent.tsx
 * - desktopWindowAppContent/mounts.tsx
 */

import { lazy } from 'react';

export const ClipboardManagerLazy = lazy(() => import('../ClipboardManager'));

export const UGSDesktopContainerLazy = lazy(() =>
	import('../UGSDesktopContainer').then((m) => ({
		default: m.UGSDesktopContainer,
	}))
);

export const ContentManagerPro = lazy(
	() => import('../../../ContentManager/ContentManagerPro')
);
export const StudioGUPageLazy = lazy(
	() => import('../../../StudioGU/StudioGUPage')
);
export const UltimateDocEditor = lazy(() =>
	import('../../../../components/UltimateDocEditor/UltimateDocEditor').then(
		(m) => ({ default: m.UltimateDocEditor })
	)
);
export const DocEditorV2Lazy = lazy(() =>
	import('../../../../features/documentEditorV2/DocEditorV2').then((m) => ({
		default: m.DocEditorV2,
	}))
);
export const GAFChatAppLazy = lazy(() =>
	import('../GAFChat/GAFChatApp').then((m) => ({ default: m.default }))
);
export const VideoCallAppLazy = lazy(() =>
	import('../VideoCall/VideoCallApp').then((m) => ({ default: m.default }))
);
export const DesktopAiChatAppLazy = lazy(() =>
	import('../../../../features/desktop-ai-chat/DesktopAiChatApp').then((m) => ({
		default: m.DesktopAiChatApp,
	}))
);
export const SocialHubAppLazy = lazy(
	() => import('../../../../features/friends/components/SocialHubApp')
);
export const EWRPGeneratorLazy = lazy(() =>
	import('../../../../components/EWRP/EWRPGenerator').then((m) => ({
		default: m.default,
	}))
);
export const AppStoreWindowContentLazy = lazy(() =>
	import('../AppStoreWindowContent').then((m) => ({
		default: m.AppStoreWindowContent,
	}))
);
export const DesktopShellSettingsWindowContentLazy = lazy(() =>
	import('../DesktopShellSettingsWindowContent').then((m) => ({
		default: m.DesktopShellSettingsWindowContent,
	}))
);
export const UnifiedAdminPageLazy = lazy(() =>
	import('../../../Admin/UnifiedAdminPage').then((m) => ({
		default: m.UnifiedAdminPage,
	}))
);
export const MarketingCabinetPageLazy = lazy(
	() => import('../../../MarketingCabinet/MarketingCabinetPage')
);
export const EwaAppLazy = lazy(() =>
	import('../../../../features/ewa/EwaDesktopApp').then((m) => ({
		default: m.EwaDesktopApp,
	}))
);
export const CustomerCabinetPageLazy = lazy(
	() => import('../../../CustomerCabinet/CustomerCabinetPage')
);
export const UserSiteStudioAppLazy = lazy(
	() => import('../../apps/UserSiteStudio')
);
export const SiteManagerOpsPanelLazy = lazy(
	() =>
		import(
			'../../../../features/site-studio/desktop/components/SiteManagerOpsPanel'
		)
);
export const LocalServiceIframeAppLazy = lazy(
	() => import('../../apps/LocalServiceIframeApp')
);
export const ProjectAboutAppLazy = lazy(
	() => import('../../apps/ProjectAboutApp')
);
export const EBrowserAppLazy = lazy(() => import('../../apps/EBrowserApp'));
export const KursorinaAppLazy = lazy(() => import('../../apps/KursorinaApp'));
export const CalendarAppLazy = lazy(() => import('../../apps/CalendarApp'));
export const EmperyNexusChronicleAppLazy = lazy(
	() => import('../../apps/EmperyNexusChronicleApp')
);
export const KirsPageLazy = lazy(() => import('../../../Kirs/KirsPage'));
export const KirsClientSitePageLazy = lazy(
	() => import('../../../Kirs/KirsClientSitePage')
);
export const MusicForgeAppLazy = lazy(() =>
	import('../../../MusicForge/MusicForgeApp').then((m) => ({
		default: m.MusicForgeApp,
	}))
);
export const PoemmaAppLazy = lazy(() =>
	import('../../../../features/poemma/PoemmaApp').then((m) => ({
		default: m.PoemmaApp,
	}))
);
export const ImageStudioPageLazy = lazy(() =>
	import('../../../ImageStudio/ImageStudioPage').then((m) => ({
		default: m.ImageStudioPage,
	}))
);
export const VideoStudioPageLazy = lazy(() =>
	import('../../../VideoStudio/VideoStudioPage').then((m) => ({
		default: m.VideoStudioPage,
	}))
);
export const MusicPlayerPageLazy = lazy(() =>
	import('../../../MusicPlayer/MusicPlayerPage').then((m) => ({
		default: m.MusicPlayerPage,
	}))
);
export const DesktopWidgetShelfAppLazy = lazy(() =>
	import('../DesktopWidgetShelfApp').then((m) => ({ default: m.default }))
);
export const DesktopDashboardFavoritesAppLazy = lazy(() =>
	import('../DesktopDashboardFavoritesApp').then((m) => ({
		default: m.default,
	}))
);
export const NotificationsDesktopAppLazy = lazy(() =>
	import('../NotificationsDesktopApp').then((m) => ({
		default: m.default,
	}))
);
export const EWDeskAppLazy = lazy(() => import('../EWDeskApp'));
export const FeedbackHubAppLazy = lazy(() => import('../FeedbackHubApp'));
export const SurveyHubAppLazy = lazy(
	() => import('../../apps/SurveyHub/SurveyHubApp')
);
export const AssistantAppLazy = lazy(() => import('../AssistantApp'));
export const ProfessionalWorldsAppLazy = lazy(
	() => import('../../apps/ProfessionalWorlds/ProfessionalWorldsApp')
);
