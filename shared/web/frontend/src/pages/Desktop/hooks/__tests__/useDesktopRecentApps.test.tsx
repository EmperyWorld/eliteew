import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DesktopItem } from '../../types/desktop.types';
import {
	__resetDesktopRecentAppsModuleForTests,
	useDesktopRecentApps,
} from '../useDesktopRecentApps';

const { emptyShell } = vi.hoisted(() => ({
	emptyShell: {
		recent_app_ids: [] as string[],
		recent_app_ids_by_desktop: {} as Record<string, string[]>,
		recent_file_ids: [] as string[],
		clipboard_history: [] as [],
		now_playing: null,
		gaf_chat_sound_enabled: null,
		virtual_desktops: null,
		windows_snapshot: null,
		clock_show_seconds: null,
		timezone: null,
		quiet_mode: null,
	},
}));

const scheduleShellStateMutation = vi.hoisted(() => vi.fn());
const flushShellStatePipelineNow = vi.hoisted(() =>
	vi.fn().mockResolvedValue(undefined)
);
const resetShellStatePipeline = vi.hoisted(() => vi.fn());

vi.mock(
	'../../utils/desktopShellStateMutationPipeline',
	async (importOriginal) => {
		const actual =
			await importOriginal<
				typeof import('../../utils/desktopShellStateMutationPipeline')
			>();
		return {
			...actual,
			scheduleShellStateMutation,
			flushShellStatePipelineNow,
			resetShellStatePipeline: resetShellStatePipeline.mockImplementation(
				() => {
					actual.resetShellStatePipeline();
				}
			),
		};
	}
);

vi.mock('../../services/desktopApi', async (importOriginal) => {
	const actual =
		await importOriginal<typeof import('../../services/desktopApi')>();
	return {
		...actual,
		fetchDesktopShellStateDeduplicated: vi
			.fn()
			.mockResolvedValue({ ...emptyShell }),
		patchDesktopShellStateMerged: vi.fn().mockImplementation(async (p) => ({
			...emptyShell,
			recent_app_ids: p.recent_app_ids ?? emptyShell.recent_app_ids,
			recent_app_ids_by_desktop:
				p.recent_app_ids_by_desktop ?? emptyShell.recent_app_ids_by_desktop,
			recent_file_ids: p.recent_file_ids ?? emptyShell.recent_file_ids,
			clipboard_history: p.clipboard_history ?? emptyShell.clipboard_history,
			now_playing: p.now_playing ?? emptyShell.now_playing,
			gaf_chat_sound_enabled:
				p.gaf_chat_sound_enabled ?? emptyShell.gaf_chat_sound_enabled,
		})),
	};
});

function app(id: string, name = id): DesktopItem {
	return {
		id,
		name,
		type: 'app',
		position: { x: 0, y: 0 },
		appComponent: name,
	};
}

function ensureLocalStorageForTest(): void {
	if (typeof localStorage !== 'undefined') return;
	const store = new Map<string, string>();
	const storage = {
		getItem: vi.fn((key: string) => store.get(key) ?? null),
		setItem: vi.fn((key: string, value: string) => {
			store.set(key, String(value));
		}),
		removeItem: vi.fn((key: string) => {
			store.delete(key);
		}),
		clear: vi.fn(() => {
			store.clear();
		}),
		key: vi.fn((index: number) => Array.from(store.keys())[index] ?? null),
		get length() {
			return store.size;
		},
	} satisfies Storage;
	Object.defineProperty(globalThis, 'localStorage', {
		configurable: true,
		value: storage,
	});
	if (typeof window !== 'undefined') {
		Object.defineProperty(window, 'localStorage', {
			configurable: true,
			value: storage,
		});
	}
}

describe('useDesktopRecentApps', () => {
	beforeEach(() => {
		ensureLocalStorageForTest();
		localStorage.clear();
		__resetDesktopRecentAppsModuleForTests();
		vi.clearAllMocks();
	});

	it('keeps launcher surfaces in sync and resolves recent items in MRU order', async () => {
		const first = renderHook(() => useDesktopRecentApps(3));
		const second = renderHook(() => useDesktopRecentApps(3));

		await waitFor(() => {
			expect(first.result.current.recentIds).toEqual([]);
		});

		act(() => {
			first.result.current.recordRecentApp('alpha');
		});

		await waitFor(() => {
			expect(second.result.current.recentIds).toEqual(['alpha']);
		});

		act(() => {
			second.result.current.recordRecentApp('beta');
			second.result.current.recordRecentApp('gamma');
			second.result.current.recordRecentApp('beta');
		});

		await waitFor(() => {
			expect(first.result.current.recentIds).toEqual([
				'beta',
				'gamma',
				'alpha',
			]);
		});

		expect(
			first.result.current
				.recentItems([app('alpha'), app('beta'), app('gamma')])
				.map((item) => item.id)
		).toEqual(['beta', 'gamma', 'alpha']);
	});

	it('records MRU per virtual desktop when desktopId is passed', async () => {
		const { result } = renderHook(() => useDesktopRecentApps(5));

		await waitFor(() => {
			expect(result.current.recentIds).toEqual([]);
		});

		act(() => {
			result.current.recordRecentApp('app-a', 'vd-1');
			result.current.recordRecentApp('app-b', 'vd-2');
			result.current.recordRecentApp('app-c', 'vd-1');
		});

		await waitFor(() => {
			expect(result.current.recentIdsByDesktop).toEqual({
				'vd-1': ['app-c', 'app-a'],
				'vd-2': ['app-b'],
			});
		});
		expect(result.current.recentIds[0]).toBe('app-c');
	});

	it('schedules coalesced shell patch when MRU changes', async () => {
		const { result } = renderHook(() => useDesktopRecentApps(4));

		await waitFor(() => {
			expect(result.current.recentIds).toEqual([]);
		});

		act(() => {
			result.current.recordRecentApp('app-x', 'vd-main');
		});

		await waitFor(() => {
			expect(scheduleShellStateMutation).toHaveBeenCalledWith(
				expect.objectContaining({
					source: 'mru',
					merge: expect.any(Function),
				})
			);
			const mergeFn = scheduleShellStateMutation.mock.calls.at(-1)?.[0]?.merge;
			expect(mergeFn?.({})).toEqual({
				recent_app_ids: ['app-x'],
				recent_app_ids_by_desktop: { 'vd-main': ['app-x'] },
			});
		});
	});
});
