/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Journey Hub shell — primary tabs EliteEW | Релизы | Ещё (W2).
 *
 * Invariants:
 * - Only HUB_PRIMARY_TABS; no brochure/Appeals peers.
 * - Default tab from defaultHubTab (update → Релизы once).
 * - Tablist keeps all tabpanels in DOM (hidden when inactive) for aria-controls.
 *
 * Related:
 * - DESKTOP-CLIENT-LAUNCHER-JOURNEY.md §4–§5
 */

import type { KeyboardEvent } from 'react';
import type { HubPrimaryTab } from '../../lib/launcher/journey';
import { HUB_PRIMARY_TABS } from '../../lib/launcher/journey';
import type { EliteewTabProps } from './tabs/EliteewTab';
import { EliteewTab } from './tabs/EliteewTab';
import type { ReleasesTabProps } from './tabs/ReleasesTab';
import { ReleasesTab } from './tabs/ReleasesTab';
import type { MoreTabProps } from './tabs/MoreTab';
import { MoreTab } from './tabs/MoreTab';
import '../shell/shell.css';
import './hub.css';

const TAB_LABEL: Record<HubPrimaryTab, string> = {
	eliteew: 'EliteEW',
	releases: 'Релизы',
	more: 'Ещё…',
};

export type HubShellProps = {
	tab: HubPrimaryTab;
	onTabChange: (tab: HubPrimaryTab) => void;
	eliteew: EliteewTabProps;
	releases: ReleasesTabProps;
	more: MoreTabProps;
};

export function HubShell({
	tab,
	onTabChange,
	eliteew,
	releases,
	more,
}: HubShellProps) {
	const onTabKeyDown = (
		event: KeyboardEvent<HTMLButtonElement>,
		id: HubPrimaryTab
	) => {
		const idx = HUB_PRIMARY_TABS.indexOf(id);
		if (idx < 0) return;
		let nextIdx = idx;
		if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
			nextIdx = (idx + 1) % HUB_PRIMARY_TABS.length;
		} else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
			nextIdx = (idx - 1 + HUB_PRIMARY_TABS.length) % HUB_PRIMARY_TABS.length;
		} else if (event.key === 'Home') {
			nextIdx = 0;
		} else if (event.key === 'End') {
			nextIdx = HUB_PRIMARY_TABS.length - 1;
		} else {
			return;
		}
		event.preventDefault();
		const next = HUB_PRIMARY_TABS[nextIdx];
		onTabChange(next);
		queueMicrotask(() => {
			document.getElementById(`hub-tab-${next}`)?.focus();
		});
	};

	return (
		<section className="hub" aria-label="EliteEW Hub">
			<div className="hub-tabs" role="tablist" aria-label="Разделы">
				{HUB_PRIMARY_TABS.map((id) => (
					<button
						key={id}
						type="button"
						role="tab"
						className="hub-tab"
						id={`hub-tab-${id}`}
						aria-selected={tab === id}
						aria-controls={`hub-panel-${id}`}
						tabIndex={tab === id ? 0 : -1}
						onClick={() => onTabChange(id)}
						onKeyDown={(event) => onTabKeyDown(event, id)}
					>
						{TAB_LABEL[id]}
					</button>
				))}
			</div>
			{HUB_PRIMARY_TABS.map((id) => (
				<div
					key={id}
					className="hub-panel"
					role="tabpanel"
					id={`hub-panel-${id}`}
					aria-labelledby={`hub-tab-${id}`}
					hidden={tab !== id}
					tabIndex={tab === id ? 0 : undefined}
				>
					{tab === id && id === 'eliteew' ? (
						<EliteewTab {...eliteew} />
					) : null}
					{tab === id && id === 'releases' ? (
						<ReleasesTab {...releases} />
					) : null}
					{tab === id && id === 'more' ? <MoreTab {...more} /> : null}
				</div>
			))}
		</section>
	);
}
