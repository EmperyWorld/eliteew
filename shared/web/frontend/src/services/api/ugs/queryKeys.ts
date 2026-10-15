import type { QueryKey } from '@tanstack/react-query';

export interface UgsTasksQueryFilters {
	status?: string;
	limit?: number;
	offset?: number;
	/** Lightweight rows when Hub polls during an open SSE stream */
	compact?: boolean;
	/** Infinite-query marker (distinct React Query key from offset pagination) */
	infinite?: boolean;
}

function normalizeTaskStatus(status?: string): string | undefined {
	if (!status || status === 'all') {
		return undefined;
	}
	return status;
}

export const ugsQueryKeys = {
	all: ['ugs'] as const,
	tasks: (filters: UgsTasksQueryFilters = {}): QueryKey => [
		'ugs',
		'tasks',
		{
			status: normalizeTaskStatus(filters.status),
			limit: filters.limit ?? 150,
			offset: filters.offset ?? 0,
			compact: filters.compact === true,
			infinite: filters.infinite === true,
		},
	],
	taskStatus: (requestId: string | undefined): QueryKey => [
		'ugs',
		'status',
		requestId,
	],
	taskResult: (requestId: string | undefined): QueryKey => [
		'ugs',
		'result',
		requestId,
	],
	stats: (): QueryKey => ['ugs', 'stats'],
	metrics: (): QueryKey => ['ugs', 'metrics'],
	analytics: (): QueryKey => ['ugs', 'analytics'],
	types: (): QueryKey => ['ugs', 'types'],
	providers: (): QueryKey => ['ugs', 'providers'],
	workflows: (): QueryKey => ['ugs', 'workflows'],
	workflowExecutions: (workflowId: string, limit = 5): QueryKey => [
		'ugs',
		'workflow',
		workflowId,
		'executions',
		{ limit },
	],
};

export function hasUgsQueryKeyPrefix(
	queryKey: readonly unknown[],
	prefix: readonly unknown[]
): boolean {
	if (queryKey.length < prefix.length) {
		return false;
	}

	return prefix.every((segment, index) => queryKey[index] === segment);
}
