/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for desktop open-window instance policy (limits, dedupe, DocEditor target reuse).
 *
 * Invariants:
 * - Policy outcomes mirror pre-extraction `commitOpenWindow` behavior.
 *
 * Related:
 * - `hooks/windowManagerOpenPolicy.ts`, `hooks/useWindowManager.ts`
 */

import { describe, expect, it } from 'vitest';
import type { DesktopItem, WindowState } from '../../types/desktop.types';
import {
	normalizeWindowInstanceLimit,
	resolveOpenWindowDedupe,
} from '../windowManagerOpenPolicy';

const folderItem: DesktopItem = {
	id: 'folder-docs',
	name: 'Documents',
	type: 'folder',
	position: { x: 0, y: 0 },
};

const ugsItem: DesktopItem = {
	id: 'app-ugs',
	name: 'UGS',
	type: 'app',
	position: { x: 0, y: 0 },
	appComponent: 'UGS',
};

const docEditorItem: DesktopItem = {
	id: 'app-doc-editor',
	name: 'Doc Editor',
	type: 'app',
	position: { x: 0, y: 0 },
	appComponent: 'DocEditor',
};

function seedWindow(
	overrides: Partial<WindowState> & Pick<WindowState, 'id'>
): WindowState {
	return {
		title: 'Window',
		type: 'app',
		position: { x: 10, y: 20 },
		size: { width: 640, height: 480 },
		zIndex: 1,
		isMinimized: false,
		isMaximized: false,
		path: [],
		restoreBounds: null,
		folderId: ugsItem.id,
		appComponent: 'UGS',
		...overrides,
	};
}

describe('normalizeWindowInstanceLimit', () => {
	it('returns 1 when policy is missing or multiple disallowed', () => {
		expect(normalizeWindowInstanceLimit(undefined)).toBe(1);
		expect(
			normalizeWindowInstanceLimit({ allowMultiple: false, maxInstances: 5 })
		).toBe(1);
	});

	it('clamps and truncates maxInstances when multiple allowed', () => {
		expect(
			normalizeWindowInstanceLimit({ allowMultiple: true, maxInstances: 3 })
		).toBe(3);
		expect(
			normalizeWindowInstanceLimit({ allowMultiple: true, maxInstances: 2.9 })
		).toBe(2);
		expect(
			normalizeWindowInstanceLimit({ allowMultiple: true, maxInstances: 0 })
		).toBe(1);
		expect(
			normalizeWindowInstanceLimit({
				allowMultiple: true,
				maxInstances: Number.NaN,
			})
		).toBe(1);
	});
});

