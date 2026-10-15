/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave F2 thin Document | Совещание flip for joint/expert/plain team answers
 * that carry `council_transcript` (shared chrome outside blueprint tabs).
 *
 * Invariants:
 * - Document pane is the caller's content; Process never replaces final markdown.
 * - While live streaming with turns, default tab is Совещание.
 *
 * Related:
 * - DesktopAiCouncilProcessPanel.tsx
 * - DesktopAiChatMessageRow.tsx
 */
import * as React from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/utils/cn';

import type { DesktopCouncilTranscript } from '../ensemble/types';
import { DesktopAiCouncilProcessPanel } from './DesktopAiCouncilProcessPanel';

type CouncilShellTab = 'document' | 'council';

export function DesktopAiCouncilTabsShell({
	transcript,
	live = false,
	documentPane,
	activeSpeakerId = null,
}: {
	transcript: DesktopCouncilTranscript;
	live?: boolean;
	documentPane: React.ReactNode;
	activeSpeakerId?: string | null;
}) {
	const { t } = useTranslation('desktopAiChat');
	const hasTurns =
		transcript.turns.some((turn) => turn.kind !== 'orchestrator_brief') ||
		(live && activeSpeakerId);
	const [tab, setTab] = React.useState<CouncilShellTab>(() =>
		live && hasTurns ? 'council' : 'document'
	);

	React.useEffect(() => {
		if (live && hasTurns) {
			setTab('council');
		}
	}, [live, hasTurns]);

	const tabClass = (id: CouncilShellTab) =>
		cn(
			'rounded-md border px-2 py-1 text-[0.68rem] font-semibold uppercase tracking-wide transition-colors',
			tab === id
				? 'border-[rgb(var(--desktop-accent-rgb)/0.45)] bg-[rgb(var(--desktop-accent-rgb)/0.16)] text-(--desktop-text-primary)'
				: 'border-(--desktop-border-subtle) bg-transparent text-(--desktop-text-muted) hover:text-(--desktop-text-primary)'
		);

	return (
		<section className="space-y-2.5">
			<nav className="flex flex-wrap gap-1.5" aria-label={t('councilTabsAria')}>
				<button
					type="button"
					className={tabClass('document')}
					onClick={() => setTab('document')}
				>
					{t('blueprintTabDocument')}
				</button>
				<button
					type="button"
					className={tabClass('council')}
					onClick={() => setTab('council')}
				>
					{t('councilTabProcess')}
				</button>
			</nav>
			{tab === 'document' ? documentPane : null}
			{tab === 'council' ? (
				<DesktopAiCouncilProcessPanel
					transcript={transcript}
					live={live}
					activeSpeakerId={activeSpeakerId}
				/>
			) : null}
		</section>
	);
}
