/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Amber local draft restore banner for the EWRP presentations tab.
 *
 * Invariants:
 * - Single UI surface (inline or sticky); copy uses draftRestore* i18n keys.
 *
 * Related:
 * - `EwrpGeneratorChunks.tsx` barrel, `documentation/product/EWRP-REVOLUTIONARY-PRESENTATIONS.md`
 */

import { cn } from '@/utils/cn';
import { useTranslation } from 'react-i18next';
import { formatEwrpLocalDraftSavedAt } from '../ewrpDraftDateFormat';

export type EwrpDraftRestoreBannerVariant = 'inline' | 'sticky';

/** Amber prompt when a local slide draft differs from the server version. */
export function EwrpDraftRestoreBanner({
	slideCount,
	savedAt,
	onRestore,
	onDismiss,
	variant = 'inline',
	secondaryBtnClass,
}: {
	slideCount: number;
	savedAt: number;
	onRestore: () => void;
	onDismiss: () => void;
	variant?: EwrpDraftRestoreBannerVariant;
	secondaryBtnClass: string;
}) {
	const { t } = useTranslation('ewrp');
	const savedAtLabel = formatEwrpLocalDraftSavedAt(savedAt);
	return (
		<div
			role="status"
			className={cn(
				'flex flex-wrap items-start justify-between gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-[11px] text-amber-100/95',
				variant === 'sticky' &&
					'sticky top-0 z-20 shrink-0 shadow-(--desktop-shadow-soft) ring-1 ring-inset ring-amber-500/15 backdrop-blur-md',
				variant === 'inline' && 'mt-3'
			)}
		>
			<div className="min-w-0 flex-1">
				<p className="font-semibold text-amber-50/95">
					{t('form.draftRestoreTitle')}
				</p>
				<p className="mt-1 leading-relaxed text-amber-100/90">
					{t('form.draftRestoreBody', {
						count: slideCount,
						date: savedAtLabel,
					})}
				</p>
			</div>
			<span className="flex shrink-0 flex-wrap gap-2">
				<button
					type="button"
					className={cn(secondaryBtnClass, 'text-[10px]')}
					onClick={onRestore}
				>
					{t('form.draftRestoreButton')}
				</button>
				<button
					type="button"
					className={cn(secondaryBtnClass, 'text-[10px]')}
					onClick={onDismiss}
				>
					{t('form.draftRestoreDismiss')}
				</button>
			</span>
		</div>
	);
}
