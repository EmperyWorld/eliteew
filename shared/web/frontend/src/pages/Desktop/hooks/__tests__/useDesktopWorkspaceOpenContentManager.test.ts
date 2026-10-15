import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDesktopWorkspaceOpenContentManager } from '../useDesktopWorkspaceOpenContentManager';
import type { DesktopItem } from '../../types/desktop.types';

describe('useDesktopWorkspaceOpenContentManager', () => {
	it('opens ContentManagerPro from itemsRef when present', () => {
		const cm: DesktopItem = {
			id: 'cm1',
			name: 'CM',
			type: 'app',
			position: { x: 0, y: 0 },
			appComponent: 'ContentManagerPro',
		};
		const itemsRef = { current: [cm] as DesktopItem[] };
		const handleOpenWindow = vi.fn();

		const { result } = renderHook(() =>
			useDesktopWorkspaceOpenContentManager({
				itemsRef,
				handleOpenWindow,
			})
		);

		result.current.openContentManager({ documentId: 'doc-1' });
		expect(handleOpenWindow).toHaveBeenCalledWith(cm, {
			initialPayload: { documentId: 'doc-1' },
		});
	});

	it('falls back to DEFAULT_APPS when items empty', () => {
		const itemsRef = { current: [] as DesktopItem[] };
		const handleOpenWindow = vi.fn();

		const { result } = renderHook(() =>
			useDesktopWorkspaceOpenContentManager({
				itemsRef,
				handleOpenWindow,
			})
		);

		result.current.openContentManager();
		expect(handleOpenWindow).toHaveBeenCalled();
		const firstArg = handleOpenWindow.mock.calls[0][0] as DesktopItem;
		expect(firstArg.appComponent).toBe('ContentManagerPro');
	});
});
