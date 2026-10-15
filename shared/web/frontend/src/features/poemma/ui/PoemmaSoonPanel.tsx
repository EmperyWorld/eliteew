/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Placeholder panel for POEMMA routes not yet implemented in the current wave.
 *
 * Invariants:
 * - Title and body come from route registry; no fake feature promises.
 *
 * Related:
 * - src/features/poemma/PoemmaApp.tsx PoemmaSoonPlaceholder
 */

import { PoemmaEyebrowLabel } from './PoemmaEyebrowLabel';
import { PoemmaPagePanel } from './PoemmaPagePanel';
import { PoemmaPageShell } from './PoemmaPageShell';
import { POEMMA_DISPLAY_TITLE_CLASS } from './poemmaUiClasses';

export type PoemmaSoonPanelProps = {
	title: string;
	description: string;
};

export function PoemmaSoonPanel({ title, description }: PoemmaSoonPanelProps) {
	return (
		<PoemmaPageShell>
			<PoemmaPagePanel>
				<PoemmaEyebrowLabel>Скоро</PoemmaEyebrowLabel>
				<h2 className={POEMMA_DISPLAY_TITLE_CLASS}>{title}</h2>
				<p className="mt-3 text-base leading-7 text-(--desktop-text-secondary)">
					{description}
				</p>
			</PoemmaPagePanel>
		</PoemmaPageShell>
	);
}
