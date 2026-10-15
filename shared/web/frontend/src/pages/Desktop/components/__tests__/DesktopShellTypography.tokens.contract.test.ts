/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock P2 shell-chrome typography: key chrome modules use DESKTOP_TYPOGRAPHY
 * instead of raw text-[9–11px] literals (shell chrome + settings Visual Studio).
 *
 * Invariants:
 * - Listed shell paths must not contain text-[9px]|text-[10px]|text-[11px].
 *
 * Related:
 * - documentation/product/desktop/DESKTOP_DESIGN_SYSTEM.md
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const RAW_PX = /text-\[(9|10|11)px\]/;

const SHELL_PATHS = [
	'../RuntimeDisabledActionsHintCard.tsx',
	'../desktopWidgetsPanel/FreeWidgetsPanelLayout.tsx',
	'../desktopWidgetsPanel/StackedWidgetsPanelLayout.tsx',
	'../desktopWidgetsPanel/WidgetSlotBody.tsx',
	'../desktopWidgetsPanel/PanelNowPlaying.tsx',
	'../DesktopAssistantSelectionRail.tsx',
	'../desktopExplorerRailUi.tsx',
	'../startMenu/StartMenuAppGrid.tsx',
	'../../utils/assistantUserShellUi.ts',
	'../../apps/LocalServiceIframeApp.tsx',
	'../ProductAssistantMarkdown.tsx',
	'../AdminCatalogAppIcon.tsx',
] as const;

const SETTINGS_VISUAL_STUDIO_PATHS = [
	'../settings/DesktopSettingsPerformanceTab.tsx',
	'../settings/desktopVisualStudioPreviewHotspots.ts',
	'../settings/desktopSettingsPreviewComponents.tsx',
	'../settings/expansion/DesktopSettingsExpansionStorageCard.tsx',
	'../settings/DesktopVisualStudioPreview.tsx',
	'../settings/personalize/DesktopSettingsPersonalizePresetsFacade.tsx',
	'../settings/expansion/DesktopSettingsExpansionShellSyncDataCard.tsx',
	'../settings/desktopVisualStudioPreviewInteractive/DesktopVisualStudioPreviewInteractive.tsx',
] as const;

const TYPOGRAPHY_LOCKED_PATHS = [
	...SHELL_PATHS,
	...SETTINGS_VISUAL_STUDIO_PATHS,
] as const;

function readRel(relativePath: string): string {
	const dir = dirname(fileURLToPath(import.meta.url));
	return readFileSync(join(dir, relativePath), 'utf8');
}

describe('Desktop shell typography token contract (P2)', () => {
	it.each(TYPOGRAPHY_LOCKED_PATHS)('%s has no raw text-[9–11px]', (rel) => {
		const src = readRel(rel);
		expect(src).toContain('DESKTOP_TYPOGRAPHY');
		expect(src).not.toMatch(RAW_PX);
	});
});
