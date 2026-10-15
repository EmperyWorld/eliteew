/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Operations entry when composer is hidden in non-chat output surface modes (plan 15 R08).
 *
 * Invariants:
 * - Rendered by parent only when ``composerVisible`` is false.
 *
 * Related:
 * - src/features/ewa/companionUx/CompanionChatMainColumn.tsx
 */

import { SparklesIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';

export type CompanionNonChatOperationsEntryProps = {
	activeOperationCount: number;
	awaitingConfirmationCount?: number;
	onOpenOperations: () => void;
};

export function CompanionNonChatOperationsEntry({
	activeOperationCount,
	awaitingConfirmationCount = 0,
	onOpenOperations,
}: CompanionNonChatOperationsEntryProps) {
	const { t } = useTranslation('marketing');
	const needsDecision = awaitingConfirmationCount > 0;
	const visibleCount = needsDecision
		? awaitingConfirmationCount
		: activeOperationCount;

	return (
		<div
			className="flex shrink-0 justify-end px-1"
			data-testid="ewa-companion-non-chat-operations-entry"
		>
			<DesktopAppButton
				type="button"
				variant="neutral"
				size="sm"
				className={cn(
					'relative gap-1.5',
					visibleCount > 0 && 'border-[rgb(var(--desktop-accent-rgb)/0.4)]',
					needsDecision && 'border-amber-300/45 text-amber-50'
				)}
				onClick={onOpenOperations}
				aria-label={
					needsDecision
						? t('ewaCompanion.nonChatOperationsDecisionAria', {
								count: awaitingConfirmationCount,
							})
						: activeOperationCount > 0
							? t('ewaCompanion.nonChatOperationsEntryAria', {
									count: activeOperationCount,
								})
							: t('ewaCompanion.nonChatOperationsEntry')
				}
			>
				<SparklesIcon className="size-3.5" aria-hidden />
				<span className="text-[11px]">
					{needsDecision
						? t('ewaCompanion.nonChatOperationsDecisionEntry', 'Нужен ответ')
						: t('ewaCompanion.nonChatOperationsEntry')}
				</span>
				{visibleCount > 0 ? (
					<span
						className={cn(
							'ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full',
							'bg-[rgb(var(--desktop-accent-rgb))] px-1 text-[9px] font-bold text-white',
							needsDecision &&
								'bg-amber-400 text-[rgb(var(--desktop-bg-primary-rgb))]'
						)}
						aria-hidden
					>
						{visibleCount > 9 ? '9+' : visibleCount}
					</span>
				) : null}
			</DesktopAppButton>
		</div>
	);
}
