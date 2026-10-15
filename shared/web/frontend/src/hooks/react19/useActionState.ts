/**
 * React 19 useActionState Hook Examples
 *
 * Примеры использования нового хука useActionState из React 19
 * для управления состоянием действий форм
 */

import { useActionState } from 'react';

/**
 * Action State для форм
 */
export interface ActionState<T = unknown> {
	success: boolean;
	message?: string;
	data?: T;
	errors?: Record<string, string[]>;
}

/**
 * Update User Form с useActionState
 *
 * @example
 * ```tsx
 * function UserProfileForm({ userId }: { userId: string }) {
 *   const { state, formAction, isPending } = useUpdateUser(userId);
 *
 *   return (
 *     <form action={formAction}>
 *       <input name="name" />
 *       {state?.errors?.name && <span>{state.errors.name[0]}</span>}
 *       {state?.success && <span>{state.message}</span>}
 *       <button disabled={isPending}>Сохранить</button>
 *     </form>
 *   );
 * }
 * ```
 */
async function updateUserAction(
	_prevState: ActionState | null,
	formData: FormData
): Promise<ActionState> {
	const name = formData.get('name') as string;
	const email = formData.get('email') as string;

	// Валидация
	const errors: Record<string, string[]> = {};
	if (!name || name.length < 2) {
		errors.name = ['Имя должно быть минимум 2 символа'];
	}
	if (!email?.includes('@')) {
		errors.email = ['Некорректный email'];
	}

	if (Object.keys(errors).length > 0) {
		return {
			success: false,
			errors,
			message: 'Ошибка валидации',
		};
	}

	try {
		// await apiClient.put(`/users/${userId}`, { name, email });
		return {
			success: true,
			message: 'Профиль обновлен',
			data: { name, email },
		};
	} catch (error) {
		return {
			success: false,
			message: error instanceof Error ? error.message : 'Ошибка обновления',
		};
	}
}

export function useUpdateUser(_userId: string) {
	const [state, formAction, isPending] = useActionState(updateUserAction, null);

	return {
		state,
		formAction,
		isPending,
	};
}

/**
 * Create Comment Form с useActionState
 */
async function createCommentAction(
	_prevState: ActionState | null,
	formData: FormData
): Promise<ActionState> {
	const text = formData.get('text') as string;
	const _postId = formData.get('postId') as string;

	if (!text || text.trim().length === 0) {
		return {
			success: false,
			errors: { text: ['Комментарий не может быть пустым'] },
		};
	}

	try {
		// await apiClient.post(`/posts/${_postId}/comments`, { text });
		return {
			success: true,
			message: 'Комментарий добавлен',
		};
	} catch (_error) {
		return {
			success: false,
			message: 'Ошибка добавления комментария',
		};
	}
}

export function useCreateComment() {
	const [state, formAction, isPending] = useActionState(
		createCommentAction,
		null
	);

	return {
		state,
		formAction,
		isPending,
	};
}

/**
 * Search Form с useActionState
 */
async function searchAction(
	_prevState: ActionState<{ results: unknown[] }> | null,
	formData: FormData
): Promise<ActionState<{ results: unknown[] }>> {
	const query = formData.get('query') as string;

	if (!query || query.trim().length < 2) {
		return {
			success: false,
			message: 'Минимум 2 символа для поиска',
			data: { results: [] },
		};
	}

	try {
		// const results = await apiClient.get(`/search?q=${query}`);
		return {
			success: true,
			data: { results: [] },
		};
	} catch (_error) {
		return {
			success: false,
			message: 'Ошибка поиска',
			data: { results: [] },
		};
	}
}

export function useSearch() {
	const [state, formAction, isPending] = useActionState(searchAction, null);

	return {
		state,
		formAction,
		isPending,
	};
}
