/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure class-name builder for the Assistant FAQ aside shell layout.
 *
 * Invariants:
 * - Mobile embedded layout uses full-width capped height; desktop uses md sidebar width.
 *
 * Related:
 * - pages/Desktop/components/assistant/AssistantFaqPanel.tsx
 * - pages/Desktop/components/AssistantApp.tsx
 */
import { cn } from '@/utils/cn';
import type { DesktopWindowStyle } from '../../types';
import { DESKTOP_SURFACE } from '../../constants';
import { getDesktopShellContentPanelClassName } from '../../utils/desktopVisualSystem';
import { ASSISTANT_FAQ_ASIDE_SEARCH_ACTIVE_CLASS } from './assistantFaqPanelStyles';

export type BuildAssistantFaqAsideClassNameInput = {
	shellFrame: DesktopWindowStyle;
	embeddedMobileLayout: boolean;
	faqSearch: string;
	faqSearchFocused: boolean;
};

export function buildAssistantFaqAsideClassName(
	input: BuildAssistantFaqAsideClassNameInput
): string {
	const { shellFrame, embeddedMobileLayout, faqSearch, faqSearchFocused } =
		input;
	return cn(
		'shrink-0 border-b border-(--desktop-border-subtle) overflow-y-auto',
		embeddedMobileLayout
			? 'w-full max-h-[min(42dvh,20rem)] border-r-0 shadow-none mobile-handbook-faq-open'
			: cn(
					'md:w-[min(100%,14rem)] md:border-b-0 md:border-r max-h-[36vh] md:max-h-none',
					'md:shadow-[inset_-1px_0_0_0_color-mix(in_srgb,var(--desktop-border-subtle)_65%,transparent)]'
				),
		DESKTOP_SURFACE.spacingMd,
		'p-2.5',
		'bg-[color-mix(in_srgb,var(--desktop-surface-panel)_58%,transparent)]',
		(faqSearch.trim() || faqSearchFocused) &&
			ASSISTANT_FAQ_ASIDE_SEARCH_ACTIVE_CLASS,
		getDesktopShellContentPanelClassName(shellFrame)
	);
}
