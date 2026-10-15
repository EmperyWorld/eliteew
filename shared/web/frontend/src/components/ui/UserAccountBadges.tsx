import { cn } from '@/utils/cn';

import { AdminCustomBadge } from './AdminCustomBadge';
import { SystemAccountBadge } from './SystemAccountBadge';
import { TrustedUserBadge } from './TrustedUserBadge';

/** Доверенный + админский значок + системный (порядок фиксирован). */
export function UserAccountBadges({
	isTrusted,
	adminBadgeLabel,
	adminBadgeHint,
	isSystemAccount,
	className,
}: {
	isTrusted?: boolean;
	adminBadgeLabel?: string | null;
	adminBadgeHint?: string | null;
	isSystemAccount?: boolean;
	className?: string;
}) {
	const label = adminBadgeLabel?.trim();
	return (
		<span className={cn('inline-flex flex-wrap items-center gap-1', className)}>
			{isTrusted ? <TrustedUserBadge className="shrink-0" /> : null}
			{label ? (
				<AdminCustomBadge label={label} title={adminBadgeHint ?? undefined} />
			) : null}
			{isSystemAccount ? <SystemAccountBadge className="shrink-0" /> : null}
		</span>
	);
}
