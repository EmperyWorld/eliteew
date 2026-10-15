/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Above-the-fold hero/context strip for Desktop AI Chat when the user needs
 * orientation before the thread (no chat selected, first-run sidebar).
 *
 * Invariants:
 * - Copy is passed from desktopAiChat i18n; one primary action above the fold.
 *
 * Related:
 * - layout/desktopAiChatLayoutTokens.ts, DesktopAppChrome.tsx
 * - features/professional-worlds/desktop/layout/ProfessionalWorldsVisiblePrimitives.tsx
 */

import type { ReactNode } from 'react';

import { cn } from '@/utils/cn';

import { DESKTOP_AI_CHAT_WORKSPACE_HERO_CLASS } from './desktopAiChatLayoutTokens';

export function DesktopAiChatWorkspaceHero({
	eyebrow,
	title,
	description,
	primaryAction,
	secondaryAction,
	className,
}: {
	eyebrow: ReactNode;
	title: ReactNode;
	description?: ReactNode;
	primaryAction?: ReactNode;
	secondaryAction?: ReactNode;
	className?: string;
}) {
	return (
		<section
			className={cn(
				DESKTOP_AI_CHAT_WORKSPACE_HERO_CLASS,
				'mx-auto w-full max-w-lg text-center',
				className
			)}
		>
			<p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-(--desktop-text-muted)">
				{eyebrow}
			</p>
			<h2 className="mt-2 text-lg font-semibold leading-tight text-(--desktop-text-primary)">
				{title}
			</h2>
			{description ? (
				<p className="mt-2 text-sm leading-6 text-(--desktop-text-secondary)">
					{description}
				</p>
			) : null}
			{primaryAction || secondaryAction ? (
				<div className="mt-4 flex flex-wrap items-center justify-center gap-2">
					{primaryAction}
					{secondaryAction}
				</div>
			) : null}
		</section>
	);
}
