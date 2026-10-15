import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DesktopItem, WindowState } from '../../types/desktop.types';
import { useDesktopExpansionSettings } from '../useDesktopExpansionSettings';
import * as desktopSnapGeometry from '../../utils/desktopSnapGeometry';

const shellState = vi.hoisted(() => ({
	current: {
		workspace_profiles: {
			profiles: [
				{
					id: 'workspace-1',
					name: 'Creative',
					appIds: ['app-docs'],
					folderItemIds: ['projects'],
					widgetIds: ['notes'],
				},
			],
		},
		window_layout_presets: [],
		widgets_layout: null,
		app_collections: [],
		content_shortcuts: [],
		assistant_context_actions: [],
	} as Record<string, unknown>,
	patches: [] as Record<string, unknown>[],
}));

const toastInfo = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());

const pipelineSnapshot = vi.hoisted(() => ({
	phase: 'idle' as
		| 'idle'
		| 'conflict'
		| 'debouncing'
		| 'flushing'
		| 'recovering',
	lastConflict: null as { message: string } | null,
}));

const pipelineListeners = vi.hoisted(() => {
	const listeners = new Set<(snapshot: typeof pipelineSnapshot) => void>();
	return {
		listeners,
		emit() {
			for (const listener of listeners) {
				listener(pipelineSnapshot);
			}
		},
	};
});

vi.mock('sonner', () => ({
	toast: {
		info: toastInfo,
		error: toastError,
	},
}));

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, opts?: { count?: number }) =>
			typeof opts?.count === 'number' ? `${key}:${opts.count}` : key,
	}),
}));

vi.mock('../../services/desktopApi', () => ({
	fetchDesktopShellStateDeduplicated: vi.fn(async () => shellState.current),
	isDesktopShellStateConflictError: vi.fn(
		(error: unknown) =>
			(error as { name?: string })?.name === 'DesktopShellStateConflictError'
	),
	isDesktopShellStateConflictMessage: vi.fn(
		(message: string | null | undefined) =>
			typeof message === 'string' && message.includes('conflict')
	),
}));

const scheduleShellStateMutation = vi.hoisted(() =>
	vi.fn((options: { source: string; merge: () => Record<string, unknown> }) => {
		const patch = options.merge();
		shellState.patches.push(patch);
		shellState.current = { ...shellState.current, ...patch };
	})
);

const flushShellStatePipelineNow = vi.hoisted(() =>
	vi.fn(async () => shellState.current)
);

vi.mock('../../utils/desktopShellStateMutationPipeline', () => ({
	scheduleShellStateMutation,
	flushShellStatePipelineNow,
	subscribeShellStatePipeline: vi.fn((listener) => {
		pipelineListeners.listeners.add(listener);
		listener(pipelineSnapshot);
		return () => {
			pipelineListeners.listeners.delete(listener);
		};
	}),
	setShellStatePipelineFlushFailureHook: vi.fn(),
}));

function app(id: string): DesktopItem {
	return {
		id,
		name: id,
		type: 'app',
		position: { x: 20, y: 20 },
	};
}

function appWithComponent(id: string, appComponent: string): DesktopItem {
	return {
		...app(id),
		appComponent,
	};
}

const folder: DesktopItem = {
	id: 'projects',
	name: 'Projects',
	type: 'folder',
	position: { x: 20, y: 120 },
};

const windowState: WindowState = {
	id: 'w-1',
	title: 'Docs',
	type: 'app',
	position: { x: 40, y: 40 },
	size: { width: 900, height: 600 },
	isMinimized: false,
	isMaximized: false,
	zIndex: 4,
	path: [],
	appComponent: 'DocEditor',
	folderId: 'app-docs',
};

/** Выше z-index — первая зона при раскладке «две колонки». */
const windowStateFront: WindowState = {
	...windowState,
	id: 'w-2',
	title: 'Chat',
	zIndex: 10,
	appComponent: 'GAFChatApp',
	folderId: 'gaf-item',
};

