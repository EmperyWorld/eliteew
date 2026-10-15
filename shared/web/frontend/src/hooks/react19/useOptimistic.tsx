/**
 * React 19 useOptimistic Hook Examples
 *
 * Примеры использования нового хука useOptimistic из React 19
 * для оптимистичных обновлений UI
 */

import { useOptimistic, useTransition } from 'react';

/**
 * Optimistic Todo List
 *
 * @example
 * ```tsx
 * function TodoApp() {
 *   const [todos, setTodos] = useState<Todo[]>([]);
 *   const addTodo = useOptimisticTodo(todos, setTodos);
 *
 *   return (
 *     <div>
 *       {todos.map(todo => <TodoItem key={todo.id} todo={todo} />)}
 *       <AddTodoForm onAdd={addTodo} />
 *     </div>
 *   );
 * }
 * ```
 */
export interface Todo {
	id: number;
	text: string;
	completed: boolean;
}

export function useOptimisticTodo(
	todos: Todo[],
	setTodos: (todos: Todo[] | ((prev: Todo[]) => Todo[])) => void
): {
	todos: Todo[];
	addTodo: (text: string) => Promise<void>;
	isPending: boolean;
} {
	const [optimisticTodos, addOptimisticTodo] = useOptimistic(
		todos,
		(state: Todo[], newTodo: Todo) => [...state, newTodo]
	);

	const [isPending, startTransition] = useTransition();

	async function addTodo(text: string): Promise<void> {
		const newTodo: Todo = {
			id: Date.now(),
			text,
			completed: false,
		};

		// Оптимистичное обновление - сразу показываем в UI
		addOptimisticTodo(newTodo);

		// Асинхронное сохранение на сервере
		startTransition(async () => {
			try {
				// await saveTodoToServer(newTodo);
				setTodos((prev) => [...prev, newTodo]);
			} catch (error) {
				// Откат при ошибке
				setTodos((prev) => prev.filter((t) => t.id !== newTodo.id));
				throw error;
			}
		});
	}

	return {
		todos: optimisticTodos,
		addTodo,
		isPending,
	};
}

/**
 * Optimistic Like Button
 *
 * @example
 * ```tsx
 * function LikeButton({ postId, initialLikes }: Props) {
 *   const { likes, toggleLike, isPending } = useOptimisticLike(initialLikes);
 *
 *   return (
 *     <button onClick={() => toggleLike(postId)} disabled={isPending}>
 *       ❤️ {likes}
 *     </button>
 *   );
 * }
 * ```
 */
export function useOptimisticLike(initialLikes: number): {
	likes: number;
	toggleLike: (postId: number) => Promise<void>;
	isPending: boolean;
} {
	const [optimisticLikes, updateLikes] = useOptimistic(
		initialLikes,
		(state: number, increment: number) => state + increment
	);

	const [isPending, startTransition] = useTransition();

	async function toggleLike(_postId: number): Promise<void> {
		const increment = optimisticLikes > initialLikes ? -1 : 1;

		// Оптимистичное обновление
		updateLikes(increment);

		// Асинхронное сохранение
		startTransition(async () => {
			// await likePost(_postId);
		});
	}

	return {
		likes: optimisticLikes,
		toggleLike,
		isPending,
	};
}
