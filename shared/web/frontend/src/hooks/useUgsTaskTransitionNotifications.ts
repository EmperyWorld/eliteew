import { useUserPreferencesApp } from '@/contexts/UserPreferencesAppContext';
import { useNotifications } from '@/notifications';
import type { UGSTask } from '@/services/api/ugs/types';
import {
	DEFAULT_UGS_NOTIFICATION_BLOCK,
	DEFAULT_UGS_NOTIFICATION_PREFERENCES,
	type UgsNotificationBlockSettings,
	type UgsNotificationPreferences,
} from '@/types/profile';
import { showBrowserNotificationWhenTabHidden } from '@/utils/browserSystemNotification';
import { humanizeUgsTypeKey } from '@/utils/ugsHumanizeTypeKey';
import { useEffect, useRef } from 'react';

type UgsTransitionTask = Pick<UGSTask, 'id' | 'status' | 'type_key'>;

function resolveUgsBlock(
	prefs: UgsNotificationPreferences | undefined,
	key: keyof UgsNotificationPreferences
): UgsNotificationBlockSettings {
	const b = prefs?.[key];
	if (!b) {
		return { ...DEFAULT_UGS_NOTIFICATION_BLOCK };
	}
	return {
		enabled: b.enabled !== false,
		in_app: b.in_app !== false,
		browser: b.browser === true,
	};
}

/**
 * Тосты и центр уведомлений при смене статуса задач UGS.
 * Должен жить на уровне Desktop (tray poll), чтобы события шли и при закрытом окне UGS.
 * Настройки: `preferences.notifications.ugs` с API (см. UserPreferencesAppProvider).
 */
export function useUgsTaskTransitionNotifications(
	tasks: UgsTransitionTask[] | undefined,
	enabled: boolean
): void {
	const { toast, addToCenter } = useNotifications();
	const previousStatusByTaskRef = useRef<Map<string, UGSTask['status']>>(
		new Map()
	);
	const initializedRef = useRef(false);
	const prefsApp = useUserPreferencesApp();
	const ugsPrefs =
		prefsApp?.preferences?.notifications?.ugs ??
		DEFAULT_UGS_NOTIFICATION_PREFERENCES;

	useEffect(() => {
		if (!enabled) {
			previousStatusByTaskRef.current.clear();
			initializedRef.current = false;
			return;
		}
		if (tasks === undefined) {
			return;
		}

		const prevStatusByTask = previousStatusByTaskRef.current;
		const completedCfg = resolveUgsBlock(ugsPrefs, 'task_completed');
		const queuedCfg = resolveUgsBlock(ugsPrefs, 'task_queued');
		const startedCfg = resolveUgsBlock(ugsPrefs, 'task_started');
		const isInitialized = initializedRef.current;

		for (const task of tasks) {
			const prevStatus = prevStatusByTask.get(task.id);
			const currentStatus = task.status;

			if (isInitialized) {
				if (currentStatus === 'completed' && prevStatus !== 'completed') {
					if (completedCfg.enabled) {
						const title = `UGS: ${humanizeUgsTypeKey(task.type_key)}`;
						const message = 'Генерация завершена';
						if (completedCfg.in_app) {
							toast.success(title, message);
							addToCenter({
								type: 'success',
								title,
								message,
								source: 'ugs',
								persistent: true,
							});
						}
						if (completedCfg.browser) {
							showBrowserNotificationWhenTabHidden(title, message, {
								tag: `ugs-done-${task.id}`,
							});
						}
					}
				}

				if (
					(currentStatus === 'pending' || currentStatus === 'queued') &&
					prevStatus !== 'pending' &&
					prevStatus !== 'queued'
				) {
					if (queuedCfg.enabled) {
						const qTitle = 'Задача поставлена в очередь';
						const qBody = `${humanizeUgsTypeKey(task.type_key)} — ожидает запуска`;
						if (queuedCfg.in_app) {
							toast.info(qTitle, qBody);
						}
						if (queuedCfg.browser) {
							showBrowserNotificationWhenTabHidden(`UGS: очередь`, qBody, {
								tag: `ugs-queued-${task.id}`,
							});
						}
					}
				}

				if (
					currentStatus === 'processing' &&
					(prevStatus === 'pending' ||
						prevStatus === 'queued' ||
						prevStatus === 'retrying')
				) {
					if (startedCfg.enabled) {
						const sTitle = 'Задача запущена';
						const sBody = `${humanizeUgsTypeKey(task.type_key)} — выполняется`;
						if (startedCfg.in_app) {
							toast.success(sTitle, sBody);
						}
						if (startedCfg.browser) {
							showBrowserNotificationWhenTabHidden('UGS: запуск', sBody, {
								tag: `ugs-started-${task.id}`,
							});
						}
					}
				}
			}

			prevStatusByTask.set(task.id, currentStatus);
		}

		initializedRef.current = true;
	}, [tasks, enabled, toast, addToCenter, ugsPrefs]);
}
