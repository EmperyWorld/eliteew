/**
 * Widget Hooks with React Query
 * Provides caching and state management for floating widgets
 */

import {
	useQuery,
	useMutation,
	useQueryClient,
	type UseQueryResult,
	type UseMutationResult,
} from '@tanstack/react-query';
import {
	floatingWidgetsService,
	type FloatingWidget,
} from '../services/api/floatingWidgetsService';

/**
 * Hook for fetching user widgets with caching
 */
export function useWidgets(): UseQueryResult<FloatingWidget[], Error> {
	return useQuery({
		queryKey: ['floating-widgets'],
		queryFn: () => floatingWidgetsService.getUserWidgets(),
		staleTime: 2 * 60 * 1000, // 2 минуты
		gcTime: 10 * 60 * 1000, // 10 минут в кеше (было cacheTime)
		retry: 2,
		refetchOnWindowFocus: false,
	});
}

/**
 * Hook for updating a widget
 */
export function useUpdateWidget(): UseMutationResult<
	FloatingWidget,
	Error,
	{ id: string; updates: Partial<FloatingWidget> }
> {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({
			id,
			updates,
		}: {
			id: string;
			updates: Partial<FloatingWidget>;
		}) => floatingWidgetsService.updateWidget(id, updates),
		onSuccess: (updatedWidget) => {
			// Обновить кеш
			queryClient.setQueryData<FloatingWidget[]>(['floating-widgets'], (old) =>
				old?.map((w) => (w.id === updatedWidget.id ? updatedWidget : w))
			);
		},
	});
}

/**
 * Hook for deleting a widget
 */
export function useDeleteWidget(): UseMutationResult<void, Error, string> {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (id: string) => floatingWidgetsService.deleteWidget(id),
		onSuccess: (_, deletedId) => {
			// Удалить из кеша
			queryClient.setQueryData<FloatingWidget[]>(
				['floating-widgets'],
				(old) => old?.filter((w) => w.id !== deletedId) || []
			);
		},
	});
}

/**
 * Hook for creating a widget from template
 */
export function useCreateWidgetFromTemplate(): UseMutationResult<
	FloatingWidget,
	Error,
	Parameters<typeof floatingWidgetsService.createWidgetFromTemplate>[0]
> {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (
			request: Parameters<
				typeof floatingWidgetsService.createWidgetFromTemplate
			>[0]
		) => floatingWidgetsService.createWidgetFromTemplate(request),
		onSuccess: () => {
			// Инвалидировать кеш для перезагрузки
			queryClient.invalidateQueries({ queryKey: ['floating-widgets'] });
		},
	});
}
