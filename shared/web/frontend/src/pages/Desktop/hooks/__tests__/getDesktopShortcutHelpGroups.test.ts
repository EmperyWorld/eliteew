import { describe, expect, it, vi } from 'vitest';
import type { TFunction } from 'i18next';
import {
	formatShortcutKeysForPlatform,
	getDesktopShortcutHelpGroups,
} from '../useKeyboardShortcuts';

describe('getDesktopShortcutHelpGroups', () => {
	it('builds three groups with keys and descriptions from i18n', () => {
		const t = vi.fn(
			(key: string) => `t:${key}`
		) as unknown as TFunction<'desktopUi'>;
		const groups = getDesktopShortcutHelpGroups(t);
		expect(groups).toHaveLength(3);
		expect(groups[0].items.length).toBe(14);
		expect(groups[1].items.length).toBe(7);
		expect(groups[2].items.length).toBe(4);
		expect(groups[0].items[0]).toEqual({
			id: 'shortcuts.shell.commandPalette',
			keys: 't:shortcuts.shell.commandPalette.keys',
			desc: 't:shortcuts.shell.commandPalette.desc',
		});
		expect(t).toHaveBeenCalledWith('shortcuts.groups.shell');
	});

	it('maps palette command ids to shortcuts i18n keys', () => {
		expect(formatShortcutKeysForPlatform('Ctrl+K, Win+K or ⌘K')).toMatch(
			/Ctrl\+K|⌘K/
		);
	});
});
