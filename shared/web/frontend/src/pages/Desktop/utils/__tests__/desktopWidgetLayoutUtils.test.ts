import { describe, expect, it } from 'vitest';
import type {
	DesktopWidgetsLayout,
	DesktopWorkspaceProfile,
} from '../../types/desktopExpansion.types';
import {
	filterDesktopWidgetSlots,
	mergeMissingDefaultWidgetSlots,
	normalizeWidgetsLayout,
	reorderWidgetSlotsByIndex,
} from '../desktopWidgetLayoutUtils';

describe('normalizeWidgetsLayout', () => {
	it('preserves slot position when slotPlacement is free', () => {
		const out = normalizeWidgetsLayout({
			slotPlacement: 'free',
			slots: [
				{
					id: 'notes',
					type: 'notes',
					enabled: true,
					mode: 'compact',
					position: { x: 12, y: 34 },
				},
			],
			perWorkspace: false,
		});
		expect(out.slots[0]?.position).toEqual({ x: 12, y: 34 });
	});

	it('merges missing default slots including assistant-plan and agenda', () => {
		const out = normalizeWidgetsLayout({
			slots: [{ id: 'notes', type: 'notes', enabled: true, mode: 'compact' }],
			perWorkspace: false,
		});
		expect(out.slots.some((slot) => slot.id === 'favorites')).toBe(true);
		expect(out.slots.some((slot) => slot.id === 'assistant-plan')).toBe(true);
		expect(out.slots.some((slot) => slot.id === 'agenda')).toBe(true);
	});

	it('strips slot position when stacked', () => {
		const out = normalizeWidgetsLayout({
			slots: [
				{
					id: 'notes',
					type: 'notes',
					enabled: true,
					position: { x: 1, y: 2 },
				},
			],
			perWorkspace: false,
		});
		expect(out.slots[0]?.position).toBeUndefined();
	});

	it('preserves panelOffset on layout root', () => {
		const out = normalizeWidgetsLayout({
			slots: [],
			perWorkspace: false,
			panelOffset: { x: 4, y: -12 },
		});
		expect(out.panelOffset).toEqual({ x: 4, y: -12 });
	});

	it('drops invalid slot position when free', () => {
		const out = normalizeWidgetsLayout({
			slotPlacement: 'free',
			slots: [{ id: 'notes', position: { x: 'n', y: 1 } }],
			perWorkspace: false,
		});
		expect(out.slots[0]?.position).toBeUndefined();
	});
});

describe('filterDesktopWidgetSlots', () => {
	const baseProfiles: DesktopWorkspaceProfile[] = [
		{
			id: 'p1',
			name: 'A',
			appIds: [],
			folderItemIds: [],
			widgetIds: [],
			desktopId: 'desktop-1',
		},
		{
			id: 'p2',
			name: 'B',
			appIds: [],
			folderItemIds: [],
			widgetIds: [],
		},
	];

	it('returns all enabled when perWorkspace is false', () => {
		const layout: DesktopWidgetsLayout = {
			slots: [
				{
					id: 'notes',
					type: 'notes',
					enabled: true,
					mode: 'compact',
					workspaceProfileId: 'p1',
				},
			],
			perWorkspace: false,
		};
		const filtered = filterDesktopWidgetSlots(
			layout,
			'desktop-2',
			baseProfiles
		);
		expect(filtered).toHaveLength(1);
	});

	it('keeps global slot when perWorkspace', () => {
		const layout: DesktopWidgetsLayout = {
			slots: [{ id: 'notes', type: 'notes', enabled: true, mode: 'compact' }],
			perWorkspace: true,
		};
		const filtered = filterDesktopWidgetSlots(
			layout,
			'desktop-2',
			baseProfiles
		);
		expect(filtered.map((s) => s.id)).toEqual(['notes']);
	});

	it('filters by profile desktopId', () => {
		const layout: DesktopWidgetsLayout = {
			slots: [
				{
					id: 'notes',
					type: 'notes',
					enabled: true,
					mode: 'compact',
					workspaceProfileId: 'p1',
				},
			],
			perWorkspace: true,
		};
		expect(
			filterDesktopWidgetSlots(layout, 'desktop-1', baseProfiles).length
		).toBe(1);
		expect(
			filterDesktopWidgetSlots(layout, 'desktop-9', baseProfiles).length
		).toBe(0);
	});

	it('drops unknown profile id', () => {
		const layout: DesktopWidgetsLayout = {
			slots: [
				{
					id: 'notes',
					type: 'notes',
					enabled: true,
					mode: 'compact',
					workspaceProfileId: 'missing',
				},
			],
			perWorkspace: true,
		};
		expect(filterDesktopWidgetSlots(layout, 'desktop-1', baseProfiles)).toEqual(
			[]
		);
	});
});

