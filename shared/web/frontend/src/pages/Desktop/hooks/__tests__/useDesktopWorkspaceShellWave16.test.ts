import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { UseDesktopWorkspaceHandleActionParams } from '../useDesktopWorkspaceHandleAction';
import { useDesktopWorkspaceHandleAction } from '../useDesktopWorkspaceHandleAction';
import {
	useDesktopWorkspaceKeyboardShortcuts,
	type UseDesktopWorkspaceKeyboardShortcutsParams,
} from '../useDesktopWorkspaceKeyboardShortcuts';
import type { DesktopItem } from '../../types/desktop.types';
import type { VirtualDesktop } from '../useVirtualDesktops';

const minimalCtx = () =>
	({
		isOpen: false,
		x: 0,
		y: 0,
		targetType: 'desktop',
	}) as UseDesktopWorkspaceHandleActionParams['ctx'];

function rootApp(id: string, name: string): DesktopItem {
	return {
		id,
		name,
		type: 'app',
		position: { x: 999, y: 999 },
	};
}

function minimalHandleActionParams(
	overrides: Partial<UseDesktopWorkspaceHandleActionParams>
): UseDesktopWorkspaceHandleActionParams {
	const noop = () => {};
	return {
		ctx: minimalCtx(),
		items: [],
		selected: new Set(),
		gridStep: 'medium',
		snapToGridEffective: true,
		setShowNF: noop,
		openAppStoreAsWindow: noop,
		setShowSessionInfoPanel: noop,
		openSocialHubTab: () => undefined,
		openShellSettings: noop,
		handleOpenWindow: noop,
		commitItems: noop,
		setSelected: noop,
		performWorkspaceRefresh: noop,
		setPropertiesItem: noop,
		setRenamingId: noop,
		copyItems: noop,
		cutItems: noop,
		pasteClipboard: noop,
		updateConfig: async () => {},
		activeDesktopWindow: null,
		minimizeWindow: noop,
		maximizeWindow: noop,
		closeWindow: noop,
		toggleWindowAlwaysOnTop: noop,
		updateDesktopVisualPreferences: async () => {},
		openDesktopAppByComponent: () => undefined,
		createMarkdownFile: async () => null,
		...overrides,
	};
}

function minimalKeyboardParams(
	overrides: Partial<UseDesktopWorkspaceKeyboardShortcutsParams>
): UseDesktopWorkspaceKeyboardShortcutsParams {
	const noop = () => {};
	const desktops: VirtualDesktop[] = [
		{ id: 'desktop-1', name: '1', isActive: true, windows: [] },
	];
	return {
		activeDesktopWindow: null,
		currentDesktopWindows: [],
		activeDesktopWindowId: null,
		snapWindow: noop,
		maximizeWindow: noop,
		minimizeWindow: noop,
		closeWindow: noop,
		minimizeAllWindows: noop,
		setShowQuickSearch: noop,
		setShowTaskSwitcher: noop,
		toggleExplicitTheme: noop,
		showCommandPalette: false,
		setShowCommandPalette: noop,
		setShowShortcutsHelp: noop,
		openShellSettings: noop,
		openSocialHubTab: () => undefined,
		openDesktopAppByComponent: () => undefined,
		setShowClipboard: noop,
		installedApps: [],
		handleOpenWindow: noop,
		switchToNextDesktop: noop,
		switchToPreviousDesktop: noop,
		createDesktop: noop,
		desktops,
		switchToDesktop: noop,
		focusWindow: noop,
		...overrides,
	};
}

