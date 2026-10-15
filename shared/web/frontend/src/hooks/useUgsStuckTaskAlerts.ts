/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Stuck-task detection for UGS: warn when processing runs longer than expected (UGS Hub).
 *
 * Invariants:
 * - No automatic cancel — operator must press «Отменить» (avoids false positives from stale timestamps).
 * - Server datetimes are parsed as UTC (see ``parseServerUtcIsoMs``).
 *
 * Related:
 * - components/UGSHub.tsx
 * - utils/parseServerUtcIso.ts
 */

import { useCallback, useEffect, useRef } from 'react';
import type { UGSTask } from '../services/api/ugs/types';
import { parseServerUtcIsoMs } from '../utils/parseServerUtcIso';

const DEFAULT_ESTIMATED_TIME_SEC = 120;
/** Music / long audio pipelines (UGS v2 ACE) — do not use the 120s default. */
const MUSIC_TYPE_ESTIMATED_SEC = 600;
const STUCK_MULTIPLIER = 2;
const STUCK_REMINDER_INTERVAL_MS = 30 * 1000;
/** Snooze после «Ждать»: переживает F5 (sessionStorage). */
const snoozeStorageKey = (taskId: string) => `ugs:stuckSnooze:v1:${taskId}`;

const MUSIC_TYPE_KEY_RE = /^music_generator_/i;

function estimatedSecForType(
	typeKey: string,
	estimatedTimeByType: Map<string, number>
): number {
	const fromMap = estimatedTimeByType.get(typeKey);
	if (fromMap != null && fromMap > 0) {
		return fromMap;
	}
	if (MUSIC_TYPE_KEY_RE.test(typeKey)) {
		return MUSIC_TYPE_ESTIMATED_SEC;
	}
	return DEFAULT_ESTIMATED_TIME_SEC;
}

function processingStartedMs(task: UGSTask): number | undefined {
	const meta =
		task.metadata &&
		typeof task.metadata === 'object' &&
		!Array.isArray(task.metadata)
			? (task.metadata as Record<string, unknown>)
			: {};
	return (
		parseServerUtcIsoMs(
			typeof meta.processing_started_at === 'string'
				? meta.processing_started_at
				: undefined
		) ??
		parseServerUtcIsoMs(
			typeof meta.worker_started_at === 'string'
				? meta.worker_started_at
				: undefined
		)
	);
}

/** When ``processing`` — do not treat queue ``created_at`` as processing start (avoids instant «stuck»). */
function resolveProcessingStartedMs(task: UGSTask, now: number): number {
	const fromMeta = processingStartedMs(task);
	if (fromMeta !== undefined) {
		return fromMeta;
	}
	const started = parseServerUtcIsoMs(task.started_at);
	if (started !== undefined) {
		return started;
	}
	const updated = parseServerUtcIsoMs(task.updated_at);
	if (updated !== undefined && now - updated < 6 * 60 * 60 * 1000) {
		return updated;
	}
	return now;
}

export interface UgsStuckTaskToastApi {
	addToast: (toast: {
		type: string;
		title: string;
		message?: string;
		persistent?: boolean;
		actions?: Array<{ label: string; onClick: () => void }>;
	}) => string;
	patchToast: (
		id: string,
		toast: {
			title: string;
			message?: string;
			persistent?: boolean;
			actions?: Array<{ label: string; onClick: () => void }>;
		}
	) => void;
	removeToast: (id: string) => void;
	info: (
		title: string,
		message?: string,
		options?: { duration?: number }
	) => void;
}

