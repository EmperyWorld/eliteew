/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * POEMMA app top bar: user-facing title, period, optional sync hint, route navigation.
 *
 * Invariants:
 * - Sync badge only when connection/save needs attention; no «Сервер онлайн» noise.
 * - Uses desktop shell CSS variables via shared POEMMA tokens.
 *
 * Related:
 * - src/features/poemma/PoemmaApp.tsx
 * - src/features/poemma/poemmaUserChromeCopy.ts
 */

import type { ReactNode } from 'react';
import type { PoemmaPeriod } from '../poemmaDomain';
import {
	POEMMA_APP_TITLE,
	poemmaUserPeriodLabel,
	resolvePoemmaUserSyncBadge,
} from '../poemmaUserChromeCopy';
import type { PoemmaSyncStatus } from '../poemmaRepository';
import {
	PoemmaMetricBadge,
	type PoemmaMetricBadgeTone,
} from './PoemmaMetricBadge';
import { PoemmaStatusStack } from './PoemmaStatusStack';
import { PoemmaTopNavChip } from './PoemmaTopNavChip';
import {
	POEMMA_APP_SUBTITLE_CLASS,
	POEMMA_APP_TITLE_CLASS,
	POEMMA_NAV_TRACK_CLASS,
	POEMMA_TOP_BAR_CLASS,
} from './poemmaUiClasses';

export type PoemmaTopBarNavItem = {
	path: string;
	shortTitle: string;
};

export type PoemmaTopBarSession = {
	displayName: string;
	roleLabel: string;
};

export type PoemmaTopBarProps = {
	session: PoemmaTopBarSession;
	syncStatus: PoemmaSyncStatus;
	period: PoemmaPeriod | null;
	navItems: PoemmaTopBarNavItem[];
	isNavActive: (path: string) => boolean;
	onSelect: (path: string) => void;
	actions?: ReactNode;
};

export function PoemmaTopBar({
	session,
	syncStatus,
	period,
	navItems,
	isNavActive,
	onSelect,
	actions,
}: PoemmaTopBarProps) {
	const syncBadge = resolvePoemmaUserSyncBadge(syncStatus);
	const periodLabel = poemmaUserPeriodLabel(period);

	return (
		<div className={POEMMA_TOP_BAR_CLASS}>
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="min-w-0 space-y-0.5">
					<h1 className={POEMMA_APP_TITLE_CLASS}>{POEMMA_APP_TITLE}</h1>
					<p className={POEMMA_APP_SUBTITLE_CLASS}>
						{session.displayName} · {session.roleLabel}
					</p>
				</div>
				<PoemmaStatusStack>
					<PoemmaMetricBadge
						label={periodLabel}
						tone="neutral"
						variant="chip"
					/>
					{syncBadge ? (
						<PoemmaMetricBadge
							label={syncBadge.label}
							tone={syncBadge.tone as PoemmaMetricBadgeTone}
							title={syncBadge.detail ?? undefined}
							variant="chip"
						/>
					) : null}
					{actions ? <div className="flex items-center">{actions}</div> : null}
				</PoemmaStatusStack>
			</div>
			<nav
				data-poemma-guide="nav"
				className={POEMMA_NAV_TRACK_CLASS}
				aria-label="Разделы карты бизнеса"
			>
				{navItems.map((item) => (
					<PoemmaTopNavChip
						key={item.path}
						label={item.shortTitle}
						active={isNavActive(item.path)}
						onClick={() => onSelect(item.path)}
					/>
				))}
			</nav>
		</div>
	);
}
