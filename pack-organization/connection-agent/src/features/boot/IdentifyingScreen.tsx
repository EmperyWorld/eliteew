/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Journey Phase A — Identifying preloader until full native boot resolve.
 *
 * Invariants:
 * - No activation drop-zone; no Hub / StepRail chrome.
 * - aria-busy while preparing; honest retry on boot_error.
 * - Respects prefers-reduced-motion (CSS).
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-CLIENT-LAUNCHER-JOURNEY.md §3
 * - lib/launcher/journey/journeyPhase.ts
 */

import './identifying.css';

type IdentifyingScreenProps = {
	failed: boolean;
	detail?: string;
	onRetry?: () => void;
};

export function IdentifyingScreen({
	failed,
	detail,
	onRetry,
}: IdentifyingScreenProps) {
	return (
		<section
			className="identifying"
			data-state={failed ? 'error' : 'busy'}
			aria-busy={!failed}
			aria-live="polite"
		>
			<div className="identifying-mark" aria-hidden="true">
				<img src="/brand-mark.png" alt="" width={88} height={88} />
			</div>
			<h1 className="identifying-title">EliteEW</h1>
			{failed ? (
				<>
					<p className="identifying-lead">
						{detail?.trim() ||
							'Не удалось подготовить EliteEW на этом устройстве.'}
					</p>
					{onRetry ? (
						<button type="button" className="cta" onClick={onRetry}>
							Повторить
						</button>
					) : null}
				</>
			) : (
				<p className="identifying-lead">Подготавливаем EliteEW…</p>
			)}
		</section>
	);
}
