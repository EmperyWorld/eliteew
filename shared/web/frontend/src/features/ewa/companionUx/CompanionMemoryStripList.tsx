/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared memory strip list for desktop left rail and mobile «Помнит о вас» sheet (U6.3 forget).
 *
 * Invariants:
 * - Forget is offered only when ``row.forgettable`` and ``onForgetRequest`` is set.
 * - Catalog-synthesized lines have no ``content_hash`` and stay read-only.
 *
 * Related:
 * - src/features/ewa/companionLearnedUi.ts
 * - src/features/ewa/EwaCompanionChatPanel.tsx
 */

import { XMarkIcon } from '@heroicons/react/24/solid';
import { useTranslation } from 'react-i18next';

import type { CompanionMemoryStripRow } from '@/features/ewa/companionLearnedUi';
import { DESKTOP_CHROME_FOCUS_VISIBLE } from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';

export type CompanionMemoryStripListProps = {
	rows: readonly CompanionMemoryStripRow[];
	memoryRevision?: number;
	forgettingHash?: string | null;
	onForgetRequest?: (row: CompanionMemoryStripRow) => void;
	className?: string;
	itemClassName?: string;
};

function memoryRowDomKey(
	row: CompanionMemoryStripRow,
	revision: number
): string {
	return `mem-${revision}-${row.key}`;
}

export function CompanionMemoryStripList({
	rows,
	memoryRevision = 0,
	forgettingHash = null,
	onForgetRequest,
	className,
	itemClassName,
}: CompanionMemoryStripListProps) {
	const { t } = useTranslation('marketing');

	return (
		<ul
			className={cn(
				'space-y-1 overflow-y-auto overscroll-y-contain text-[12px] leading-snug',
				className
			)}
			aria-label={t('ewaCompanion.memoryStripTitle')}
		>
			{rows.map((row) => {
				const forgetBusy =
					row.contentHash !== null && forgettingHash === row.contentHash;
				const forgettable =
					row.forgettable && row.contentHash !== null && onForgetRequest;
				return (
					<li
						key={memoryRowDomKey(row, memoryRevision)}
						className={cn(
							'group flex items-start gap-1 text-(--desktop-text-secondary)',
							itemClassName
						)}
					>
						<span className="shrink-0 text-(--companion-text-soft)">
							{'\u2022 '}
						</span>
						<span className="min-w-0 flex-1">{row.label}</span>
						{forgettable ? (
							<button
								type="button"
								disabled={forgetBusy}
								className={cn(
									'-mr-0.5 inline-flex shrink-0 items-center justify-center rounded p-0.5',
									'text-(--companion-text-soft) opacity-70',
									'hover:bg-rose-500/10 hover:text-rose-200 hover:opacity-100',
									'group-hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100',
									DESKTOP_CHROME_FOCUS_VISIBLE,
									forgetBusy && 'cursor-wait opacity-50'
								)}
								aria-label={t('ewaCompanion.memoryForgetAria', {
									label: row.label,
								})}
								onClick={() => onForgetRequest?.(row)}
							>
								<XMarkIcon className="size-3.5" aria-hidden />
							</button>
						) : null}
					</li>
				);
			})}
		</ul>
	);
}