describe('useDesktopExpansionSettings', () => {
	beforeEach(() => {
		toastInfo.mockClear();
		toastError.mockClear();
		scheduleShellStateMutation.mockClear();
		flushShellStatePipelineNow.mockClear();
		flushShellStatePipelineNow.mockImplementation(
			async () => shellState.current
		);
		scheduleShellStateMutation.mockImplementation(
			(options: { merge: () => Record<string, unknown> }) => {
				const patch = options.merge();
				shellState.patches.push(patch);
				shellState.current = { ...shellState.current, ...patch };
			}
		);
		pipelineSnapshot.phase = 'idle';
		pipelineSnapshot.lastConflict = null;
		shellState.current = {
			workspace_profiles: {
				profiles: [
					{
						id: 'workspace-1',
						name: 'Creative',
						appIds: ['app-docs'],
						folderItemIds: ['projects'],
						widgetIds: ['notes'],
					},
				],
			},
			window_layout_presets: [],
			widgets_layout: null,
			app_collections: [],
			content_shortcuts: [],
			assistant_context_actions: [],
		};
		shellState.patches = [];
	});

	it('hydrates expansion settings from shell-state and exposes storage map', async () => {
		const { result } = renderHook(() =>
			useDesktopExpansionSettings({
				items: [folder],
				installedApps: [app('app-docs')],
				currentDesktopWindows: [windowState],
				activeDesktopId: 'desktop-1',
			})
		);

		await waitFor(() => expect(result.current.isLoading).toBe(false));

		expect(result.current.storageMap.map((row) => row.id)).toContain(
			'shell-state'
		);
		expect(result.current.workspaceProfiles).toHaveLength(1);
		const shellRow = result.current.storageMap.find(
			(r) => r.id === 'shell-state'
		);
		expect(shellRow?.fields).toContain('ewa_hints');
		expect(shellRow?.fields.length).toBeGreaterThanOrEqual(20);
		expect(result.current.savedSessionSnapshotWindowCount).toBe(0);
		expect(result.current.widgetsLayout.slots.map((slot) => slot.id)).toContain(
			'notes'
		);
	});

	it('hydrates visual style presets from shell-state', async () => {
		shellState.current = {
			...shellState.current,
			visual_style_presets: [
				{
					id: 'vp-1',
					name: 'Ocean',
					theme: 'dark',
					accentFollows: false,
					wallpaperIndex: 2,
					windowStyle: 'glass',
					taskbarStyle: 'glass',
					iconStyle: 'glass',
					widgetsStyle: 'glass',
				},
			],
		};
		const { result } = renderHook(() =>
			useDesktopExpansionSettings({
				items: [folder],
				installedApps: [app('app-docs')],
				currentDesktopWindows: [],
				activeDesktopId: 'desktop-1',
			})
		);
		await waitFor(() => expect(result.current.isLoading).toBe(false));
		expect(result.current.visualStylePresets).toHaveLength(1);
		expect(result.current.visualStylePresets[0]).toMatchObject({
			id: 'vp-1',
			name: 'Ocean',
			wallpaperIndex: 2,
		});
	});

	it('persists workspace, layout, widget, app, content, and assistant updates', async () => {
		const onApplyWindowLayoutPreset = vi.fn();
		const onCollectCurrentWorkspaceWindows = vi.fn();
		const { result } = renderHook(() =>
			useDesktopExpansionSettings({
				items: [folder],
				installedApps: [app('app-docs'), app('app-gaf')],
				currentDesktopWindows: [windowState],
				activeDesktopId: 'desktop-1',
				onApplyWindowLayoutPreset,
				onCollectCurrentWorkspaceWindows,
			})
		);

		await waitFor(() => expect(result.current.isLoading).toBe(false));

		await act(async () => {
			await result.current.addWorkspaceProfile();
			await result.current.addWindowLayoutPreset();
			await result.current.toggleWidgetSlot('notes');
			await result.current.addAppCollection();
			await result.current.addContentShortcut();
			await result.current.toggleAssistantAction('send-to-gaf');
		});

		expect(scheduleShellStateMutation).toHaveBeenCalled();
		expect(
			scheduleShellStateMutation.mock.calls.some(
				([options]) => options.source === 'expansion'
			)
		).toBe(true);
		expect(shellState.patches.some((p) => 'workspace_profiles' in p)).toBe(
			true
		);
		expect(shellState.patches.some((p) => 'window_layout_presets' in p)).toBe(
			true
		);
		expect(shellState.patches.some((p) => 'widgets_layout' in p)).toBe(true);
		expect(shellState.patches.some((p) => 'app_collections' in p)).toBe(true);
		expect(shellState.patches.some((p) => 'content_shortcuts' in p)).toBe(true);
		expect(
			shellState.patches.some((p) => 'assistant_context_actions' in p)
		).toBe(true);

		const createdPreset = result.current.windowLayoutPresets[0];
		expect(createdPreset?.windows[0]?.appComponent).toBe('DocEditor');

		act(() => {
			if (createdPreset) {
				result.current.applyWindowLayoutPreset(createdPreset.id);
			}
			result.current.collectCurrentWorkspaceWindows();
		});

		expect(onApplyWindowLayoutPreset).toHaveBeenCalledWith(createdPreset);
		expect(onCollectCurrentWorkspaceWindows).toHaveBeenCalledOnce();

		await act(async () => {
			await result.current.removeWindowLayoutPreset(createdPreset?.id ?? '');
			await result.current.toggleWidgetSlotMode('notes');
			await result.current.removeAppCollection(
				result.current.appCollections[0]?.id ?? ''
			);
			await result.current.removeContentShortcut(
				result.current.contentShortcuts[0]?.id ?? ''
			);
		});

		expect(result.current.windowLayoutPresets).toHaveLength(0);
	});

	it('adds workspace profile from template when matching apps are installed', async () => {
		const { result } = renderHook(() =>
			useDesktopExpansionSettings({
				items: [folder],
				installedApps: [appWithComponent('gaf-item', 'GAFChatApp')],
				currentDesktopWindows: [],
				activeDesktopId: 'desktop-1',
			})
		);

		await waitFor(() => expect(result.current.isLoading).toBe(false));
		const n = result.current.workspaceProfiles.length;
		await act(async () => {
			await result.current.addWorkspaceProfileFromTemplate('communication');
		});
		expect(toastInfo).not.toHaveBeenCalled();
		expect(result.current.workspaceProfiles).toHaveLength(n + 1);
		const created = result.current.workspaceProfiles.at(-1);
		expect(created?.appIds).toContain('gaf-item');
		expect(shellState.patches.some((p) => 'workspace_profiles' in p)).toBe(
			true
		);
	});

	it('toasts when template has no installed apps', async () => {
		const { result } = renderHook(() =>
			useDesktopExpansionSettings({
				items: [],
				installedApps: [],
				currentDesktopWindows: [],
				activeDesktopId: 'desktop-1',
			})
		);
		await waitFor(() => expect(result.current.isLoading).toBe(false));
		await act(async () => {
			await result.current.addWorkspaceProfileFromTemplate('communication');
		});
		expect(toastInfo).toHaveBeenCalledWith(
			'settingsPanel.expansionWorkspaceTemplateEmpty'
		);
	});

	it('adds workspace profile from open windows using window folderId', async () => {
		const { result } = renderHook(() =>
			useDesktopExpansionSettings({
				items: [folder],
				installedApps: [app('app-docs')],
				currentDesktopWindows: [windowState],
				activeDesktopId: 'desktop-1',
			})
		);
		await waitFor(() => expect(result.current.isLoading).toBe(false));
		const n = result.current.workspaceProfiles.length;
		await act(async () => {
			await result.current.addWorkspaceProfileFromOpenWindows();
		});
		expect(toastInfo).not.toHaveBeenCalled();
		expect(result.current.workspaceProfiles).toHaveLength(n + 1);
		const created = result.current.workspaceProfiles.at(-1);
		expect(created?.appIds).toContain('app-docs');
	});

	it('toasts when capturing open windows finds nothing', async () => {
		const { result } = renderHook(() =>
			useDesktopExpansionSettings({
				items: [],
				installedApps: [],
				currentDesktopWindows: [],
				activeDesktopId: 'desktop-1',
			})
		);
		await waitFor(() => expect(result.current.isLoading).toBe(false));
		await act(async () => {
			await result.current.addWorkspaceProfileFromOpenWindows();
		});
		expect(toastInfo).toHaveBeenCalledWith(
			'settingsPanel.expansionWorkspaceCaptureEmpty'
		);
	});

	const minimalPersisted = {
		folderId: 'app-docs',
		path: [] as string[],
		appComponent: 'DocEditor' as string | undefined,
		title: 'Docs',
		type: 'app' as const,
		position: { x: 0, y: 0 },
		size: { width: 400, height: 300 },
		isMinimized: false,
		isMaximized: false,
		zIndex: 1,
		desktopId: 'desktop-1',
	};

	it('hydrates saved session snapshot window count from shell-state', async () => {
		shellState.current = {
			...shellState.current,
			windows_snapshot: {
				windows: [minimalPersisted, { ...minimalPersisted }],
			},
		};
		const { result } = renderHook(() =>
			useDesktopExpansionSettings({
				items: [folder],
				installedApps: [app('app-docs')],
				currentDesktopWindows: [],
				activeDesktopId: 'desktop-1',
			})
		);
		await waitFor(() => expect(result.current.isLoading).toBe(false));
		expect(result.current.savedSessionSnapshotWindowCount).toBe(2);
	});

	it('adds workspace profile from saved windows snapshot', async () => {
		shellState.current = {
			...shellState.current,
			windows_snapshot: { windows: [minimalPersisted] },
		};
		const { result } = renderHook(() =>
			useDesktopExpansionSettings({
				items: [folder],
				installedApps: [app('app-docs')],
				currentDesktopWindows: [],
				activeDesktopId: 'desktop-1',
			})
		);
		await waitFor(() => expect(result.current.isLoading).toBe(false));
		const n = result.current.workspaceProfiles.length;
		await act(async () => {
			await result.current.addWorkspaceProfileFromSessionSnapshot();
		});
		expect(toastInfo).not.toHaveBeenCalled();
		expect(result.current.workspaceProfiles).toHaveLength(n + 1);
		const created = result.current.workspaceProfiles.at(-1);
		expect(created?.appIds).toContain('app-docs');
	});

	it('toasts when saved snapshot has no matching desktop items', async () => {
		shellState.current = {
			...shellState.current,
			windows_snapshot: {
				windows: [{ ...minimalPersisted, folderId: 'missing' }],
			},
		};
		const { result } = renderHook(() =>
			useDesktopExpansionSettings({
				items: [folder],
				installedApps: [app('app-docs')],
				currentDesktopWindows: [],
				activeDesktopId: 'desktop-1',
			})
		);
		await waitFor(() => expect(result.current.isLoading).toBe(false));
		await act(async () => {
			await result.current.addWorkspaceProfileFromSessionSnapshot();
		});
		expect(toastInfo).toHaveBeenCalledWith(
			'settingsPanel.expansionWorkspaceSnapshotEmpty'
		);
	});

	it('patches workspace profile metadata', async () => {
		const { result } = renderHook(() =>
			useDesktopExpansionSettings({
				items: [folder],
				installedApps: [app('app-docs')],
				currentDesktopWindows: [],
				activeDesktopId: 'desktop-1',
			})
		);
		await waitFor(() => expect(result.current.isLoading).toBe(false));
		await act(async () => {
			await result.current.patchWorkspaceProfile('workspace-1', {
				name: 'Renamed',
				description: 'Hello',
				desktopId: 'vd-9',
				wallpaper: 'https://example.com/w.jpg',
			});
		});
		const p = result.current.workspaceProfiles[0];
		expect(p?.name).toBe('Renamed');
		expect(p?.description).toBe('Hello');
		expect(p?.desktopId).toBe('vd-9');
		expect(p?.wallpaper).toBe('https://example.com/w.jpg');
		expect(
			shellState.patches.some(
				(x) =>
					(x as { workspace_profiles?: { profiles: { id: string }[] } })
						.workspace_profiles?.profiles?.[0]?.id === 'workspace-1'
			)
		).toBe(true);
	});

	it('delegates applyCuratedWorkspaceLayout to onApplyCuratedWorkspaceLayout', async () => {
		const onApplyCuratedWorkspaceLayout = vi.fn();
		const { result } = renderHook(() =>
			useDesktopExpansionSettings({
				items: [folder],
				installedApps: [app('app-docs')],
				currentDesktopWindows: [],
				activeDesktopId: 'desktop-1',
				onApplyCuratedWorkspaceLayout,
			})
		);
		await waitFor(() => expect(result.current.isLoading).toBe(false));
		act(() => {
			result.current.applyCuratedWorkspaceLayout('gridQuarters');
		});
		expect(onApplyCuratedWorkspaceLayout).toHaveBeenCalledWith('gridQuarters');
	});

	it('addWindowLayoutPresetFromCuratedTemplate persists snap geometry for two windows', async () => {
		const spy = vi
			.spyOn(desktopSnapGeometry, 'readDesktopWorkArea')
			.mockReturnValue({
				offsetLeft: 0,
				offsetTop: 0,
				width: 1200,
				height: 800,
				layoutScale: 1,
			});
		try {
			const { result } = renderHook(() =>
				useDesktopExpansionSettings({
					items: [folder],
					installedApps: [
						appWithComponent('app-docs', 'DocEditor'),
						appWithComponent('gaf-item', 'GAFChatApp'),
					],
					currentDesktopWindows: [windowState, windowStateFront],
					activeDesktopId: 'desktop-1',
				})
			);
			await waitFor(() => expect(result.current.isLoading).toBe(false));
			await act(async () => {
				await result.current.addWindowLayoutPresetFromCuratedTemplate(
					'halfHorizontal'
				);
			});
			const preset = result.current.windowLayoutPresets[0];
			expect(preset?.windows).toHaveLength(2);
			expect(preset?.windows[0]?.appComponent).toBe('GAFChatApp');
			expect(preset?.windows[0]?.position).toEqual({ x: 0, y: 0 });
			expect(preset?.windows[0]?.size.width).toBe(600);
			expect(preset?.windows[1]?.appComponent).toBe('DocEditor');
			expect(preset?.windows[1]?.position.x).toBe(600);
			expect(preset?.windows[1]?.size.width).toBe(600);
		} finally {
			spy.mockRestore();
		}
	});

	it('addAppCollectionFromTemplate adds collection when template apps are installed', async () => {
		const { result } = renderHook(() =>
			useDesktopExpansionSettings({
				items: [folder],
				installedApps: [
					appWithComponent('clip', 'ClipboardManager'),
					appWithComponent('cm', 'ContentManagerPro'),
					appWithComponent('dai', 'DesktopAiChatApp'),
				],
				currentDesktopWindows: [],
				activeDesktopId: 'desktop-1',
			})
		);
		await waitFor(() => expect(result.current.isLoading).toBe(false));
		await act(async () => {
			await result.current.addAppCollectionFromTemplate('myTools');
		});
		const c = result.current.appCollections[0];
		expect(c?.appIds).toEqual(['clip', 'cm', 'dai']);
		expect(c?.name).toBe(
			'settingsPanel.expansionAppCollectionTemplate.myTools.name'
		);
		expect(
			shellState.patches.some((p) =>
				Array.isArray(
					(p as { app_collections?: { appIds: string[] }[] }).app_collections
				)
			)
		).toBe(true);
	});

	it('toasts when app collection template matches no installed apps', async () => {
		const { result } = renderHook(() =>
			useDesktopExpansionSettings({
				items: [folder],
				installedApps: [appWithComponent('x', 'UnknownApp')],
				currentDesktopWindows: [],
				activeDesktopId: 'desktop-1',
			})
		);
		await waitFor(() => expect(result.current.isLoading).toBe(false));
		await act(async () => {
			await result.current.addAppCollectionFromTemplate('myTools');
		});
		expect(toastInfo).toHaveBeenCalledWith(
			'settingsPanel.expansionAppCollectionTemplateEmpty'
		);
		expect(result.current.appCollections).toHaveLength(0);
	});

	it('sets error without toast when expansion patch fails (banner-only dedupe)', async () => {
		flushShellStatePipelineNow.mockRejectedValueOnce(new Error('network down'));
		const { result } = renderHook(() =>
			useDesktopExpansionSettings({
				items: [folder],
				installedApps: [app('app-docs')],
				currentDesktopWindows: [],
				activeDesktopId: 'desktop-1',
			})
		);
		await waitFor(() => expect(result.current.isLoading).toBe(false));
		await act(async () => {
			await result.current.addWorkspaceProfile();
		});
		expect(result.current.error).toBe('network down');
		expect(toastError).not.toHaveBeenCalled();
	});

	it('derives conflict error from pipeline snapshot subscription', async () => {
		const { result } = renderHook(() =>
			useDesktopExpansionSettings({
				items: [folder],
				installedApps: [app('app-docs')],
				currentDesktopWindows: [],
				activeDesktopId: 'desktop-1',
			})
		);
		await waitFor(() => expect(result.current.isLoading).toBe(false));

		await act(async () => {
			pipelineSnapshot.phase = 'conflict';
			pipelineSnapshot.lastConflict = { message: 'shell_state conflict stale' };
			pipelineListeners.emit();
		});

		expect(result.current.error).toBe('shell_state conflict stale');
	});
});
