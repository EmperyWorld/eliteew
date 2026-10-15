/**
 * useActivityLog - Hook для истории действий
 *
 * Отслеживает все операции с файлами:
 * - Загрузка файла
 * - Удаление файла
 * - Редактирование метаданных
 * - Поделиться файлом
 * - Перемещение файла
 * - Возможность отменить (undo)
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { log } from '../../../utils/logger';
import {
	readJsonStorage,
	writeJsonStorage,
	removeStorageItem,
} from '../../../utils/storage';

export type ActivityType =
	| 'upload'
	| 'delete'
	| 'edit'
	| 'share'
	| 'move'
	| 'favorite'
	| 'unfavorite'
	| 'batch_delete'
	| 'batch_move'
	| 'batch_assign_project';

export interface Activity {
	id: string;
	type: ActivityType;
	contentId?: string;
	contentName?: string;
	contentIds?: string[];
	timestamp: Date;
	description: string;
	undoable: boolean;
	undoData?: unknown;
}

function getDefaultDescription(
	type: ActivityType,
	contentName?: string,
	count?: number
): string {
	switch (type) {
		case 'upload':
			return `Загружен файл: ${contentName || 'неизвестно'}`;
		case 'delete':
			return `Удален файл: ${contentName || 'неизвестно'}`;
		case 'edit':
			return `Отредактирован файл: ${contentName || 'неизвестно'}`;
		case 'share':
			return `Поделились файлом: ${contentName || 'неизвестно'}`;
		case 'move':
			return `Перемещен файл: ${contentName || 'неизвестно'}`;
		case 'favorite':
			return `Добавлен в избранное: ${contentName || 'неизвестно'}`;
		case 'unfavorite':
			return `Удален из избранного: ${contentName || 'неизвестно'}`;
		case 'batch_delete':
			return `Удалено файлов: ${count || 0}`;
		case 'batch_move':
			return `Перемещено файлов: ${count || 0}`;
		case 'batch_assign_project':
			return `Привязка к проекту: ${count || 0} файлов`;
		default:
			return 'Действие выполнено';
	}
}

interface UseActivityLogOptions {
	maxHistory?: number;
	onUndo?: (activity: Activity) => Promise<boolean>;
}

interface UseActivityLogReturn {
	activities: Activity[];
	undoStack: Activity[];
	addActivity: (
		type: ActivityType,
		options?: {
			contentId?: string;
			contentName?: string;
			contentIds?: string[];
			description?: string;
			undoable?: boolean;
			undoData?: unknown;
		}
	) => Activity;
	undo: (activityId?: string) => Promise<boolean>;
	clearHistory: () => void;
	canUndo: boolean;
}

export const useActivityLog = (
	options: UseActivityLogOptions = {}
): UseActivityLogReturn => {
	const { maxHistory = 50, onUndo } = options;

	const [activities, setActivities] = useState<Activity[]>([]);
	const [undoStack, setUndoStack] = useState<Activity[]>([]);
	const activityIdCounter = useRef(0);

	// Загрузить историю из localStorage
	useEffect(() => {
		try {
			const saved = readJsonStorage<
				Array<Omit<Activity, 'timestamp'> & { timestamp: string }>
			>('content_activity_log', []);
			if (saved.length > 0) {
				setActivities(
					saved.map((a) => ({
						...a,
						timestamp: new Date(a.timestamp),
					}))
				);
			}
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			log.warn(
				'useActivityLog',
				`Failed to load activity log: ${errorMessage}`
			);
		}
	}, []);

	// Сохранить историю в localStorage
	useEffect(() => {
		try {
			const toSave = activities.slice(-maxHistory).map((a) => ({
				...a,
				timestamp: a.timestamp.toISOString(),
			}));
			writeJsonStorage('content_activity_log', toSave);
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			log.warn(
				'useActivityLog',
				`Failed to save activity log: ${errorMessage}`
			);
		}
	}, [activities, maxHistory]);

	const addActivity = useCallback(
		(
			type: ActivityType,
			options: {
				contentId?: string;
				contentName?: string;
				contentIds?: string[];
				description?: string;
				undoable?: boolean;
				undoData?: unknown;
			} = {}
		) => {
			const {
				contentId,
				contentName,
				contentIds,
				description,
				undoable = false,
				undoData,
			} = options;

			const activity: Activity = {
				id: `activity_${Date.now()}_${activityIdCounter.current++}`,
				type,
				contentId,
				contentName,
				contentIds,
				timestamp: new Date(),
				description:
					description ||
					getDefaultDescription(type, contentName, contentIds?.length),
				undoable,
				undoData,
			};

			setActivities((prev) => {
				const newActivities = [...prev, activity];
				// Ограничить размер истории
				return newActivities.slice(-maxHistory);
			});

			// Если действие можно отменить, добавить в стек отмены
			if (undoable) {
				setUndoStack((prev) => [activity, ...prev].slice(0, 10)); // Последние 10 действий
			}

			return activity;
		},
		[maxHistory]
	);

	const undo = useCallback(
		async (activityId?: string) => {
			let activity: Activity | undefined;

			if (activityId) {
				activity = activities.find((a) => a.id === activityId);
			} else {
				// Отменить последнее действие
				activity = undoStack[0];
			}

			if (!activity?.undoable) {
				return false;
			}

			if (onUndo) {
				const success = await onUndo(activity);
				if (success) {
					// Удалить из стека отмены
					if (activity) {
						setUndoStack((prev) => prev.filter((a) => a.id !== activity.id));
					}
					// Добавить запись об отмене
					addActivity('edit', {
						description: `Отменено: ${activity.description}`,
						undoable: false,
					});
				}
				return success;
			}

			return false;
		},
		[activities, undoStack, onUndo, addActivity]
	);

	const clearHistory = useCallback(() => {
		setActivities([]);
		setUndoStack([]);
		removeStorageItem('content_activity_log');
	}, []);

	return {
		activities,
		undoStack,
		addActivity,
		undo,
		clearHistory,
		canUndo: undoStack.length > 0,
	};
};
