/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest coverage for **`buildEwaCompanionShellContextSnapshot`** — all-desktops scope, active-desktop filter,
 * title redaction, **z_index** clamp (Pydantic max), **`surface_excerpt`** / **`surface_selection`** / **`surface_listing`** wiring.
 *
 * Invariants:
 * - Deterministic sort by z-index (desc); **`maxWindows`** applies **after** z-ordering (not insertion order).
 *
 * Related:
 * - src/pages/Desktop/utils/buildEwaCompanionShellContext.ts
 */
import { buildEwaCompanionShellContextSnapshot } from '@/pages/Desktop/utils/buildEwaCompanionShellContext';
import type { VirtualDesktop } from '@/pages/Desktop/hooks/useVirtualDesktops';
import type { WindowState } from '@/pages/Desktop/types/desktop.types';
import { describe, expect, it } from 'vitest';

describe('buildEwaCompanionShellContextSnapshot', () => {
	it('keeps only windows on the active desktop by default and orders by z-index', () => {
		const desktops: VirtualDesktop[] = [
			{ id: 'd1', name: 'One', isActive: true, windows: ['w1', 'w2'] },
			{ id: 'd2', name: 'Two', isActive: false, windows: ['w3'] },
		];
		const allWindows: WindowState[] = [
			{
				id: 'w1',
				title: 'A',
				type: 'app',
				position: { x: 0, y: 0 },
				size: { width: 100, height: 100 },
				isMinimized: false,
				isMaximized: false,
				zIndex: 2,
				path: [],
				appComponent: 'EwaApp',
			},
			{
				id: 'w2',
				title: 'B',
				type: 'app',
				position: { x: 0, y: 0 },
				size: { width: 100, height: 100 },
				isMinimized: false,
				isMaximized: false,
				zIndex: 9,
				path: [],
				appComponent: 'GAFChatApp',
			},
			{
				id: 'w3',
				title: 'Other desk',
				type: 'app',
				position: { x: 0, y: 0 },
				size: { width: 100, height: 100 },
				isMinimized: false,
				isMaximized: false,
				zIndex: 99,
				path: [],
				appComponent: 'MusicPlayer',
			},
		];
		const snap = buildEwaCompanionShellContextSnapshot({
			allWindows,
			desktops,
			activeDesktopId: 'd1',
			activeWindowId: 'w2',
			includeAllVirtualDesktops: false,
		});
		expect(snap.active_desktop_id).toBe('d1');
		expect(snap.active_window_id).toBe('w2');
		expect(snap.windows.map((w) => w.window_id)).toEqual(['w2', 'w1']);
	});

	it('includes all virtual desktops when includeAllVirtualDesktops is true', () => {
		const desktops: VirtualDesktop[] = [
			{ id: 'd1', name: 'One', isActive: true, windows: ['w1', 'w2'] },
			{ id: 'd2', name: 'Two', isActive: false, windows: ['w3'] },
		];
		const allWindows: WindowState[] = [
			{
				id: 'w1',
				title: 'A',
				type: 'app',
				position: { x: 0, y: 0 },
				size: { width: 100, height: 100 },
				isMinimized: false,
				isMaximized: false,
				zIndex: 2,
				path: [],
				appComponent: 'EwaApp',
			},
			{
				id: 'w2',
				title: 'B',
				type: 'app',
				position: { x: 0, y: 0 },
				size: { width: 100, height: 100 },
				isMinimized: false,
				isMaximized: false,
				zIndex: 9,
				path: [],
				appComponent: 'GAFChatApp',
			},
			{
				id: 'w3',
				title: 'Other desk',
				type: 'app',
				position: { x: 0, y: 0 },
				size: { width: 100, height: 100 },
				isMinimized: false,
				isMaximized: false,
				zIndex: 99,
				path: [],
				appComponent: 'MusicPlayer',
			},
		];
		const snap = buildEwaCompanionShellContextSnapshot({
			allWindows,
			desktops,
			activeDesktopId: 'd1',
			activeWindowId: 'w2',
			includeAllVirtualDesktops: true,
		});
		expect(snap.windows.map((w) => w.window_id)).toEqual(['w3', 'w2', 'w1']);
		expect(snap.windows.find((w) => w.window_id === 'w3')?.desktop_id).toBe(
			'd2'
		);
	});

	it('redacts email-like snippets in titles', () => {
		const desktops: VirtualDesktop[] = [
			{ id: 'd1', name: 'One', isActive: true, windows: ['w1'] },
		];
		const allWindows: WindowState[] = [
			{
				id: 'w1',
				title: 'Chat with x@example.com now',
				type: 'app',
				position: { x: 0, y: 0 },
				size: { width: 100, height: 100 },
				isMinimized: false,
				isMaximized: false,
				zIndex: 1,
				path: [],
				appComponent: 'DesktopAiChatApp',
			},
		];
		const snap = buildEwaCompanionShellContextSnapshot({
			allWindows,
			desktops,
			activeDesktopId: 'd1',
			activeWindowId: null,
		});
		expect(snap.windows[0].title).toContain('[redacted]');
	});

	it('clamps z_index to the Pydantic wire maximum (2_000_000)', () => {
		const desktops: VirtualDesktop[] = [
			{ id: 'd1', name: 'One', isActive: true, windows: ['w1'] },
		];
		const allWindows: WindowState[] = [
			{
				id: 'w1',
				title: 'Z',
				type: 'app',
				position: { x: 0, y: 0 },
				size: { width: 100, height: 100 },
				isMinimized: false,
				isMaximized: false,
				zIndex: 9_999_999,
				path: [],
				appComponent: 'EwaApp',
			},
		];
		const snap = buildEwaCompanionShellContextSnapshot({
			allWindows,
			desktops,
			activeDesktopId: 'd1',
			activeWindowId: 'w1',
		});
		expect(snap.windows[0].z_index).toBe(2_000_000);
	});

	it('maps companionSurfaceSelectionPlain to surface_selection for DocEditor apps', () => {
		const desktops: VirtualDesktop[] = [
			{ id: 'd1', name: 'One', isActive: true, windows: ['w1'] },
		];
		const allWindows: WindowState[] = [
			{
				id: 'w1',
				title: 'Doc',
				type: 'app',
				position: { x: 0, y: 0 },
				size: { width: 100, height: 100 },
				isMinimized: false,
				isMaximized: false,
				zIndex: 1,
				path: [],
				appComponent: 'DocEditor',
				initialPayload: {
					companionSurfaceSelectionPlain: 'Alpha line\nBeta',
				},
			},
		];
		const snap = buildEwaCompanionShellContextSnapshot({
			allWindows,
			desktops,
			activeDesktopId: 'd1',
			activeWindowId: 'w1',
			includeAllVirtualDesktops: false,
		});
		expect(snap.windows[0]?.surface_selection).toContain('Alpha');
		expect(snap.windows[0]?.surface_selection).toContain('Beta');
	});

	it('maps companionSurfaceExcerpt to surface_excerpt on snapshot rows', () => {
		const desktops: VirtualDesktop[] = [
			{ id: 'd1', name: 'One', isActive: true, windows: ['w1'] },
		];
		const allWindows: WindowState[] = [
			{
				id: 'w1',
				title: 'Doc',
				type: 'app',
				position: { x: 0, y: 0 },
				size: { width: 100, height: 100 },
				isMinimized: false,
				isMaximized: false,
				zIndex: 1,
				path: [],
				appComponent: 'DocEditor',
				initialPayload: { companionSurfaceExcerpt: 'Hello from the chapter.' },
			},
		];
		const snap = buildEwaCompanionShellContextSnapshot({
			allWindows,
			desktops,
			activeDesktopId: 'd1',
			activeWindowId: 'w1',
			includeAllVirtualDesktops: false,
		});
		expect(snap.windows[0]?.surface_excerpt).toContain('chapter');
	});

	it('maps companionListingPlain to surface_listing and includes folder windows as DesktopFolder', () => {
		const desktops: VirtualDesktop[] = [
			{ id: 'd1', name: 'One', isActive: true, windows: ['w1', 'w2'] },
		];
		const allWindows: WindowState[] = [
			{
				id: 'w1',
				title: 'Project',
				type: 'folder',
				position: { x: 0, y: 0 },
				size: { width: 100, height: 100 },
				isMinimized: false,
				isMaximized: false,
				zIndex: 3,
				path: ['Alpha'],
				folderId: 'item-42',
				initialPayload: {
					companionListingPlain: '[Desktop folder] Alpha\n- file.pdf',
				},
			},
			{
				id: 'w2',
				title: 'Deck',
				type: 'app',
				position: { x: 0, y: 0 },
				size: { width: 100, height: 100 },
				isMinimized: false,
				isMaximized: false,
				zIndex: 1,
				path: [],
				appComponent: 'EWRP',
				initialPayload: {
					companionListingPlain: '[EWRP]\n- job a',
				},
			},
		];
		const snap = buildEwaCompanionShellContextSnapshot({
			allWindows,
			desktops,
			activeDesktopId: 'd1',
			activeWindowId: null,
		});
		expect(snap.windows.map((x) => x.window_id)).toEqual(['w1', 'w2']);
		const folderRow = snap.windows.find((x) => x.window_id === 'w1');
		expect(folderRow?.app_component).toBe('DesktopFolder');
		expect(folderRow?.surface_listing).toContain('file.pdf');
		const appRow = snap.windows.find((x) => x.window_id === 'w2');
		expect(appRow?.surface_listing).toContain('[EWRP]');
	});

	it('caps maxWindows by z-index so high-stacked windows at the end of state are not dropped', () => {
		const desktops: VirtualDesktop[] = [
			{
				id: 'd1',
				name: 'One',
				isActive: true,
				windows: ['a', 'b', 'c', 'd', 'top'],
			},
		];
		const allWindows: WindowState[] = [
			{
				id: 'a',
				title: 'Old 1',
				type: 'app',
				position: { x: 0, y: 0 },
				size: { width: 100, height: 100 },
				isMinimized: false,
				isMaximized: false,
				zIndex: 1,
				path: [],
				appComponent: 'EwaApp',
			},
			{
				id: 'b',
				title: 'Old 2',
				type: 'app',
				position: { x: 0, y: 0 },
				size: { width: 100, height: 100 },
				isMinimized: false,
				isMaximized: false,
				zIndex: 2,
				path: [],
				appComponent: 'EwaApp',
			},
			{
				id: 'c',
				title: 'Old 3',
				type: 'app',
				position: { x: 0, y: 0 },
				size: { width: 100, height: 100 },
				isMinimized: false,
				isMaximized: false,
				zIndex: 3,
				path: [],
				appComponent: 'EwaApp',
			},
			{
				id: 'd',
				title: 'Old 4',
				type: 'app',
				position: { x: 0, y: 0 },
				size: { width: 100, height: 100 },
				isMinimized: false,
				isMaximized: false,
				zIndex: 4,
				path: [],
				appComponent: 'EwaApp',
			},
			{
				id: 'top',
				title: 'Doc Editor',
				type: 'app',
				position: { x: 0, y: 0 },
				size: { width: 100, height: 100 },
				isMinimized: false,
				isMaximized: false,
				zIndex: 900,
				path: [],
				appComponent: 'DocEditor',
				initialPayload: {
					companionListingPlain: '- finance [document] uc=uuid-here',
				},
			},
		];
		const snap = buildEwaCompanionShellContextSnapshot({
			allWindows,
			desktops,
			activeDesktopId: 'd1',
			activeWindowId: 'top',
			includeAllVirtualDesktops: false,
			maxWindows: 3,
		});
		expect(snap.windows.map((w) => w.window_id)).toEqual(['top', 'd', 'c']);
		expect(snap.windows[0]?.surface_listing).toContain('finance');
	});
});
