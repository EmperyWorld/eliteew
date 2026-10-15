/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Guard idle `#desktop` shell: heavy overlays must stay lazy / gated, not static imports.
 *
 * Related:
 * - DesktopWorkspaceShellLayout.tsx, DesktopWorkspaceContent.tsx
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const dir = dirname(fileURLToPath(import.meta.url));

describe('desktop shell cold lazy contract', () => {
	it('ShellLayout does not static-import framer LayoutGroup or heavy overlays', () => {
		const src = readFileSync(
			join(dir, '../DesktopWorkspaceShellLayout.tsx'),
			'utf8'
		);
		expect(src).not.toMatch(/from ['"]framer-motion['"]/);
		expect(src).toContain('LiveVoiceDesktopPipelineGate');
		expect(src).toContain("import('./DesktopWorkspaceSearchOverlays')");
		expect(src).toContain("import('./DesktopWorkspaceAppStoreLayer')");
		expect(src).toContain("import('./DesktopModalsLayer')");
		expect(src).toContain("import('./DesktopWorkspaceWindowContextMenu')");
		expect(src).toContain("import('./DesktopWorkspaceHelpAndSession')");
		expect(src).toContain('showAppStore');
		expect(src).toContain('searchOverlaysNeeded');
	});

	it('Content does not static-import Settings / Modals / NewFolder / framer', () => {
		const src = readFileSync(
			join(dir, '../../DesktopWorkspaceContent.tsx'),
			'utf8'
		);
		const headEarlySrc = readFileSync(
			join(dir, '../../hooks/useDesktopWorkspaceContentHeadEarlyCluster.ts'),
			'utf8'
		);
		expect(src).not.toMatch(/from ['"]framer-motion['"]/);
		expect(src).toContain("import('./components/DesktopSettingsPanel')");
		expect(src).toContain("import('./components/DesktopModalsLayer')");
		expect(src).toContain("import('./components/NewFolderDialog')");
		expect(src).toContain("import('./components/DesktopMaintenanceOverlay')");
		expect(src).toContain(
			"import('./components/DesktopWindowLayoutPresetApplyDialog')"
		);
		expect(headEarlySrc).toContain('useSystemPrefersReducedMotion');
	});

	it('Canvas lazy-loads widgets, floating widget, and context overlays', () => {
		const src = readFileSync(
			join(dir, '../DesktopWorkspaceCanvas.tsx'),
			'utf8'
		);
		expect(src).toContain("import('./DesktopWidgetsPanel')");
		expect(src).toContain("import('./DesktopWorkspaceFloatingWidget')");
		expect(src).toContain("import('./EnhancedContextMenu')");
		expect(src).toContain("import('./ItemPropertiesModal')");
		expect(src).toContain(
			"import type { DesktopWidgetsPanelProps } from './DesktopWidgetsPanel'"
		);
		expect(src).not.toMatch(/^import \{[^;\n]*DesktopWidgetsPanel/m);
	});

	it('Right toolbar lazy-loads GAF tray and notification details', () => {
		const src = readFileSync(join(dir, '../TaskbarRightToolbar.tsx'), 'utf8');
		expect(src).toContain("import('./TaskbarTrayGafCluster')");
		expect(src).toContain("import('./TaskbarNotificationCluster')");
		expect(src).toContain("import('./taskbarStrip/TaskbarVolumeControl')");
		expect(src).toContain('mountDeferredTray');
	});

	it('Taskbar lazy-loads StartMenu only when open', () => {
		const src = readFileSync(join(dir, '../Taskbar.tsx'), 'utf8');
		expect(src).toContain("import('./StartMenu')");
		expect(src).toContain('showStart ?');
	});

	it('head/tail keep friends, GAF unread, widgets, and recents feed off the static graph', () => {
		const headEarlySrc = readFileSync(
			join(dir, '../../hooks/useDesktopWorkspaceContentHeadEarlyCluster.ts'),
			'utf8'
		);
		const headLateSrc = readFileSync(
			join(dir, '../../hooks/useDesktopWorkspaceContentHeadLateCluster.ts'),
			'utf8'
		);
		const viewModelSrc = readFileSync(
			join(dir, '../../hooks/useDesktopWorkspaceContentViewModel.ts'),
			'utf8'
		);
		const assemblySrc = readFileSync(
			join(dir, '../../hooks/useDesktopWorkspaceShellLayoutInputAssembly.ts'),
			'utf8'
		);
		const tailSrc = readFileSync(
			join(dir, '../../hooks/useDesktopWorkspaceContentTailCluster.ts'),
			'utf8'
		);
		const contentSrc = readFileSync(
			join(dir, '../../DesktopWorkspaceContent.tsx'),
			'utf8'
		);
		const visualSrc = readFileSync(
			join(dir, '../../hooks/useDesktopWorkspaceVisualProfileBridge.ts'),
			'utf8'
		);
		const runtimeSrc = readFileSync(
			join(dir, '../../runtime/DesktopDeferredShellExtrasRuntime.tsx'),
			'utf8'
		);
		const expansionRuntimeSrc = readFileSync(
			join(dir, '../../runtime/DesktopDeferredExpansionRuntime.tsx'),
			'utf8'
		);
		const forbidden = [
			'useFriendsOverview',
			'useGAFUnreadCount',
			'useEwDeskUnreadCount',
			'useDesktopRecentContentFeed',
			'useDesktopWorkspaceWidgetsPanelProps',
			'useDesktopWorkspaceRecentFilesAndViewport',
		];
		for (const src of [
			headEarlySrc,
			headLateSrc,
			viewModelSrc,
			assemblySrc,
			tailSrc,
			visualSrc,
		]) {
			for (const symbol of forbidden) {
				expect(src).not.toMatch(new RegExp(symbol));
			}
			expect(src).not.toMatch(
				/import \{[^}]*useNotifications[^}]*\} from ['"]@\/notifications['"]/
			);
		}
		for (const src of [
			headEarlySrc,
			headLateSrc,
			viewModelSrc,
			assemblySrc,
			tailSrc,
		]) {
			expect(src).not.toMatch(/useDesktopWorkspaceShellBadgeCounts/);
			expect(src).not.toMatch(/useDesktopDeferredShellExtras/);
		}
		expect(contentSrc).toContain(
			"import('./runtime/DesktopDeferredWorkspaceRuntimes')"
		);
		expect(contentSrc).toContain('DesktopDeferredExpansionProvider');
		expect(contentSrc).toContain('DesktopDeferredShellExtrasProvider');
		expect(contentSrc).toContain('DesktopDeferredMount');
		expect(contentSrc).toContain('DesktopWorkspaceShellLayoutWithExtras');
		expect(expansionRuntimeSrc).toContain('useDesktopExpansionSettings');
		expect(runtimeSrc).toContain('useNotificationStore');
		expect(runtimeSrc).toContain('useDesktopRecentContentFeed');
		expect(runtimeSrc).toContain('useDesktopWorkspaceWidgetsPanelProps');
		expect(runtimeSrc).toContain('useDesktopWorkspaceShellBadgeCounts');
	});

	it('head/tail keep expansion settings off the static graph', () => {
		const headLateSrc = readFileSync(
			join(dir, '../../hooks/useDesktopWorkspaceContentHeadLateCluster.ts'),
			'utf8'
		);
		const tailSrc = readFileSync(
			join(dir, '../../hooks/useDesktopWorkspaceContentTailCluster.ts'),
			'utf8'
		);
		const viewModelSrc = readFileSync(
			join(dir, '../../hooks/useDesktopWorkspaceContentViewModel.ts'),
			'utf8'
		);
		for (const src of [headLateSrc, tailSrc, viewModelSrc]) {
			expect(src).not.toMatch(
				/import \{[^}]*useDesktopExpansionSettings[^}]*\} from/
			);
			expect(src).not.toMatch(/from ['"].*desktopExpansionSettings\//);
		}
		const workspaceRuntimesSrc = readFileSync(
			join(dir, '../../runtime/DesktopDeferredWorkspaceRuntimes.tsx'),
			'utf8'
		);
		expect(workspaceRuntimesSrc).toContain('DesktopDeferredExpansionRuntime');
		expect(workspaceRuntimesSrc).toContain('DesktopDeferredShellExtrasRuntime');
	});

	it('head/tail keep companion orchestration off the static graph', () => {
		const tailSrc = readFileSync(
			join(dir, '../../hooks/useDesktopWorkspaceContentTailCluster.ts'),
			'utf8'
		);
		const viewModelSrc = readFileSync(
			join(dir, '../../hooks/useDesktopWorkspaceContentViewModel.ts'),
			'utf8'
		);
		const contentSrc = readFileSync(
			join(dir, '../../DesktopWorkspaceContent.tsx'),
			'utf8'
		);
		for (const src of [tailSrc, viewModelSrc]) {
			expect(src).not.toMatch(
				/import \{[^}]*useDesktopWorkspaceContentOrchestration[^}]*\} from/
			);
		}
		const companionRuntimeSrc = readFileSync(
			join(dir, '../../runtime/DesktopDeferredCompanionRuntime.tsx'),
			'utf8'
		);
		expect(companionRuntimeSrc).toContain(
			'useDesktopWorkspaceContentOrchestration'
		);
		expect(contentSrc).toContain('DesktopDeferredCompanionProvider');
		const workspaceRuntimesSrc = readFileSync(
			join(dir, '../../runtime/DesktopDeferredWorkspaceRuntimes.tsx'),
			'utf8'
		);
		expect(workspaceRuntimesSrc).toContain('DesktopDeferredCompanionRuntime');
	});

	it('tail keeps voice command listeners off the static graph', () => {
		const tailSrc = readFileSync(
			join(dir, '../../hooks/useDesktopWorkspaceContentTailCluster.ts'),
			'utf8'
		);
		const voiceClusterSrc = readFileSync(
			join(dir, '../../hooks/useDesktopWorkspaceVoiceSettingsCenterCluster.ts'),
			'utf8'
		);
		expect(tailSrc).not.toMatch(
			/import \{[^}]*useDesktopVoiceCommands[^}]*\} from/
		);
		expect(voiceClusterSrc).not.toMatch(
			/import \{[^}]*useDesktopVoiceCommands[^}]*\} from/
		);
		const voiceRuntimeSrc = readFileSync(
			join(dir, '../../runtime/DesktopDeferredVoiceCommandsRuntime.tsx'),
			'utf8'
		);
		expect(voiceRuntimeSrc).toContain('useDesktopVoiceCommands');
		const workspaceRuntimesSrc = readFileSync(
			join(dir, '../../runtime/DesktopDeferredWorkspaceRuntimes.tsx'),
			'utf8'
		);
		expect(workspaceRuntimesSrc).toContain('DesktopDeferredVoiceCommandsRuntime');
	});

	it('TaskbarClock lazy-loads mini month grid in the flyout', () => {
		const src = readFileSync(join(dir, '../TaskbarClock.tsx'), 'utf8');
		expect(src).toContain(
			"import('@/pages/Desktop/apps/calendarApp/CalendarMiniMonthGrid')"
		);
		expect(src).not.toMatch(
			/from ['"]@\/pages\/Desktop\/apps\/calendarApp\/CalendarMiniMonthGrid['"]/
		);
	});
});
