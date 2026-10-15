/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Subtle indicator when companion window is not foreground (plan 15 R16).
 *
 * Invariants:
 * - Shown only when ``isDesktopWindowActive`` is false on desktop layout.
 *
 * Related:
 * - src/features/ewa/companionUx/CompanionChatPanelRoot.tsx
 */

import { useTranslation } from 'react-i18next';

import { cn } from '@/utils/cn';

export type CompanionPanelBackgroundHintProps = {
	visible: boolean;
	mobileEmbeddedLayout: boolean;
};

export function CompanionPanelBackgroundHint({
	visible,
	mobileEmbeddedLayout,
}: CompanionPanelBackgroundHintProps) {
	const { t } = useTranslation('marketing');

	if (!visible || mobileEmbeddedLayout) return null;

	return (
		<div
			className={cn(
				'pointer-events-none absolute inset-x-3 top-2 z-30 flex justify-center',
				'motion-safe:animate-in motion-safe:fade-in motion-reduce:animate-none'
			)}
			data-testid="ewa-companion-panel-background-hint"
			role="status"
			aria-live="polite"
		>
			<span
				className={cn(
					'rounded-full border border-white/12 bg-black/45 px-2.5 py-1',
					'text-[10px] font-medium text-(--companion-text-soft) backdrop-blur-sm',
					'motion-reduce:backdrop-blur-none'
				)}
			>
				{t('ewaCompanion.panelBackgroundHint')}
			</span>
		</div>
	);
}
