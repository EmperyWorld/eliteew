/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Behavioral tests for widget notes/todos hooks (API path + local fallback).
 *
 * Invariants:
 * - API failure enables localStorage mode with `isLocalOnly`.
 *
 * Related:
 * - `pages/Desktop/hooks/useWidgetNotesTodos.ts`
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEYS } from '../../constants';
import { useWidgetNotes, useWidgetTodos } from '../useWidgetNotesTodos';

const getWidgetNotes = vi.hoisted(() => vi.fn());
const createWidgetNote = vi.hoisted(() => vi.fn());
const updateWidgetNote = vi.hoisted(() => vi.fn());
const deleteWidgetNote = vi.hoisted(() => vi.fn());
const getWidgetTodos = vi.hoisted(() => vi.fn());
const createWidgetTodo = vi.hoisted(() => vi.fn());
const updateWidgetTodo = vi.hoisted(() => vi.fn());
const deleteWidgetTodo = vi.hoisted(() => vi.fn());

vi.mock('../../services/desktopApi', () => ({
	getWidgetNotes,
	createWidgetNote,
	updateWidgetNote,
	deleteWidgetNote,
	getWidgetTodos,
	createWidgetTodo,
	updateWidgetTodo,
	deleteWidgetTodo,
}));

vi.mock('../../../../contexts/AuthContext', () => ({
	useAuth: () => ({ user: { id: 'test-user-wave-b' } }),
}));

let queryClient: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
	return (
		<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
	);
}

function ensureLocalStorageForTest(): void {
	const canUseNative =
		typeof localStorage !== 'undefined' &&
		typeof localStorage.setItem === 'function';
	if (canUseNative) {
		try {
			localStorage.setItem('__widget_notes_test__', '1');
			localStorage.removeItem('__widget_notes_test__');
			return;
		} catch {
			// broken jsdom/localstorage-file — install in-memory polyfill below
		}
	}
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

describe('useWidgetNotes', () => {
	beforeEach(() => {
		ensureLocalStorageForTest();
		localStorage.clear();
		queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		getWidgetNotes.mockReset();
		createWidgetNote.mockReset();
		updateWidgetNote.mockReset();
		deleteWidgetNote.mockReset();
	});

	it('loads notes from API', async () => {
		getWidgetNotes.mockResolvedValue([
			{
				id: 'n1',
				content: 'Hello',
				color: 'yellow',
				position: { x: 0, y: 0 },
				created_at: '2026-06-30T08:00:00.000Z',
			},
		]);

		const { result } = renderHook(() => useWidgetNotes(), { wrapper });

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false);
		});

		expect(result.current.notes).toHaveLength(1);
		expect(result.current.notes[0]?.content).toBe('Hello');
		expect(result.current.isLocalOnly).toBe(false);
	});

	it('falls back to localStorage when API fails', async () => {
		localStorage.setItem(
			STORAGE_KEYS.WIDGET_NOTES,
			JSON.stringify([
				{
					id: 'local-note',
					content: 'Offline note',
					color: 'blue',
					position: { x: 0, y: 0 },
					createdAt: '2026-06-30T08:00:00.000Z',
				},
			])
		);
		getWidgetNotes.mockRejectedValue(new Error('offline'));

		const { result } = renderHook(() => useWidgetNotes(), { wrapper });

		await waitFor(
			() => {
				expect(result.current.isLocalOnly).toBe(true);
			},
			{ timeout: 3000 }
		);

		expect(result.current.notes).toHaveLength(1);
		expect(result.current.notes[0]?.content).toBe('Offline note');
	});

	it('uses empty list when API fails and storage is empty', async () => {
		getWidgetNotes.mockRejectedValue(new Error('offline'));

		const { result } = renderHook(() => useWidgetNotes(), { wrapper });

		await waitFor(
			() => {
				expect(result.current.isLocalOnly).toBe(true);
			},
			{ timeout: 3000 }
		);

		expect(result.current.notes).toHaveLength(0);
	});
});

describe('useWidgetTodos', () => {
	beforeEach(() => {
		ensureLocalStorageForTest();
		localStorage.clear();
		queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		getWidgetTodos.mockReset();
		createWidgetTodo.mockReset();
		updateWidgetTodo.mockReset();
		deleteWidgetTodo.mockReset();
	});

	it('falls back to localStorage when API fails', async () => {
		localStorage.setItem(
			STORAGE_KEYS.WIDGET_TODOS,
			JSON.stringify([
				{
					id: 'local-todo',
					text: 'Offline task',
					completed: false,
					priority: 'medium',
					tags: [],
					createdAt: '2026-06-30T08:00:00.000Z',
				},
			])
		);
		getWidgetTodos.mockRejectedValue(new Error('offline'));

		const { result } = renderHook(() => useWidgetTodos(), { wrapper });

		await waitFor(
			() => {
				expect(result.current.isLocalOnly).toBe(true);
			},
			{ timeout: 3000 }
		);

		expect(result.current.todos).toHaveLength(1);
		expect(result.current.todos[0]?.text).toBe('Offline task');
	});
});
