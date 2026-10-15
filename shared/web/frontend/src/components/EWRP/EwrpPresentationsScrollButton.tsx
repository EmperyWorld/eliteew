/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared compact scroll CTA for EWRP presentations toolbar and mini status bar.
 *
 * Invariants:
 * - Icon-only below 640px with aria-label/title; full label from sm breakpoint.
 *
 * Related:
 * - `ewrpMiniStatusCompactLayout.ts`, `EWRPGeneratorMain.tsx`, `EwrpPresentationsMiniStatusBar.tsx`
 */

import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/utils/cn';
import {
	ArrowDownIcon,
	ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { EWRP_MINI_STATUS_COMPACT_MQ } from './ewrpMiniStatusCompactLayout';

const sw = 1.75;

export type EwrpPresentationsScrollButtonVariant = 'status' | 'editor';

export type EwrpPresentationsScrollButtonProps = {
	variant: EwrpPresentationsScrollButtonVariant;
	onClick: () => void;
	buttonClassName: string;
};

/** Scroll-to-status or scroll-to-editor button with responsive compact labeling. */
export function EwrpPresentationsScrollButton(
	props: EwrpPresentationsScrollButtonProps
) {
	const { variant, onClick, buttonClassName } = props;
	const { t } = useTranslation('ewrp');
	const isCompact = useMediaQuery(EWRP_MINI_STATUS_COMPACT_MQ);
	const title =
		variant === 'status'
			? t('tabs.scrollToStatusTitle')
			: t('tabs.scrollToEditorTitle');
	const label =
		variant === 'status' ? t('tabs.scrollToStatus') : t('tabs.scrollToEditor');
	const Icon = variant === 'status' ? ArrowDownIcon : ClipboardDocumentListIcon;

	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				buttonClassName,
				'gap-1.5',
				isCompact && 'min-w-8 justify-center px-2'
			)}
			title={title}
			aria-label={title}
		>
			<Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={sw} aria-hidden />
			<span className="hidden sm:inline">{label}</span>
		</button>
	);
}
