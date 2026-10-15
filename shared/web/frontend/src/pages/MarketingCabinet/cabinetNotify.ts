/**
 * Transient feedback for the Marketing Cabinet — same stack as dashboards (Sonner via `notify`),
 * without importing `useNotifications` from the hook layer. Keeps the page decoupled from UI hooks.
 */
import type { NotifyToastOptions } from '@/notifications/api';
import { notify } from '@/notifications/api';

/** Sonner root class — left accent bar in `src/styles/index.css` (cabinet-scoped toast look). */
const CABINET_TOAST_CLASS = 'marketing-cabinet-toast';

/** Shared Sonner options so success/error stay visually aligned (durations match `notify` defaults). */
const cabinetToastOptions = {
	className: CABINET_TOAST_CLASS,
} satisfies NotifyToastOptions;

export const cabinetNotify = {
	success(message: string, description?: string, options?: NotifyToastOptions) {
		notify.success(message, description, {
			...cabinetToastOptions,
			...options,
		});
	},
	info(message: string, description?: string, options?: NotifyToastOptions) {
		notify.info(message, description, { ...cabinetToastOptions, ...options });
	},
	error(message: string, description?: string, options?: NotifyToastOptions) {
		notify.error(message, description, { ...cabinetToastOptions, ...options });
	},
};
