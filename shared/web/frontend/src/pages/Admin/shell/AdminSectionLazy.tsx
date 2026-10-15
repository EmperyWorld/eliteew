/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Stable lazy() factories for Unified Admin section bodies (module-scope to avoid Suspense remount loops).
 *
 * Invariants:
 * - Each factory is created once at module load; never recreate inside render.
 *
 * Related:
 * - `pages/Admin/UnifiedAdminPage.tsx`
 */

import { lazy } from 'react';

export const LazyAdminUsersHubSection = lazy(() =>
	import('../AdminUsersHubSection').then((m) => ({
		default: m.AdminUsersHubSection,
	}))
);

export const LazyDesktopAppStoreAdminPage = lazy(() =>
	import('../../Desktop/DesktopAppStoreAdminPage').then((m) => ({
		default: m.DesktopAppStoreAdminPage,
	}))
);

export const LazyProfessionalWorldsAdminSection = lazy(() =>
	import(
		'../../../features/professional-worlds/admin/ProfessionalWorldsAdminSection'
	).then((m) => ({
		default: m.ProfessionalWorldsAdminSection,
	}))
);

export const LazyUGSAdminV2Panel = lazy(() =>
	import('../../../features/ugs/admin-v2/UGSAdminV2Panel').then((m) => ({
		default: m.default,
	}))
);

export const LazyFeedbackAdminSection = lazy(() =>
	import('../FeedbackAdminSection').then((m) => ({
		default: m.FeedbackAdminSection,
	}))
);

export const LazySocialReportsAdminSection = lazy(() =>
	import('../SocialReportsAdminSection').then((m) => ({
		default: m.SocialReportsAdminSection,
	}))
);

export const LazySurveysAdminSection = lazy(() =>
	import('../SurveysAdminSection').then((m) => ({
		default: m.SurveysAdminSection,
	}))
);

export const LazyAssistantAdminSection = lazy(() =>
	import('../AssistantAdminSection').then((m) => ({
		default: m.AssistantAdminSection,
	}))
);

export const LazyEwDeskAdminSection = lazy(() =>
	import('../EwDeskAdminSection').then((m) => ({
		default: m.EwDeskAdminSection,
	}))
);

export const LazyEwaCompanionAdminPanel = lazy(() =>
	import('../../../features/ewa/admin/EwaCompanionAdminPanel').then((m) => ({
		default: m.EwaCompanionAdminPanel,
	}))
);

export const LazySiteManagerOpsPanel = lazy(() =>
	import(
		'../../../features/site-studio/desktop/components/SiteManagerOpsPanel'
	).then((m) => ({
		default: m.SiteManagerOpsPanel,
	}))
);

export const LazySystemGafInstructionSection = lazy(() =>
	import('../SystemGafInstructionSection').then((m) => ({
		default: m.SystemGafInstructionSection,
	}))
);

export const LazyI18nRewriteAdminSection = lazy(() =>
	import('../I18nRewriteAdminSection').then((m) => ({
		default: m.I18nRewriteAdminSection,
	}))
);

export const LazySearchAdminSection = lazy(() =>
	import('../search/SearchAdminSection').then((m) => ({
		default: m.SearchAdminSection,
	}))
);

export const LazyMusicForgeAdminSection = lazy(() =>
	import('../musicForge/MusicForgeAdminSection').then((m) => ({
		default: m.MusicForgeAdminSection,
	}))
);

export const LazyContentAdminSection = lazy(() =>
	import('../content/ContentAdminSection').then((m) => ({
		default: m.ContentAdminSection,
	}))
);

export const LazyKbsewAdminSection = lazy(() =>
	import('../kbsew/KbsewAdminSection').then((m) => ({
		default: m.KbsewAdminSection,
	}))
);

export const LazyDesktopAiChatAdminSection = lazy(() =>
	import('../desktopAiChat/DesktopAiChatAdminSection').then((m) => ({
		default: m.DesktopAiChatAdminSection,
	}))
);

export const LazyWorkersAdminSection = lazy(() =>
	import('../workers/WorkersAdminSection').then((m) => ({
		default: m.WorkersAdminSection,
	}))
);

export const LazyPlatformOpsAdminSection = lazy(() =>
	import('../platformOps/PlatformOpsAdminSection').then((m) => ({
		default: m.PlatformOpsAdminSection,
	}))
);

export const LazyTopologyAdminSection = lazy(() =>
	import('../topology/TopologyAdminSection').then((m) => ({
		default: m.TopologyAdminSection,
	}))
);

export const LazyFactoryAdminSection = lazy(() =>
	import('../factory/FactoryAdminPanel').then((m) => ({
		default: m.FactoryAdminPanel,
	}))
);

export const LazyDocEditorPluginsAdminSection = lazy(() =>
	import('../docEditor/DocEditorPluginsAdminSection').then((m) => ({
		default: m.DocEditorPluginsAdminSection,
	}))
);
