/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Static (no motion) chip showing web search is armed for the next send only.
 *
 * Invariants:
 * - One click clears the arm; does not animate.
 *
 * Related:
 * - components/DesktopAiChatComposer.tsx, DesktopAiChatSettingsRail.tsx
 */
import type { TFunction } from 'i18next';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { DESKTOP_TYPOGRAPHY } from '../../../pages/Desktop/constants';
import { cn } from '@/utils/cn';

export type DesktopAiWebSearchArmChipProps = {
	onDisarm: () => void;
	lucideStroke: number;
	t: TFunction<'desktopAiChat'>;
};

export function DesktopAiWebSearchArmChip({
	onDisarm,
	lucideStroke,
	t,
}: DesktopAiWebSearchArmChipProps) {
	return (
		<div
			className={cn(
				'flex items-center justify-between gap-2 rounded-md border border-[rgb(var(--desktop-accent-rgb)/0.4)] bg-[rgb(var(--desktop-accent-rgb)/0.1)] px-2 py-1',
				DESKTOP_TYPOGRAPHY.shellMeta10
			)}
			role="status"
			data-testid="desktop-ai-web-search-arm"
		>
			<span className="min-w-0 font-medium text-[rgb(var(--desktop-accent-rgb)/0.95)]">
				{t('webSearchArmChip')}
			</span>
			<button
				type="button"
				onClick={onDisarm}
				className="inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-(--desktop-text-secondary) hover:bg-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.08)_100%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.45)]"
				aria-label={t('webSearchArmDisarmAria')}
			>
				<span className="underline-offset-2">{t('webSearchArmDisarm')}</span>
				<XMarkIcon
					className="h-3.5 w-3.5"
					aria-hidden
					strokeWidth={lucideStroke}
				/>
			</button>
		</div>
	);
}
