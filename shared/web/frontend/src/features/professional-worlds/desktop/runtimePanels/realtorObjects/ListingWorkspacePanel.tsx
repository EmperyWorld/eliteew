/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Composes listing workspace edit, AI, and media sections for the active property.
 *
 * Invariants:
 * - Rendered only when a listing is selected on the listingWorkspace tab.
 *
 * Related:
 * - RealtorObjectsWorkspaceShell.tsx
 */

import { ListingWorkspaceAiPanel } from './ListingWorkspaceAiPanel';
import { ListingWorkspaceEditPanel } from './ListingWorkspaceEditPanel';
import { ListingWorkspaceMediaPanel } from './ListingWorkspaceMediaPanel';

export function ListingWorkspacePanel() {
	return (
		<div className="grid gap-3">
			<ListingWorkspaceEditPanel />
			<ListingWorkspaceAiPanel />
			<ListingWorkspaceMediaPanel />
		</div>
	);
}
