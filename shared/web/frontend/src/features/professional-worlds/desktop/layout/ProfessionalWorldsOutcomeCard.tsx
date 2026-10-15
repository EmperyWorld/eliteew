/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared outcome card for Professional Worlds journeys after a save, run, handoff,
 * or partial failure.
 *
 * Invariants:
 * - Outcome copy must say what happened and what did not happen automatically.
 * - Next actions are explicit buttons/links; support detail is optional and secondary.
 *
 * Related:
 * - ProfileWorkspacePanel.tsx
 * - RealtorObjectsWorkspacePanel.tsx
 * - documentation/product/PROFESSIONAL-WORLDS.md
 * ---
 */

import type { ReactNode } from 'react';

import { DesktopProductNextAction } from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';

import { SupportDetailsPanel } from '../components/SupportDetailsPanel';
import {
	PW_TONE_LABEL_CLASS,
	type ProfessionalWorldsTone,
} from './professionalWorldsLayoutTokens';

export function ProfessionalWorldsOutcomeCard({
	title,
	description,
	tone = 'ok',
	actions,
	supportSummary,
	supportDetail,
	className,
}: {
	title: ReactNode;
	description?: ReactNode;
	tone?: ProfessionalWorldsTone;
	actions?: ReactNode;
	supportSummary?: string;
	supportDetail?: ReactNode;
	className?: string;
}) {
	return (
		<DesktopProductNextAction
			title={<span className={PW_TONE_LABEL_CLASS[tone]}>{title}</span>}
			description={description}
			actions={actions}
			className={cn(
				'border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)',
				className
			)}
		>
			{supportDetail ? (
				<SupportDetailsPanel
					summary={supportSummary}
					className="mt-2 text-left"
				>
					<div className="text-xs text-(--desktop-text-muted)">
						{supportDetail}
					</div>
				</SupportDetailsPanel>
			) : null}
		</DesktopProductNextAction>
	);
}
