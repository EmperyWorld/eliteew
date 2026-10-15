/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Prev/next match controls for in-thread search navigation.
 *
 * Invariants:
 * - Labels are passed from parent for i18n.
 *
 * Related:
 * - GAFChatApp.tsx · gafChatDesktopIconTooltip.tsx
 */

import { DESKTOP_LUCIDE } from '../../constants';
import { DesktopAppButton } from '../DesktopAppChrome';
import { GafChatDesktopIconTooltip } from './gafChatDesktopIconTooltip';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';

export function GafThreadSearchNavIcons({
	onPrev,
	onNext,
	prevLabel,
	nextLabel,
}: {
	onPrev: () => void;
	onNext: () => void;
	prevLabel: string;
	nextLabel: string;
}) {
	return (
		<>
			<GafChatDesktopIconTooltip content={prevLabel}>
				<DesktopAppButton
					type="button"
					variant="ghost"
					size="icon"
					className="h-8 w-8 shrink-0 touch-manipulation"
					aria-label={prevLabel}
					onClick={onPrev}
				>
					<ChevronUpIcon
						className="h-4 w-4"
						aria-hidden
						strokeWidth={DESKTOP_LUCIDE.stroke}
					/>
				</DesktopAppButton>
			</GafChatDesktopIconTooltip>
			<GafChatDesktopIconTooltip content={nextLabel}>
				<DesktopAppButton
					type="button"
					variant="ghost"
					size="icon"
					className="h-8 w-8 shrink-0 touch-manipulation"
					aria-label={nextLabel}
					onClick={onNext}
				>
					<ChevronDownIcon
						className="h-4 w-4"
						aria-hidden
						strokeWidth={DESKTOP_LUCIDE.stroke}
					/>
				</DesktopAppButton>
			</GafChatDesktopIconTooltip>
		</>
	);
}
