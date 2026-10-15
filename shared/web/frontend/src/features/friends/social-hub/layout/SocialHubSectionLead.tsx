/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * In-section title block for Social Hub panels (privacy, mobile, people sub-views).
 *
 * Invariants:
 * - Calm copy only; no marketing badges or gradient heroes.
 *
 * Related:
 * - sections/SocialHubPeopleSection.tsx
 * - ../../components/SocialHubPrivacyPreviewPanel.tsx
 */

import type { ReactNode } from 'react';

import { cn } from '@/utils/cn';

import {
	SH_SECTION_LEAD_DESC_CLASS,
	SH_SECTION_LEAD_TITLE_CLASS,
	SH_SECTION_LEAD_WRAP_CLASS,
} from './socialHubLayoutTokens';

export function SocialHubSectionLead({
	title,
	description,
	actions,
	className,
}: {
	title: ReactNode;
	description?: ReactNode;
	actions?: ReactNode;
	className?: string;
}): JSX.Element {
	return (
		<div className={cn(SH_SECTION_LEAD_WRAP_CLASS, className)}>
			<div className="min-w-0 space-y-1.5">
				<h2 className={SH_SECTION_LEAD_TITLE_CLASS}>{title}</h2>
				{description ? (
					<p className={SH_SECTION_LEAD_DESC_CLASS}>{description}</p>
				) : null}
			</div>
			{actions ? (
				<div className="flex shrink-0 flex-wrap items-center gap-2">
					{actions}
				</div>
			) : null}
		</div>
	);
}
