/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * DB-backed widget notes/todos, dashboard favorites, and transactional widget-sync batch API.
 *
 * Invariants:
 * - `syncDesktopWidgets` throws on non-2xx so client outbox is retained for retry.
 *
 * Related:
 * - `hooks/useWidgetNotesTodos.ts`
 * - `hooks/useDashboardFavorites.ts`
 * - `utils/desktopWidgetOutboxQueue.ts`
 */

import { api } from '../../../../services/api/client';
import { API_PATH, DESKTOP_API_OPTIONS } from './constants';
import type {
	DashboardFavoriteCreate,
	DashboardFavoriteResponse,
	DesktopWidgetSyncResponse,
	DesktopWidgetSyncOp,
	Position,
	WidgetNoteResponse,
	WidgetTodoResponse,
} from './types';

export async function getWidgetNotes(): Promise<WidgetNoteResponse[]> {
	return api.get<WidgetNoteResponse[]>(
		`${API_PATH}/widget-notes`,
		DESKTOP_API_OPTIONS
	);
}

export async function createWidgetNote(data: {
	content?: string;
	color?: string;
	position?: Position;
	tags?: string[];
}): Promise<WidgetNoteResponse> {
	return api.post<WidgetNoteResponse>(
		`${API_PATH}/widget-notes`,
		data,
		DESKTOP_API_OPTIONS
	);
}

export async function updateWidgetNote(
	noteId: string,
	data: Partial<{
		content: string;
		color: string;
		position: Position;
		tags: string[];
	}>
): Promise<WidgetNoteResponse> {
	return api.patch<WidgetNoteResponse>(
		`${API_PATH}/widget-notes/${noteId}`,
		data,
		DESKTOP_API_OPTIONS
	);
}

export async function deleteWidgetNote(noteId: string): Promise<void> {
	await api.delete(`${API_PATH}/widget-notes/${noteId}`, DESKTOP_API_OPTIONS);
}

export async function getWidgetTodos(): Promise<WidgetTodoResponse[]> {
	return api.get<WidgetTodoResponse[]>(
		`${API_PATH}/widget-todos`,
		DESKTOP_API_OPTIONS
	);
}

export async function createWidgetTodo(data: {
	text: string;
	completed?: boolean;
	priority?: string;
	tags?: string[];
}): Promise<WidgetTodoResponse> {
	return api.post<WidgetTodoResponse>(
		`${API_PATH}/widget-todos`,
		data,
		DESKTOP_API_OPTIONS
	);
}

export async function updateWidgetTodo(
	todoId: string,
	data: Partial<{
		text: string;
		completed: boolean;
		priority: string;
		tags: string[];
	}>
): Promise<WidgetTodoResponse> {
	return api.patch<WidgetTodoResponse>(
		`${API_PATH}/widget-todos/${todoId}`,
		data,
		DESKTOP_API_OPTIONS
	);
}

export async function deleteWidgetTodo(todoId: string): Promise<void> {
	await api.delete(`${API_PATH}/widget-todos/${todoId}`, DESKTOP_API_OPTIONS);
}

export async function getDashboardFavorites(): Promise<
	DashboardFavoriteResponse[]
> {
	return api.get<DashboardFavoriteResponse[]>(
		`${API_PATH}/favorites`,
		DESKTOP_API_OPTIONS
	);
}

export async function createDashboardFavorite(
	data: DashboardFavoriteCreate
): Promise<DashboardFavoriteResponse> {
	return api.post<DashboardFavoriteResponse>(
		`${API_PATH}/favorites`,
		data,
		DESKTOP_API_OPTIONS
	);
}

export async function deleteDashboardFavorite(
	favoriteId: string
): Promise<void> {
	return api.delete(`${API_PATH}/favorites/${favoriteId}`, DESKTOP_API_OPTIONS);
}

export async function reorderDashboardFavorites(
	favoriteIds: string[]
): Promise<void> {
	await api.patch(
		`${API_PATH}/favorites/reorder`,
		{ favorite_ids: favoriteIds },
		DESKTOP_API_OPTIONS
	);
}

/**
 * POST /desktop/widget-sync — one Postgres transaction + Redis Idempotency-Key.
 * Throws on non-2xx (including network abort) so the client outbox is retained.
 */
export async function syncDesktopWidgets(
	body: { ops: DesktopWidgetSyncOp[] },
	idempotencyKey: string
): Promise<DesktopWidgetSyncResponse> {
	return api.post<DesktopWidgetSyncResponse>(`${API_PATH}/widget-sync`, body, {
		...DESKTOP_API_OPTIONS,
		headers: {
			'Idempotency-Key': idempotencyKey,
		},
	});
}
