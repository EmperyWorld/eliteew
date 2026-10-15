/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Standard access denial surface for POEMMA owner-only or restricted routes.
 *
 * Invariants:
 * - Preserves Russian copy contracts from caller; default title from user chrome copy.
 *
 * Related:
 * - src/features/poemma/PoemmaApp.tsx route ACL
 * - owner-only pages (finance, goal, promo, …)
 */

import { POEMMA_ACCESS_DENIED } from '../poemmaUserChromeCopy';
import { PoemmaNoticePanel } from './PoemmaNoticePanel';
import { PoemmaPageShell } from './PoemmaPageShell';

export type PoemmaAccessDeniedProps = {
	title?: string;
	description: string;
};

export function PoemmaAccessDenied({
	title = POEMMA_ACCESS_DENIED.ownerTitle,
	description,
}: PoemmaAccessDeniedProps) {
	return (
		<PoemmaPageShell>
			<PoemmaNoticePanel
				tone="warning"
				title={title}
				description={description}
			/>
		</PoemmaPageShell>
	);
}
