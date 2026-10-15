/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Secondary overflow hosts Live Voice + quiet chips + tour/shortcuts; attention chips on rail.
 *
 * Related:
 * - ../TaskbarSecondaryOverflow.tsx
 * - ../TaskbarRightToolbar.tsx
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('TaskbarSecondaryOverflow contract', () => {
	it('wires overflow with Live Voice, quiet chips, session menu, and guide anchors', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const overflowSrc = readFileSync(
			join(dir, '../TaskbarSecondaryOverflow.tsx'),
			'utf8'
		);
		const toolbarSrc = readFileSync(
			join(dir, '../TaskbarRightToolbar.tsx'),
			'utf8'
		);

		expect(overflowSrc).toContain('aria-haspopup="menu"');
		expect(overflowSrc).toContain('aria-expanded={menuOpen}');
		expect(overflowSrc).toContain('TaskbarIconContextMenu');
		expect(overflowSrc).toContain('role="menuitem"');
		expect(overflowSrc).toContain('data-live-voice-taskbar="true"');
		expect(overflowSrc).toContain('includeSessionInMenu');
		expect(overflowSrc).toContain('includeClipboardInMenu');
		expect(overflowSrc).toContain('includeTrayInMenu');
		expect(overflowSrc).toContain('includeNotificationsInMenu');
		expect(overflowSrc).toContain('data-taskbar-clipboard-overflow="true"');
		expect(overflowSrc).toContain('data-taskbar-tray-overflow="true"');
		expect(overflowSrc).toContain('data-taskbar-notifications-overflow="true"');
		expect(overflowSrc).toContain(
			'data-desktop-welcome-guide="taskbar-tour-launch"'
		);
		expect(overflowSrc).toContain('welcomeOnboarding.guide.menuLabel');
		expect(overflowSrc).not.toContain('titleBarChrome.guideTour');
		expect(overflowSrc).toContain('data-desktop-welcome-guide="shortcuts"');

		expect(toolbarSrc).toContain('TaskbarSecondaryOverflow');
		expect(toolbarSrc).toContain('onToggleLiveVoice={toggleLiveVoice}');
		expect(toolbarSrc).toContain(
			'includeSessionInMenu={!sessionNeedsAttention}'
		);
		expect(toolbarSrc).toContain(
			'includeClipboardInMenu={!clipboardNeedsAttention}'
		);
		expect(toolbarSrc).toContain(
			'includeTrayInMenu={mountDeferredTray && !trayNeedsAttention}'
		);
		expect(toolbarSrc).toContain('includeNotificationsInMenu={');
		expect(toolbarSrc).toContain(
			'mountDeferredTray && !notificationsNeedsAttention'
		);
		expect(toolbarSrc).toContain('sessionNeedsAttention ? (');
		expect(toolbarSrc).toContain('clipboardNeedsAttention ? (');
		expect(toolbarSrc).toContain('showTrayChipOnRail={trayNeedsAttention}');
		expect(toolbarSrc).toContain(
			'showBellOnRail={notificationsNeedsAttention}'
		);
		expect(toolbarSrc).not.toContain(
			'compact && Boolean(onOpenDesktopWelcomeTour || onShowShortcuts)'
		);
		expect(toolbarSrc).not.toContain('data-live-voice-taskbar="true"');
	});
});
