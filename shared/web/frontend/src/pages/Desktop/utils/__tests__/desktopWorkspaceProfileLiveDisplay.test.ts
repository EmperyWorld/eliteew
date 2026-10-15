/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit coverage for live workspace-profile display helpers used by Start Menu and settings cards.
 *
 * Invariants:
 * - Open-window summaries should preserve app display titles such as EWA companion persona names.
 *
 * Related:
 * - src/pages/Desktop/utils/desktopWorkspaceProfileLiveDisplay.ts
 */
import { describe, expect, it } from 'vitest';
import type { DesktopWorkspaceProfile } from '../../types/desktopExpansion.types';
import type { DesktopItem, WindowState } from '../../types/desktop.types';
import {
	collectWorkspaceProfileLaunchItemIdsForMru,
	filterWindowsOnVirtualDesktop,
	recentAppNamesForWorkspaceProfile,
	effectiveRecentIdsForWorkspaceProfile,
	resolveWorkspaceProfileTargetDesktopId,
	summarizeOpenWindowsForDisplay,
} from '../desktopWorkspaceProfileLiveDisplay';

const profileBase: DesktopWorkspaceProfile = {
	id: 'p1',
	name: 'Test',
	appIds: ['a1', 'a2'],
	folderItemIds: [],
	widgetIds: [],
};

describe('resolveWorkspaceProfileTargetDesktopId', () => {
	it('uses profile desktop when set', () => {
		expect(
			resolveWorkspaceProfileTargetDesktopId(
				{ ...profileBase, desktopId: 'd2' },
				'd1'
			)
		).toBe('d2');
	});

	it('falls back to active desktop', () => {
		expect(
			resolveWorkspaceProfileTargetDesktopId({ ...profileBase }, 'd1')
		).toBe('d1');
	});
});

describe('filterWindowsOnVirtualDesktop', () => {
	it('filters by getWindowsOnDesktop', () => {
		const wins: WindowState[] = [
			{
				id: 'w1',
				title: 'A',
				type: 'app',
				position: { x: 0, y: 0 },
				size: { width: 100, height: 100 },
				isMinimized: false,
				isMaximized: false,
				zIndex: 1,
				path: [],
			},
			{
				id: 'w2',
				title: 'B',
				type: 'app',
				position: { x: 0, y: 0 },
				size: { width: 100, height: 100 },
				isMinimized: false,
				isMaximized: false,
				zIndex: 2,
				path: [],
			},
		];
		const get = (desk: string) => (desk === 'dx' ? ['w2'] : []);
		expect(filterWindowsOnVirtualDesktop(wins, get, 'dx')).toHaveLength(1);
		expect(filterWindowsOnVirtualDesktop(wins, get, 'dx')[0]?.id).toBe('w2');
	});
});

describe('summarizeOpenWindowsForDisplay', () => {
	it('counts minimized separately', () => {
		const wins: WindowState[] = [
			{
				id: 'w1',
				title: 'Open',
				type: 'app',
				position: { x: 0, y: 0 },
				size: { width: 100, height: 100 },
				isMinimized: false,
				isMaximized: false,
				zIndex: 1,
				path: [],
			},
			{
				id: 'w2',
				title: 'Min',
				type: 'app',
				position: { x: 0, y: 0 },
				size: { width: 100, height: 100 },
				isMinimized: true,
				isMaximized: false,
				zIndex: 2,
				path: [],
			},
		];
		const s = summarizeOpenWindowsForDisplay(wins, 3);
		expect(s.visibleCount).toBe(1);
		expect(s.minimizedCount).toBe(1);
		expect(s.totalCount).toBe(2);
		expect(s.visibleTitles).toEqual(['Open']);
	});

	it('uses persona-aware display title for EWA companion windows', () => {
		const s = summarizeOpenWindowsForDisplay(
			[
				{
					id: 'ewa-win',
					title: 'EWA',
					type: 'app',
					position: { x: 0, y: 0 },
					size: { width: 100, height: 100 },
					isMinimized: false,
					isMaximized: false,
					zIndex: 3,
					path: [],
					appComponent: 'EwaApp',
					initialPayload: {
						ewaDesktopPersonaId: 'tala',
						ewaDesktopDisplayName: 'Тала',
					},
				},
			],
			3
		);

		expect(s.visibleTitles).toEqual(['Тала']);
	});
});

describe('recentAppNamesForWorkspaceProfile', () => {
	it('preserves recent order and respects profile apps', () => {
		const profile: DesktopWorkspaceProfile = {
			...profileBase,
			appIds: ['x', 'y'],
		};
		const catalog = new Map<string, DesktopItem>([
			['x', { id: 'x', name: 'App X', type: 'app' } as DesktopItem],
			['y', { id: 'y', name: 'App Y', type: 'app' } as DesktopItem],
		]);
		expect(
			recentAppNamesForWorkspaceProfile(['z', 'y', 'x'], profile, catalog, 5)
		).toEqual(['App Y', 'App X']);
	});
});

describe('collectWorkspaceProfileLaunchItemIdsForMru', () => {
	it('includes resolved apps and existing folders in order', () => {
		const installed: DesktopItem[] = [
			{ id: 'app-x', type: 'app', name: 'X' } as DesktopItem,
		];
		const deskItems: DesktopItem[] = [
			{ id: 'fold-1', type: 'folder', name: 'F' } as DesktopItem,
		];
		const profile: DesktopWorkspaceProfile = {
			...profileBase,
			appIds: ['app-x', 'missing'],
			folderItemIds: ['fold-1', 'nope'],
		};
		expect(
			collectWorkspaceProfileLaunchItemIdsForMru(profile, installed, deskItems)
		).toEqual(['app-x', 'fold-1']);
	});
});

describe('effectiveRecentIdsForWorkspaceProfile', () => {
	it('prefers per-desktop list when profile targets that desktop', () => {
		const profile: DesktopWorkspaceProfile = {
			...profileBase,
			desktopId: 'd1',
			appIds: ['a1'],
		};
		const byDesk = { d1: ['a1', 'z'] };
		expect(
			effectiveRecentIdsForWorkspaceProfile(['z', 'a1'], byDesk, profile, 'dx')
		).toEqual(['a1', 'z']);
	});

	it('falls back to global when per-desktop list is empty', () => {
		const profile: DesktopWorkspaceProfile = {
			...profileBase,
			desktopId: 'd1',
		};
		expect(
			effectiveRecentIdsForWorkspaceProfile(['g1', 'g2'], {}, profile, 'dx')
		).toEqual(['g1', 'g2']);
	});
});
