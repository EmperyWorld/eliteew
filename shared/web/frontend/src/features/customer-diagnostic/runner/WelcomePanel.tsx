/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Welcome phase UI for the customer diagnostic runner.
 *
 * Invariants:
 * - — (нет)
 *
 * Related:
 * - ../CustomerDiagnosticRunner.tsx
 */

import { useTranslation } from 'react-i18next';

import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';

import { DIAGNOSTIC_MODULE_ORDER } from '../diagnosticDefinition';

export function WelcomePanel({ onStart }: { onStart: () => void }) {
	const { t } = useTranslation('customerCabinet');
	return (
		<div
			className={cn(
				'relative overflow-hidden rounded-2xl border border-white/10 bg-white/6 p-5',
				'backdrop-blur-[6px]'
			)}
		>
			<div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#f97316,#a855f7,#14b8a6)]" />
			<p className="mb-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-(--desktop-text-secondary)">
				{t('diagnostic.welcomeKicker')}
			</p>
			<h2 className="mb-2 font-(family-name:--font-display,ui-serif,Georgia,serif) text-xl font-semibold leading-tight text-(--desktop-text-primary) sm:text-2xl">
				<span className="bg-[linear-gradient(90deg,#5eead4,#a78bfa,#fb923c)] bg-clip-text text-transparent">
					{t('diagnostic.welcomeTitle')}
				</span>
			</h2>
			<p className="mb-4 text-sm leading-relaxed text-(--desktop-text-secondary)">
				{t('diagnostic.welcomeBody')}
			</p>
			<div className="mb-4 grid grid-cols-3 gap-2 text-center">
				<div className="rounded-xl bg-white/6 px-2 py-2">
					<span className="block text-lg font-bold text-teal-300 tabular-nums">
						{DIAGNOSTIC_MODULE_ORDER.length}
					</span>
					<span className="text-[0.65rem] font-medium uppercase tracking-wide text-(--desktop-text-secondary)">
						{t('diagnostic.welcomeStatModules')}
					</span>
				</div>
				<div className="rounded-xl bg-white/6 px-2 py-2">
					<span className="block text-lg font-bold text-violet-300 tabular-nums">
						∞
					</span>
					<span className="text-[0.65rem] font-medium uppercase tracking-wide text-(--desktop-text-secondary)">
						{t('diagnostic.welcomeStatPause')}
					</span>
				</div>
				<div className="rounded-xl bg-white/6 px-2 py-2">
					<span className="block text-lg font-bold text-orange-300 tabular-nums">
						%
					</span>
					<span className="text-[0.65rem] font-medium uppercase tracking-wide text-(--desktop-text-secondary)">
						{t('diagnostic.welcomeStatAuto')}
					</span>
				</div>
			</div>
			<DesktopAppButton type="button" variant="accent" onClick={onStart}>
				{t('diagnostic.start')}
			</DesktopAppButton>
		</div>
	);
}
