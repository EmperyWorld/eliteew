/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Confirm/cancel bar for task runs awaiting confirmation (Phase 3 HTTP confirm).
 *
 * Related:
 * - src/features/ewa/CompanionOperationRunCard.tsx
 */

import { useTranslation } from 'react-i18next';

import { DESKTOP_CHROME_FOCUS_VISIBLE } from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';

export type CompanionConfirmBarProps = {
	runId: string;
	busy?: boolean;
	onConfirm: (runId: string, decision: 'confirm' | 'cancel') => void;
};

export function CompanionConfirmBar({
	runId,
	busy = false,
	onConfirm,
}: CompanionConfirmBarProps) {
	const { t } = useTranslation('marketing');
	return (
		<div className="mt-1.5 flex flex-wrap gap-1">
			<button
				type="button"
				disabled={busy}
				className={cn(
					'rounded-md border border-emerald-500/50 px-2 py-1 text-[11px]',
					'bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20',
					busy && 'opacity-60',
					DESKTOP_CHROME_FOCUS_VISIBLE
				)}
				onClick={() => onConfirm(runId, 'confirm')}
			>
				{t('ewaCompanion.operationConfirm')}
			</button>
			<button
				type="button"
				disabled={busy}
				className={cn(
					'rounded-md border border-(--companion-divider) px-2 py-1 text-[11px]',
					'text-(--desktop-text-primary) hover:bg-(--companion-bg)',
					busy && 'opacity-60',
					DESKTOP_CHROME_FOCUS_VISIBLE
				)}
				onClick={() => onConfirm(runId, 'cancel')}
			>
				{t('ewaCompanion.operationCancel')}
			</button>
		</div>
	);
}
