/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Informational strip when GAF E2EE keys are not ready — guides users to phone binding.
 *
 * Invariants:
 * - Shown only when backend reports `ready: false`; does not block ordinary chat.
 *
 * Related:
 * - GAFChatApp.tsx, documentation/product/mobile/MOBILE-TRUSTED-DEVICE-BINDING.md
 * - DesktopChromeTooltip.tsx
 */
import { cn } from '@/utils/cn';
import { LockClosedIcon } from '@heroicons/react/24/outline';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_LUCIDE,
	DESKTOP_TYPOGRAPHY,
	DESKTOP_Z_INDEX,
} from '../../../constants';
import {
	DESKTOP_APP_STYLE_CONTRACT,
	DesktopAppButton,
} from '../../DesktopAppChrome';
import { DesktopChromeTooltip } from '../../DesktopChromeTooltip';

export interface GAFChatE2eeReadinessBannerProps {
	onSetupKeys?: () => void;
	onDismiss?: () => void;
}

export function GAFChatE2eeReadinessBanner({
	onSetupKeys,
	onDismiss,
}: GAFChatE2eeReadinessBannerProps): React.ReactElement {
	const { t } = useTranslation('gafChat');
	const messageId = React.useId();
	const titleId = `${messageId}-title`;

	return (
		<div
			role="status"
			aria-live="polite"
			aria-labelledby={titleId}
			aria-describedby={messageId}
			className={cn(
				'relative motion-safe:animate-fade-in motion-reduce:animate-none',
				'border-b border-[rgb(var(--desktop-accent-rgb)/0.35)] border-l-4 border-l-[rgb(var(--desktop-accent-rgb)/0.85)]',
				'bg-[color-mix(in_srgb,var(--desktop-surface-panel)_78%,rgb(var(--desktop-accent-rgb)/0.12))]',
				'px-4 py-3 text-(--desktop-text-primary) backdrop-blur-md',
				DESKTOP_TYPOGRAPHY.body,
				'shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
			)}
			style={{ zIndex: DESKTOP_Z_INDEX.GAF_RELATIVE_ALERT_STRIP }}
		>
			<div className="flex items-start gap-3">
				<span
					className={cn(
						'mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
						'bg-[rgb(var(--desktop-accent-rgb)/0.16)] text-[rgb(var(--desktop-accent-rgb)/0.95)]',
						'[&_svg]:h-[18px] [&_svg]:w-[18px]'
					)}
					aria-hidden
				>
					<LockClosedIcon strokeWidth={DESKTOP_LUCIDE.stroke} />
				</span>
				<div className="min-w-0 flex-1">
					<div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
						<div className="min-w-0 flex-1 space-y-1">
							<p
								id={titleId}
								className={cn(
									DESKTOP_APP_STYLE_CONTRACT.sectionLabel,
									'text-[rgb(var(--desktop-accent-rgb)/0.92)]'
								)}
							>
								{t('e2eeReadinessBannerTitle')}
							</p>
							<p
								id={messageId}
								className={cn(
									'font-medium leading-snug text-(--desktop-text-primary)',
									DESKTOP_TYPOGRAPHY.shellCopy13
								)}
							>
								{t('e2eeReadinessBannerBody')}
							</p>
						</div>
						{onDismiss ? (
							<DesktopChromeTooltip
								content={t('e2eeReadinessBannerDismiss')}
								placement="top"
								offsetExtra={4}
							>
								<DesktopAppButton
									type="button"
									variant="ghost"
									size="sm"
									onClick={onDismiss}
									aria-label={t('e2eeReadinessBannerDismiss')}
									className={cn(
										DESKTOP_INTERACTIVE.focusRing,
										'h-9 shrink-0 self-end px-2 sm:self-start',
										'text-(--desktop-text-muted) hover:bg-(--desktop-surface-soft-hover)'
									)}
								>
									{t('e2eeReadinessBannerDismiss')}
								</DesktopAppButton>
							</DesktopChromeTooltip>
						) : null}
					</div>
					{onSetupKeys ? (
						<div className="mt-3">
							<DesktopChromeTooltip
								content={t('e2eeReadinessBannerAction')}
								placement="top"
								offsetExtra={4}
							>
								<DesktopAppButton
									type="button"
									variant="accent"
									size="sm"
									onClick={onSetupKeys}
									aria-describedby={messageId}
									className="min-h-9"
								>
									{t('e2eeReadinessBannerAction')}
								</DesktopAppButton>
							</DesktopChromeTooltip>
						</div>
					) : null}
				</div>
			</div>
		</div>
	);
}
