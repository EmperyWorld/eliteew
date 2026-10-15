import {
	CheckCircleIcon,
	ExclamationTriangleIcon,
	InformationCircleIcon,
	XCircleIcon,
} from '@heroicons/react/24/outline';

import {
	type NotificationSourceKey,
	normalizeNotificationSource,
} from '@/notifications/sourceMeta';

export const notificationStyles = {
	info: {
		icon: InformationCircleIcon,
		bg: 'bg-[color-mix(in_srgb,var(--glass-bg)_44%,var(--desktop-surface-soft)_56%)]',
		border: 'border-(--desktop-border-subtle)',
		iconColor: 'text-(--desktop-text-secondary)',
	},
	success: {
		icon: CheckCircleIcon,
		bg: 'bg-[color-mix(in_srgb,var(--desktop-surface-soft)_88%,rgb(var(--desktop-accent-rgb))_12%)]',
		border: 'border-[rgb(var(--desktop-accent-rgb))/0.38]',
		iconColor: 'text-[rgb(var(--desktop-accent-rgb))]/88',
	},
	warning: {
		icon: ExclamationTriangleIcon,
		bg: 'bg-[color-mix(in_srgb,var(--desktop-surface-soft)_90%,rgb(245_158_11)_10%)]',
		border: 'border-amber-900/[0.4]',
		iconColor: 'text-amber-500/72',
	},
	error: {
		icon: XCircleIcon,
		bg: 'bg-[color-mix(in_srgb,var(--desktop-surface-soft)_88%,rgb(248_113_113)_12%)]',
		border: 'border-red-900/[0.42]',
		iconColor: 'text-red-400/78',
	},
} as const;

export const notificationIconWellClass =
	'bg-[color-mix(in_srgb,var(--glass-bg)_30%,var(--desktop-surface-soft)_70%)]';

const sourceVisualStyles: Record<
	NotificationSourceKey,
	{
		containerTone: string;
		badgeTone: string;
		iconTone: string;
	}
> = {
	default: {
		containerTone: '',
		badgeTone: 'border-(--desktop-border-subtle) text-(--desktop-text-muted)',
		iconTone: '',
	},
	gaf_chat: {
		containerTone:
			'bg-[color-mix(in_srgb,var(--desktop-surface-soft)_86%,rgb(34_211_238)_14%)]',
		badgeTone:
			'border-cyan-500/45 bg-cyan-500/10 text-cyan-100 dark:text-cyan-200',
		iconTone: 'text-cyan-300/85',
	},
	ugs: {
		containerTone:
			'bg-[color-mix(in_srgb,var(--desktop-surface-soft)_85%,rgb(168_85_247)_15%)]',
		badgeTone:
			'border-violet-500/45 bg-violet-500/10 text-violet-100 dark:text-violet-200',
		iconTone: 'text-violet-300/85',
	},
	doc_editor: {
		containerTone:
			'bg-[color-mix(in_srgb,var(--desktop-surface-soft)_84%,rgb(16_185_129)_16%)]',
		badgeTone:
			'border-emerald-500/45 bg-emerald-500/10 text-emerald-100 dark:text-emerald-200',
		iconTone: 'text-emerald-300/85',
	},
	friends: {
		containerTone:
			'bg-[color-mix(in_srgb,var(--desktop-surface-soft)_84%,rgb(244_114_182)_16%)]',
		badgeTone:
			'border-pink-500/45 bg-pink-500/10 text-pink-100 dark:text-pink-200',
		iconTone: 'text-pink-300/85',
	},
	business_intelligence: {
		containerTone:
			'bg-[color-mix(in_srgb,var(--desktop-surface-soft)_84%,rgb(245_158_11)_16%)]',
		badgeTone:
			'border-amber-500/45 bg-amber-500/10 text-amber-100 dark:text-amber-200',
		iconTone: 'text-amber-300/85',
	},
	server: {
		containerTone:
			'bg-[color-mix(in_srgb,var(--desktop-surface-soft)_86%,rgb(148_163_184)_14%)]',
		badgeTone:
			'border-slate-500/45 bg-slate-500/10 text-slate-100 dark:text-slate-200',
		iconTone: 'text-slate-300/85',
	},
};

export function getNotificationSourceVisual(
	source: string | null | undefined
): {
	containerTone: string;
	badgeTone: string;
	iconTone: string;
	sourceKey: NotificationSourceKey;
} {
	const sourceKey = normalizeNotificationSource(source);
	return {
		...sourceVisualStyles[sourceKey],
		sourceKey,
	};
}
