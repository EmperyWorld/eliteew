import { cn } from '@/utils/cn';
import * as React from 'react';
import type { ReactNode } from 'react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_LUCIDE,
	DESKTOP_TYPOGRAPHY,
	DESKTOP_Z_INDEX,
} from '../../../constants';
import { XMarkIcon } from '@heroicons/react/24/outline';

import {
	DESKTOP_APP_STYLE_CONTRACT,
	DesktopAppButton,
} from '../../DesktopAppChrome';
import { DesktopChromeTooltip } from '../../DesktopChromeTooltip';

interface GAFChatErrorBarProps {
	/** Short label above the message (stronger hierarchy). */
	title?: string;
	/** Optional leading glyph (e.g. Lucide icon with aria-hidden). Replaces the default pulse dot. */
	icon?: ReactNode;
	message: string;
	actionLabel?: string;
	onAction?: () => void;
	/** Optional secondary control (link, button, or custom node). Rendered after the primary action. */
	secondaryAction?: ReactNode;
	/** When set, shows a dismiss control that calls this handler (e.g. clear transient error state). */
	onDismiss?: () => void;
	dismissLabel?: string;
}

const primaryActionClass = cn(
	DESKTOP_INTERACTIVE.focusRing,
	'border border-red-400/40 bg-[color-mix(in_srgb,var(--desktop-surface-soft)_88%,rgb(127_29_29)_12%)]',
	'text-(--desktop-text-primary) hover:border-red-400/55 hover:bg-red-500/14',
	'relative focus-visible:ring-2 focus-visible:ring-red-300/85 focus-visible:ring-offset-2',
	'focus-visible:ring-offset-[color-mix(in_srgb,var(--desktop-surface-panel)_70%,rgb(127_29_29)_30%)]',
	'motion-reduce:transition-none'
);

export const GAFChatErrorBar: React.FC<GAFChatErrorBarProps> = ({
	title: titleProp,
	icon,
	message,
	actionLabel: actionLabelProp,
	onAction,
	secondaryAction,
	onDismiss,
	dismissLabel: dismissLabelProp,
}) => {
	const { t } = useTranslation('gafChat');
	const title = titleProp ?? t('errorBarTitle');
	const actionLabel = actionLabelProp ?? t('errorBarRetry');
	const dismissLabel = dismissLabelProp ?? t('errorBarDismiss');
	const messageId = useId();
	const titleId = `${messageId}-title`;

	return (
		<div
			role="alert"
			aria-live="assertive"
			aria-atomic="true"
			aria-labelledby={titleId}
			aria-describedby={messageId}
			className={cn(
				'relative motion-safe:animate-fade-in motion-reduce:animate-none',
				'border-b border-red-500/55 border-l-4 border-l-red-500',
				'bg-[color-mix(in_srgb,var(--desktop-surface-panel)_62%,rgb(127_29_29)_38%)]',
				'px-4 py-3.5 text-(--desktop-text-primary) backdrop-blur-md',
				DESKTOP_TYPOGRAPHY.body,
				'shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_1px_0_rgba(0,0,0,0.12)]'
			)}
			style={{ zIndex: DESKTOP_Z_INDEX.GAF_RELATIVE_ALERT_STRIP }}
		>
			<div className="flex items-start gap-3">
				{icon !== undefined && icon !== null ? (
					<span
						className={cn(
							'mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
							'bg-red-500/18 text-red-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]',
							'[&_svg]:h-[18px] [&_svg]:w-[18px] [&_svg]:shrink-0'
						)}
						aria-hidden
					>
						{icon}
					</span>
				) : (
					<span
						className={cn(
							'mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-red-200',
							'ring-2 ring-red-500/50 shadow-[0_0_14px_rgba(252,165,165,0.95)]',
							'motion-safe:animate-pulse motion-reduce:animate-none'
						)}
						aria-hidden
					/>
				)}
				<div className="min-w-0 flex-1">
					<div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
						<div className="min-w-0 flex-1 space-y-1">
							<p
								id={titleId}
								className={cn(
									DESKTOP_APP_STYLE_CONTRACT.sectionLabel,
									'text-red-200/90'
								)}
							>
								{title}
							</p>
							<p
								id={messageId}
								className={cn(
									'font-medium leading-snug text-[color-mix(in_srgb,var(--desktop-text-primary)_88%,rgb(254_226_226)_12%)]',
									DESKTOP_TYPOGRAPHY.shellCopy13
								)}
							>
								{message}
							</p>
						</div>
						{onDismiss ? (
							<DesktopChromeTooltip
								content={dismissLabel}
								placement="top"
								offsetExtra={4}
							>
								<DesktopAppButton
									type="button"
									variant="ghost"
									size="sm"
									onClick={onDismiss}
									aria-label={dismissLabel}
									className={cn(
										DESKTOP_INTERACTIVE.focusRing,
										'h-9 w-9 shrink-0 self-end p-0 sm:self-start',
										'text-(--desktop-text-muted) hover:bg-red-500/18 hover:text-red-50',
										'focus-visible:ring-red-500/55',
										'-mr-1 sm:mt-0.5'
									)}
								>
									<XMarkIcon
										className="h-4 w-4"
										strokeWidth={DESKTOP_LUCIDE.stroke}
										aria-hidden
									/>
								</DesktopAppButton>
							</DesktopChromeTooltip>
						) : null}
					</div>
					{onAction || secondaryAction ? (
						<div className="mt-3 flex w-full min-w-0 flex-wrap items-center gap-2">
							{onAction ? (
								<DesktopChromeTooltip
									content={actionLabel}
									placement="top"
									offsetExtra={4}
								>
									<DesktopAppButton
										type="button"
										variant="ghost"
										size="sm"
										onClick={onAction}
										aria-describedby={messageId}
										className={cn(primaryActionClass, 'min-h-9 shrink-0')}
										style={{
											zIndex: DESKTOP_Z_INDEX.GAF_RELATIVE_ALERT_CONTROL,
										}}
									>
										{actionLabel}
									</DesktopAppButton>
								</DesktopChromeTooltip>
							) : null}
							{secondaryAction ? (
								<span className="inline-flex min-w-0 shrink-0 flex-wrap items-center gap-2 [&_button]:min-h-9">
									{secondaryAction}
								</span>
							) : null}
						</div>
					) : null}
				</div>
			</div>
		</div>
	);
};
