/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for standard desktop before-close confirm helper (plan 02/20 R06).
 */

import { describe, expect, it, vi } from 'vitest';
import { createDesktopWindowBeforeCloseConfirmHandler } from '../desktopWindowBeforeCloseConfirm';

const t = vi.fn((key: string) => {
	if (key === 'windowChrome.closeConfirmTitle') return 'Close window?';
	if (key === 'windowChrome.closeConfirmBody') return 'Unsaved changes.';
	return key;
}) as unknown as import('i18next').TFunction<'desktopUi'>;

describe('createDesktopWindowBeforeCloseConfirmHandler', () => {
	it('allows close when there is no unsaved work', () => {
		const confirmMock = vi.fn();
		vi.stubGlobal('confirm', confirmMock);
		const handler = createDesktopWindowBeforeCloseConfirmHandler({
			hasUnsavedWork: () => false,
			t,
		});
		expect(handler()).toBe(true);
		expect(confirmMock).not.toHaveBeenCalled();
		vi.unstubAllGlobals();
	});

	it('prompts and returns confirm result when unsaved', () => {
		const confirmMock = vi.fn(() => false);
		vi.stubGlobal('confirm', confirmMock);
		const handler = createDesktopWindowBeforeCloseConfirmHandler({
			hasUnsavedWork: () => true,
			t,
		});
		expect(handler()).toBe(false);
		expect(confirmMock).toHaveBeenCalledOnce();
		vi.unstubAllGlobals();
	});
});
