import { describe, expect, it } from 'vitest';
import type { WindowState } from '../../types/desktop.types';
import { collectLegacyVoiceWindowIds } from '../desktopWorkspaceRefresh';

const baseWindow = (overrides: Partial<WindowState>): WindowState => ({
	id: 'w1',
	title: 't',
	type: 'app',
	position: { x: 0, y: 0 },
	size: { width: 100, height: 100 },
	isMinimized: false,
	isMaximized: false,
	zIndex: 1,
	path: [],
	...overrides,
});

describe('collectLegacyVoiceWindowIds', () => {
	it('returns ids only for legacy hidden app components', () => {
		const windows: WindowState[] = [
			baseWindow({ id: 'a', appComponent: 'VoiceCommand' }),
			baseWindow({ id: 'b', appComponent: 'GAFChatApp' }),
			baseWindow({ id: 'c', appComponent: 'VoiceStudio' }),
		];
		expect(collectLegacyVoiceWindowIds(windows)).toEqual(['a', 'c']);
	});

	it('returns empty list when none match', () => {
		expect(
			collectLegacyVoiceWindowIds([
				baseWindow({ id: 'x', appComponent: 'GAFChatApp' }),
			])
		).toEqual([]);
	});
});
