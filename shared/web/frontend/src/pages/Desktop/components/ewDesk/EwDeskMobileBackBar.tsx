/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Compact mobile/narrow EWDesk chrome — back-to-list control above the detail pane.
 *
 * Invariants:
 * - Shown only when split-pane is off and a post is selected (parent gates render).
 *
 * Related:
 * - `pages/Desktop/components/EWDeskApp.tsx`
 */
import { cn } from '@/utils/cn';
import { ChevronLeftIcon } from '@heroicons/react/24/outline';
import type { TFunction } from 'i18next';
import type { ReactElement } from 'react';
import { DESKTOP_LUCIDE } from '../../constants';
import { DesktopAppButton } from '../DesktopAppChrome';

export interface EwDeskMobileBackBarProps {
	t: TFunction<'desktopUi', 'ewDesk'>;
	headerStripClass: string;
	onBack: () => void;
}

export function EwDeskMobileBackBar({
	t,
	headerStripClass,
	onBack,
}: EwDeskMobileBackBarProps): ReactElement {
	return (
		<div
			className={cn(
				'flex min-h-11 shrink-0 select-none items-center px-3 py-2',
				'border-b border-(--desktop-border-subtle)/70',
				'shadow-[inset_0_-1px_0_rgb(var(--desktop-fg-primary-rgb)/0.06)]',
				headerStripClass
			)}
		>
			<DesktopAppButton
				type="button"
				variant="ghost"
				size="sm"
				className="group gap-1.5 rounded-(--desktop-radius-lg) px-2 text-(--desktop-text-primary) hover:bg-(--desktop-surface-soft) active:scale-[0.98] motion-reduce:active:scale-100"
				aria-label={t('backToListAria')}
				onClick={onBack}
			>
				<ChevronLeftIcon
					className="h-4 w-4 shrink-0 transition-transform duration-200 motion-reduce:transition-none motion-safe:group-hover:-translate-x-px motion-safe:group-focus-visible:-translate-x-px"
					aria-hidden
					strokeWidth={DESKTOP_LUCIDE.stroke}
				/>
				{t('backToList')}
			</DesktopAppButton>
		</div>
	);
}