describe('normalizeWidgetsLayout defaults', () => {
	it('defaults todos off and plan/agenda on', () => {
		const slots = normalizeWidgetsLayout(null).slots;
		expect(slots.find((slot) => slot.id === 'todos')?.enabled).toBe(false);
		expect(slots.find((slot) => slot.id === 'assistant-plan')?.enabled).toBe(
			true
		);
		expect(slots.find((slot) => slot.id === 'agenda')?.enabled).toBe(true);
	});

	it('keeps explicitly enabled todos and uses catalog default when enabled is omitted', () => {
		const kept = normalizeWidgetsLayout({
			slots: [{ id: 'todos', type: 'todos', enabled: true, mode: 'compact' }],
			perWorkspace: false,
		});
		expect(kept.slots.find((slot) => slot.id === 'todos')?.enabled).toBe(true);
		const omitted = normalizeWidgetsLayout({
			slots: [{ id: 'todos', type: 'todos', mode: 'compact' }],
			perWorkspace: false,
		});
		expect(omitted.slots.find((slot) => slot.id === 'todos')?.enabled).toBe(
			false
		);
	});

	it('drops unknown slot types instead of rewriting them into assistant-plan', () => {
		const out = normalizeWidgetsLayout({
			slots: [
				{ id: 'weird', type: 'not-a-slot', enabled: true, mode: 'compact' },
				{ id: 'notes', type: 'notes', enabled: true, mode: 'compact' },
			],
			perWorkspace: false,
		});
		expect(out.slots.some((slot) => slot.id === 'weird')).toBe(false);
		expect(out.slots.some((slot) => slot.type === 'assistant-plan')).toBe(true);
	});

	it('drops a calendar widget slot instead of inventing a docked calendar', () => {
		const out = normalizeWidgetsLayout({
			slots: [
				{ id: 'calendar', type: 'calendar', enabled: true, mode: 'compact' },
				{ id: 'agenda', type: 'agenda', enabled: true, mode: 'compact' },
			],
			perWorkspace: false,
		});
		expect(out.slots.some((slot) => slot.id === 'calendar')).toBe(false);
		expect(out.slots.some((slot) => slot.type === 'agenda')).toBe(true);
	});
});

describe('mergeMissingDefaultWidgetSlots', () => {
	it('appends favorites when persisted layout predates the slot', () => {
		const merged = mergeMissingDefaultWidgetSlots([
			{ id: 'notes', type: 'notes', enabled: true, mode: 'compact' },
		]);
		expect(merged.some((slot) => slot.id === 'favorites')).toBe(true);
		expect(merged.some((slot) => slot.id === 'assistant-plan')).toBe(true);
		expect(merged.some((slot) => slot.id === 'agenda')).toBe(true);
	});
});

describe('reorderWidgetSlotsByIndex', () => {
	it('moves slot', () => {
		const slots = normalizeWidgetsLayout(null).slots;
		const movedId = slots[0]?.id;
		const next = reorderWidgetSlotsByIndex(slots, 0, 2);
		expect(next[2]?.id).toBe(movedId);
		expect(next[0]?.id).not.toBe(movedId);
	});
});
