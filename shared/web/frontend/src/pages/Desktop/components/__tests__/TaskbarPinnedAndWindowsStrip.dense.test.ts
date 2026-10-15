/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract tests for dense-window taskbar policy and strip/overflow partition.
 *
 * Invariants:
 * - Dense mode starts above visible slot count and always implies titled overflow.
 * - Dense mode does not imply same-app grouping.
 *
 * Related:
 * - src/pages/Desktop/components/taskbarStrip/taskbarStripHelpers.ts
 * - src/pages/Desktop/components/TaskbarPinnedAndWindowsStrip.tsx
 */

import { describe, expect, it } from 'vitest';
import type { WindowState } from '../../types/desktop.types';
import {
	partitionTaskbarWindowsForStrip,
	shouldUseDenseTaskbarWindowMode,
	TASKBAR_DENSE_WINDOW_COUNT,
	TASKBAR_VISIBLE_WINDOW_SLOTS,
} from '../TaskbarPinnedAndWindowsStrip';

function fakeWindow(id: string): WindowState {
	return {
		id,
		title: `Win ${id}`,
		appComponent: 'AssistantApp',
		isMinimized: false,
	} as WindowState;
}

describe('TaskbarPinnedAndWindowsStrip dense window policy', () => {
	it('enables dense mode above visible slot count', () => {
		expect(shouldUseDenseTaskbarWindowMode(TASKBAR_VISIBLE_WINDOW_SLOTS)).toBe(
			false
		);
		expect(shouldUseDenseTaskbarWindowMode(TASKBAR_DENSE_WINDOW_COUNT)).toBe(
			true
		);
		expect(
			shouldUseDenseTaskbarWindowMode(TASKBAR_DENSE_WINDOW_COUNT + 5)
		).toBe(true);
	});

	it('partitions excess windows into titled overflow when dense', () => {
		const windows = Array.from({ length: 12 }, (_, i) => fakeWindow(`w${i}`));
		const part = partitionTaskbarWindowsForStrip(windows);
		expect(part.dense).toBe(true);
		expect(part.hasOverflow).toBe(true);
		expect(part.visibleWindows).toHaveLength(TASKBAR_VISIBLE_WINDOW_SLOTS);
		expect(part.overflowWindows).toHaveLength(
			12 - TASKBAR_VISIBLE_WINDOW_SLOTS
		);
		expect(part.overflowWindows.map((w) => w.id)).toEqual([
			'w7',
			'w8',
			'w9',
			'w10',
			'w11',
		]);
	});

	it('keeps overflow window titles for narrow 12+ window loads', () => {
		const windows = Array.from({ length: 14 }, (_, i) => ({
			...fakeWindow(`n${i}`),
			title: `Named window ${i}`,
		}));
		const part = partitionTaskbarWindowsForStrip(windows);
		expect(part.dense).toBe(true);
		expect(part.hasOverflow).toBe(true);
		expect(part.visibleWindows).toHaveLength(TASKBAR_VISIBLE_WINDOW_SLOTS);
		expect(part.overflowWindows).toHaveLength(
			14 - TASKBAR_VISIBLE_WINDOW_SLOTS
		);
		for (const w of part.overflowWindows) {
			expect(w.title).toMatch(/^Named window /);
			expect(w.title.length).toBeGreaterThan(0);
		}
	});

	it('locks 12 windows → 7 visible + 5 titled overflow (a11y strip contract)', () => {
		const windows = Array.from({ length: 12 }, (_, i) => ({
			...fakeWindow(`a11y-${i}`),
			title: `Overflow title ${i}`,
		}));
		const part = partitionTaskbarWindowsForStrip(windows);
		expect(TASKBAR_VISIBLE_WINDOW_SLOTS).toBe(7);
		expect(part.visibleWindows).toHaveLength(7);
		expect(part.overflowWindows).toHaveLength(5);
		expect(part.overflowWindows.map((w) => w.title)).toEqual([
			'Overflow title 7',
			'Overflow title 8',
			'Overflow title 9',
			'Overflow title 10',
			'Overflow title 11',
		]);
	});
});