export function useUgsStuckTaskAlerts(
	tasks: UGSTask[],
	estimatedTimeByType: Map<string, number>,
	cancelTask: (task: UGSTask) => Promise<void>,
	toast: UgsStuckTaskToastApi,
	playNotificationSound: () => void,
	humanizeLabel: (typeKey: string) => string = (k) => k
): void {
	const stuckNextShowAtRef = useRef<Map<string, number>>(new Map());
	const stuckToastIdByTaskRef = useRef<Map<string, string>>(new Map());
	const stuckIntervalRef = useRef<Map<string, ReturnType<typeof setInterval>>>(
		new Map()
	);
	const seenProcessingAtRef = useRef<Map<string, number>>(new Map());

	const clearStuckTimers = useCallback((taskId: string) => {
		const i = stuckIntervalRef.current.get(taskId);
		if (i) {
			clearInterval(i);
			stuckIntervalRef.current.delete(taskId);
		}
	}, []);

	useEffect(() => {
		const now = Date.now();
		const normMs = (sec: number) => sec * 1000;

		tasks
			.filter((t) => t.status === 'processing' || t.status === 'retrying')
			.forEach((task) => {
				const snoozeUntil = Math.floor(
					Number(sessionStorage.getItem(snoozeStorageKey(task.id)) || '0')
				);
				if (Number.isFinite(snoozeUntil) && snoozeUntil > now) {
					return;
				}

				const sec = estimatedSecForType(task.type_key, estimatedTimeByType);
				const startedAtMs = resolveProcessingStartedMs(task, now);

				if (!seenProcessingAtRef.current.has(task.id)) {
					seenProcessingAtRef.current.set(task.id, now);
				}
				const firstSeen = seenProcessingAtRef.current.get(task.id) ?? now;
				const graceMs = Math.min(normMs(Math.max(60, sec)), 3 * 60 * 1000);
				if (now - firstSeen < graceMs) {
					return;
				}

				const heartbeatAt = parseServerUtcIsoMs(task.last_heartbeat_at);
				const activityAt =
					heartbeatAt !== undefined && Number.isFinite(heartbeatAt)
						? heartbeatAt
						: startedAtMs;

				if (!Number.isFinite(startedAtMs) || !Number.isFinite(activityAt)) {
					return;
				}

				const elapsed = Math.max(0, now - startedAtMs);
				const silenceMs = Math.max(0, now - activityAt);
				const nextShowAt = stuckNextShowAtRef.current.get(task.id);

				if (elapsed < STUCK_MULTIPLIER * normMs(sec)) {
					return;
				}
				if (
					heartbeatAt !== undefined &&
					Number.isFinite(heartbeatAt) &&
					silenceMs < normMs(Math.max(30, Math.round(sec / 3)))
				) {
					return;
				}
				if (nextShowAt !== undefined && now < nextShowAt) {
					return;
				}
				if (stuckToastIdByTaskRef.current.has(task.id)) {
					return;
				}

				const taskId = task.id;
				const taskCopy = task;

				playNotificationSound();

				const toastIdHolder = { id: '' };
				const heartbeatLine =
					heartbeatAt !== undefined && Number.isFinite(heartbeatAt)
						? `Последний heartbeat — ${Math.round(silenceMs / 1000)} с назад.`
						: 'Heartbeat с сервера не передаётся в списке задач; время отсчитывается от старта обработки.';
				const baseStuckMessage = `Генерация ${humanizeLabel(task.type_key)} идёт уже ${Math.round(elapsed / 1000)} с (норма ~${sec} с). ${heartbeatLine} Нажмите «Ждать», чтобы скрыть напоминание, или «Отменить» — отмена только вручную.`;

				const stuckActions: Array<{ label: string; onClick: () => void }> = [
					{
						label: 'Ждать',
						onClick: () => {
							clearStuckTimers(taskId);
							toast.removeToast(toastIdHolder.id);
							stuckToastIdByTaskRef.current.delete(taskId);
							const snoozeMs = Math.max(normMs(sec) * 3, 15 * 60 * 1000);
							sessionStorage.setItem(
								snoozeStorageKey(taskId),
								String(Date.now() + snoozeMs)
							);
							stuckNextShowAtRef.current.set(taskId, Date.now() + normMs(sec));
						},
					},
					{
						label: 'Отменить',
						onClick: () => {
							clearStuckTimers(taskId);
							toast.removeToast(toastIdHolder.id);
							stuckToastIdByTaskRef.current.delete(taskId);
							stuckNextShowAtRef.current.delete(taskId);
							void cancelTask(taskCopy);
						},
					},
				];

				toastIdHolder.id = toast.addToast({
					type: 'warning',
					title: 'Задача выполняется дольше обычного',
					message: baseStuckMessage,
					persistent: true,
					actions: stuckActions,
				});

				const toastId = toastIdHolder.id;
				stuckToastIdByTaskRef.current.set(taskId, toastId);
				stuckNextShowAtRef.current.set(taskId, now + normMs(sec));

				const intervalId = setInterval(() => {
					playNotificationSound();
					toast.patchToast(toastId, {
						title: 'Задача выполняется дольше обычного',
						message: baseStuckMessage,
						persistent: true,
						actions: stuckActions,
					});
				}, STUCK_REMINDER_INTERVAL_MS);

				stuckIntervalRef.current.set(taskId, intervalId);
			});

		tasks.forEach((t) => {
			if (
				t.status !== 'processing' &&
				t.status !== 'retrying' &&
				t.status !== 'pending' &&
				t.status !== 'queued'
			) {
				clearStuckTimers(t.id);
				stuckNextShowAtRef.current.delete(t.id);
				seenProcessingAtRef.current.delete(t.id);
				sessionStorage.removeItem(snoozeStorageKey(t.id));
				const tid = stuckToastIdByTaskRef.current.get(t.id);
				if (tid) {
					toast.removeToast(tid);
					stuckToastIdByTaskRef.current.delete(t.id);
				}
			}
		});
	}, [
		tasks,
		estimatedTimeByType,
		toast,
		cancelTask,
		playNotificationSound,
		clearStuckTimers,
		humanizeLabel,
	]);
}
