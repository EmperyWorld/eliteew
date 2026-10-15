import { describe, expect, it } from 'vitest';
import type { WindowState } from '../../types/desktop.types';
import { applyAlwaysOnTopLayer } from '../desktopAlwaysOnTopZIndex';

function win(id: string, zIndex: number, alwaysOnTop?: boolean): WindowState {
	return {
		id,
		title: id,
		type: 'app',
		path: [id],
		position: { x: 0, y: 0 },
		size: { width: 400, height: 300 },
		isMinimized: false,
		isMaximized: false,
		zIndex,
		alwaysOnTop,
	};
}

describe('desktopAlwaysOnTopLayer', () => {
	it('bumps always-on-top windows above the highest normal window', () => {
		const windows = [win('normal', 10), win('pinned', 5, true)];
		const next = applyAlwaysOnTopLayer(windows);
		const pinned = next.find((row) => row.id === 'pinned');
		expect(pinned?.zIndex).toBeGreaterThan(10);
	});

	it('returns the same array when no always-on-top windows exist', () => {
		const windows = [win('a', 1), win('b', 2)];
		expect(applyAlwaysOnTopLayer(windows)).toBe(windows);
	});
});
