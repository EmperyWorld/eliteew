/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Workspace section scaffold: optional header, subtabs, banner, and panel body.
 *
 * Invariants:
 * - Does not own tab state; caller passes `subtabs` slot from `WorkspaceSubtabs`.
 *
 * Related:
 * - runtimePanels/*
 */

import type { ReactNode } from 'react';

import { cn } from '@/utils/cn';

import { PW_WORKSPACE_SECTION_GAP } from './professionalWorldsLayoutTokens';

export function ProfessionalWorldsWorkspaceSection({
	title,
	description,
	subtabs,
	banner,
	children,
	className,
}: {
	title?: ReactNode;
	description?: ReactNode;
	subtabs?: ReactNode;
	banner?: ReactNode;
	children: ReactNode;
	className?: string;
}) {
	return (
		<section className={cn(PW_WORKSPACE_SECTION_GAP, className)}>
			{title || description ? (
				<header className="grid gap-1 px-0.5">
					{title ? (
						<h3 className="text-sm font-semibold text-(--desktop-text-primary)">
							{title}
						</h3>
					) : null}
					{description ? (
						<p className="text-xs leading-relaxed text-(--desktop-text-secondary)">
							{description}
						</p>
					) : null}
				</header>
			) : null}
			{subtabs}
			{banner}
			{children}
		</section>
	);
}
