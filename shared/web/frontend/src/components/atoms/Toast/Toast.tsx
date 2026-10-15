import type { ToasterProps } from 'sonner';
import { Toaster } from 'sonner';
import { useNotifications } from '@/notifications/useNotifications';

/** Shared Sonner mount: a11y labels, stack gap, styling (single source for NotificationProvider). */
export const eliteToasterProps = {
	position: 'top-center' as const,
	theme: 'dark' as const,
	richColors: true,
	closeButton: true,
	expand: true,
	gap: 14,
	duration: 3500,
	/** Above desktop windows / Tauri chrome so incoming call Answer stays reachable. */
	style: { zIndex: 2147483000 },
	containerAriaLabel: 'Уведомления',
	toastOptions: {
		closeButtonAriaLabel: 'Закрыть уведомление',
		style: {
			background:
				'radial-gradient(circle at 0% 0%, rgba(56, 189, 248, 0.16), transparent 55%), radial-gradient(circle at 100% 100%, rgba(52, 211, 153, 0.14), transparent 55%), rgba(15, 23, 42, 0.72)',
			border: '1px solid rgba(148, 163, 184, 0.32)',
			boxShadow: '0 22px 55px rgba(15, 23, 42, 0.9)',
			backdropFilter: 'blur(22px) saturate(1.35)',
		},
		classNames: {
			toast:
				'group rounded-2xl px-4 py-3.5 border border-white/10 bg-slate-950/30 backdrop-blur-2xl shadow-[0_18px_40px_rgba(15,23,42,0.85)] flex items-start gap-3 data-[type=success]:border-emerald-400/50 data-[type=success]:bg-emerald-400/10 data-[type=error]:border-rose-400/55 data-[type=error]:bg-rose-400/10 data-[type=warning]:border-amber-300/55 data-[type=warning]:bg-amber-400/10 data-[type=info]:border-sky-400/55 data-[type=info]:bg-sky-400/10',
			title: 'text-sm font-medium text-slate-50 tracking-tight',
			description: 'mt-0.5 text-xs text-slate-300 leading-snug',
			actionButton:
				'mt-2 text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-950 hover:bg-white transition-colors',
			closeButton:
				'text-slate-400 hover:text-slate-50 hover:bg-slate-900/60 rounded-full transition-colors',
		},
	},
} satisfies ToasterProps;

export function EliteToaster(props: ToasterProps) {
	return <Toaster {...eliteToasterProps} {...props} />;
}

export function useToast() {
	const notifications = useNotifications();
	return {
		success: (title: string, message?: string) =>
			notifications.success(title, message),
		error: (title: string, message?: string) =>
			notifications.error(title, message),
		warning: (title: string, message?: string) =>
			notifications.warning(title, message),
		info: (title: string, message?: string) =>
			notifications.info(title, message),
	};
}
