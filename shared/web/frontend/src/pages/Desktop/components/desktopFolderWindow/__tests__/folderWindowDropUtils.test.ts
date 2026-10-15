/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for folder window drop payload classification and overlay copy keys.
 *
 * Invariants:
 * - Classification order matches list-body drop handler precedence.
 *
 * Related:
 * - folderWindowDropUtils.ts
 */

import { describe, expect, it } from 'vitest';
import { CM_CONTENT_DRAG_MIME } from '@/pages/ContentManager/utils/contentManagerDrag';
import { DESKTOP_NESTED_ITEM_DRAG_MIME } from '../../../utils/desktopNestedItemDrag';
import {
	classifyFolderDropPayload,
	dataTransferActivatesFolderDropOverlay,
	resolveFolderDropOverlayCopyKey,
} from '../folderWindowDropUtils';

describe('classifyFolderDropPayload', () => {
	it('prefers nested shortcut payload over library drag', () => {
		const dt = {
			getData: (type: string) => {
				if (type === DESKTOP_NESTED_ITEM_DRAG_MIME) return '["n1"]';
				if (type === CM_CONTENT_DRAG_MIME) return '{"ids":["c1"]}';
				return '';
			},
			files: [] as unknown as FileList,
			types: [DESKTOP_NESTED_ITEM_DRAG_MIME, CM_CONTENT_DRAG_MIME],
		} as unknown as DataTransfer;

		expect(classifyFolderDropPayload(dt)).toBe('nested-move');
	});

	it('detects OS file upload payload', () => {
		const dt = {
			getData: () => '',
			files: [{ name: 'a.txt' }],
			types: ['Files'],
		} as unknown as DataTransfer;

		expect(classifyFolderDropPayload(dt)).toBe('upload');
		expect(dataTransferActivatesFolderDropOverlay(dt)).toBe(true);
	});
});

describe('resolveFolderDropOverlayCopyKey', () => {
	it('maps payload kinds to i18n keys', () => {
		expect(resolveFolderDropOverlayCopyKey('upload')).toBe(
			'folderWindow.dropUpload'
		);
		expect(resolveFolderDropOverlayCopyKey('library-move')).toBe(
			'folderWindow.dropMoveLibrary'
		);
		expect(resolveFolderDropOverlayCopyKey('nested-move')).toBe(
			'folderWindow.dropMoveShortcut'
		);
		expect(resolveFolderDropOverlayCopyKey(null)).toBeNull();
	});
});
