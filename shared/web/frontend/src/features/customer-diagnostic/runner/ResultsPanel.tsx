/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Complete-phase results shell wrapping DiagnosticResultsSection.
 *
 * Invariants:
 * - — (нет)
 *
 * Related:
 * - ../CustomerDiagnosticRunner.tsx
 */

import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';

import { DiagnosticResultsSection } from '../DiagnosticResultsSection';
import { computeAllResults } from '../diagnosticScoring';
import type { DiagnosticTranslate } from './runnerTypes';

export function ResultsPanel({
	results,
	onBackHub,
	t,
}: {
	results: ReturnType<typeof computeAllResults>;
	onBackHub: () => void;
	t: DiagnosticTranslate;
}) {
	return (
		<div
			className={cn(
				'relative overflow-hidden rounded-2xl border border-white/10 bg-white/6 p-4 backdrop-blur-[6px]',
				'sm:p-5'
			)}
		>
			<div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#34d399,#2dd4bf,#a78bfa)]" />
			<DiagnosticResultsSection results={results} t={t} />

			<div className="mt-4">
				<DesktopAppButton type="button" variant="neutral" onClick={onBackHub}>
					{t('diagnostic.backModules')}
				</DesktopAppButton>
			</div>
		</div>
	);
}
