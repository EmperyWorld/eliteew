import { useCallback, useEffect, useRef, useState } from 'react';

export type QueuedTaskStatus =
	| 'queued'
	| 'pending'
	| 'processing'
	| 'retrying'
	| 'completed'
	| 'failed'
	| 'cancelled';

export interface QueuedTaskState<T = unknown> {
	id: string | null;
	status: QueuedTaskStatus | null;
	progress: number | null;
	result: T | null;
	error: string | null;
}

const TERMINAL_STATUSES: QueuedTaskStatus[] = [
	'completed',
	'failed',
	'cancelled',
];

interface UseQueuedTaskOptions<TStatusPayload, TResult> {
	restoreKey?: string;
	pollIntervalMs?: number;
	getTaskId: (payload: TStatusPayload) => string;
	getStatus: (payload: TStatusPayload) => QueuedTaskStatus;
	getProgress?: (payload: TStatusPayload) => number | null;
	getError?: (payload: TStatusPayload) => string | null;
	getResult?: (payload: TStatusPayload) => TResult | null;
	fetchStatus: (id: string) => Promise<TStatusPayload>;
}

export function useQueuedTask<TStatusPayload, TResult = unknown>(
	options: UseQueuedTaskOptions<TStatusPayload, TResult>
) {
	const {
		restoreKey,
		pollIntervalMs = 2500,
		getTaskId,
		getStatus,
		getProgress,
		getError,
		getResult,
		fetchStatus,
	} = options;
	const [state, setState] = useState<QueuedTaskState<TResult>>({
		id: null,
		status: null,
		progress: null,
		result: null,
		error: null,
	});
	const timerRef = useRef<number | null>(null);

	const stopPolling = useCallback(() => {
		if (timerRef.current !== null) {
			window.clearTimeout(timerRef.current);
			timerRef.current = null;
		}
	}, []);

	const persistId = useCallback(
		(id: string | null) => {
			if (!restoreKey) return;
			if (id) {
				window.localStorage.setItem(restoreKey, id);
			} else {
				window.localStorage.removeItem(restoreKey);
			}
		},
		[restoreKey]
	);

	const poll = useCallback(
		async (taskId: string) => {
			stopPolling();
			try {
				const payload = await fetchStatus(taskId);
				const nextStatus = getStatus(payload);
				const nextState: QueuedTaskState<TResult> = {
					id: getTaskId(payload),
					status: nextStatus,
					progress: getProgress ? getProgress(payload) : null,
					result: getResult ? getResult(payload) : null,
					error: getError ? getError(payload) : null,
				};
				setState(nextState);
				if (TERMINAL_STATUSES.includes(nextStatus)) {
					if (nextStatus === 'completed') {
						persistId(nextState.id);
					} else {
						persistId(null);
					}
					return;
				}
				persistId(nextState.id);
				timerRef.current = window.setTimeout(() => {
					void poll(taskId);
				}, pollIntervalMs);
			} catch (error) {
				setState((prev) => ({
					...prev,
					status: 'failed',
					error:
						error instanceof Error
							? error.message
							: 'Failed to fetch task status',
				}));
				persistId(null);
			}
		},
		[
			fetchStatus,
			getError,
			getProgress,
			getResult,
			getStatus,
			getTaskId,
			persistId,
			pollIntervalMs,
			stopPolling,
		]
	);

	const start = useCallback(
		(taskId: string, initialStatus: QueuedTaskStatus = 'queued') => {
			persistId(taskId);
			setState({
				id: taskId,
				status: initialStatus,
				progress: initialStatus === 'completed' ? 100 : 0,
				result: null,
				error: null,
			});
			void poll(taskId);
		},
		[persistId, poll]
	);

	const clear = useCallback(() => {
		stopPolling();
		persistId(null);
		setState({
			id: null,
			status: null,
			progress: null,
			result: null,
			error: null,
		});
	}, [persistId, stopPolling]);

	useEffect(() => {
		if (!restoreKey) return;
		const restoredId = window.localStorage.getItem(restoreKey);
		if (restoredId) {
			void poll(restoredId);
		}
		return stopPolling;
	}, [poll, restoreKey, stopPolling]);

	return {
		state,
		start,
		clear,
		stopPolling,
	};
}
