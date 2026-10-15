/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Source contract for Start Menu keyboard surface and search-to-grid navigation.
 *
 * Related:
 * - src/pages/Desktop/components/StartMenuLegacy.tsx
 * - src/pages/Desktop/components/StartMenu.tsx
 * - src/pages/Desktop/components/startMenu/useStartMenuKeyboard.ts
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('StartMenu keyboard contract', () => {
	const dir = dirname(fileURLToPath(import.meta.url));
	const startMenuSource = () =>
		readFileSync(join(dir, '../StartMenuLegacy.tsx'), 'utf8');
	const orchestratorSource = () =>
		readFileSync(join(dir, '../StartMenu.tsx'), 'utf8');
	const keyboardSource = () =>
		readFileSync(join(dir, '../startMenu/useStartMenuKeyboard.ts'), 'utf8');
	const disclosureSource = () =>
		readFileSync(join(dir, '../startMenu/useStartMenuDisclosure.ts'), 'utf8');

	it('orchestrator switches modes without owning legacy keyboard surface', () => {
		const orch = orchestratorSource();
		expect(orch).toContain('StartMenuLegacy');
		expect(orch).toContain('StartMenuCommandConsole');
		expect(orch).toContain('StartMenuWorkspace');
		expect(orch).toContain('normalizeDesktopMenuMode');
		expect(orch).toContain('desktop_menu_mode');
	});

	it('marks shell keyboard surface and supports ArrowDown from search', () => {
		const startSrc = startMenuSource();
		const keySrc = keyboardSource();
		expect(startSrc).toContain('data-desktop-shell-keyboard-surface');
		expect(startSrc).toContain('useStartMenuKeyboard');
		expect(keySrc).toContain('posInApps < 0');
		expect(keySrc).toContain("e.key === 'ArrowDown' || e.key === 'Home'");
	});

	it('closes app context menu on Escape before dismissing Start Menu', () => {
		const startSrc = startMenuSource();
		const keySrc = keyboardSource();
		expect(keySrc).toContain("if (e.key === 'Escape')");
		expect(keySrc).toContain('if (appCtx)');
		expect(keySrc).toContain('setAppCtx(null)');
		expect(startSrc).toContain('escapeCapture: true');
		expect(startSrc).toContain('focusFirstMenuItem: true');
	});

	it('clears search on Escape before closing Start Menu', () => {
		const keySrc = keyboardSource();
		expect(keySrc).toContain('unwindStartMenuEscapeLayer');
		expect(keySrc).toContain('consumeEscapeForSearchClear');
		expect(keySrc).toContain("clearSearch: () => setSearch('')");
	});

	it('collapses shortcuts panel on Escape before closing Start Menu', () => {
		const keySrc = keyboardSource();
		expect(keySrc).toContain('if (state.showShortcuts)');
		expect(keySrc).toContain('actions.setShowShortcuts(false)');
		expect(keySrc).toContain('e.stopPropagation()');
	});

	it('unwinds progressive disclosure before shortcuts and menu close', () => {
		const keySrc = keyboardSource();
		const workAdvanced = keySrc.indexOf('if (state.showWorkAdvanced)');
		const libraryDiscovery = keySrc.indexOf('if (state.showLibraryDiscovery)');
		const moreTabs = keySrc.indexOf('if (state.showMoreTabs)');
		const shortcuts = keySrc.indexOf('if (state.showShortcuts)');
		expect(workAdvanced).toBeGreaterThan(0);
		expect(libraryDiscovery).toBeGreaterThan(workAdvanced);
		expect(moreTabs).toBeGreaterThan(libraryDiscovery);
		expect(shortcuts).toBeGreaterThan(moreTabs);
		expect(keySrc).toContain('actions.setShowWorkAdvanced(false)');
		expect(keySrc).toContain('actions.setShowLibraryDiscovery(false)');
		expect(keySrc).toContain('actions.setShowMoreTabs(false)');
	});

	it('resets progressive disclosure when the menu closes', () => {
		const src = disclosureSource();
		expect(src).toContain('if (isOpen) return;');
		expect(src).toContain('setShowMoreTabs(false)');
		expect(src).toContain('setShowLibraryDiscovery(false)');
		expect(src).toContain('setShowWorkAdvanced(false)');
	});

	it('keeps only primary tabs visible; secondary live in More menu', () => {
		const src = readFileSync(
			join(dir, '../startMenu/StartMenuTabStrip.tsx'),
			'utf8'
		);
		expect(src).toContain("id: 'home'");
		expect(src).toContain("id: 'all'");
		expect(src).toContain("id: 'recent'");
		expect(src).toContain("id: 'pinned'");
		expect(src).toContain('aria-haspopup="menu"');
		expect(src).toContain('aria-expanded={moreMenuOpen}');
		expect(src).toContain('start-menu-more-tabs-menu');
		expect(src).toContain('SECONDARY_TABS.map');
		expect(src).not.toContain('secondaryTabButtons.map');
		expect(src).not.toContain("id: 'categories'");
	});

	it('imports structural Start Menu tab modules', () => {
		const src = startMenuSource();
		expect(src).toContain("from './startMenu/StartMenuWorkExpansion'");
		expect(src).toContain("from './startMenu/StartMenuRecentDiscovery'");
		expect(src).toContain("from './startMenu/StartMenuHomeSurface'");
		expect(src).toContain("from './startMenu/StartMenuAppGrid'");
		expect(src).toContain("from './startMenu/StartMenuSearchHeader'");
		expect(src).toContain("from './startMenu/StartMenuAppContextMenu'");
		expect(src).toContain("from './startMenu/StartMenuFooterChrome'");
		expect(src).toContain("from './startMenu/useStartMenuAppCatalog'");
		expect(src).toContain("from './startMenu/useStartMenuKeyboard'");
		expect(src).toContain('<StartMenuWorkExpansion');
		expect(src).toContain('<StartMenuHomeSurface');
		expect(src).toContain('<StartMenuRecentDiscovery');
		expect(src).toContain('<StartMenuAppGrid');
		expect(src).toContain('<StartMenuSearchHeader');
		expect(src).toContain('<StartMenuAppContextMenu');
		expect(src).toContain('<StartMenuFooterChrome');
		expect(src).toContain("useState<StartMenuTab>('home')");
		expect(src).toContain("resolvedTab === 'all'");
	});

	it('uses useShellCaptureEscape while Start Menu is open', () => {
		const src = startMenuSource();
		expect(src).toContain('useShellCaptureEscape');
		expect(src).toContain('isOpen && !appCtx');
		expect(src).toContain('onLayer: captureEscapeOnLayer');
	});

	it('selects intent tab without opening More menu; expands work advanced / recent library', () => {
		const src = disclosureSource();
		expect(src).toContain("tab === 'work'");
		expect(src).toContain('setShowMoreTabs(false)');
		expect(src).toContain('setShowWorkAdvanced(true)');
		expect(src).toContain("tab === 'recent'");
		// Wave 1 progressive: Recent intent selects tab only — library stays collapsed.
		expect(src).not.toContain('setShowLibraryDiscovery(true)');
		expect(src).toContain('resolveStartMenuTab');
		expect(src).toContain('setActiveTab(tab)');
		expect(src.indexOf('setShowWorkAdvanced(true)')).toBeLessThan(
			src.indexOf('setActiveTab(tab)')
		);
	});

	it('Wave 4: All apps stays primary; budget constants stay imported in metrics', () => {
		const strip = readFileSync(
			join(dir, '../startMenu/StartMenuTabStrip.tsx'),
			'utf8'
		);
		expect(strip).toContain('start-menu-tab-');
		expect(strip).toMatch(/PRIMARY_TABS[\s\S]*id:\s*'all'/);
		const metrics = readFileSync(
			join(dir, '../../utils/desktopShellUxMetrics.ts'),
			'utf8'
		);
		expect(metrics).toContain('START_ALL_APPS_MAX_TABS_TO_PRIMARY = 6');
		expect(metrics).toContain('SETTINGS_TABS_MAX_TABS_TO_PRIMARY = 3');
	});
});
