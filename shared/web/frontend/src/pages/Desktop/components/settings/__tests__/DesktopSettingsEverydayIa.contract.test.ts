/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Everyday IA contract locks — Look SoT navigate, Fine-tune budget, Behavior
 * disclosure, Comfort metrics not primary.
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-SETTINGS-EVERYDAY-IA.md
 * - documentation/reference/solution-readiness/2026-09-06-desktop-settings-everyday-ia-redesign.md
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
	isVisualStudioLookSoTHotspot,
	VISUAL_STUDIO_LOOK_SOT_HOTSPOTS,
	visualStudioHotspotNavigateTarget,
} from '../desktopVisualStudioPreviewHotspots';

const dir = dirname(fileURLToPath(import.meta.url));

describe('Desktop Settings Everyday IA', () => {
	it('Look SoT hotspots map to Chrome/Widgets field ids', () => {
		expect(VISUAL_STUDIO_LOOK_SOT_HOTSPOTS).toEqual([
			'window',
			'taskbar',
			'widget',
		]);
		expect(isVisualStudioLookSoTHotspot('window')).toBe(true);
		expect(isVisualStudioLookSoTHotspot('scene')).toBe(false);
		expect(visualStudioHotspotNavigateTarget('window').tab).toBe('chrome');
		expect(visualStudioHotspotNavigateTarget('taskbar').tab).toBe('chrome');
		expect(visualStudioHotspotNavigateTarget('widget').tab).toBe('widgets');
	});

	it('preview interactive opens hotspots in-place (does not navigate Look SoT on click)', () => {
		const interactive = readFileSync(
			join(
				dir,
				'../desktopVisualStudioPreviewInteractive/DesktopVisualStudioPreviewInteractive.tsx'
			),
			'utf8'
		);
		const popover = readFileSync(
			join(
				dir,
				'../desktopVisualStudioPreviewInteractive/hotspotPopoverContent.tsx'
			),
			'utf8'
		);
		expect(interactive).toContain('onNavigateSettingsField');
		expect(interactive).toContain(
			'onClick={(event) => onHotspotClick(id, event.currentTarget)}'
		);
		expect(interactive).not.toMatch(
			/if \(isVisualStudioLookSoTHotspot\(id\) && onNavigateSettingsField\)/
		);
		expect(interactive).toContain('onDesktopWindowStyleChange');
		expect(popover).toContain('renderStyleSegmentGrid');
		expect(popover).toContain('onDesktopWindowStyleChange');
		expect(popover).toContain('onDesktopTaskbarStyleChange');
		expect(popover).toContain('onDesktopWidgetsStyleChange');
		expect(popover).not.toContain('hotspotLookSoTHint');
	});

	it('Fine-tune nests motion advanced behind disclosure; reduce-motion stays everyday', () => {
		const section = readFileSync(
			join(dir, '../DesktopSettingsVisualStudioSection.tsx'),
			'utf8'
		);
		const reduceIdx = section.indexOf('shellReduceMotionLabel');
		const advancedIdx = section.indexOf(
			'data-testid="desktop-settings-finetune-motion-advanced"'
		);
		const speedIdx = section.indexOf('shellMotionSpeedHeading');
		const morphIdx = section.indexOf('windowMorphLabel');
		expect(reduceIdx).toBeGreaterThan(-1);
		expect(advancedIdx).toBeGreaterThan(reduceIdx);
		expect(speedIdx).toBeGreaterThan(advancedIdx);
		expect(morphIdx).toBeGreaterThan(advancedIdx);
	});

	it('Personalize has no DESKTOP_TASKBAR_STYLE_KEYS style grid of its own', () => {
		const personalize = readFileSync(
			join(dir, '../DesktopSettingsPersonalizeTab.tsx'),
			'utf8'
		);
		expect(personalize).not.toContain('DESKTOP_TASKBAR_STYLE_KEYS');
		expect(personalize).toContain('desktop-settings-personalize-fine-tune');
	});

	it('Chrome remains the window/taskbar style SoT', () => {
		const chrome = readFileSync(
			join(dir, '../DesktopSettingsChromeTab.tsx'),
			'utf8'
		);
		expect(chrome).toContain('DESKTOP_TASKBAR_STYLE_KEYS');
		expect(chrome).toContain('desktop-settings-chrome-window-looks');
		expect(chrome).toContain('desktop-settings-chrome-taskbar-looks');
	});

	it('Behavior demotes apps/menu/sync behind more-options disclosure', () => {
		const cluster = readFileSync(
			join(dir, '../expansion/DesktopSettingsExpansionShellCluster.tsx'),
			'utf8'
		);
		const vdIdx = cluster.indexOf(
			'DesktopSettingsExpansionShellVirtualDesktopsCard'
		);
		const moreIdx = cluster.indexOf(
			'data-testid="desktop-settings-shell-more-options"'
		);
		const appsJsxIdx = cluster.indexOf(
			'<DesktopSettingsExpansionShellAppsCard',
			moreIdx
		);
		expect(vdIdx).toBeGreaterThan(-1);
		expect(moreIdx).toBeGreaterThan(vdIdx);
		expect(appsJsxIdx).toBeGreaterThan(moreIdx);
	});

	it('Comfort keeps Long tasks / FPS labels inside session-status disclosure', () => {
		const perf = readFileSync(
			join(dir, '../DesktopSettingsPerformanceTab.tsx'),
			'utf8'
		);
		const sessionIdx = perf.indexOf(
			'data-testid="desktop-settings-comfort-session-status"'
		);
		const longTaskIdx = perf.indexOf("perfStatLongTask'");
		const fpsLabelIdx = perf.indexOf("perfStatFps'");
		expect(sessionIdx).toBeGreaterThan(-1);
		expect(longTaskIdx).toBeGreaterThan(sessionIdx);
		expect(fpsLabelIdx).toBeGreaterThan(sessionIdx);
	});

	it('Fine-tune uses one Fonts Body|Display chooser (not two peer full grids)', () => {
		const section = readFileSync(
			join(dir, '../DesktopSettingsVisualStudioSection.tsx'),
			'utf8'
		);
		expect(section).toContain(
			'data-testid="desktop-settings-finetune-fonts-chooser"'
		);
		expect(section).toContain('data-finetune-font-pane-trigger="body"');
		expect(section).toContain('data-finetune-font-pane-trigger="display"');
		expect(section).toContain('data-finetune-font-pane="body"');
		expect(section).toContain('data-finetune-font-pane="display"');
		expect(section).toContain("hidden={fontPane !== 'body'}");
		expect(section).toContain("hidden={fontPane !== 'display'}");
	});

	it('Comfort nests soft-blur experiment inside session-status (not sibling)', () => {
		const perf = readFileSync(
			join(dir, '../DesktopSettingsPerformanceTab.tsx'),
			'utf8'
		);
		const sessionIdx = perf.indexOf(
			'data-testid="desktop-settings-comfort-session-status"'
		);
		const experimentalIdx = perf.indexOf(
			'data-testid="desktop-settings-comfort-experimental-effects"'
		);
		expect(sessionIdx).toBeGreaterThan(-1);
		expect(experimentalIdx).toBeGreaterThan(sessionIdx);
		const between = perf.slice(sessionIdx, experimentalIdx);
		expect(between.includes('</details>')).toBe(false);
	});

	it('Personalize mounts RU|EN language strip in sticky stack under compact preview', () => {
		const personalize = readFileSync(
			join(dir, '../DesktopSettingsPersonalizeTab.tsx'),
			'utf8'
		);
		expect(personalize).toContain('DesktopSettingsPersonalizeLanguageCard');
		const stickyIdx = personalize.indexOf('sticky top-0');
		const languageIdx = personalize.indexOf(
			'<DesktopSettingsPersonalizeLanguageCard'
		);
		const tryOnIdx = personalize.indexOf(
			'data-testid="desktop-settings-try-on-sticky-banner"'
		);
		const curatedIdx = personalize.indexOf('desktop-settings-curated-presets');
		expect(stickyIdx).toBeGreaterThan(-1);
		expect(languageIdx).toBeGreaterThan(stickyIdx);
		expect(tryOnIdx).toBeGreaterThan(languageIdx);
		expect(curatedIdx).toBeGreaterThan(tryOnIdx);
		expect(personalize).not.toContain('top-[min(42vh,320px)]');
		expect(personalize).toContain('desktop-settings-look-group');
		expect(personalize).toContain('cardLookGroupTitle');
		const languageCard = readFileSync(
			join(dir, '../personalize/DesktopSettingsPersonalizeLanguageCard.tsx'),
			'utf8'
		);
		expect(languageCard).toContain(
			'data-testid="desktop-settings-personalize-language"'
		);
		expect(languageCard).toContain(
			'data-testid="desktop-settings-personalize-language-strip"'
		);
		expect(languageCard).not.toContain('SettingsFormCard');
		expect(languageCard).toContain(
			"buildDesktopSettingsFieldElementId('profile_ui', 'language')"
		);
		expect(languageCard).toContain('applyDesktopUiLanguage');
		expect(languageCard).toContain('useOptionalAuth');
		expect(languageCard).not.toContain('useAuth()');
		const wallpaperCard = readFileSync(
			join(dir, '../personalize/DesktopSettingsPersonalizeWallpaperCard.tsx'),
			'utf8'
		);
		expect(wallpaperCard).toContain('desktop-settings-wallpaper-thumb');
		expect(wallpaperCard).toContain('h-16 w-28');
		expect(wallpaperCard).not.toMatch(/aspect-video/);
		expect(wallpaperCard).not.toContain('min-h-[140px]');
		const vsSection = readFileSync(
			join(dir, '../DesktopSettingsVisualStudioSection.tsx'),
			'utf8'
		);
		expect(vsSection).toContain('stageDensity="compact"');
		const preview = readFileSync(
			join(dir, '../DesktopVisualStudioPreview.tsx'),
			'utf8'
		);
		expect(preview).not.toContain('previewMotionKey');
		expect(preview).toContain('Math.round(2400 * desktopShellMotionSpeedScale');
		const picker = readFileSync(join(dir, '../../WallpaperPicker.tsx'), 'utf8');
		expect(picker).toContain('size="lg"');
		expect(picker).toContain('grid-cols-5');
		expect(picker).toContain("id: 'pending-upload'");
		expect(picker).not.toContain('size="xl"');
	});

	it('Visual Studio exposes motion stage hotspot alongside scene', () => {
		const preview = readFileSync(
			join(dir, '../DesktopVisualStudioPreview.tsx'),
			'utf8'
		);
		expect(preview).toContain('hotspotId="motion"');
		expect(preview).toContain('hotspotMotionChip');
		expect(preview).toContain(
			'handlers.onHotspotClick(hotspotId, event.currentTarget)'
		);
	});

	it('Visual Studio morph chip anchors window→taskbar (not nested under Look SoT)', () => {
		const preview = readFileSync(
			join(dir, '../DesktopVisualStudioPreview.tsx'),
			'utf8'
		);
		expect(preview).toContain('absolute right-3 bottom-3 z-20 size-8');
		expect(preview).toContain(
			'absolute bottom-2 left-1/2 z-30 size-8 -translate-x-1/2'
		);
		expect(preview).not.toMatch(
			/hotspotId="window"[\s\S]*hotspotId="morph"[\s\S]*<\/PreviewHotspotRegion>\s*<\/PreviewHotspotRegion>/
		);
		const windowBlockStart = preview.indexOf('hotspotId="window"');
		const morphExpanded = preview.indexOf(
			'absolute right-3 bottom-3 z-20 size-8'
		);
		const taskbarBlock = preview.indexOf('hotspotId="taskbar"');
		const morphMinimized = preview.indexOf(
			'absolute bottom-2 left-1/2 z-30 size-8 -translate-x-1/2'
		);
		expect(windowBlockStart).toBeGreaterThan(-1);
		expect(morphExpanded).toBeGreaterThan(windowBlockStart);
		expect(taskbarBlock).toBeGreaterThan(morphExpanded);
		expect(morphMinimized).toBeGreaterThan(taskbarBlock);
	});

	it('Personalize primary source has no support jargon keys', () => {
		const personalize = readFileSync(
			join(dir, '../DesktopSettingsPersonalizeTab.tsx'),
			'utf8'
		);
		for (const key of [
			'perfStatFps',
			'perfStatLongTask',
			'perfStatActiveAdapters',
			'shell_state',
			'Telemetry',
		] as const) {
			expect(personalize).not.toContain(key);
		}
	});
});