describe('resolveOpenWindowDedupe', () => {
	it('focuses an existing folder window when not forceNew', () => {
		const prev = [
			seedWindow({
				id: 'w-folder',
				type: 'folder',
				folderId: folderItem.id,
				title: folderItem.name,
				zIndex: 4,
				isMinimized: true,
			}),
		];

		const result = resolveOpenWindowDedupe({
			prev,
			item: folderItem,
			forceNew: false,
			nextZ: 10,
		});

		expect(result.action).toBe('reuse');
		if (result.action !== 'reuse') return;
		expect(result.reuseReason).toBe('same_app');
		expect(result.windows).toHaveLength(1);
		expect(result.windows[0]?.id).toBe('w-folder');
		expect(result.windows[0]?.isMinimized).toBe(false);
		expect(result.windows[0]?.zIndex).toBe(10);
	});

	it('opens a new folder window when forceNew is set', () => {
		const prev = [
			seedWindow({
				id: 'w-folder',
				type: 'folder',
				folderId: folderItem.id,
				title: folderItem.name,
			}),
		];

		const result = resolveOpenWindowDedupe({
			prev,
			item: folderItem,
			forceNew: true,
			nextZ: 10,
		});

		expect(result).toEqual({ action: 'open_new' });
	});

	it('focuses single-instance app instead of opening another window', () => {
		const prev = [
			seedWindow({
				id: 'w-ugs',
				folderId: ugsItem.id,
				zIndex: 2,
				isMinimized: true,
			}),
		];

		const result = resolveOpenWindowDedupe({
			prev,
			item: ugsItem,
			forceNew: false,
			instancePolicy: { allowMultiple: false, maxInstances: 1 },
			nextZ: 5,
		});

		expect(result.action).toBe('reuse');
		if (result.action !== 'reuse') return;
		expect(result.reuseReason).toBe('same_app');
		expect(result.windows[0]?.id).toBe('w-ugs');
		expect(result.windows[0]?.zIndex).toBe(5);
	});

	it('allows a new app window while under the instance cap', () => {
		const prev = [
			seedWindow({ id: 'w1', zIndex: 2 }),
			seedWindow({ id: 'w2', zIndex: 3 }),
		];

		const result = resolveOpenWindowDedupe({
			prev,
			item: ugsItem,
			forceNew: false,
			instancePolicy: { allowMultiple: true, maxInstances: 3 },
			nextZ: 8,
		});

		expect(result).toEqual({ action: 'open_new' });
	});

	it('focuses the top same-app window when the instance cap is reached', () => {
		const prev = [
			seedWindow({ id: 'w-low', zIndex: 2, isMinimized: true }),
			seedWindow({ id: 'w-top', zIndex: 7, isMinimized: true }),
		];

		const result = resolveOpenWindowDedupe({
			prev,
			item: ugsItem,
			forceNew: false,
			instancePolicy: { allowMultiple: true, maxInstances: 2 },
			nextZ: 9,
		});

		expect(result.action).toBe('at_limit');
		if (result.action !== 'at_limit') return;
		expect(result.maxInstances).toBe(2);
		expect(result.windows.find((w) => w.id === 'w-top')?.zIndex).toBe(9);
		expect(result.windows.find((w) => w.id === 'w-top')?.isMinimized).toBe(
			false
		);
	});

	it('reuses DocEditor window for the same document target', () => {
		const prev = [
			seedWindow({
				id: 'w-doc',
				folderId: docEditorItem.id,
				appComponent: 'DocEditor',
				title: 'Doc Editor',
				initialPayload: {
					docEditorTabs: [{ source: 'docEditor', id: 'doc-42' }],
					activeDocEditorTab: { source: 'docEditor', id: 'doc-42' },
					documentId: 'doc-42',
					documentIds: ['doc-42'],
					activeDocumentId: 'doc-42',
				},
				zIndex: 3,
				isMinimized: true,
			}),
		];

		const result = resolveOpenWindowDedupe({
			prev,
			item: docEditorItem,
			forceNew: false,
			instancePolicy: { allowMultiple: true, maxInstances: 4 },
			initialPayload: {
				docEditorTabs: [{ source: 'docEditor', id: 'doc-42' }],
				activeDocEditorTab: { source: 'docEditor', id: 'doc-42' },
				documentId: 'doc-42',
			},
			nextZ: 11,
		});

		expect(result.action).toBe('reuse');
		if (result.action !== 'reuse') return;
		expect(result.reuseReason).toBe('same_document');
		expect(result.windows[0]?.id).toBe('w-doc');
		expect(result.windows[0]?.zIndex).toBe(11);
		expect(result.windows[0]?.initialPayload?.documentId).toBe('doc-42');
	});

	it('matches same app by appComponent when folderId differs', () => {
		const prev = [
			seedWindow({
				id: 'w-alias',
				folderId: 'other-desktop-item-id',
				appComponent: 'UGS',
				zIndex: 6,
			}),
		];

		const result = resolveOpenWindowDedupe({
			prev,
			item: ugsItem,
			forceNew: false,
			instancePolicy: { allowMultiple: true, maxInstances: 1 },
			nextZ: 12,
		});

		expect(result.action).toBe('at_limit');
		if (result.action !== 'at_limit') return;
		expect(result.windows[0]?.id).toBe('w-alias');
	});
});
