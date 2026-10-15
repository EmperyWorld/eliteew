/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Adapts Sonner toasts for `useUgsStuckTaskAlerts` (persistent action toasts).
 *
 * Related:
 * - hooks/useUgsStuckTaskAlerts.ts
 * - components/UGSHub.tsx
 */

import { toast as sonnerToast } from 'sonner';

import type { UgsStuckTaskToastApi } from '../../../../hooks/useUgsStuckTaskAlerts';

function toastFnForType(type: string) {
	if (type === 'error') return sonnerToast.error;
	if (type === 'warning') return sonnerToast.warning;
	return sonnerToast.info;
}

function sonnerOptions(
	message?: string,
	persistent?: boolean,
	actions?: Array<{ label: string; onClick: () => void }>
) {
	return {
		description: message,
		duration: persistent ? Number.POSITIVE_INFINITY : 5000,
		...(actions?.[0]
			? { action: { label: actions[0].label, onClick: actions[0].onClick } }
			: {}),
		...(actions?.[1]
			? { cancel: { label: actions[1].label, onClick: actions[1].onClick } }
			: {}),
	};
}

/** Sonner-backed toast API for stuck-task alerts in UGS Hub. */
export function buildUgsHubStuckTaskToastApi(): UgsStuckTaskToastApi {
	return {
		addToast: ({ type, title, message, persistent, actions }) => {
			const fn = toastFnForType(type);
			const id = fn(title, sonnerOptions(message, persistent, actions));
			return String(id);
		},
		patchToast: (id, { title, message, persistent, actions }) => {
			sonnerToast.warning(title, {
				id,
				...sonnerOptions(message, persistent, actions),
			});
		},
		removeToast: (id) => sonnerToast.dismiss(id),
		info: (title, message, options) => {
			sonnerToast.info(title, {
				description: message,
				duration: options?.duration ?? 3000,
			});
		},
	};
}
