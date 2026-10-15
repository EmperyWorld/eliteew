/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Display-layer system folder labels resolve by stable id/systemKey without mutating API names.
 *
 * Related:
 * - ../desktopSystemFolderLabels.ts
 */

import { describe, expect, it, vi } from 'vitest';
import {
	resolveDesktopFolderDisplayName,
	resolveDesktopSystemFolderLabelId,
} from '../desktopSystemFolderLabels';

describe('desktopSystemFolderLabels', () => {
	it('maps system folder ids and systemKey', () => {
		expect(
			resolveDesktopSystemFolderLabelId({
				id: 'documents',
				name: 'Documents',
				type: 'folder',
			})
		).toBe('documents');
		expect(
			resolveDesktopSystemFolderLabelId({
				id: 'custom-id',
				name: 'Custom',
				type: 'folder',
				systemKey: 'images',
			})
		).toBe('images');
		expect(
			resolveDesktopSystemFolderLabelId({
				id: 'my-folder',
				name: 'My folder',
				type: 'folder',
			})
		).toBeNull();
	});

	it('translates system folders and falls back for user folders', () => {
		const t = vi.fn((key: string, opts?: { defaultValue?: string }) => {
			if (key === 'systemFolders.documents') return 'Документы';
			if (key === 'systemFolders.content') return 'Библиотека контента';
			return opts?.defaultValue ?? key;
		}) as never;

		expect(
			resolveDesktopFolderDisplayName(
				{ id: 'documents', name: 'Documents', type: 'folder' },
				t
			)
		).toBe('Документы');
		expect(
			resolveDesktopFolderDisplayName(
				{ id: 'content', name: 'Content', type: 'folder', isSystem: true },
				t
			)
		).toBe('Библиотека контента');
		expect(
			resolveDesktopFolderDisplayName(
				{ id: 'my-folder', name: 'My notes', type: 'folder' },
				t
			)
		).toBe('My notes');
	});

	it('accepts API DesktopItemResponse-shaped folders', () => {
		const t = vi.fn((key: string, opts?: { defaultValue?: string }) => {
			if (key === 'systemFolders.music') return 'Музыка';
			return opts?.defaultValue ?? key;
		}) as never;

		expect(
			resolveDesktopFolderDisplayName(
				{
					item_id: 'music',
					name: 'Music',
					item_type: 'FOLDER',
					is_system: true,
					system_key: 'music',
				},
				t
			)
		).toBe('Музыка');
		expect(
			resolveDesktopSystemFolderLabelId({
				item_id: 'custom',
				name: 'X',
				item_type: 'FOLDER',
				system_key: 'downloads',
			})
		).toBe('downloads');
	});

	it('resolves bootstrap seed names when path segment has no system id', () => {
		const t = vi.fn((key: string, opts?: { defaultValue?: string }) => {
			if (key === 'systemFolders.documents') return 'Документы';
			if (key === 'systemFolders.content') return 'Библиотека контента';
			return opts?.defaultValue ?? key;
		}) as never;

		expect(
			resolveDesktopSystemFolderLabelId({
				name: 'Documents',
				type: 'folder',
			})
		).toBe('documents');
		expect(
			resolveDesktopFolderDisplayName({ name: 'Documents', type: 'folder' }, t)
		).toBe('Документы');
		expect(
			resolveDesktopFolderDisplayName({ name: 'Content', type: 'folder' }, t)
		).toBe('Библиотека контента');
		expect(
			resolveDesktopFolderDisplayName({ name: 'My notes', type: 'folder' }, t)
		).toBe('My notes');
	});
});
