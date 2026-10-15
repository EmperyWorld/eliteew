/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Compact GAF Chat E2EE consent control for the desktop chat toolbar.
 *
 * Invariants:
 * - E2EE starts only through explicit user action; ordinary chat remains the default.
 *
 * Related:
 * - documentation/product/GAF-CHAT-BACKEND.md · DesktopChromeTooltip.tsx
 */
import { useTranslation } from 'react-i18next';
import { DESKTOP_LUCIDE } from '../../constants';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { DESKTOP_CHROME_FOCUS_VISIBLE } from '../DesktopAppChrome';
import { DesktopChromeTooltip } from '../DesktopChromeTooltip';
import { cn } from '@/utils/cn';
import { ArrowPathIcon, LockClosedIcon } from '@heroicons/react/24/outline';
import type { GafE2eeStatus } from './api/gafChatApi';

export function GAFChatEncryptionIconButton({
	className,
	iconClassName,
	status,
	busy = false,
	currentUserId,
	onPropose,
	onAccept,
	onDecline,
	onDisable,
	onSetupKeys,
}: {
	className?: string;
	iconClassName?: string;
	status?: GafE2eeStatus | null;
	busy?: boolean;
	currentUserId?: string | null;
	onPropose?: () => void;
	onAccept?: () => void;
	onDecline?: () => void;
	onDisable?: () => void;
	/** When keys are not ready — open phone binding flow. */
	onSetupKeys?: () => void;
}) {
	const { t } = useTranslation('gafChat');
	const value = status?.status ?? 'off';
	const ready = Boolean(status?.ready);
	const requestedByMe = Boolean(
		status?.requested_by_user_id &&
			currentUserId &&
			status.requested_by_user_id === currentUserId
	);
	const canRequest = ready && (value === 'off' || value === 'declined');
	const canAnswer = ready && value === 'pending' && !requestedByMe;
	const canDisable = value === 'active';
	const statusLabel =
		value === 'active'
			? t('e2eeStatusActive')
			: value === 'pending'
				? t('e2eeStatusPending')
				: !ready
					? t('e2eeStatusUnavailable')
					: t('e2eeStatusPlain');
	const label =
		value === 'active'
			? t('e2eeTooltipActive')
			: value === 'pending'
				? requestedByMe
					? t('e2eeTooltipPendingMine')
					: t('e2eeTooltipPendingPartner')
				: !ready
					? t('e2eeTooltipUnavailable')
					: t('e2eeTooltipPlain');
	const showStatusBadge = value === 'active' || value === 'pending' || !ready;
	const badgeTone =
		value === 'active'
			? 'bg-[rgb(var(--desktop-accent-rgb)/0.95)]'
			: value === 'pending'
				? 'bg-amber-400/90'
				: 'bg-(--desktop-text-dim)';

	return (
		<DesktopChromeTooltip content={label} placement="bottom" offsetExtra={6}>
			<section
				className={cn(
					'inline-flex min-h-8 max-w-full items-center gap-1 rounded-lg px-1.5 py-1 text-(--desktop-text-muted)',
					'motion-safe:transition-colors motion-safe:duration-200 motion-reduce:transition-none',
					DESKTOP_CHROME_FOCUS_VISIBLE,
					value === 'active'
						? 'bg-[rgb(var(--desktop-accent-rgb)/0.14)] text-[rgb(var(--desktop-fg-primary-rgb)/0.96)]'
						: null,
					className
				)}
				aria-label={statusLabel}
			>
				<span className="relative inline-flex shrink-0">
					{busy ? (
						<ArrowPathIcon
							className={cn('h-4 w-4 shrink-0 animate-spin', iconClassName)}
							strokeWidth={DESKTOP_LUCIDE.stroke}
							aria-hidden
						/>
					) : (
						<LockClosedIcon
							className={cn('h-4 w-4 shrink-0', iconClassName)}
							strokeWidth={DESKTOP_LUCIDE.stroke}
							aria-hidden
						/>
					)}
					{showStatusBadge ? (
						<span
							className={cn(
								'absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full ring-1 ring-(--desktop-surface-panel) sm:hidden',
								badgeTone
							)}
							aria-hidden
						/>
					) : null}
				</span>
				<span
					className={cn(
						'hidden max-w-32 truncate font-medium sm:inline',
						DESKTOP_TYPOGRAPHY.captionInherit
					)}
				>
					{statusLabel}
				</span>
				{canRequest && onPropose ? (
					<button
						type="button"
						className={cn(
							'rounded-md px-1.5 py-0.5 font-semibold text-[rgb(var(--desktop-fg-primary-rgb)/0.95)] hover:bg-(--desktop-surface-soft-hover) disabled:opacity-55',
							DESKTOP_TYPOGRAPHY.captionInherit
						)}
						disabled={busy}
						onClick={onPropose}
					>
						{t('e2eeActionRequest')}
					</button>
				) : null}
				{canAnswer && onAccept ? (
					<button
						type="button"
						className={cn(
							'rounded-md px-1.5 py-0.5 font-semibold text-[rgb(var(--desktop-fg-primary-rgb)/0.95)] hover:bg-(--desktop-surface-soft-hover) disabled:opacity-55',
							DESKTOP_TYPOGRAPHY.captionInherit
						)}
						disabled={busy}
						onClick={onAccept}
					>
						{t('e2eeActionAccept')}
					</button>
				) : null}
				{canAnswer && onDecline ? (
					<button
						type="button"
						className={cn(
							'rounded-md px-1.5 py-0.5 text-(--desktop-text-muted) hover:bg-(--desktop-surface-soft-hover) disabled:opacity-55',
							DESKTOP_TYPOGRAPHY.captionInherit
						)}
						disabled={busy}
						onClick={onDecline}
					>
						{t('e2eeActionDecline')}
					</button>
				) : null}
				{canDisable && onDisable ? (
					<button
						type="button"
						className={cn(
							'rounded-md px-1.5 py-0.5 text-(--desktop-text-muted) hover:bg-(--desktop-surface-soft-hover) disabled:opacity-55',
							DESKTOP_TYPOGRAPHY.captionInherit
						)}
						disabled={busy}
						onClick={onDisable}
					>
						{t('e2eeActionDisable')}
					</button>
				) : null}
				{!ready && onSetupKeys ? (
					<button
						type="button"
						className={cn(
							'rounded-md px-1.5 py-0.5 font-semibold text-[rgb(var(--desktop-fg-primary-rgb)/0.95)] hover:bg-(--desktop-surface-soft-hover) disabled:opacity-55',
							DESKTOP_TYPOGRAPHY.captionInherit
						)}
						disabled={busy}
						onClick={onSetupKeys}
					>
						{t('e2eeActionSetupKeys')}
					</button>
				) : null}
			</section>
		</DesktopChromeTooltip>
	);
}
