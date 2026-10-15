/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T <keysray70@gmail.com>
 * ---
 *
 * Purpose:
 * Shared visual primitives for UGS Hub: theme-aware surfaces, typography, skeletons, section headings.
 *
 * Invariants:
 * - All surfaces follow desktop shell CSS variables from settings.
 *
 * Related:
 * - components/UGSHub.tsx, ugsHubShellThemeContext.ts
 */

import { motion } from 'framer-motion';
import { useMemo, type FC, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { ElitePreloaderPanel } from '@/components/ui/ElitePreloaderPanel';
import { pickEliteTechnicalQuote } from '@/components/ui/eliteTechnicalQuotes';

import { cn } from '../../../utils/cn';
import { useUgsHubShellTheme } from './ugsHubShellThemeContext';

import {
	ugsHubEyebrowClasses,
	ugsHubModalBackdropClasses,
	ugsHubModalDividerClasses,
	ugsHubModalPanelClasses,
	ugsHubPanelClasses,
	ugsHubRootClasses,
	ugsHubRootGlowClasses,
	ugsHubSkeletonBlockClasses,
	ugsHubTabRailClasses,
	ugsHubTextMuted,
	ugsHubTextPrimary,
} from './ugsHubThemeTokens';

export * from './ugsHubThemeTokens';

export interface UgsHubSectionHeadingProps {
	eyebrow: string;
	title: string;
	count?: number;
	className?: string;
}

export const UgsHubSectionHeading: FC<UgsHubSectionHeadingProps> = ({
	eyebrow,
	title,
	count,
	className,
}) => {
	const theme = useUgsHubShellTheme();
	return (
		<div className={cn('flex items-baseline justify-between gap-2', className)}>
			<div className="min-w-0 space-y-1">
				<p className={ugsHubEyebrowClasses(theme)}>{eyebrow}</p>
				<h3
					className={cn(
						'text-lg font-semibold tracking-tight',
						ugsHubTextPrimary(theme)
					)}
				>
					{title}
				</h3>
			</div>
			{count != null ? (
				<span
					className={cn(
						'shrink-0 text-xs tabular-nums',
						ugsHubTextMuted(theme)
					)}
				>
					{count}
				</span>
			) : null}
		</div>
	);
};

export const UgsHubLoadingSkeleton: FC = () => {
	const { t } = useTranslation('ugsHub');
	const theme = useUgsHubShellTheme();
	const quote = useMemo(() => pickEliteTechnicalQuote(), []);
	const pulse = 'animate-pulse motion-reduce:animate-none';
	const block = ugsHubSkeletonBlockClasses(theme);

	return (
		<div
			className={cn(ugsHubRootClasses(theme), 'p-6 sm:p-8')}
			data-testid="ugs-hub-root"
			role="status"
			aria-busy
			aria-live="polite"
		>
			<span className="sr-only">{t('loading.hubSrOnly')}</span>
			<div className={ugsHubRootGlowClasses(theme)} />
			<div className="relative z-10 w-full min-w-0 space-y-8">
				<div className={cn('space-y-4', pulse)}>
					<div className={cn('h-9 w-48', block)} />
					<div className={cn('h-10 w-72 max-w-full', block)} />
					<div className={cn('h-4 w-full max-w-xl', block)} />
				</div>
				<ElitePreloaderPanel quote={quote} className="mx-auto" />
				<div className={cn('grid gap-3 sm:grid-cols-2 xl:grid-cols-4', pulse)}>
					{(['stat-a', 'stat-b', 'stat-c', 'stat-d'] as const).map((key) => (
						<div key={key} className={cn(ugsHubPanelClasses(theme), 'h-28')} />
					))}
				</div>
				<div
					className={cn(
						ugsHubTabRailClasses(theme),
						pulse,
						'h-12 w-full max-w-2xl'
					)}
				/>
				<div className={cn(ugsHubPanelClasses(theme), pulse, 'h-36')} />
				<div className={cn('space-y-3', pulse)}>
					{(['row-a', 'row-b', 'row-c'] as const).map((key) => (
						<div key={key} className={cn(ugsHubPanelClasses(theme), 'h-24')} />
					))}
				</div>
			</div>
		</div>
	);
};

export function UgsHubFiltersPanel({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	const theme = useUgsHubShellTheme();
	return (
		<section
			className={cn(ugsHubPanelClasses(theme, 'mb-6 p-4 md:p-5'), className)}
		>
			{children}
		</section>
	);
}

export interface UgsHubModalFrameProps {
	backdropZ: number;
	contentZ: number;
	onClose: () => void;
	maxWidthClass?: string;
	maxHeightClass?: string;
	header: ReactNode;
	footer?: ReactNode;
	bodyClassName?: string;
	children: ReactNode;
}

export const UgsHubModalFrame: FC<UgsHubModalFrameProps> = ({
	backdropZ,
	contentZ,
	onClose,
	maxWidthClass = 'max-w-4xl',
	maxHeightClass = 'max-h-[82vh]',
	header,
	footer,
	bodyClassName,
	children,
}) => {
	const theme = useUgsHubShellTheme();

	return (
		<motion.div
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			className={ugsHubModalBackdropClasses(theme)}
			style={{ zIndex: backdropZ }}
			onClick={onClose}
		>
			<motion.div
				initial={{ scale: 0.96, opacity: 0 }}
				animate={{ scale: 1, opacity: 1 }}
				exit={{ scale: 0.96, opacity: 0 }}
				className={cn(
					ugsHubModalPanelClasses(theme),
					maxWidthClass,
					maxHeightClass,
					'flex flex-col'
				)}
				style={{ zIndex: contentZ }}
				onClick={(event) => event.stopPropagation()}
				role="dialog"
				aria-modal="true"
			>
				<div
					className={cn(
						'flex shrink-0 flex-col gap-4 border-b px-6 py-4',
						ugsHubModalDividerClasses(theme)
					)}
				>
					{header}
				</div>
				<div
					className={cn(
						'min-h-0 flex-1 overflow-y-auto px-6 py-5',
						bodyClassName
					)}
				>
					{children}
				</div>
				{footer ? (
					<div
						className={cn(
							'shrink-0 border-t px-6 py-4',
							ugsHubModalDividerClasses(theme)
						)}
					>
						{footer}
					</div>
				) : null}
			</motion.div>
		</motion.div>
	);
};
