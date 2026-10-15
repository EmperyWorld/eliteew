/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Standard loading/error state wrappers for POEMMA pages using DesktopProductStatePanel.
 *
 * Invariants:
 * - Explicit states only; no silent null returns while data loads.
 *
 * Related:
 * - src/features/poemma/PoemmaApp.tsx
 */

import type { ReactNode } from 'react';
import { DesktopProductStatePanel } from '@/pages/Desktop/components/DesktopAppChrome';
import { PoemmaPageShell } from './PoemmaPageShell';

export type PoemmaPageLoadingProps = {
	title: string;
	description: string;
};

export function PoemmaPageLoading({
	title,
	description,
}: PoemmaPageLoadingProps) {
	return (
		<PoemmaPageShell>
			<DesktopProductStatePanel
				state="loading"
				title={title}
				description={description}
			/>
		</PoemmaPageShell>
	);
}

export type PoemmaPageErrorProps = {
	title: string;
	description: string;
	actions?: ReactNode;
};

export function PoemmaPageError({
	title,
	description,
	actions,
}: PoemmaPageErrorProps) {
	return (
		<PoemmaPageShell>
			<DesktopProductStatePanel
				state="error"
				title={title}
				description={description}
				actions={actions}
			/>
		</PoemmaPageShell>
	);
}
