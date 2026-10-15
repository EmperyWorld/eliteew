/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Primary CTA «Пройти интервью» for a prep card (blueprint chrome or freeform).
 *
 * Invariants:
 * - Never auto-starts Discussion; click only.
 * - Busy state disables the control without hiding it.
 *
 * Related:
 * - ./interviewHandoff.ts
 * - ../DesktopAiBlueprintArtifactBubble.tsx
 */
import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
import type { TFunction } from 'i18next';

import { DESKTOP_INTERACTIVE } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';

import { DesktopAiChatIconTooltip } from '../components/desktopAiChatIconTooltip';

export function DesktopAiInterviewHandoffStartButton({
	busy = false,
	onClick,
	t,
	className,
}: {
	busy?: boolean;
	onClick: () => void;
	t: TFunction<'desktopAiChat'>;
	className?: string;
}) {
	return (
		<DesktopAiChatIconTooltip content={t('interviewTakeHint')}>
			<button
				type="button"
				className={cn(
					'inline-flex items-center gap-1 rounded-md border border-[rgb(var(--desktop-accent-rgb)/0.35)] bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb)/0.16)_100%,transparent)] px-2 py-1 text-[0.68rem] font-semibold text-(--desktop-text-primary) transition-colors',
					'hover:bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb)/0.24)_100%,transparent)]',
					'disabled:cursor-not-allowed disabled:opacity-55',
					DESKTOP_INTERACTIVE,
					className
				)}
				onClick={onClick}
				disabled={busy}
				aria-label={t('interviewTakeAria')}
			>
				<ChatBubbleLeftRightIcon className="h-3.5 w-3.5" aria-hidden />
				<span>{busy ? t('interviewTakeBusy') : t('interviewTakeCta')}</span>
			</button>
		</DesktopAiChatIconTooltip>
	);
}