describe('useDesktopWorkspaceHandleAction (wave 16)', () => {
	it('sort-by-name orders root icons and applies grid positions from gridStep', () => {
		const commitItems = vi.fn();
		const items: DesktopItem[] = [rootApp('b', 'zebra'), rootApp('a', 'alpha')];
		const { result } = renderHook(() =>
			useDesktopWorkspaceHandleAction(
				minimalHandleActionParams({
					items,
					commitItems,
					gridStep: 'small',
				})
			)
		);
		act(() => {
			result.current('sort-by-name');
		});
		expect(commitItems).toHaveBeenCalledTimes(1);
		const next = commitItems.mock.calls[0][0] as DesktopItem[];
		const roots = next.filter((i) => !i.parentId);
		expect(roots.map((i) => i.name)).toEqual(['alpha', 'zebra']);
		const ySmall = roots[1]?.position.y;

		const commitItemsMed = vi.fn();
		const { result: resultMed } = renderHook(() =>
			useDesktopWorkspaceHandleAction(
				minimalHandleActionParams({
					items,
					commitItems: commitItemsMed,
					gridStep: 'medium',
				})
			)
		);
		act(() => {
			resultMed.current('sort-by-name');
		});
		const nextMed = commitItemsMed.mock.calls[0][0] as DesktopItem[];
		const rootsMed = nextMed.filter((i) => !i.parentId);
		const yMedium = rootsMed[1]?.position.y;
		expect(ySmall).not.toBe(yMedium);
	});

	it('open-in-doc-editor opens DocEditor with unified content id', () => {
		const openDesktopAppByComponent = vi.fn();
		const file: DesktopItem = {
			id: 'uc-1',
			name: 'a.txt',
			type: 'file',
			position: { x: 0, y: 0 },
			fileType: 'text/plain',
		};
		const ctx = {
			...minimalCtx(),
			targetItem: file,
			targetType: 'item' as const,
		};
		const { result } = renderHook(() =>
			useDesktopWorkspaceHandleAction(
				minimalHandleActionParams({
					ctx,
					openDesktopAppByComponent,
				})
			)
		);
		act(() => {
			result.current('open-in-doc-editor');
		});
		expect(openDesktopAppByComponent).toHaveBeenCalledWith('DocEditor', {
			initialPayload: { unifiedContentId: 'uc-1' },
		});
	});

	it('open-in-content-manager opens Content Manager with folder item id', () => {
		const openDesktopAppByComponent = vi.fn();
		const folder: DesktopItem = {
			id: 'folder-42',
			name: 'Project',
			type: 'folder',
			position: { x: 0, y: 0 },
		};
		const ctx = {
			...minimalCtx(),
			targetItem: folder,
			targetType: 'item' as const,
		};
		const { result } = renderHook(() =>
			useDesktopWorkspaceHandleAction(
				minimalHandleActionParams({
					ctx,
					openDesktopAppByComponent,
				})
			)
		);
		act(() => {
			result.current('open-in-content-manager');
		});
		expect(openDesktopAppByComponent).toHaveBeenCalledWith(
			'ContentManagerPro',
			{
				initialPayload: { contentManagerFolderItemId: 'folder-42' },
			}
		);
	});

	it('send-to-gaf-chat opens GAF with composer attachment payload', () => {
		const openDesktopAppByComponent = vi.fn();
		const file: DesktopItem = {
			id: 'uc-gaf',
			name: 'doc.pdf',
			type: 'file',
			position: { x: 0, y: 0 },
			fileType: 'application/pdf',
			size: 1024,
		};
		const ctx = {
			...minimalCtx(),
			targetItem: file,
			targetType: 'item' as const,
		};
		const { result } = renderHook(() =>
			useDesktopWorkspaceHandleAction(
				minimalHandleActionParams({
					ctx,
					openDesktopAppByComponent,
				})
			)
		);
		act(() => {
			result.current('send-to-gaf-chat');
		});
		expect(openDesktopAppByComponent).toHaveBeenCalledWith('GAFChatApp', {
			initialPayload: {
				gafComposerAttachmentContentId: 'uc-gaf',
				gafComposerAttachmentFileName: 'doc.pdf',
				gafComposerAttachmentMimeType: 'application/pdf',
				gafComposerAttachmentSize: 1024,
			},
		});
	});

	it('send-to-desktop-ai opens Desktop AI with attach payload', () => {
		const openDesktopAppByComponent = vi.fn();
		const file: DesktopItem = {
			id: 'uc-ai',
			name: 'note.md',
			type: 'file',
			position: { x: 0, y: 0 },
		};
		const ctx = {
			...minimalCtx(),
			targetItem: file,
			targetType: 'item' as const,
		};
		const { result } = renderHook(() =>
			useDesktopWorkspaceHandleAction(
				minimalHandleActionParams({
					ctx,
					openDesktopAppByComponent,
				})
			)
		);
		act(() => {
			result.current('send-to-desktop-ai');
		});
		expect(openDesktopAppByComponent).toHaveBeenCalledWith('DesktopAiChatApp', {
			initialPayload: {
				desktopAiAttachContentId: 'uc-ai',
				desktopAiAttachSourceLabel: 'note.md',
			},
		});
	});
});

describe('useDesktopWorkspaceKeyboardShortcuts (wave 16)', () => {
	it('forwards F5 to onWorkspaceRefresh', () => {
		const onWorkspaceRefresh = vi.fn();
		renderHook(() =>
			useDesktopWorkspaceKeyboardShortcuts(
				minimalKeyboardParams({ onWorkspaceRefresh })
			)
		);
		const ev = new KeyboardEvent('keydown', { key: 'F5', bubbles: true });
		act(() => {
			window.dispatchEvent(ev);
		});
		expect(onWorkspaceRefresh).toHaveBeenCalledTimes(1);
	});
});
