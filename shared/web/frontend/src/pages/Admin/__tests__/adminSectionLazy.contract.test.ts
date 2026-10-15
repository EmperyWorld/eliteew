/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract lock: every nav section except inline `system` has a module-scope lazy factory.
 *
 * Related:
 * - `pages/Admin/shell/AdminSectionLazy.tsx`
 * - `pages/Admin/shell/adminShellConfig.ts`
 */

import { describe, expect, it } from 'vitest';
import { ADMIN_SHELL_SECTIONS } from '../shell/adminShellConfig';
import {
	LazyAdminUsersHubSection,
	LazyAssistantAdminSection,
	LazyContentAdminSection,
	LazyDesktopAiChatAdminSection,
	LazyDesktopAppStoreAdminPage,
	LazyEwaCompanionAdminPanel,
	LazyEwDeskAdminSection,
	LazyFeedbackAdminSection,
	LazyI18nRewriteAdminSection,
	LazyKbsewAdminSection,
	LazyMusicForgeAdminSection,
	LazyProfessionalWorldsAdminSection,
	LazySearchAdminSection,
	LazySiteManagerOpsPanel,
	LazySocialReportsAdminSection,
	LazySurveysAdminSection,
	LazySystemGafInstructionSection,
	LazyUGSAdminV2Panel,
	LazyPlatformOpsAdminSection,
	LazyTopologyAdminSection,
	LazyFactoryAdminSection,
	LazyDocEditorPluginsAdminSection,
	LazyWorkersAdminSection,
} from '../shell/AdminSectionLazy';

const LAZY_BY_SECTION: Record<string, unknown> = {
	users: LazyAdminUsersHubSection,
	desktop: LazyDesktopAppStoreAdminPage,
	professionalWorlds: LazyProfessionalWorldsAdminSection,
	ugsV2: LazyUGSAdminV2Panel,
	feedback: LazyFeedbackAdminSection,
	socialReports: LazySocialReportsAdminSection,
	surveys: LazySurveysAdminSection,
	assistant: LazyAssistantAdminSection,
	ewdesk: LazyEwDeskAdminSection,
	ewaCompanion: LazyEwaCompanionAdminPanel,
	siteStudio: LazySiteManagerOpsPanel,
	docEditor: LazyDocEditorPluginsAdminSection,
	gaf: LazySystemGafInstructionSection,
	i18nRewrite: LazyI18nRewriteAdminSection,
	search: LazySearchAdminSection,
	musicForge: LazyMusicForgeAdminSection,
	content: LazyContentAdminSection,
	kbsew: LazyKbsewAdminSection,
	desktopAiChat: LazyDesktopAiChatAdminSection,
	workers: LazyWorkersAdminSection,
	platformOps: LazyPlatformOpsAdminSection,
	topology: LazyTopologyAdminSection,
	factory: LazyFactoryAdminSection,
};

describe('AdminSectionLazy contract', () => {
	it('covers every shell section except inline system', () => {
		for (const section of ADMIN_SHELL_SECTIONS) {
			if (section.id === 'system') continue;
			expect(
				LAZY_BY_SECTION[section.id],
				`missing lazy factory for ${section.id}`
			).toBeTypeOf('object');
		}
	});

	it('does not register a lazy factory for retired legacy ugs', () => {
		expect(LAZY_BY_SECTION.ugs).toBeUndefined();
	});
});
