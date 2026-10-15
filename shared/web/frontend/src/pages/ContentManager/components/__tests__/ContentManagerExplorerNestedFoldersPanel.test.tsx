/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock Content Manager nested-folder grid: no nested buttons, visible accent,
 * compact horizontal tiles, open + menu callbacks.
 *
 * Invariants:
 * - Grid tile is role=group with a single open button (menu is a sibling).
 * - Cards include border-l-4 + folder accent class.
 * - Grid is dense (gap-1.5); tiles are not tall poster cards (no min-h-7.25rem).
 *
 * Related:
 * - ContentManagerExplorerNestedFoldersPanel.tsx
 * - contentManagerNestedFoldersChrome.ts
 * - documentation/product/CONTENT-MANAGER.md
 */

import {
	cleanup,
	fireEvent,
	render,
	screen,
	within,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DesktopItemResponse } from '../../../Desktop/services/desktopApi';
import { ContentManagerExplorerNestedFoldersPanel } from '../ContentManagerExplorerNestedFoldersPanel';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, opts?: { name?: string }) =>
			opts?.name ? `${key}:${opts.name}` : key,
	}),
}));

afterEach(() => {
	cleanup();
});

function folder(
	partial: Partial<DesktopItemResponse> & { item_id: string; name: string }
): DesktopItemResponse {
	return {
		position: {},
		color: null,
		gradient: null,
		is_pinned: false,
		app_component: null,
		is_system: false,
		system_key: null,
		meta: {},
		created_at: '2026-01-01T00:00:00Z',
		updated_at: '2026-01-01T00:00:00Z',
		...partial,
		id: partial.id ?? partial.item_id,
		item_id: partial.item_id,
		item_type: 'FOLDER' as const,
		name: partial.name,
	};
}

describe('ContentManagerExplorerNestedFoldersPanel', () => {
	it('renders grid tiles without nesting the more-menu inside the open button', () => {
		const onOpenFolder = vi.fn();
		const onFolderContextMenu = vi.fn();
		render(
			<ContentManagerExplorerNestedFoldersPanel
				folders={[
					folder({
						item_id: 'documents',
						name: 'Documents',
						system_key: 'documents',
						is_system: true,
					}),
					folder({
						item_id: 'user-1',
						name: 'Плазма',
						meta: { folder_icon: 'sparkles' },
					}),
				]}
				viewMode="grid"
				shellContentPanelClass="panel"
				onOpenFolder={onOpenFolder}
				onFolderContextMenu={onFolderContextMenu}
			/>
		);

		const grid = document.querySelector('[data-cm-nested-folders-grid="true"]');
		expect(grid).toBeTruthy();
		const tile = document.querySelector(
			'[data-cm-nested-folder-id="documents"]'
		);
		expect(tile).toBeTruthy();
		expect(tile?.className).toMatch(/border-l-4/);
		expect(tile?.className).not.toMatch(/min-h-\[7\.25rem\]/);
		expect(tile?.className).toMatch(/items-stretch|items-center/);
		expect(grid?.className).toMatch(/gap-1\.5/);
		expect(grid?.className).not.toMatch(/gap-3/);
		expect(tile?.querySelectorAll('button').length).toBe(2);

		const openBtn = within(tile as HTMLElement).getByRole('button', {
			name: /explorer\.folderRowHint/,
		});
		expect(openBtn.querySelector('button')).toBeNull();

		fireEvent.click(openBtn);
		expect(onOpenFolder).toHaveBeenCalledWith('documents');

		fireEvent.click(
			within(tile as HTMLElement).getByRole('button', { name: 'pro.menu.more' })
		);
		expect(onFolderContextMenu).toHaveBeenCalledTimes(1);
	});

	it('returns null when there are no nested folders', () => {
		const { container } = render(
			<ContentManagerExplorerNestedFoldersPanel
				folders={[]}
				viewMode="grid"
				shellContentPanelClass="panel"
				onOpenFolder={vi.fn()}
				onFolderContextMenu={vi.fn()}
			/>
		);
		expect(container.firstChild).toBeNull();
		expect(screen.queryByLabelText('explorer.nestedFoldersSection')).toBeNull();
	});
});
