/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Centered wizard panel shell: step indicator, body, and footer action row.
 *
 * Invariants:
 * - Does not own validation; pages supply step content and footer actions.
 *
 * Related:
 * - src/features/poemma/onboarding/PoemmaOnboarding.tsx
 * - src/features/poemma/guide/PoemmaGuidePage.tsx
 */

import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';
import { PoemmaPagePanel } from './PoemmaPagePanel';
import { POEMMA_WIZARD_FOOTER_CLASS } from './poemmaUiClasses';

export type PoemmaWizardFrameProps = {
	stepIndicator?: ReactNode;
	progressLabel?: string;
	children: ReactNode;
	footer?: ReactNode;
	className?: string;
	panelClassName?: string;
};

export function PoemmaWizardFrame({
	stepIndicator,
	progressLabel,
	children,
	footer,
	className,
	panelClassName,
}: PoemmaWizardFrameProps) {
	return (
		<div className={cn('grid min-h-full w-full p-4 sm:p-6', className)}>
			<PoemmaPagePanel className={panelClassName}>
				<div className="space-y-6">
					{stepIndicator || progressLabel ? (
						<div className="space-y-3 text-center">
							{stepIndicator}
							{progressLabel ? (
								<p className="text-sm font-semibold text-(--desktop-text-secondary)">
									{progressLabel}
								</p>
							) : null}
						</div>
					) : null}
					{children}
					{footer ? (
						<div className={POEMMA_WIZARD_FOOTER_CLASS}>{footer}</div>
					) : null}
				</div>
			</PoemmaPagePanel>
		</div>
	);
}
